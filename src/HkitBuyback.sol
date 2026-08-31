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
import {ILaunchToken} from "./interfaces/ILaunchToken.sol";
import {IHkitBuybackSource} from "./interfaces/IHkitBuybackSource.sol";

/// @title HkitBuyback
/// @notice Permissionless keeper: pulls accumulated ETH from the distributor, buys HKIT, burns it.
contract HkitBuyback is Owned, IUnlockCallback {
    using CurrencyLibrary for Currency;
    using CurrencySettler for Currency;
    using TransientStateLibrary for IPoolManager;

    IPoolManager public immutable poolManager;
    IHkitBuybackSource public immutable source;

    address public hkit;
    PoolKey public poolKey;
    bool public configured;

    error NotPoolManager();
    error NotConfigured();
    error ZeroAmount();
    error InsufficientOutput();
    error BadPool();

    event Configured(address indexed hkit, PoolKey key);
    event BuybackBurned(uint256 ethIn, uint256 tokensBurned, address indexed caller);

    struct SwapCall {
        uint256 ethIn;
        uint256 minTokensOut;
        bool zeroForOne;
    }

    constructor(address owner_, IPoolManager manager_, IHkitBuybackSource source_) Owned(owner_) {
        poolManager = manager_;
        source = source_;
    }

    receive() external payable {}

    function configure(address hkit_, PoolKey calldata key) external onlyOwner {
        address c0 = Currency.unwrap(key.currency0);
        address c1 = Currency.unwrap(key.currency1);
        bool hasEth = c0 == address(0) || c1 == address(0);
        bool hasHkit = c0 == hkit_ || c1 == hkit_;
        if (!hasEth || !hasHkit || hkit_ == address(0)) revert BadPool();

        hkit = hkit_;
        poolKey = key;
        configured = true;
        emit Configured(hkit_, key);
    }

    /// @notice Spend up to `ethAmount` of distributor buyback ETH to buy + burn HKIT.
    function execute(uint256 ethAmount, uint256 minTokensOut) external returns (uint256 tokensBurned) {
        if (!configured) revert NotConfigured();
        if (ethAmount == 0) revert ZeroAmount();

        source.flushBuybackEth();
        uint256 pulled = source.pullBuybackEth(ethAmount);
        if (pulled == 0) revert ZeroAmount();

        bool zeroForOne = Currency.unwrap(poolKey.currency0) == address(0);
        tokensBurned = abi.decode(
            poolManager.unlock(
                abi.encode(SwapCall({ethIn: pulled, minTokensOut: minTokensOut, zeroForOne: zeroForOne}))
            ),
            (uint256)
        );

        emit BuybackBurned(pulled, tokensBurned, msg.sender);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        SwapCall memory call = abi.decode(data, (SwapCall));

        poolManager.swap(
            poolKey,
            SwapParams({
                zeroForOne: call.zeroForOne,
                amountSpecified: -int256(call.ethIn),
                sqrtPriceLimitX96: call.zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );

        Currency eth = Currency.wrap(address(0));
        Currency token = Currency.wrap(hkit);

        int256 ethDelta = poolManager.currencyDelta(address(this), eth);
        int256 tokenDelta = poolManager.currencyDelta(address(this), token);

        if (ethDelta < 0) {
            eth.settle(poolManager, address(this), uint256(-ethDelta), false);
        }
        uint256 tokensOut = tokenDelta > 0 ? uint256(tokenDelta) : 0;
        if (tokensOut < call.minTokensOut) revert InsufficientOutput();
        if (tokensOut > 0) {
            token.take(poolManager, address(this), tokensOut, false);
            ILaunchToken(hkit).burn(tokensOut);
        }

        // Refund unused ETH to the buyback source.
        int256 ethLeft = poolManager.currencyDelta(address(this), eth);
        if (ethLeft > 0) {
            eth.take(poolManager, address(this), uint256(ethLeft), false);
        }
        uint256 dust = address(this).balance;
        if (dust > 0) {
            source.returnBuybackEth{value: dust}();
        }

        return abi.encode(tokensOut);
    }
}
