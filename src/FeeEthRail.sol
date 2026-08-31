// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {TransientStateLibrary} from "@uniswap/v4-core/src/libraries/TransientStateLibrary.sol";

import {Owned} from "./base/Owned.sol";
import {CurrencySettler} from "./libraries/CurrencySettler.sol";
import {QuotronBridge} from "./libraries/QuotronBridge.sol";

/// @title FeeEthRail
/// @notice Converts protocol fee inventory (wStock / USDG) toward native ETH via Quotrons + an ETH bridge pool.
/// @dev Quotrons covers wStock ↔ USDG. Owner configures a USDG↔ETH (or USDG↔WETH) v4 pool for the last hop.
contract FeeEthRail is Owned, IUnlockCallback {
    using CurrencyLibrary for Currency;
    using CurrencySettler for Currency;
    using TransientStateLibrary for IPoolManager;

    IPoolManager public immutable poolManager;
    address public immutable usdg;

    PoolKey public ethBridgeKey;
    bool public ethBridgeSet;
    /// @dev Non-zero when the ETH hop outputs WETH that must be unwrapped.
    address public weth;

    error NotPoolManager();
    error ZeroAmount();
    error InsufficientOutput();
    error InsufficientValue();
    error BridgeNotSet();
    error BadBridge();
    error UnauthorizedBridgeHook();
    error TransferFailed();
    error NativeNotAccepted();

    event EthBridgeSet(
        Currency currency0, Currency currency1, uint24 fee, int24 tickSpacing, address hooks, address wethToken
    );
    event Converted(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    struct SwapCall {
        address payer;
        address recipient;
        PoolKey key;
        bool zeroForOne;
        uint256 amountIn;
        uint256 minAmountOut;
        uint160 sqrtLimit;
    }

    constructor(address owner_, IPoolManager manager_, address usdg_) Owned(owner_) {
        poolManager = manager_;
        usdg = usdg_;
    }

    receive() external payable {}

    /// @notice Configure the USDG → ETH hop. Pass `wethToken` if the bridge uses WETH instead of native ETH.
    function setEthBridge(PoolKey calldata key, address wethToken) external onlyOwner {
        address c0 = Currency.unwrap(key.currency0);
        address c1 = Currency.unwrap(key.currency1);
        bool hasUsdg = c0 == usdg || c1 == usdg;
        bool hasEth = c0 == address(0) || c1 == address(0);
        bool hasWeth = wethToken != address(0) && (c0 == wethToken || c1 == wethToken);
        if (!hasUsdg || (!hasEth && !hasWeth)) revert BadBridge();
        if (!QuotronBridge.isAllowedBridgeHook(address(key.hooks))) revert UnauthorizedBridgeHook();

        ethBridgeKey = key;
        ethBridgeSet = true;
        weth = hasEth ? address(0) : wethToken;
        emit EthBridgeSet(key.currency0, key.currency1, key.fee, key.tickSpacing, address(key.hooks), weth);
    }

    /// @notice wStock → USDG via Quotrons.
    function stockToUsdg(address stock, uint256 amountIn, uint256 minAmountOut, address payer, address recipient)
        external
        returns (uint256 amountOut)
    {
        if (!QuotronBridge.isQuotronStock(stock)) revert QuotronBridge.UnknownStock();
        PoolKey memory key = QuotronBridge.poolKey(stock);
        bool zfo = Currency.unwrap(key.currency0) == stock;
        amountOut = _swapExactIn(key, zfo, amountIn, minAmountOut, payer, recipient);
        emit Converted(stock, usdg, amountIn, amountOut);
    }

    /// @notice USDG → native ETH via the configured bridge (unwraps WETH if needed).
    function usdgToEth(uint256 amountIn, uint256 minAmountOut, address payer, address recipient)
        external
        returns (uint256 amountOut)
    {
        if (!ethBridgeSet) revert BridgeNotSet();
        PoolKey memory key = ethBridgeKey;
        bool zfo = Currency.unwrap(key.currency0) == usdg;
        address outToken = zfo ? Currency.unwrap(key.currency1) : Currency.unwrap(key.currency0);

        if (outToken == address(0)) {
            amountOut = _swapExactIn(key, zfo, amountIn, minAmountOut, payer, recipient);
        } else {
            amountOut = _swapExactIn(key, zfo, amountIn, minAmountOut, payer, address(this));
            (bool ok,) = outToken.call(abi.encodeWithSignature("withdraw(uint256)", amountOut));
            if (!ok) revert TransferFailed();
            CurrencyLibrary.ADDRESS_ZERO.transfer(recipient, amountOut);
        }
        emit Converted(usdg, address(0), amountIn, amountOut);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        SwapCall memory call = abi.decode(data, (SwapCall));

        poolManager.swap(
            call.key,
            SwapParams({
                zeroForOne: call.zeroForOne, amountSpecified: -int256(call.amountIn), sqrtPriceLimitX96: call.sqrtLimit
            }),
            ""
        );

        int256 d0 = poolManager.currencyDelta(address(this), call.key.currency0);
        int256 d1 = poolManager.currencyDelta(address(this), call.key.currency1);

        uint256 amountOut = call.zeroForOne ? (d1 > 0 ? uint256(d1) : 0) : (d0 > 0 ? uint256(d0) : 0);

        _settleDelta(call.key.currency0, call.payer, call.recipient);
        _settleDelta(call.key.currency1, call.payer, call.recipient);

        if (amountOut < call.minAmountOut) revert InsufficientOutput();
        return abi.encode(amountOut);
    }

    function _swapExactIn(
        PoolKey memory key,
        bool zeroForOne,
        uint256 amountIn,
        uint256 minAmountOut,
        address payer,
        address recipient
    ) internal returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();
        uint160 limit = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
        amountOut = abi.decode(
            poolManager.unlock(
                abi.encode(
                    SwapCall({
                        payer: payer,
                        recipient: recipient,
                        key: key,
                        zeroForOne: zeroForOne,
                        amountIn: amountIn,
                        minAmountOut: minAmountOut,
                        sqrtLimit: limit
                    })
                )
            ),
            (uint256)
        );
    }

    function _settleDelta(Currency currency, address payer, address recipient) internal {
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
