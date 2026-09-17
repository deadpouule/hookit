// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TransientStateLibrary} from "@uniswap/v4-core/src/libraries/TransientStateLibrary.sol";

import {LaunchFactory} from "./LaunchFactory.sol";
import {CurrencySettler} from "./libraries/CurrencySettler.sol";
import {ProtocolConstants} from "./libraries/ProtocolConstants.sol";
import {QuotronBridge} from "./libraries/QuotronBridge.sol";

/// @title BalancedAggregator
/// @notice PAIR-style exact-input router for `launchMulti` tokens. USDG is the common settlement
///         asset; each leg may bridge through a canonical Quotrons wStock/USDG pool before the
///         launch v4 leg. Quotes are USDG or Quotrons wStocks only. Up to five unique markets
///         per swap, one atomic unlock.
contract BalancedAggregator is IUnlockCallback {
    using CurrencyLibrary for Currency;
    using CurrencySettler for Currency;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using TransientStateLibrary for IPoolManager;

    uint16 public constant MAX_PRICE_IMPACT_BPS = 1_500;
    uint256 public constant MAX_DEADLINE_WINDOW = 1 days;

    IPoolManager public immutable poolManager;
    LaunchFactory public immutable factory;
    Currency public immutable usdg;

    struct RouteLeg {
        uint8 marketIndex;
        uint256 amountIn;
        uint256 minAmountOut;
    }

    struct BuyCall {
        address payer;
        address recipient;
        address token;
        uint256 launchId;
        uint256 minTotalOut;
        RouteLeg[] legs;
    }

    struct SellCall {
        address payer;
        address recipient;
        address token;
        uint256 launchId;
        uint256 minTotalOut;
        RouteLeg[] legs;
    }

    error NotPoolManager();
    error Expired();
    error DeadlineTooFar();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidLegCount();
    error AmountMismatch();
    error TokenMismatch();
    error UnknownMarket();
    error PoolKeyMismatch();
    error UnsupportedQuote();
    error InsufficientOutput();
    error PriceImpactTooHigh();
    error UnauthorizedBridgeHook();

    constructor(IPoolManager manager_, LaunchFactory factory_) {
        if (address(manager_) == address(0) || address(factory_) == address(0)) revert ZeroAddress();
        poolManager = manager_;
        factory = factory_;
        usdg = Currency.wrap(QuotronBridge.usdg());
    }

    /// @notice Buy launch token with USDG split across up to five canonical markets.
    function buyExactInput(
        uint256 launchId,
        address token,
        uint256 amountIn,
        uint256 minTotalOut,
        RouteLeg[] calldata legs,
        address recipient,
        uint256 deadline
    ) external returns (uint256 totalOut) {
        _validateDeadline(deadline);
        _validateLegs(launchId, token, amountIn, legs);

        BuyCall memory call = BuyCall({
            payer: msg.sender,
            recipient: recipient,
            token: token,
            launchId: launchId,
            minTotalOut: minTotalOut,
            legs: legs
        });

        totalOut = abi.decode(poolManager.unlock(abi.encode(uint8(0), call)), (uint256));
        if (totalOut < minTotalOut) revert InsufficientOutput();
    }

    /// @notice Sell launch token into USDG split across up to five canonical markets.
    function sellExactInput(
        uint256 launchId,
        address token,
        uint256 amountIn,
        uint256 minTotalOut,
        RouteLeg[] calldata legs,
        address recipient,
        uint256 deadline
    ) external returns (uint256 totalOut) {
        _validateDeadline(deadline);
        _validateLegs(launchId, token, amountIn, legs);

        SellCall memory call = SellCall({
            payer: msg.sender,
            recipient: recipient,
            token: token,
            launchId: launchId,
            minTotalOut: minTotalOut,
            legs: legs
        });

        totalOut = abi.decode(poolManager.unlock(abi.encode(uint8(1), call)), (uint256));
        if (totalOut < minTotalOut) revert InsufficientOutput();
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();

        uint8 kind = abi.decode(data, (uint8));
        if (kind == 0) {
            (, BuyCall memory buy) = abi.decode(data, (uint8, BuyCall));
            return abi.encode(_unlockBuy(buy));
        }
        (, SellCall memory sell) = abi.decode(data, (uint8, SellCall));
        return abi.encode(_unlockSell(sell));
    }

    function _unlockBuy(BuyCall memory call) internal returns (uint256 totalOut) {
        uint256 tokenBefore = IERC20Minimal(call.token).balanceOf(call.recipient);

        for (uint256 i; i < call.legs.length; ++i) {
            RouteLeg memory leg = call.legs[i];
            PoolKey memory hookKey = factory.poolKeyOfMarket(call.launchId, leg.marketIndex);
            Currency quote = _quoteCurrency(hookKey, call.token);
            if (quote == usdg) {
                _swapHookExactIn(hookKey, call.token, call.payer, call.recipient, true, leg.amountIn, leg.minAmountOut);
            } else {
                _swapCompositeBuy(
                    hookKey, call.token, quote, call.payer, call.recipient, leg.amountIn, leg.minAmountOut
                );
            }
        }

        _refund(usdg, call.payer);
        uint256 tokenAfter = IERC20Minimal(call.token).balanceOf(call.recipient);
        totalOut = tokenAfter > tokenBefore ? tokenAfter - tokenBefore : 0;
    }

    function _unlockSell(SellCall memory call) internal returns (uint256 totalOut) {
        uint256 usdgBefore = IERC20Minimal(Currency.unwrap(usdg)).balanceOf(call.recipient);
        uint256 tokenBefore = IERC20Minimal(call.token).balanceOf(address(this));

        IERC20Minimal(call.token).transferFrom(call.payer, address(this), _sumLegInputs(call.legs));

        for (uint256 i; i < call.legs.length; ++i) {
            RouteLeg memory leg = call.legs[i];
            PoolKey memory hookKey = factory.poolKeyOfMarket(call.launchId, leg.marketIndex);
            Currency quote = _quoteCurrency(hookKey, call.token);
            if (quote == usdg) {
                _swapHookExactIn(
                    hookKey, call.token, address(this), call.recipient, false, leg.amountIn, leg.minAmountOut
                );
            } else {
                _swapCompositeSell(
                    hookKey, call.token, quote, address(this), call.recipient, leg.amountIn, leg.minAmountOut
                );
            }
        }

        uint256 tokenAfter = IERC20Minimal(call.token).balanceOf(address(this));
        if (tokenAfter != tokenBefore) revert InsufficientOutput();

        uint256 usdgAfter = IERC20Minimal(Currency.unwrap(usdg)).balanceOf(call.recipient);
        totalOut = usdgAfter > usdgBefore ? usdgAfter - usdgBefore : 0;
    }

    function _swapCompositeBuy(
        PoolKey memory hookKey,
        address token,
        Currency quote,
        address payer,
        address recipient,
        uint256 usdgIn,
        uint256 minOut
    ) internal returns (uint256 amountOut) {
        PoolKey memory bridgeKey = QuotronBridge.poolKey(Currency.unwrap(quote));
        if (!QuotronBridge.isAllowedBridgeHook(address(bridgeKey.hooks))) revert UnauthorizedBridgeHook();

        bool bridgeZfo = QuotronBridge.zeroForOne(Currency.unwrap(quote), Currency.unwrap(usdg));
        bool hookZfo = !_tokenIsCurrency0(hookKey, token);

        (uint160 sqrtBefore,,,) = poolManager.getSlot0(bridgeKey.toId());
        poolManager.swap(
            bridgeKey,
            SwapParams({
                zeroForOne: bridgeZfo,
                amountSpecified: -int256(usdgIn),
                sqrtPriceLimitX96: bridgeZfo ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );
        (uint160 sqrtAfter,,,) = poolManager.getSlot0(bridgeKey.toId());
        _enforceImpact(sqrtBefore, sqrtAfter);

        Currency bridgeIn = bridgeZfo ? bridgeKey.currency0 : bridgeKey.currency1;
        int256 bridgeInDelta = poolManager.currencyDelta(address(this), bridgeIn);
        if (bridgeInDelta < 0) {
            bridgeIn.settle(poolManager, payer, uint256(-bridgeInDelta), false);
        }
        int256 bridgeInLeft = poolManager.currencyDelta(address(this), bridgeIn);
        if (bridgeInLeft > 0) {
            bridgeIn.take(poolManager, payer, uint256(bridgeInLeft), false);
        }

        uint256 quoteIn = uint256(poolManager.currencyDelta(address(this), quote));
        if (quoteIn == 0) revert InsufficientOutput();

        (sqrtBefore,,,) = poolManager.getSlot0(hookKey.toId());
        poolManager.swap(
            hookKey,
            SwapParams({
                zeroForOne: hookZfo,
                amountSpecified: -int256(quoteIn),
                sqrtPriceLimitX96: hookZfo ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            abi.encode(recipient)
        );
        (sqrtAfter,,,) = poolManager.getSlot0(hookKey.toId());
        _enforceImpact(sqrtBefore, sqrtAfter);

        int256 d0 = poolManager.currencyDelta(address(this), hookKey.currency0);
        int256 d1 = poolManager.currencyDelta(address(this), hookKey.currency1);
        if (d0 < 0) {
            hookKey.currency0.settleWithBuffer(poolManager, address(this), uint256(-d0));
        }
        if (d1 < 0) {
            hookKey.currency1.settleWithBuffer(poolManager, address(this), uint256(-d1));
        }
        if (d0 > 0) {
            hookKey.currency0.take(poolManager, recipient, uint256(d0), false);
        }
        if (d1 > 0) {
            hookKey.currency1.take(poolManager, recipient, uint256(d1), false);
        }

        int256 quoteLeft = poolManager.currencyDelta(address(this), quote);
        if (quoteLeft > 0) {
            quote.take(poolManager, payer, uint256(quoteLeft), false);
        }

        amountOut = hookZfo ? (d1 > 0 ? uint256(d1) : 0) : (d0 > 0 ? uint256(d0) : 0);
        if (amountOut < minOut) revert InsufficientOutput();
    }

    function _swapCompositeSell(
        PoolKey memory hookKey,
        address token,
        Currency quote,
        address payer,
        address recipient,
        uint256 tokenIn,
        uint256 minOut
    ) internal returns (uint256 amountOut) {
        bool hookZfo = _tokenIsCurrency0(hookKey, token);
        Currency tokenCur = Currency.wrap(token);

        (uint160 sqrtBefore,,,) = poolManager.getSlot0(hookKey.toId());
        poolManager.swap(
            hookKey,
            SwapParams({
                zeroForOne: hookZfo,
                amountSpecified: -int256(tokenIn),
                sqrtPriceLimitX96: hookZfo ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            abi.encode(recipient)
        );
        (uint160 sqrtAfter,,,) = poolManager.getSlot0(hookKey.toId());
        _enforceImpact(sqrtBefore, sqrtAfter);

        int256 tokenDelta = poolManager.currencyDelta(address(this), tokenCur);
        if (tokenDelta < 0) {
            tokenCur.settle(poolManager, payer, uint256(-tokenDelta), false);
        }

        int256 quoteCredit = poolManager.currencyDelta(address(this), quote);
        if (quoteCredit <= 0) revert InsufficientOutput();
        uint256 quoteMid = uint256(quoteCredit);

        PoolKey memory bridgeKey = QuotronBridge.poolKey(Currency.unwrap(quote));
        if (!QuotronBridge.isAllowedBridgeHook(address(bridgeKey.hooks))) revert UnauthorizedBridgeHook();

        bool bridgeBuyZfo = QuotronBridge.zeroForOne(Currency.unwrap(quote), Currency.unwrap(usdg));
        bool bridgeSellZfo = !bridgeBuyZfo;
        (sqrtBefore,,,) = poolManager.getSlot0(bridgeKey.toId());
        poolManager.swap(
            bridgeKey,
            SwapParams({
                zeroForOne: bridgeSellZfo,
                amountSpecified: -int256(quoteMid),
                sqrtPriceLimitX96: bridgeSellZfo ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );
        (sqrtAfter,,,) = poolManager.getSlot0(bridgeKey.toId());
        _enforceImpact(sqrtBefore, sqrtAfter);

        int256 quoteLeft = poolManager.currencyDelta(address(this), quote);
        if (quoteLeft < 0) {
            quote.settle(poolManager, address(this), uint256(-quoteLeft), false);
        } else if (quoteLeft > 0) {
            quote.take(poolManager, payer, uint256(quoteLeft), false);
        }

        Currency bridgeOut = bridgeSellZfo ? bridgeKey.currency1 : bridgeKey.currency0;
        int256 outDelta = poolManager.currencyDelta(address(this), bridgeOut);
        amountOut = outDelta > 0 ? uint256(outDelta) : 0;
        if (amountOut < minOut) revert InsufficientOutput();
        if (outDelta > 0) {
            bridgeOut.take(poolManager, recipient, amountOut, false);
        }

        int256 tokenLeft = poolManager.currencyDelta(address(this), tokenCur);
        if (tokenLeft > 0) {
            tokenCur.take(poolManager, payer, uint256(tokenLeft), false);
        }
    }

    function _swapHookExactIn(
        PoolKey memory hookKey,
        address token,
        address payer,
        address recipient,
        bool buy,
        uint256 amountIn,
        uint256 minOut
    ) internal returns (uint256 amountOut) {
        bool zeroForOne = buy ? !_tokenIsCurrency0(hookKey, token) : _tokenIsCurrency0(hookKey, token);

        (uint160 sqrtBefore,,,) = poolManager.getSlot0(hookKey.toId());
        poolManager.swap(
            hookKey,
            SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(amountIn),
                sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            abi.encode(recipient)
        );
        (uint160 sqrtAfter,,,) = poolManager.getSlot0(hookKey.toId());
        _enforceImpact(sqrtBefore, sqrtAfter);

        int256 d0 = poolManager.currencyDelta(address(this), hookKey.currency0);
        int256 d1 = poolManager.currencyDelta(address(this), hookKey.currency1);
        _settleCurrencyDelta(hookKey.currency0, payer, recipient);
        _settleCurrencyDelta(hookKey.currency1, payer, recipient);

        amountOut = zeroForOne ? (d1 > 0 ? uint256(d1) : 0) : (d0 > 0 ? uint256(d0) : 0);
        if (amountOut < minOut) revert InsufficientOutput();
    }

    function _settleCurrencyDelta(Currency currency, address payer, address recipient) internal {
        int256 delta = poolManager.currencyDelta(address(this), currency);
        if (delta < 0) {
            uint256 owe = uint256(-delta);
            if (payer == address(this)) {
                currency.settleWithBuffer(poolManager, payer, owe);
            } else {
                currency.settle(poolManager, payer, owe, false);
            }
        }
        delta = poolManager.currencyDelta(address(this), currency);
        if (delta > 0) {
            currency.take(poolManager, recipient, uint256(delta), false);
        }
    }

    function _enforceImpact(uint160 sqrtBefore, uint160 sqrtAfter) internal pure {
        if (sqrtBefore == 0 || sqrtAfter == 0) return;
        uint256 hi = sqrtBefore > sqrtAfter ? sqrtBefore : sqrtAfter;
        uint256 lo = sqrtBefore > sqrtAfter ? sqrtAfter : sqrtBefore;
        uint256 impactBps = (hi - lo) * ProtocolConstants.BPS_DENOMINATOR / lo;
        if (impactBps > MAX_PRICE_IMPACT_BPS) revert PriceImpactTooHigh();
    }

    function _refund(Currency currency, address to) internal {
        int256 delta = poolManager.currencyDelta(address(this), currency);
        if (delta > 0) currency.take(poolManager, to, uint256(delta), false);
    }

    function _validateDeadline(uint256 deadline) internal view {
        if (block.timestamp > deadline) revert Expired();
        if (deadline > block.timestamp + MAX_DEADLINE_WINDOW) revert DeadlineTooFar();
    }

    function _validateLegs(uint256 launchId, address token, uint256 amountIn, RouteLeg[] calldata legs) internal view {
        if (amountIn == 0) revert ZeroAmount();
        if (legs.length == 0 || legs.length > ProtocolConstants.MAX_LAUNCH_MARKETS) revert InvalidLegCount();
        (address launchToken,,,,,,,) = factory.launches(launchId);
        if (launchToken != token) revert TokenMismatch();

        uint256 sum;
        uint8 seen;
        for (uint256 i; i < legs.length; ++i) {
            RouteLeg memory leg = legs[i];
            if (leg.amountIn == 0) revert ZeroAmount();
            if (leg.marketIndex >= factory.launchMarketCount(launchId)) revert UnknownMarket();
            if ((seen & (uint8(1) << leg.marketIndex)) != 0) revert UnknownMarket();
            seen |= uint8(1) << leg.marketIndex;
            PoolKey memory hookKey = factory.poolKeyOfMarket(launchId, leg.marketIndex);
            _assertCanonicalQuote(_quoteCurrency(hookKey, token));
            sum += leg.amountIn;
        }
        if (sum != amountIn) revert AmountMismatch();
    }

    function _assertCanonicalQuote(Currency quote) internal view {
        if (quote == usdg) return;
        if (QuotronBridge.isQuotronStock(Currency.unwrap(quote))) return;
        revert UnsupportedQuote();
    }

    function _sumLegInputs(RouteLeg[] memory legs) internal pure returns (uint256 sum) {
        for (uint256 i; i < legs.length; ++i) sum += legs[i].amountIn;
    }

    function _quoteCurrency(PoolKey memory key, address token) internal pure returns (Currency) {
        return _tokenIsCurrency0(key, token) ? key.currency1 : key.currency0;
    }

    function _tokenIsCurrency0(PoolKey memory key, address token) internal pure returns (bool) {
        return Currency.unwrap(key.currency0) == token;
    }
}
