// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";

import {QuotronStockQuotes} from "./QuotronStockQuotes.sol";
import {UniswapV4Deployments} from "./UniswapV4Deployments.sol";
import {FixedPointMath} from "./FixedPointMath.sol";

/// @title QuotronBridge
/// @notice Build Uniswap v4 pool keys for Quotrons wStock/USDG venues (composite + fee rail).
/// @dev wStock USD for launch/graduation sizing prefers live `sqrtPriceX96` (USDG ≈ $1).
library QuotronBridge {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    /// @dev USDG has 6 decimals; scale 1 USDG-wei → $1e-6 into 1e18 USD.
    uint256 internal constant USDG_TO_USD_X18 = 1e12;

    error UnknownStock();

    function isQuotronsHook(address hooks) internal pure returns (bool) {
        return hooks == QuotronStockQuotes.QUOTRONS_HOOK;
    }

    function isAllowedBridgeHook(address hooks) internal pure returns (bool) {
        return hooks == address(0) || isQuotronsHook(hooks);
    }

    function usdg() internal pure returns (address) {
        return UniswapV4Deployments.get(QuotronStockQuotes.INK_MAINNET).stableQuote;
    }

    function listingOf(address stock) internal pure returns (QuotronStockQuotes.Listing memory listing) {
        QuotronStockQuotes.Listing[] memory all = QuotronStockQuotes.listings();
        for (uint256 i; i < all.length; ++i) {
            if (all[i].token == stock) return all[i];
        }
        revert UnknownStock();
    }

    function isQuotronStock(address stock) internal pure returns (bool) {
        QuotronStockQuotes.Listing[] memory all = QuotronStockQuotes.listings();
        for (uint256 i; i < all.length; ++i) {
            if (all[i].token == stock) return true;
        }
        return false;
    }

    /// @notice Canonical PoolKey for a Quotrons wStock/USDG market.
    function poolKey(address stock) internal pure returns (PoolKey memory key) {
        address quote = usdg();
        Currency c0;
        Currency c1;
        if (uint160(stock) < uint160(quote)) {
            c0 = Currency.wrap(stock);
            c1 = Currency.wrap(quote);
        } else {
            c0 = Currency.wrap(quote);
            c1 = Currency.wrap(stock);
        }
        key = PoolKey({
            currency0: c0,
            currency1: c1,
            fee: QuotronStockQuotes.QUOTRONS_DYNAMIC_FEE,
            tickSpacing: QuotronStockQuotes.QUOTRONS_TICK_SPACING,
            hooks: IHooks(QuotronStockQuotes.QUOTRONS_HOOK)
        });
    }

    /// @notice `true` when swapping `tokenIn` for the other side is zeroForOne on the Quotrons pool.
    function zeroForOne(address stock, address tokenIn) internal pure returns (bool) {
        PoolKey memory key = poolKey(stock);
        return tokenIn == Currency.unwrap(key.currency0);
    }

    /// @notice Spot USD price of 1 whole wStock (1e18 wei), 1e18-scaled, from Quotrons pool `sqrtPriceX96`.
    /// @dev Assumes USDG ≈ $1. Returns 0 if the pool is uninitialized.
    function usdPriceX18(IPoolManager manager, address stock) internal view returns (uint256) {
        PoolKey memory key = poolKey(stock);
        (uint160 sqrtPriceX96,,,) = manager.getSlot0(key.toId());
        if (sqrtPriceX96 == 0) return 0;

        bool stockIsCurrency0 = Currency.unwrap(key.currency0) == stock;
        // USDG wei for 1e18 stock wei (= 1 whole token).
        uint256 usdgWei = FixedPointMath.quoteFromToken(1 ether, sqrtPriceX96, stockIsCurrency0);
        return usdgWei * USDG_TO_USD_X18;
    }
}
