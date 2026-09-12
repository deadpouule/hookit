// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

import {CurrencySettler} from "./CurrencySettler.sol";
import {ILaunchToken} from "../interfaces/ILaunchToken.sol";
import {HktHolderDropVault} from "../HktHolderDropVault.sol";

/// @title QuoteBuyLib
/// @notice External library: spend quote claims to buy the launch token.
/// @dev Linked (not inlined) so MasterLaunchHook stays under EIP-170. DELEGATECALL so
///      settle/take hit the hook's ERC-6909 claims. Caller must set the hook fee-action flag.
library QuoteBuyLib {
    using CurrencySettler for Currency;

    /// @notice Exact-in quote→token swap. Tokens are taken to `to`. Returns zeros on failure.
    function swapQuoteForToken(
        IPoolManager manager,
        PoolKey calldata key,
        Currency quote,
        address token,
        bool tokenIsCurrency0,
        uint256 quoteAmount,
        address to
    ) internal returns (uint256 quotePaid, uint256 tokenOut, bool ok) {
        if (quoteAmount == 0 || to == address(0)) return (0, 0, false);
        bool zeroForOne = !tokenIsCurrency0;
        BalanceDelta delta;
        try manager.swap(
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
            return (0, 0, false);
        }

        int128 quoteDelta = zeroForOne ? delta.amount0() : delta.amount1();
        int128 tokenDelta = zeroForOne ? delta.amount1() : delta.amount0();
        quotePaid = quoteDelta < 0 ? uint256(uint128(-quoteDelta)) : 0;
        tokenOut = tokenDelta > 0 ? uint256(uint128(tokenDelta)) : 0;
        if (quotePaid > 0) quote.settle(manager, address(this), quotePaid, true);
        if (tokenOut > 0) Currency.wrap(token).take(manager, to, tokenOut, false);
        ok = tokenOut > 0;
    }

    function autoBurn(
        IPoolManager manager,
        PoolKey calldata key,
        Currency quote,
        address token,
        bool tokenIsCurrency0,
        uint256 quoteAmount
    ) external returns (uint256 quotePaid, uint256 tokenOut, bool ok) {
        (quotePaid, tokenOut, ok) = swapQuoteForToken(
            manager, key, quote, token, tokenIsCurrency0, quoteAmount, address(this)
        );
        if (tokenOut > 0) ILaunchToken(token).burn(tokenOut);
    }

    function hktDropBuy(
        IPoolManager manager,
        PoolKey calldata key,
        Currency quote,
        address token,
        bool tokenIsCurrency0,
        uint256 quoteAmount,
        HktHolderDropVault vault
    ) external returns (uint256 quotePaid, uint256 tokenOut, bool ok) {
        if (address(vault) == address(0) || vault.hkt() == address(0)) return (0, 0, false);
        (quotePaid, tokenOut, ok) =
            swapQuoteForToken(manager, key, quote, token, tokenIsCurrency0, quoteAmount, address(vault));
        if (!ok) return (0, 0, false);
        vault.creditInternal(token, tokenOut);
    }
}
