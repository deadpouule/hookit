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
/// @notice Thin v4 swap router with exact-in, slippage, native refunds, hookData = recipient,
///         and composite payment→quote→token buys in a single unlock.
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
    error QuoteMismatch();

    struct SwapCall {
        address payer;
        address recipient;
        PoolKey key;
        SwapParams params;
        uint256 minAmountOut;
    }

    struct CompositeSwapCall {
        address payer;
        address recipient;
        PoolKey bridgeKey;
        bool bridgeZeroForOne;
        uint256 amountIn;
        PoolKey hookKey;
        bool hookZeroForOne;
        Currency quoteCurrency;
        uint256 minAmountOut;
        uint160 bridgeSqrtLimit;
        uint160 hookSqrtLimit;
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

        SwapCall memory call = SwapCall({
            payer: msg.sender,
            recipient: msg.sender,
            key: key,
            params: SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(amountIn),
                sqrtPriceLimitX96: sqrtPriceLimitX96
            }),
            minAmountOut: minAmountOut
        });

        amountOut = abi.decode(poolManager.unlock(abi.encode(uint8(0), call)), (uint256));

        uint256 leftover = address(this).balance;
        if (leftover > 0) CurrencyLibrary.ADDRESS_ZERO.transfer(msg.sender, leftover);
    }

    /// @notice Pay with `bridgeKey` (hooks must be zero), receive launch token from `hookKey` in one tx.
    /// @dev `quoteCurrency` must match the quote side of `hookKey` and the output of the bridge leg.
    function swapExactInComposite(
        PoolKey calldata bridgeKey,
        bool bridgeZeroForOne,
        uint256 amountIn,
        PoolKey calldata hookKey,
        bool hookZeroForOne,
        Currency quoteCurrency,
        uint256 minAmountOut,
        uint160 bridgeSqrtLimit,
        uint160 hookSqrtLimit
    ) external payable returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();
        if (address(bridgeKey.hooks) != address(0)) revert QuoteMismatch();

        Currency bridgeIn = bridgeZeroForOne ? bridgeKey.currency0 : bridgeKey.currency1;
        if (bridgeIn.isAddressZero()) {
            if (msg.value < amountIn) revert InsufficientValue();
        } else if (msg.value != 0) {
            revert NativeNotAccepted();
        }

        _assertQuoteCurrency(hookKey, quoteCurrency);

        if (bridgeSqrtLimit == 0) {
            bridgeSqrtLimit = bridgeZeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
        }
        if (hookSqrtLimit == 0) {
            hookSqrtLimit = hookZeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
        }

        CompositeSwapCall memory call = CompositeSwapCall({
            payer: msg.sender,
            recipient: msg.sender,
            bridgeKey: bridgeKey,
            bridgeZeroForOne: bridgeZeroForOne,
            amountIn: amountIn,
            hookKey: hookKey,
            hookZeroForOne: hookZeroForOne,
            quoteCurrency: quoteCurrency,
            minAmountOut: minAmountOut,
            bridgeSqrtLimit: bridgeSqrtLimit,
            hookSqrtLimit: hookSqrtLimit
        });

        amountOut = abi.decode(poolManager.unlock(abi.encode(uint8(1), call)), (uint256));

        uint256 leftover = address(this).balance;
        if (leftover > 0) CurrencyLibrary.ADDRESS_ZERO.transfer(msg.sender, leftover);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();

        uint8 kind = abi.decode(data, (uint8));
        if (kind == 1) {
            (, CompositeSwapCall memory composite) = abi.decode(data, (uint8, CompositeSwapCall));
            return _unlockComposite(composite);
        }

        (, SwapCall memory call) = abi.decode(data, (uint8, SwapCall));

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

    function _unlockComposite(CompositeSwapCall memory call) internal returns (bytes memory) {
        poolManager.swap(
            call.bridgeKey,
            SwapParams({
                zeroForOne: call.bridgeZeroForOne,
                amountSpecified: -int256(call.amountIn),
                sqrtPriceLimitX96: call.bridgeSqrtLimit
            }),
            ""
        );

        Currency bridgeIn = call.bridgeZeroForOne ? call.bridgeKey.currency0 : call.bridgeKey.currency1;
        int256 bridgeInDelta = poolManager.currencyDelta(address(this), bridgeIn);
        if (bridgeInDelta < 0) {
            bridgeIn.settle(poolManager, call.payer, uint256(-bridgeInDelta), false);
        }

        uint256 quoteIn = uint256(poolManager.currencyDelta(address(this), call.quoteCurrency));
        if (quoteIn == 0) revert InsufficientOutput();

        poolManager.swap(
            call.hookKey,
            SwapParams({
                zeroForOne: call.hookZeroForOne,
                amountSpecified: -int256(quoteIn),
                sqrtPriceLimitX96: call.hookSqrtLimit
            }),
            abi.encode(call.recipient)
        );

        int256 d0 = poolManager.currencyDelta(address(this), call.hookKey.currency0);
        int256 d1 = poolManager.currencyDelta(address(this), call.hookKey.currency1);

        if (d0 < 0) {
            call.hookKey.currency0.settle(poolManager, address(this), uint256(-d0), false);
        }
        if (d1 < 0) {
            call.hookKey.currency1.settle(poolManager, address(this), uint256(-d1), false);
        }
        if (d0 > 0) {
            call.hookKey.currency0.take(poolManager, call.recipient, uint256(d0), false);
        }
        if (d1 > 0) {
            call.hookKey.currency1.take(poolManager, call.recipient, uint256(d1), false);
        }

        int256 quoteLeft = poolManager.currencyDelta(address(this), call.quoteCurrency);
        if (quoteLeft > 0) {
            call.quoteCurrency.take(poolManager, call.payer, uint256(quoteLeft), false);
        }

        uint256 amountOut = call.hookZeroForOne
            ? (d1 > 0 ? uint256(d1) : 0)
            : (d0 > 0 ? uint256(d0) : 0);
        if (amountOut < call.minAmountOut) revert InsufficientOutput();

        return abi.encode(amountOut);
    }

    function _assertQuoteCurrency(PoolKey memory hookKey, Currency quoteCurrency) internal pure {
        if (
            Currency.unwrap(quoteCurrency) != Currency.unwrap(hookKey.currency0)
                && Currency.unwrap(quoteCurrency) != Currency.unwrap(hookKey.currency1)
        ) {
            revert QuoteMismatch();
        }
    }
}
