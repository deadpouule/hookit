// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "./base/BaseHook.sol";
import {Owned} from "./base/Owned.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {
    BeforeSwapDelta,
    BeforeSwapDeltaLibrary,
    toBeforeSwapDelta
} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams, ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {SafeCast} from "@uniswap/v4-core/src/libraries/SafeCast.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

interface IERC20Supply {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

import {IMasterLaunchHook} from "./interfaces/IMasterLaunchHook.sol";
import {ILaunchToken} from "./interfaces/ILaunchToken.sol";
import {BitmaskConfig} from "./libraries/BitmaskConfig.sol";
import {DynamicFeeMath} from "./libraries/DynamicFeeMath.sol";
import {FixedPointMath} from "./libraries/FixedPointMath.sol";
import {ProtocolConstants} from "./libraries/ProtocolConstants.sol";
import {CurrencySettler} from "./libraries/CurrencySettler.sol";
import {FeeEscrow} from "./FeeEscrow.sol";
import {FloorVault} from "./FloorVault.sol";
import {HolderAirdropVault} from "./HolderAirdropVault.sol";
import {ProtocolRevenueDistributor} from "./ProtocolRevenueDistributor.sol";
import {BuybackVault} from "./BuybackVault.sol";

/// @title MasterLaunchHook
/// @notice Singleton Uniswap v4 hook: quote-only fees, anti-rug LP lock, anti-snipe, anti-MEV,
///         backed floor, auto-burn (buyback + burn), LP donate, and holder quote airdrops.
contract MasterLaunchHook is BaseHook, Owned, IMasterLaunchHook {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;
    using SafeCast for uint256;
    using CurrencySettler for Currency;
    using BitmaskConfig for uint256;

    uint160 public constant HOOK_FLAGS = uint160(
        Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
            | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
    );

    address public override factory;
    FloorVault public immutable vault;
    FeeEscrow public immutable escrow;
    ProtocolRevenueDistributor public immutable distributor;
    BuybackVault public immutable buybacks;
    HolderAirdropVault public immutable airdropVault;

    mapping(PoolId => uint256) public override configs;
    mapping(PoolId => uint256) public dynamicFeeWindows;
    mapping(PoolId => LaunchState) private _launchState;
    mapping(PoolId => mapping(address => uint256)) public lastSwapPacked;
    mapping(PoolId => uint256) public pendingAutoBurn;
    mapping(PoolId => uint256) public pendingLpDonate;

    bytes32 private constant FEE_ACTION_SLOT = keccak256("hookit.feeAction");

    event FactorySet(address indexed factory);
    event LaunchPrepared(PoolId indexed poolId, address indexed creator, address indexed token, uint256 bitmask);
    event FeesDistributed(
        PoolId indexed poolId,
        uint256 creatorAmount,
        uint256 protocolAmount,
        uint256 floorAmount,
        uint256 buybackAmount,
        uint256 autoBurnAmount,
        uint256 lpDonateAmount,
        uint256 holderAirdropAmount
    );
    event FloorFill(PoolId indexed poolId, uint256 tokenIn, uint256 quoteOut);
    event AutoBurn(PoolId indexed poolId, uint256 quoteIn, uint256 tokenBurned);
    event LpDonated(PoolId indexed poolId, uint256 quoteAmount);

    error OnlyFactory();
    error AlreadyPrepared();
    error NotPrepared();
    error LaunchPositionLocked();
    error SandwichBlocked();
    error MaxTxExceeded();
    error MaxWalletExceeded();
    error HookDataRequired();
    error UnknownPool();

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    constructor(
        IPoolManager _poolManager,
        FloorVault _vault,
        FeeEscrow _escrow,
        ProtocolRevenueDistributor _distributor,
        BuybackVault _buybacks,
        HolderAirdropVault _airdropVault,
        address owner_
    ) BaseHook(_poolManager) Owned(owner_) {
        vault = _vault;
        escrow = _escrow;
        distributor = _distributor;
        buybacks = _buybacks;
        airdropVault = _airdropVault;
    }

    receive() external payable {}

    function setFactory(address factory_) external onlyOwner {
        factory = factory_;
        emit FactorySet(factory_);
    }

    function floorVault() external view returns (address) {
        return address(vault);
    }

    function feeEscrow() external view returns (address) {
        return address(escrow);
    }

    function revenueDistributor() external view returns (address) {
        return address(distributor);
    }

    function buybackVault() external view returns (address) {
        return address(buybacks);
    }

    function holderAirdropVault() external view returns (address) {
        return address(airdropVault);
    }

    function launchState(PoolId poolId) external view returns (LaunchState memory) {
        return _launchState[poolId];
    }

    /// @notice Rolling-window volume and live hook tax for dynamic-fee pools.
    function dynamicFeeSnapshot(PoolId poolId)
        external
        view
        returns (uint64 windowStart, uint256 windowVolume, uint16 currentHookTaxBps)
    {
        uint256 packed = configs[poolId];
        uint256 windowPacked = dynamicFeeWindows[poolId];
        windowStart = DynamicFeeMath.windowStart(windowPacked);
        windowVolume = DynamicFeeMath.windowVolume(windowPacked);
        currentHookTaxBps = DynamicFeeMath.effectiveHookTaxBps(packed, windowVolume);
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: false,
            beforeAddLiquidity: true,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: true,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: true,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function prepareLaunch(PrepareParams calldata params) external onlyFactory {
        PoolId id = params.key.toId();
        if (_launchState[id].creator != address(0)) revert AlreadyPrepared();

        configs[id] = params.bitmask;
        _launchState[id] = LaunchState({
            creator: params.creator,
            token: params.token,
            quote: params.tokenIsCurrency0 ? params.key.currency1 : params.key.currency0,
            launchTimestamp: 0,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            tokenIsCurrency0: params.tokenIsCurrency0,
            initialized: false
        });
        emit LaunchPrepared(id, params.creator, params.token, params.bitmask);
    }

    function _beforeInitialize(address sender, PoolKey calldata key, uint160) internal override returns (bytes4) {
        PoolId id = key.toId();
        LaunchState storage st = _launchState[id];
        if (st.creator == address(0)) revert NotPrepared();
        if (sender != factory) revert OnlyFactory();
        st.launchTimestamp = uint64(block.timestamp);
        st.initialized = true;
        if (configs[id].enabled(BitmaskConfig.BACKED_FLOOR_ENABLED)) {
            vault.setQuote(st.token, st.quote);
        }
        if (configs[id].enabled(BitmaskConfig.HOLDER_AIRDROP_ENABLED)) {
            airdropVault.setExcluded(st.token, address(poolManager), true);
            airdropVault.setExcluded(st.token, address(this), true);
            airdropVault.setExcluded(st.token, address(vault), true);
            airdropVault.setExcluded(st.token, address(airdropVault), true);
            airdropVault.setExcluded(st.token, address(escrow), true);
            airdropVault.setExcluded(st.token, address(buybacks), true);
            airdropVault.setExcluded(st.token, address(0), true);
        }
        return this.beforeInitialize.selector;
    }

    function _beforeAddLiquidity(address, PoolKey calldata key, ModifyLiquidityParams calldata, bytes calldata)
        internal
        view
        override
        returns (bytes4)
    {
        if (!_launchState[key.toId()].initialized) revert UnknownPool();
        return this.beforeAddLiquidity.selector;
    }

    function _beforeRemoveLiquidity(
        address,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata
    ) internal view override returns (bytes4) {
        LaunchState storage st = _launchState[key.toId()];
        if (!st.initialized) revert UnknownPool();
        if (params.liquidityDelta < 0 && params.tickLower == st.tickLower && params.tickUpper == st.tickUpper) {
            revert LaunchPositionLocked();
        }
        return this.beforeRemoveLiquidity.selector;
    }

    function _beforeSwap(address, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        PoolId id = key.toId();
        if (_inFeeAction()) {
            return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }
        LaunchState storage st = _launchState[id];
        if (!st.initialized) revert UnknownPool();

        uint256 packed = configs[id];
        bool tokenIs0 = st.tokenIsCurrency0;
        bool isBuy = tokenIs0 ? !params.zeroForOne : params.zeroForOne;
        bool exactInput = params.amountSpecified < 0;

        _antiMev(id, packed, isBuy);

        uint256 specifiedAbs = exactInput ? uint256(-params.amountSpecified) : uint256(params.amountSpecified);

        uint256 windowPacked = dynamicFeeWindows[id];
        uint256 volumeBefore = DynamicFeeMath.windowVolume(windowPacked);
        uint16 effectiveHookTax = DynamicFeeMath.effectiveHookTaxBps(packed, volumeBefore);

        if (packed.enabled(BitmaskConfig.MAX_TX_ENABLED)) {
            _checkMaxTx(st.token, packed.maxTxBps(), specifiedAbs, isBuy, exactInput);
        }

        (uint160 sqrtPriceX96,, uint128 liquidity,) = poolManager.getSlot0(id);

        uint16 snipeBps;
        if (isBuy && packed.enabled(BitmaskConfig.ANTI_SNIPE_ENABLED)) {
            snipeBps = FixedPointMath.snipeTaxBps(
                packed.initialSnipeTaxBps(), st.launchTimestamp, packed.antiSnipeDurationSeconds(), block.timestamp
            );
        }

        uint256 totalFeeBps = uint256(ProtocolConstants.BASE_FEE_BPS) + uint256(effectiveHookTax) + uint256(snipeBps);
        if (totalFeeBps > ProtocolConstants.BPS_DENOMINATOR) {
            snipeBps = uint16(ProtocolConstants.BPS_DENOMINATOR - ProtocolConstants.BASE_FEE_BPS - effectiveHookTax);
            totalFeeBps = ProtocolConstants.BPS_DENOMINATOR;
        }

        if (isBuy && packed.enabled(BitmaskConfig.MAX_WALLET_ENABLED)) {
            _checkMaxWalletBeforeBuy(st, packed, hookData, exactInput, specifiedAbs, sqrtPriceX96, totalFeeBps);
        }

        bool quoteIsSpecified = isBuy ? exactInput : !exactInput;

        // Floor intercept: sell that is already at/below floor OR would cross the floor in this swap.
        if (!isBuy && packed.enabled(BitmaskConfig.BACKED_FLOOR_ENABLED)) {
            uint256 tokenAmt =
                exactInput ? specifiedAbs : FixedPointMath.tokenFromQuote(specifiedAbs, sqrtPriceX96, tokenIs0);
            if (FixedPointMath.sellWouldBreachFloor(
                    sqrtPriceX96,
                    liquidity,
                    tokenIs0,
                    vault.reserve(st.token),
                    IERC20Supply(st.token).totalSupply(),
                    tokenAmt
                )) {
                return _floorFill(key, st, params, exactInput, specifiedAbs);
            }
        }

        uint256 quoteNotional =
            _quoteNotional(st, params, exactInput, specifiedAbs, isBuy, quoteIsSpecified, sqrtPriceX96);

        if (packed.enabled(BitmaskConfig.DYNAMIC_FEES_ENABLED)) {
            dynamicFeeWindows[id] = DynamicFeeMath.accrueVolume(windowPacked, quoteNotional, block.timestamp);
        }

        uint256 feeAmount = FixedPointMath.applyBps(quoteNotional, totalFeeBps);
        if (feeAmount == 0) {
            uint24 lpOverride =
                packed.enabled(BitmaskConfig.DYNAMIC_FEES_ENABLED) ? (LPFeeLibrary.OVERRIDE_FEE_FLAG | 0) : 0;
            return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, lpOverride);
        }

        st.quote.take(poolManager, address(this), feeAmount, true);
        _distributeFees(id, st, packed, feeAmount, snipeBps, effectiveHookTax);

        int128 specifiedDelta;
        int128 unspecifiedDelta;
        if (quoteIsSpecified) {
            specifiedDelta = feeAmount.toInt128();
        } else {
            unspecifiedDelta = feeAmount.toInt128();
        }

        uint24 lpFeeOverride =
            packed.enabled(BitmaskConfig.DYNAMIC_FEES_ENABLED) ? (LPFeeLibrary.OVERRIDE_FEE_FLAG | 0) : 0;

        return (this.beforeSwap.selector, toBeforeSwapDelta(specifiedDelta, unspecifiedDelta), lpFeeOverride);
    }

    function _afterSwap(address, PoolKey calldata key, SwapParams calldata, BalanceDelta, bytes calldata)
        internal
        override
        returns (bytes4, int128)
    {
        if (_inFeeAction()) return (this.afterSwap.selector, 0);

        PoolId id = key.toId();
        LaunchState storage st = _launchState[id];

        uint256 burnCut = pendingAutoBurn[id];
        uint256 donateCut = pendingLpDonate[id];
        if (burnCut > 0) {
            pendingAutoBurn[id] = 0;
            _autoBurn(key, st, burnCut);
        }
        if (donateCut > 0) {
            pendingLpDonate[id] = 0;
            _lpDonate(key, st, donateCut);
        }
        return (this.afterSwap.selector, 0);
    }

    function _floorFill(
        PoolKey calldata key,
        LaunchState storage st,
        SwapParams calldata,
        /* params */
        bool exactInput,
        uint256 specifiedAbs
    ) private returns (bytes4, BeforeSwapDelta, uint24) {
        Currency tokenCur = Currency.wrap(st.token);
        uint256 tokenIn;
        if (exactInput) {
            tokenIn = specifiedAbs;
        } else {
            // exact-out quote: invert floor to tokens required
            uint256 supply = IERC20Supply(st.token).totalSupply();
            uint256 res = vault.reserve(st.token);
            tokenIn = res == 0 ? 0 : (specifiedAbs * supply + res - 1) / res;
        }
        if (tokenIn == 0) {
            return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        tokenCur.take(poolManager, address(this), tokenIn, false);
        IERC20Supply(st.token).approve(address(vault), tokenIn);
        uint256 quoteOut = vault.drawForFloor(st.token, st.quote, tokenIn, address(this));
        st.quote.settle(poolManager, address(this), quoteOut, false);

        emit FloorFill(key.toId(), tokenIn, quoteOut);

        int128 specifiedDelta;
        int128 unspecifiedDelta;
        if (exactInput) {
            specifiedDelta = tokenIn.toInt128();
            unspecifiedDelta = -quoteOut.toInt128();
        } else {
            specifiedDelta = -quoteOut.toInt128();
            unspecifiedDelta = tokenIn.toInt128();
        }
        return (this.beforeSwap.selector, toBeforeSwapDelta(specifiedDelta, unspecifiedDelta), 0);
    }

    function _quoteNotional(
        LaunchState storage st,
        SwapParams calldata,
        bool,
        uint256 specifiedAbs,
        bool,
        bool quoteIsSpecified,
        uint160 sqrtPriceX96
    ) private view returns (uint256) {
        if (quoteIsSpecified) return specifiedAbs;
        return FixedPointMath.quoteFromToken(specifiedAbs, sqrtPriceX96, st.tokenIsCurrency0);
    }

    function _distributeFees(
        PoolId id,
        LaunchState storage st,
        uint256 packed,
        uint256 feeAmount,
        uint16 snipeBps,
        uint16 effectiveHookTaxBps
    ) private {
        uint16 hookTaxBps_ = effectiveHookTaxBps;
        uint256 totalBps = uint256(ProtocolConstants.BASE_FEE_BPS) + uint256(hookTaxBps_) + uint256(snipeBps);
        if (totalBps == 0) return;

        // Base (+ snipe) always computes 70/30. Hook tax is a separate pot for modules.
        // Optional: creator can fold their 70% of base into that same hook pot.
        uint256 hookTaxAmount = feeAmount * uint256(hookTaxBps_) / totalBps;
        uint256 basePool = feeAmount - hookTaxAmount;

        uint256 creatorShare = FixedPointMath.applyBps(basePool, ProtocolConstants.CREATOR_SHARE_BPS);
        uint256 protocolFromBase = basePool - creatorShare;

        uint256 hookPot = hookTaxAmount;
        uint256 creatorEscrowAmt = creatorShare;
        uint256 buybackAmt;

        if (packed.enabled(BitmaskConfig.CREATOR_SHARE_TO_HOOK_ENABLED)) {
            hookPot += creatorShare;
            creatorEscrowAmt = 0;
        } else if (st.token == distributor.nativeToken() && distributor.nativeToken() != address(0)) {
            buybackAmt = creatorEscrowAmt;
            _pushQuote(st.quote, address(distributor), buybackAmt);
            if (buybackAmt > 0) distributor.notifyBuybackInternal(st.quote, buybackAmt);
            creatorEscrowAmt = 0;
        } else if (packed.enabled(BitmaskConfig.BUYBACK_VESTING_ENABLED) && creatorEscrowAmt > 0) {
            buybackAmt = creatorEscrowAmt;
            creatorEscrowAmt = 0;
            _pushQuote(st.quote, address(buybacks), buybackAmt);
            if (buybackAmt > 0) {
                buybacks.creditInternal(
                    st.creator, st.token, st.quote, buybackAmt, packed.buybackVestingDurationSeconds()
                );
            }
        } else {
            _pushQuote(st.quote, address(escrow), creatorEscrowAmt);
            if (creatorEscrowAmt > 0) escrow.creditInternal(st.creator, st.quote, creatorEscrowAmt);
        }

        uint256 floorCut = packed.enabled(BitmaskConfig.BACKED_FLOOR_ENABLED)
            ? FixedPointMath.applyBps(hookPot, packed.floorAllocationBps())
            : 0;
        uint256 autoBurnCut = packed.enabled(BitmaskConfig.AUTO_BURN_ENABLED)
            ? FixedPointMath.applyBps(hookPot, packed.autoBurnBps())
            : 0;
        uint256 lpDonateCut = packed.enabled(BitmaskConfig.LP_DONATE_ENABLED)
            ? FixedPointMath.applyBps(hookPot, packed.lpDonateBps())
            : 0;
        uint256 airdropCut = packed.enabled(BitmaskConfig.HOLDER_AIRDROP_ENABLED)
            ? FixedPointMath.applyBps(hookPot, packed.holderAirdropBps())
            : 0;
        uint256 routed = floorCut + autoBurnCut + lpDonateCut + airdropCut;
        if (routed > hookPot) {
            airdropCut = 0;
            routed = floorCut + autoBurnCut + lpDonateCut;
            if (routed > hookPot) {
                lpDonateCut = 0;
                routed = floorCut + autoBurnCut;
                if (routed > hookPot) {
                    autoBurnCut = 0;
                    routed = floorCut;
                }
            }
        }
        // Unallocated hook pot → protocol.
        uint256 protocolShare = protocolFromBase + (hookPot - routed);

        _pushQuote(st.quote, address(distributor), protocolShare);
        if (protocolShare > 0) distributor.notifyInternal(st.quote, protocolShare);

        _pushQuote(st.quote, address(vault), floorCut);
        if (floorCut > 0) vault.depositInternal(st.token, st.quote, floorCut);

        _pushQuote(st.quote, address(airdropVault), airdropCut);
        if (airdropCut > 0) airdropVault.depositInternal(st.token, st.quote, airdropCut);

        pendingAutoBurn[id] = autoBurnCut;
        pendingLpDonate[id] = lpDonateCut;

        emit FeesDistributed(
            id, creatorEscrowAmt + buybackAmt, protocolShare, floorCut, buybackAmt, autoBurnCut, lpDonateCut, airdropCut
        );
    }

    function _pushQuote(Currency quote, address to, uint256 amount) private {
        if (amount == 0) return;
        poolManager.transfer(to, quote.toId(), amount);
    }

    function _antiMev(PoolId id, uint256 packed, bool isBuy) private {
        if (!packed.enabled(BitmaskConfig.ANTI_MEV_COOLDOWN_ENABLED)) return;
        address origin = tx.origin;
        uint256 dir = isBuy ? 1 : 2;
        uint256 packedBlock = lastSwapPacked[id][origin];
        uint256 lastBlock = packedBlock >> 8;
        // One swap per origin per pool per block — blocks classic same-block sandwich legs.
        if (lastBlock == block.number) revert SandwichBlocked();
        lastSwapPacked[id][origin] = (block.number << 8) | dir;
    }

    function _checkMaxTx(address token, uint16 bps, uint256 specifiedAbs, bool isBuy, bool exactInput) private view {
        uint256 cap = FixedPointMath.applyBps(IERC20Supply(token).totalSupply(), bps);
        if (cap == 0) return;
        bool tokenIsSpecified = isBuy ? !exactInput : exactInput;
        if (tokenIsSpecified) {
            if (specifiedAbs > cap) revert MaxTxExceeded();
        }
    }

    function _decodeRecipient(bytes calldata hookData) private pure returns (address recipient) {
        if (hookData.length < 32) revert HookDataRequired();
        recipient = abi.decode(hookData, (address));
        if (recipient == address(0)) revert HookDataRequired();
    }

    /// @dev Enforce max-wallet on buys before tokens move (requires router `hookData` = recipient).
    function _checkMaxWalletBeforeBuy(
        LaunchState storage st,
        uint256 packed,
        bytes calldata hookData,
        bool exactInput,
        uint256 specifiedAbs,
        uint160 sqrtPriceX96,
        uint256 totalFeeBps
    ) private view {
        address recipient = _decodeRecipient(hookData);
        uint256 cap = FixedPointMath.applyBps(IERC20Supply(st.token).totalSupply(), packed.maxWalletBps());
        if (cap == 0) return;

        uint256 tokenIn = exactInput
            ? FixedPointMath.tokenFromQuote(
                specifiedAbs - (specifiedAbs * totalFeeBps / ProtocolConstants.BPS_DENOMINATOR),
                sqrtPriceX96,
                st.tokenIsCurrency0
            )
            : specifiedAbs;
        if (tokenIn == 0) return;

        if (IERC20Supply(st.token).balanceOf(recipient) + tokenIn > cap) revert MaxWalletExceeded();
    }

    function _autoBurn(PoolKey calldata key, LaunchState storage st, uint256 quoteAmount) private {
        bool zeroForOne = !st.tokenIsCurrency0;
        _setFeeAction(true);
        BalanceDelta delta;
        try poolManager.swap(
            key,
            SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(quoteAmount),
                sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        ) returns (
            BalanceDelta d
        ) {
            delta = d;
        } catch {
            _setFeeAction(false);
            _quoteToFloor(st, quoteAmount);
            return;
        }
        _setFeeAction(false);

        int128 quoteDelta = zeroForOne ? delta.amount0() : delta.amount1();
        int128 tokenDelta = zeroForOne ? delta.amount1() : delta.amount0();
        uint256 quotePaid = quoteDelta < 0 ? uint256(uint128(-quoteDelta)) : 0;
        uint256 tokenOut = tokenDelta > 0 ? uint256(uint128(tokenDelta)) : 0;
        if (quotePaid > 0) st.quote.settle(poolManager, address(this), quotePaid, true);
        if (tokenOut > 0) {
            Currency.wrap(st.token).take(poolManager, address(this), tokenOut, false);
            ILaunchToken(st.token).burn(tokenOut);
        }
        emit AutoBurn(key.toId(), quotePaid, tokenOut);
    }

    function _lpDonate(PoolKey calldata key, LaunchState storage st, uint256 quoteAmount) private {
        if (poolManager.getLiquidity(key.toId()) == 0) {
            _quoteToFloor(st, quoteAmount);
            return;
        }
        uint256 amount0 = st.tokenIsCurrency0 ? 0 : quoteAmount;
        uint256 amount1 = st.tokenIsCurrency0 ? quoteAmount : 0;
        try poolManager.donate(key, amount0, amount1, "") {
            st.quote.settle(poolManager, address(this), quoteAmount, true);
            emit LpDonated(key.toId(), quoteAmount);
        } catch {
            _quoteToFloor(st, quoteAmount);
        }
    }

    function _quoteToFloor(LaunchState storage st, uint256 quoteAmount) private {
        if (quoteAmount == 0) return;
        _pushQuote(st.quote, address(vault), quoteAmount);
        vault.depositInternal(st.token, st.quote, quoteAmount);
    }

    function _inFeeAction() private view returns (bool flagged) {
        bytes32 slot = FEE_ACTION_SLOT;
        assembly {
            flagged := tload(slot)
        }
    }

    function _setFeeAction(bool flagged) private {
        bytes32 slot = FEE_ACTION_SLOT;
        assembly {
            tstore(slot, flagged)
        }
    }
}
