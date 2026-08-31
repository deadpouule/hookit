// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "./base/BaseHook.sol";
import {Owned} from "./base/Owned.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {
    BeforeSwapDelta,
    BeforeSwapDeltaLibrary,
    toBeforeSwapDelta
} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SafeCast} from "@uniswap/v4-core/src/libraries/SafeCast.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";

import {FeeEscrow} from "./FeeEscrow.sol";
import {ProtocolRevenueDistributor} from "./ProtocolRevenueDistributor.sol";
import {ProtocolConstants} from "./libraries/ProtocolConstants.sol";
import {BondingConstants} from "./libraries/BondingConstants.sol";
import {FixedPointMath} from "./libraries/FixedPointMath.sol";
import {CurrencySettler} from "./libraries/CurrencySettler.sol";

/// @title GraduatedFeeHook
/// @notice Minimal Pons-style v4 hook for classic (bonding→graduate) launches.
/// @dev `fee = 0` on the pool; quote-notional fees in `beforeSwap` (MasterLaunchHook parity).
///      No trade gates, no transfer tax, no LP locks (graduation LP lives in `LiquidityLocker`).
contract GraduatedFeeHook is BaseHook, Owned, IUnlockCallback {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using SafeCast for uint256;
    using CurrencySettler for Currency;
    using StateLibrary for IPoolManager;

    uint160 public constant HOOK_FLAGS =
        uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG);

    struct LaunchConfig {
        address token;
        address quote; // address(0) = ETH
        address creator;
        bool tokenIsCurrency0;
        bool registered;
    }

    address public factory;
    FeeEscrow public immutable escrow;
    ProtocolRevenueDistributor public immutable distributor;

    mapping(PoolId => LaunchConfig) public launches;
    /// @notice Protocol share accrued per pool / currency (pre-sweep).
    mapping(PoolId => mapping(Currency => uint256)) public pendingFees;
    /// @notice Creator share accrued per pool / currency (pre-sweep).
    mapping(PoolId => mapping(Currency => uint256)) public pendingCreatorTax;
    mapping(address => bool) public operators;

    event FactorySet(address indexed factory);
    event OperatorSet(address indexed operator, bool allowed);
    event LaunchRegistered(PoolId indexed poolId, address indexed token, address indexed creator);
    event FeesAccrued(PoolId indexed poolId, Currency indexed currency, uint256 creatorAmount, uint256 protocolAmount);
    event Swept(PoolId indexed poolId, Currency indexed currency, uint256 creatorAmount, uint256 protocolAmount);

    error OnlyFactory();
    error OnlyOperator();
    error AlreadyRegistered();
    error NotRegistered();
    error ZeroAmount();
    error ImpactTooHigh();

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner) revert OnlyOperator();
        _;
    }

    constructor(IPoolManager poolManager_, FeeEscrow escrow_, ProtocolRevenueDistributor distributor_, address owner_)
        BaseHook(poolManager_)
        Owned(owner_)
    {
        escrow = escrow_;
        distributor = distributor_;
    }

    receive() external payable {}

    function setFactory(address factory_) external onlyOwner {
        factory = factory_;
        emit FactorySet(factory_);
    }

    function setOperator(address operator, bool allowed) external onlyOwner {
        operators[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: true,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /// @notice Called by `BondingLaunchFactory` before pool initialize at graduation.
    function registerLaunch(PoolKey calldata key, address token, address quote, address creator, bool tokenIsCurrency0)
        external
        onlyFactory
    {
        PoolId id = key.toId();
        if (launches[id].registered) revert AlreadyRegistered();

        launches[id] = LaunchConfig({
            token: token, quote: quote, creator: creator, tokenIsCurrency0: tokenIsCurrency0, registered: true
        });
        emit LaunchRegistered(id, token, creator);
    }

    function _beforeInitialize(address, PoolKey calldata key, uint160) internal view override returns (bytes4) {
        if (!launches[key.toId()].registered) revert NotRegistered();
        return this.beforeInitialize.selector;
    }

    function _beforeSwap(address, PoolKey calldata key, SwapParams calldata params, bytes calldata)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        PoolId id = key.toId();
        LaunchConfig storage cfg = launches[id];
        if (!cfg.registered) revert NotRegistered();

        uint256 totalBps = uint256(ProtocolConstants.BASE_FEE_BPS);
        if (totalBps == 0) return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);

        bool tokenIs0 = cfg.tokenIsCurrency0;
        bool isBuy = tokenIs0 ? !params.zeroForOne : params.zeroForOne;
        bool exactInput = params.amountSpecified < 0;
        bool quoteIsSpecified = isBuy ? exactInput : !exactInput;
        uint256 specifiedAbs = exactInput ? uint256(-params.amountSpecified) : uint256(params.amountSpecified);

        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(id);
        uint256 quoteNotional =
            quoteIsSpecified ? specifiedAbs : FixedPointMath.quoteFromToken(specifiedAbs, sqrtPriceX96, tokenIs0);
        uint256 feeAmount = quoteNotional * totalBps / ProtocolConstants.BPS_DENOMINATOR;
        if (feeAmount == 0) return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);

        Currency quoteCur = Currency.wrap(cfg.quote);
        quoteCur.take(poolManager, address(this), feeAmount, true);

        uint256 creatorShare = FixedPointMath.applyBps(feeAmount, ProtocolConstants.CREATOR_SHARE_BPS);
        uint256 protocolShare = feeAmount - creatorShare;

        pendingCreatorTax[id][quoteCur] += creatorShare;
        pendingFees[id][quoteCur] += protocolShare;

        emit FeesAccrued(id, quoteCur, creatorShare, protocolShare);

        int128 specifiedDelta;
        int128 unspecifiedDelta;
        if (quoteIsSpecified) {
            specifiedDelta = feeAmount.toInt128();
        } else {
            unspecifiedDelta = feeAmount.toInt128();
        }

        return (this.beforeSwap.selector, toBeforeSwapDelta(specifiedDelta, unspecifiedDelta), 0);
    }

    /// @notice Distribute quote-denominated pending fees. Anyone may call when no conversion is needed.
    function sweepQuote(PoolId id) external {
        LaunchConfig storage cfg = launches[id];
        if (!cfg.registered) revert NotRegistered();
        Currency quote = Currency.wrap(cfg.quote);
        _sweepCurrency(id, cfg, quote);
    }

    /// @notice Convert token fees → quote via the pool, then distribute. Operator-only, impact-bounded.
    function sweepWithConversion(PoolKey calldata key, uint256 minQuoteOut) external onlyOperator {
        PoolId id = key.toId();
        LaunchConfig storage cfg = launches[id];
        if (!cfg.registered) revert NotRegistered();

        Currency tokenCur = Currency.wrap(cfg.token);
        uint256 tokenFees = pendingFees[id][tokenCur] + pendingCreatorTax[id][tokenCur];
        if (tokenFees == 0) {
            _sweepCurrency(id, cfg, Currency.wrap(cfg.quote));
            return;
        }

        pendingFees[id][tokenCur] = 0;
        pendingCreatorTax[id][tokenCur] = 0;

        uint256 quoteBefore = cfg.quote == address(0) ? address(this).balance : _erc20Bal(cfg.quote);
        poolManager.unlock(abi.encode(key, cfg.tokenIsCurrency0, tokenFees, minQuoteOut));
        uint256 quoteAfter = cfg.quote == address(0) ? address(this).balance : _erc20Bal(cfg.quote);
        uint256 quoteGained = quoteAfter - quoteBefore;
        if (quoteGained == 0) revert ZeroAmount();

        // Converted proceeds are already fee amounts — split 70/30 like base fee.
        uint256 creatorShare = FixedPointMath.applyBps(quoteGained, ProtocolConstants.CREATOR_SHARE_BPS);
        uint256 protocolShare = quoteGained - creatorShare;

        Currency quote = Currency.wrap(cfg.quote);
        pendingCreatorTax[id][quote] += creatorShare;
        pendingFees[id][quote] += protocolShare;
        _sweepCurrency(id, cfg, quote);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        (PoolKey memory key, bool tokenIsCurrency0, uint256 tokenIn, uint256 minQuoteOut) =
            abi.decode(data, (PoolKey, bool, uint256, uint256));

        // Sell launch token for quote.
        bool zeroForOne = tokenIsCurrency0;

        Currency tokenCur = tokenIsCurrency0 ? key.currency0 : key.currency1;
        tokenCur.settle(poolManager, address(this), tokenIn, false);

        BalanceDelta delta = poolManager.swap(
            key,
            SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(tokenIn),
                sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );

        int128 quoteDelta = tokenIsCurrency0 ? delta.amount1() : delta.amount0();
        // When selling token, we receive quote (positive take).
        uint256 quoteOut = quoteDelta > 0 ? uint256(uint128(quoteDelta)) : 0;

        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(key.toId());
        uint256 fairQuote = FixedPointMath.quoteFromToken(tokenIn, sqrtPriceX96, tokenIsCurrency0);
        uint256 minByImpact = fairQuote == 0
            ? 0
            : fairQuote * (ProtocolConstants.BPS_DENOMINATOR - BondingConstants.MAX_SWEEP_IMPACT_BPS)
                / ProtocolConstants.BPS_DENOMINATOR;
        if (quoteOut < minQuoteOut || quoteOut < minByImpact) revert ImpactTooHigh();

        Currency quoteCur = tokenIsCurrency0 ? key.currency1 : key.currency0;
        quoteCur.take(poolManager, address(this), quoteOut, false);
        return abi.encode(quoteOut);
    }

    function _sweepCurrency(PoolId id, LaunchConfig storage cfg, Currency currency) private {
        uint256 creatorAmt = pendingCreatorTax[id][currency];
        uint256 protocolAmt = pendingFees[id][currency];
        if (creatorAmt == 0 && protocolAmt == 0) revert ZeroAmount();

        pendingCreatorTax[id][currency] = 0;
        pendingFees[id][currency] = 0;

        if (creatorAmt > 0) {
            _push(currency, address(escrow), creatorAmt);
            escrow.creditInternal(cfg.creator, currency, creatorAmt);
        }
        if (protocolAmt > 0) {
            _push(currency, address(distributor), protocolAmt);
            distributor.notifyInternal(currency, protocolAmt);
        }
        emit Swept(id, currency, creatorAmt, protocolAmt);
    }

    function _push(Currency currency, address to, uint256 amount) private {
        if (amount == 0) return;
        poolManager.transfer(to, currency.toId(), amount);
    }

    function _erc20Transfer(address token, address to, uint256 amount) private returns (bool) {
        (bool ok, bytes memory data) =
            token.call(abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), to, amount));
        return ok && (data.length == 0 || abi.decode(data, (bool)));
    }

    function _erc20Bal(address token) private view returns (uint256) {
        (bool ok, bytes memory data) =
            token.staticcall(abi.encodeWithSelector(bytes4(keccak256("balanceOf(address)")), address(this)));
        require(ok && data.length >= 32);
        return abi.decode(data, (uint256));
    }
}
