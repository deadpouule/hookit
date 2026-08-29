// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";

import {FixedPointMath} from "./FixedPointMath.sol";
import {ProtocolConstants} from "./ProtocolConstants.sol";
import {QuotronBridge} from "./QuotronBridge.sol";

interface ILaunchAggregatorV3 {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @title LaunchFactoryLib
/// @notice External library linked at deploy time to keep LaunchFactory under EIP-170.
library LaunchFactoryLib {
    using CurrencyLibrary for Currency;

    struct QuoteConfig {
        bool allowed;
        uint8 decimals;
        uint256 usdPriceX18;
        address usdFeed;
    }

    struct PoolPlan {
        PoolKey key;
        uint160 sqrtPriceX96;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        bool tokenIsCurrency0;
        Currency quote;
        uint16 bps;
    }

    struct PoolSeed {
        PoolKey key;
        uint160 sqrtPriceX96;
        int24 tickLower;
        int24 tickUpper;
        int256 liquidityDelta;
    }

    struct MarketInput {
        Currency quote;
        uint16 bps;
    }

    error InvalidSupply();
    error InvalidQuote();
    error StalePrice();
    error InvalidMarketBps();
    error DuplicateQuote();

    function usdFromFeed(address feed, uint256 maxAge) external view returns (uint256) {
        return _usdFromFeed(feed, maxAge);
    }

    function quoteUsdX18(IPoolManager poolManager, address token, QuoteConfig memory q)
        external
        view
        returns (uint256)
    {
        if (QuotronBridge.isQuotronStock(token)) {
            uint256 live = QuotronBridge.usdPriceX18(poolManager, token);
            if (live != 0) return live;
        }
        if (q.usdFeed != address(0)) {
            return _usdFromFeed(q.usdFeed, ProtocolConstants.ORACLE_MAX_AGE);
        }
        return q.usdPriceX18;
    }

    function mcapQuoteWei(uint256 targetMcapUsdX18, uint256 usdX18, uint8 decimals)
        external
        pure
        returns (uint256)
    {
        if (usdX18 == 0) revert InvalidQuote();
        return FixedPointMath.mcapQuoteWei(targetMcapUsdX18, usdX18, decimals);
    }

    function splitSupply(uint256 totalSupply, MarketInput[] calldata markets)
        external
        pure
        returns (uint256[] memory amounts)
    {
        uint256 len = markets.length;
        amounts = new uint256[](len);
        uint256 allocated;
        for (uint256 i; i < len - 1; ++i) {
            amounts[i] = totalSupply * markets[i].bps / ProtocolConstants.BPS_DENOMINATOR;
            allocated += amounts[i];
        }
        amounts[len - 1] = totalSupply - allocated;
    }

    function validateMarkets(MarketInput[] calldata markets)
        external
        pure
        returns (bool hasNative, uint256 bpsSum)
    {
        uint256 marketLen = markets.length;
        for (uint256 i; i < marketLen; ++i) {
            MarketInput calldata m = markets[i];
            if (m.bps == 0) revert InvalidMarketBps();
            bpsSum += m.bps;
            if (m.quote.isAddressZero()) hasNative = true;
            for (uint256 j = i + 1; j < marketLen; ++j) {
                if (Currency.unwrap(m.quote) == Currency.unwrap(markets[j].quote)) revert DuplicateQuote();
            }
        }
        if (bpsSum != ProtocolConstants.BPS_DENOMINATOR) revert InvalidMarketBps();
    }

    function computePoolPlan(
        address token,
        Currency quote,
        uint256 tokenAmount,
        uint256 priceSupply,
        int24 spacing,
        IHooks hooks,
        uint24 fee,
        uint256 mcapQuote
    ) external pure returns (PoolPlan memory plan) {
        if (tokenAmount == 0 || priceSupply == 0) revert InvalidSupply();

        bool tokenIsCurrency0 = uint160(token) < uint160(Currency.unwrap(quote));
        plan.tokenIsCurrency0 = tokenIsCurrency0;
        plan.quote = quote;
        plan.key = PoolKey({
            currency0: tokenIsCurrency0 ? Currency.wrap(token) : quote,
            currency1: tokenIsCurrency0 ? quote : Currency.wrap(token),
            fee: fee,
            tickSpacing: spacing,
            hooks: hooks
        });

        bool tokenIsCurrency1 = !tokenIsCurrency0;
        int24 startingTick =
            FixedPointMath.startingTickForMcap(priceSupply, mcapQuote, spacing, tokenIsCurrency1);

        if (tokenIsCurrency0) {
            int24 startAligned = FixedPointMath.alignTickUp(startingTick, spacing);
            plan.tickLower = startAligned;
            plan.tickUpper = TickMath.maxUsableTick(spacing);
            if (plan.tickUpper <= plan.tickLower) plan.tickLower = plan.tickUpper - spacing;
            uint160 lowerSqrt = TickMath.getSqrtPriceAtTick(plan.tickLower);
            plan.sqrtPriceX96 =
                lowerSqrt <= TickMath.MIN_SQRT_PRICE + 1 ? TickMath.MIN_SQRT_PRICE + 1 : lowerSqrt - 1;
            plan.liquidity = FixedPointMath.liquidityForAmount0(
                TickMath.getSqrtPriceAtTick(plan.tickLower),
                TickMath.getSqrtPriceAtTick(plan.tickUpper),
                tokenAmount
            );
        } else {
            int24 startAligned = FixedPointMath.alignTickDown(startingTick, spacing);
            plan.tickLower = TickMath.minUsableTick(spacing);
            plan.tickUpper = startAligned;
            if (plan.tickUpper <= plan.tickLower) plan.tickUpper = plan.tickLower + spacing;
            uint160 upperSqrt = TickMath.getSqrtPriceAtTick(plan.tickUpper);
            if (upperSqrt >= TickMath.MAX_SQRT_PRICE - 2) {
                plan.sqrtPriceX96 = TickMath.MAX_SQRT_PRICE - 1;
            } else {
                plan.sqrtPriceX96 = upperSqrt + 1;
            }
            plan.liquidity = FixedPointMath.liquidityForAmount1(
                TickMath.getSqrtPriceAtTick(plan.tickLower),
                TickMath.getSqrtPriceAtTick(plan.tickUpper),
                tokenAmount
            );
        }
    }

    function executeUnlockSeeds(IPoolManager poolManager, bytes32 launchSalt, PoolSeed[] memory seeds, address payer)
        external
    {
        for (uint256 i; i < seeds.length; ++i) {
            PoolSeed memory s = seeds[i];
            poolManager.initialize(s.key, s.sqrtPriceX96);

            (BalanceDelta delta,) = poolManager.modifyLiquidity(
                s.key,
                ModifyLiquidityParams({
                    tickLower: s.tickLower,
                    tickUpper: s.tickUpper,
                    liquidityDelta: s.liquidityDelta,
                    salt: launchSalt
                }),
                ""
            );

            _settleDelta(poolManager, s.key.currency0, delta.amount0(), payer);
            _settleDelta(poolManager, s.key.currency1, delta.amount1(), payer);
        }
    }

    function _settleDelta(IPoolManager poolManager, Currency currency, int128 delta, address payer) private {
        if (delta < 0) {
            uint256 amount = uint256(uint128(-delta));
            if (amount == 0) return;
            if (currency.isAddressZero()) {
                poolManager.settle{value: amount}();
            } else {
                poolManager.sync(currency);
                if (payer != address(this)) {
                    IERC20Minimal(Currency.unwrap(currency)).transferFrom(payer, address(poolManager), amount);
                } else {
                    IERC20Minimal(Currency.unwrap(currency)).transfer(address(poolManager), amount);
                }
                poolManager.settle();
            }
        } else if (delta > 0) {
            uint256 amount = uint256(uint128(delta));
            if (amount == 0) return;
            poolManager.take(currency, payer, amount);
        }
    }

    function _usdFromFeed(address feed, uint256 maxAge) private view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = ILaunchAggregatorV3(feed).latestRoundData();
        if (answer <= 0) revert InvalidQuote();
        if (updatedAt == 0 || updatedAt + maxAge < block.timestamp) revert StalePrice();
        uint8 dec = ILaunchAggregatorV3(feed).decimals();
        uint256 price = uint256(answer);
        if (dec < 18) price *= 10 ** (18 - dec);
        else if (dec > 18) price /= 10 ** (dec - 18);
        return price;
    }
}
