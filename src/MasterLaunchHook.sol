// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "./base/BaseHook.sol";
import {Owned} from "./base/Owned.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary, toBeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams, ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {SafeCast} from "@uniswap/v4-core/src/libraries/SafeCast.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";

interface IERC20Supply {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

import {IMasterLaunchHook} from "./interfaces/IMasterLaunchHook.sol";
import {BitmaskConfig} from "./libraries/BitmaskConfig.sol";
import {FixedPointMath} from "./libraries/FixedPointMath.sol";
import {ProtocolConstants} from "./libraries/ProtocolConstants.sol";
import {CurrencySettler} from "./libraries/CurrencySettler.sol";
import {FeeEscrow} from "./FeeEscrow.sol";
import {FloorVault} from "./FloorVault.sol";
import {ProtocolRevenueDistributor} from "./ProtocolRevenueDistributor.sol";
import {BuybackVault} from "./BuybackVault.sol";

/// @title MasterLaunchHook
/// @notice Singleton Uniswap v4 hook: quote-only fees, anti-rug LP lock, anti-snipe, anti-MEV, backed floor.
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

    mapping(PoolId => uint256) public override configs;
    mapping(PoolId => LaunchState) private _launchState;
    mapping(PoolId => mapping(address => uint256)) public lastSwapPacked;

    event FactorySet(address indexed factory);
    event LaunchPrepared(PoolId indexed poolId, address indexed creator, address indexed token, uint256 bitmask);
    event FeesDistributed(
        PoolId indexed poolId, uint256 creatorAmount, uint256 protocolAmount, uint256 floorAmount, uint256 buybackAmount
    );
    event FloorFill(PoolId indexed poolId, uint256 tokenIn, uint256 quoteOut);

    error OnlyFactory();
    error AlreadyPrepared();
    error NotPrepared();
    error LaunchPositionLocked();
    error SandwichBlocked();
    error MaxTxExceeded();
    error MaxWalletExceeded();
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
        address owner_
    ) BaseHook(_poolManager) Owned(owner_) {
        vault = _vault;
        escrow = _escrow;
        distributor = _distributor;
        buybacks = _buybacks;
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

    function launchState(PoolId poolId) external view returns (LaunchState memory) {
        return _launchState[poolId];
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

        BitmaskConfig.unpack(params.bitmask); // validates packed ranges via unpack; pack already validated at factory
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
        vault.setQuote(st.token, st.quote);
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

    function _beforeSwap(address, PoolKey calldata key, SwapParams calldata params, bytes calldata)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        PoolId id = key.toId();
        LaunchState storage st = _launchState[id];
        if (!st.initialized) revert UnknownPool();

        uint256 packed = configs[id];
        bool tokenIs0 = st.tokenIsCurrency0;
        bool isBuy = tokenIs0 ? !params.zeroForOne : params.zeroForOne;
        bool exactInput = params.amountSpecified < 0;

        _antiMev(id, packed, isBuy);

        uint256 specifiedAbs =
            exactInput ? uint256(-params.amountSpecified) : uint256(params.amountSpecified);

        if (packed.enabled(BitmaskConfig.MAX_TX_ENABLED)) {
            _checkMaxTx(st.token, packed.maxTxBps(), specifiedAbs, isBuy, exactInput);
        }

        uint16 snipeBps;
        if (isBuy && packed.enabled(BitmaskConfig.ANTI_SNIPE_ENABLED)) {
            snipeBps = FixedPointMath.snipeTaxBps(
                packed.initialSnipeTaxBps(), st.launchTimestamp, packed.antiSnipeDurationSeconds(), block.timestamp
            );
        }

        uint256 totalFeeBps = uint256(ProtocolConstants.BASE_FEE_BPS) + uint256(packed.creatorTaxBps()) + uint256(snipeBps);

        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(id);

        bool quoteIsSpecified = isBuy ? exactInput : !exactInput;

        // Floor intercept: sell that would print below P_floor is filled from the vault.
        if (
            !isBuy && packed.enabled(BitmaskConfig.BACKED_FLOOR_ENABLED)
                && FixedPointMath.spotAtOrBelowFloor(
                    sqrtPriceX96, tokenIs0, vault.reserve(st.token), IERC20Supply(st.token).totalSupply()
                )
        ) {
            return _floorFill(key, st, params, exactInput, specifiedAbs);
        }

        uint256 quoteNotional = _quoteNotional(st, params, exactInput, specifiedAbs, isBuy, quoteIsSpecified, sqrtPriceX96);
        uint256 feeAmount = FixedPointMath.applyBps(quoteNotional, totalFeeBps);
        if (feeAmount == 0) {
            uint24 lpOverride = packed.enabled(BitmaskConfig.DYNAMIC_FEES_ENABLED)
                ? (LPFeeLibrary.OVERRIDE_FEE_FLAG | 0)
                : 0;
            return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, lpOverride);
        }

        st.quote.take(poolManager, address(this), feeAmount, true);
        _distributeFees(id, st, packed, feeAmount);

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

    function _afterSwap(address, PoolKey calldata key, SwapParams calldata, BalanceDelta, bytes calldata hookData)
        internal
        view
        override
        returns (bytes4, int128)
    {
        PoolId id = key.toId();
        uint256 packed = configs[id];
        if (packed.enabled(BitmaskConfig.MAX_WALLET_ENABLED)) {
            address recipient = hookData.length >= 32 ? abi.decode(hookData, (address)) : tx.origin;
            LaunchState storage st = _launchState[id];
            uint256 cap = FixedPointMath.applyBps(IERC20Supply(st.token).totalSupply(), packed.maxWalletBps());
            if (cap > 0 && IERC20Supply(st.token).balanceOf(recipient) > cap) revert MaxWalletExceeded();
        }
        return (this.afterSwap.selector, 0);
    }

    function _floorFill(
        PoolKey calldata key,
        LaunchState storage st,
        SwapParams calldata /* params */,
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

    function _distributeFees(PoolId id, LaunchState storage st, uint256 packed, uint256 feeAmount) private {
        uint16 taxBps = packed.creatorTaxBps();
        uint16 snipeBps = packed.enabled(BitmaskConfig.ANTI_SNIPE_ENABLED)
            ? FixedPointMath.snipeTaxBps(
                packed.initialSnipeTaxBps(), st.launchTimestamp, packed.antiSnipeDurationSeconds(), block.timestamp
            )
            : 0;
        uint256 totalBps =
            uint256(ProtocolConstants.BASE_FEE_BPS) + uint256(taxBps) + uint256(snipeBps);
        if (totalBps == 0) return;

        uint256 creatorTaxAmount = feeAmount * uint256(taxBps) / totalBps;
        uint256 splitPool = feeAmount - creatorTaxAmount;

        uint256 floorCut = packed.enabled(BitmaskConfig.BACKED_FLOOR_ENABLED)
            ? FixedPointMath.applyBps(splitPool, packed.floorAllocationBps())
            : 0;
        uint256 afterFloor = splitPool - floorCut;
        uint256 creatorShare = FixedPointMath.applyBps(afterFloor, ProtocolConstants.CREATOR_SHARE_BPS);
        uint256 protocolShare = afterFloor - creatorShare;

        uint256 buybackAmt;
        uint256 creatorEscrowAmt = creatorTaxAmount + creatorShare;
        if (packed.enabled(BitmaskConfig.BUYBACK_VESTING_ENABLED) && creatorEscrowAmt > 0) {
            buybackAmt = creatorEscrowAmt;
            creatorEscrowAmt = 0;
        }

        _pushQuote(st.quote, address(escrow), creatorEscrowAmt);
        if (creatorEscrowAmt > 0) escrow.creditInternal(st.creator, st.quote, creatorEscrowAmt);

        _pushQuote(st.quote, address(buybacks), buybackAmt);
        if (buybackAmt > 0) buybacks.creditInternal(st.creator, st.quote, buybackAmt);

        _pushQuote(st.quote, address(distributor), protocolShare);
        if (protocolShare > 0) distributor.notifyInternal(st.quote, protocolShare);

        _pushQuote(st.quote, address(vault), floorCut);
        if (floorCut > 0) vault.depositInternal(st.token, st.quote, floorCut);

        emit FeesDistributed(id, creatorEscrowAmt + buybackAmt, protocolShare, floorCut, buybackAmt);
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
        uint256 lastDir = packedBlock & 0xFF;
        if (lastBlock == block.number && lastDir != 0 && lastDir != dir) revert SandwichBlocked();
        lastSwapPacked[id][origin] = (block.number << 8) | dir;
    }

    function _checkMaxTx(
        address token,
        uint16 bps,
        uint256 specifiedAbs,
        bool isBuy,
        bool exactInput
    ) private view {
        uint256 cap = FixedPointMath.applyBps(IERC20Supply(token).totalSupply(), bps);
        if (cap == 0) return;
        bool tokenIsSpecified = isBuy ? !exactInput : exactInput;
        if (tokenIsSpecified) {
            if (specifiedAbs > cap) revert MaxTxExceeded();
        }
    }
}
