// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";

import {CurrencySettler} from "./libraries/CurrencySettler.sol";
import {EthUsdgBridgeLib} from "./libraries/EthUsdgBridgeLib.sol";

/// @title EthUsdgBridgeSeeder
/// @notice One-shot helper to add concentrated liquidity to the ETH/stable fee-rail pool.
contract EthUsdgBridgeSeeder is IUnlockCallback {
    using CurrencyLibrary for Currency;
    using CurrencySettler for Currency;

    IPoolManager public immutable poolManager;

    error NotPoolManager();
    error ZeroAmount();

    constructor(IPoolManager manager_) {
        poolManager = manager_;
    }

    receive() external payable {}

    /// @notice Seed the canonical ETH/stable bridge. Caller supplies ETH via `msg.value` and must
    ///         `approve` this contract for `stableIn` of the stable token.
    function seed(address stable, uint256 stableIn, int24 tickLower, int24 tickUpper, uint128 liquidity)
        external
        payable
    {
        if (msg.value == 0 || stableIn == 0 || liquidity == 0) revert ZeroAmount();
        PoolKey memory key = EthUsdgBridgeLib.poolKey(stable);
        IERC20Minimal(stable).transferFrom(msg.sender, address(this), stableIn);
        IERC20Minimal(stable).approve(address(poolManager), stableIn);

        poolManager.unlock(abi.encode(key, tickLower, tickUpper, int256(uint256(liquidity)), msg.sender));

        // Refund leftovers.
        uint256 ethLeft = address(this).balance;
        if (ethLeft > 0) CurrencyLibrary.ADDRESS_ZERO.transfer(msg.sender, ethLeft);
        uint256 stableLeft = IERC20Minimal(stable).balanceOf(address(this));
        if (stableLeft > 0) IERC20Minimal(stable).transfer(msg.sender, stableLeft);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        (PoolKey memory key, int24 tickLower, int24 tickUpper, int256 liqDelta, address payer) =
            abi.decode(data, (PoolKey, int24, int24, int256, address));

        (BalanceDelta delta,) = poolManager.modifyLiquidity(
            key,
            ModifyLiquidityParams({tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: liqDelta, salt: 0}),
            ""
        );

        _settle(key.currency0, delta.amount0(), payer);
        _settle(key.currency1, delta.amount1(), payer);
        return "";
    }

    function _settle(Currency currency, int128 delta, address payer) private {
        if (delta < 0) {
            uint256 amount = uint256(uint128(-delta));
            if (currency.isAddressZero()) {
                currency.settle(poolManager, address(this), amount, false);
            } else {
                currency.settle(poolManager, address(this), amount, false);
            }
        } else if (delta > 0) {
            currency.take(poolManager, payer, uint256(uint128(delta)), false);
        }
    }
}
