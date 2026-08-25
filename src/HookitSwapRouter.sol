// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {TransientStateLibrary} from "@uniswap/v4-core/src/libraries/TransientStateLibrary.sol";

import {CurrencySettler} from "./libraries/CurrencySettler.sol";

/// @title HookitSwapRouter
/// @notice Thin v4 swap router with exact-in, slippage, native refunds, and hookData = recipient.
contract HookitSwapRouter is IUnlockCallback {
    using CurrencyLibrary for Currency;
    using CurrencySettler for Currency;
    using TransientStateLibrary for IPoolManager;

    IPoolManager public immutable poolManager;

    error NotPoolManager();
    error InsufficientOutput();
    error InsufficientValue();
    error NativeNotAccepted();
    error ZeroAmount();

    struct SwapCall {
        address payer;
        address recipient;
        PoolKey key;
        SwapParams params;
        uint256 minAmountOut;
    }

    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }

    receive() external payable {}

    /// @notice Exact-input swap. Pay native ETH via `msg.value` when `currencyIn` is address(0).
    function swapExactIn(
        PoolKey calldata key,
        bool zeroForOne,
        uint256 amountIn,
        uint256 minAmountOut,
        uint160 sqrtPriceLimitX96
    ) external payable returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();

        Currency currencyIn = zeroForOne ? key.currency0 : key.currency1;
        if (currencyIn.isAddressZero()) {
            if (msg.value < amountIn) revert InsufficientValue();
        } else if (msg.value != 0) {
            revert NativeNotAccepted();
        }

        if (sqrtPriceLimitX96 == 0) {
            sqrtPriceLimitX96 = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
        }

        amountOut = abi.decode(
            poolManager.unlock(
                abi.encode(
                    SwapCall({
                        payer: msg.sender,
                        recipient: msg.sender,
                        key: key,
                        params: SwapParams({
                            zeroForOne: zeroForOne,
                            amountSpecified: -int256(amountIn),
                            sqrtPriceLimitX96: sqrtPriceLimitX96
                        }),
                        minAmountOut: minAmountOut
                    })
                )
            ),
            (uint256)
        );

        uint256 leftover = address(this).balance;
        if (leftover > 0) CurrencyLibrary.ADDRESS_ZERO.transfer(msg.sender, leftover);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        SwapCall memory call = abi.decode(data, (SwapCall));

        poolManager.swap(call.key, call.params, abi.encode(call.recipient));

        int256 d0 = poolManager.currencyDelta(address(this), call.key.currency0);
        int256 d1 = poolManager.currencyDelta(address(this), call.key.currency1);

        if (d0 < 0) {
            call.key.currency0.settle(poolManager, call.payer, uint256(-d0), false);
        }
        if (d1 < 0) {
            call.key.currency1.settle(poolManager, call.payer, uint256(-d1), false);
        }
        if (d0 > 0) {
            call.key.currency0.take(poolManager, call.recipient, uint256(d0), false);
        }
        if (d1 > 0) {
            call.key.currency1.take(poolManager, call.recipient, uint256(d1), false);
        }

        uint256 amountOut = call.params.zeroForOne
            ? (d1 > 0 ? uint256(d1) : 0)
            : (d0 > 0 ? uint256(d0) : 0);
        if (amountOut < call.minAmountOut) revert InsufficientOutput();

        return abi.encode(amountOut);
    }
}
