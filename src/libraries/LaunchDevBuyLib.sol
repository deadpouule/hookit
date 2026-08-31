// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {TransientStateLibrary} from "@uniswap/v4-core/src/libraries/TransientStateLibrary.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";

import {CurrencySettler} from "./CurrencySettler.sol";
import {FixedPointMath} from "./FixedPointMath.sol";
import {ProtocolConstants} from "./ProtocolConstants.sol";

/// @title LaunchDevBuyLib
/// @notice Atomic dev-buy swap leg for LaunchFactory unlock callbacks.
library LaunchDevBuyLib {
    using CurrencyLibrary for Currency;
    using CurrencySettler for Currency;
    using TransientStateLibrary for IPoolManager;

    struct SwapCall {
        address payer;
        address recipient;
        PoolKey key;
        bool zeroForOne;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 maxTokensOut;
    }

    error DevBuyTooLarge();
    error DevBuyQuoteTooHigh();
    error InsufficientOutput();
    error TransferFailed();
    error ZeroAmount();

    function maxDevBuyQuoteWei(uint256 mcapQuoteWei) internal pure returns (uint256) {
        return FixedPointMath.applyBps(mcapQuoteWei, ProtocolConstants.MAX_DEV_BUY_BPS);
    }

    function maxDevBuyTokens(uint256 totalSupply) internal pure returns (uint256) {
        return FixedPointMath.applyBps(totalSupply, ProtocolConstants.MAX_DEV_BUY_BPS);
    }

    function validateDevBuyQuote(uint256 devBuyQuoteIn, uint256 mcapQuoteWei) internal pure {
        if (devBuyQuoteIn == 0) return;
        if (devBuyQuoteIn > maxDevBuyQuoteWei(mcapQuoteWei)) revert DevBuyQuoteTooHigh();
    }

    function pullQuoteToken(address quote, address payer, uint256 amount) internal {
        if (amount == 0 || quote == address(0)) return;
        if (!IERC20Minimal(quote).transferFrom(payer, address(this), amount)) revert TransferFailed();
    }

    function handleUnlockSwap(IPoolManager poolManager, SwapCall memory call) internal returns (bytes memory) {
        if (call.amountIn == 0) revert ZeroAmount();

        poolManager.swap(
            call.key,
            SwapParams({
                zeroForOne: call.zeroForOne,
                amountSpecified: -int256(call.amountIn),
                sqrtPriceLimitX96: call.zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            abi.encode(call.recipient)
        );

        int256 d0 = poolManager.currencyDelta(address(this), call.key.currency0);
        int256 d1 = poolManager.currencyDelta(address(this), call.key.currency1);

        _settleDelta(poolManager, call.key.currency0, call.payer, call.recipient);
        _settleDelta(poolManager, call.key.currency1, call.payer, call.recipient);

        uint256 amountOut = call.zeroForOne ? (d1 > 0 ? uint256(d1) : 0) : (d0 > 0 ? uint256(d0) : 0);

        if (amountOut < call.minAmountOut) revert InsufficientOutput();
        if (call.maxTokensOut > 0 && amountOut > call.maxTokensOut) revert DevBuyTooLarge();

        return abi.encode(amountOut);
    }

    function _settleDelta(IPoolManager poolManager, Currency currency, address payer, address recipient) private {
        int256 delta = poolManager.currencyDelta(address(this), currency);
        if (delta < 0) {
            uint256 owe = uint256(-delta);
            if (currency.isAddressZero()) {
                currency.settle(poolManager, payer, owe, false);
            } else {
                currency.settleWithBuffer(poolManager, payer, owe);
            }
        }
        delta = poolManager.currencyDelta(address(this), currency);
        if (delta > 0) {
            currency.take(poolManager, recipient, uint256(delta), false);
        }
    }
}
