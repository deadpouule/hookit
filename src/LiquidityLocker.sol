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

/// @title LiquidityLocker
/// @notice Holds the permanent full-range graduation position. No withdraw path exists.
contract LiquidityLocker is IUnlockCallback {
    using CurrencyLibrary for Currency;
    using CurrencySettler for Currency;

    bytes32 public constant GRADUATION_SALT = keccak256("HOOKIT.BONDING.GRADUATION");

    IPoolManager public immutable poolManager;
    address public immutable factory;

    error NotFactory();
    error NotPoolManager();
    error ZeroLiquidity();

    modifier onlyFactory() {
        if (msg.sender != factory) revert NotFactory();
        _;
    }

    constructor(IPoolManager manager_, address factory_) {
        poolManager = manager_;
        factory = factory_;
    }

    receive() external payable {}

    /// @notice Initialize pool (if needed) and mint full-range LP owned by this locker forever.
    function seed(
        PoolKey calldata key,
        uint160 sqrtPriceX96,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        address quote,
        uint256 quoteIn,
        address token,
        uint256 tokenIn
    ) external payable onlyFactory {
        if (liquidity == 0) revert ZeroLiquidity();
        if (quote != address(0) && quoteIn > 0) {
            IERC20Minimal(quote).transferFrom(msg.sender, address(this), quoteIn);
            IERC20Minimal(quote).approve(address(poolManager), quoteIn);
        }
        if (tokenIn > 0) {
            IERC20Minimal(token).transferFrom(msg.sender, address(this), tokenIn);
            IERC20Minimal(token).approve(address(poolManager), tokenIn);
        }
        poolManager.unlock(abi.encode(key, sqrtPriceX96, tickLower, tickUpper, int256(uint256(liquidity))));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        (PoolKey memory key, uint160 sqrtPriceX96, int24 tickLower, int24 tickUpper, int256 liqDelta) =
            abi.decode(data, (PoolKey, uint160, int24, int24, int256));

        poolManager.initialize(key, sqrtPriceX96);

        (BalanceDelta delta,) = poolManager.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: liqDelta, salt: GRADUATION_SALT
            }),
            ""
        );

        _settle(key.currency0, delta.amount0());
        _settle(key.currency1, delta.amount1());
        return "";
    }

    function _settle(Currency currency, int128 delta) private {
        if (delta < 0) {
            currency.settle(poolManager, address(this), uint256(uint128(-delta)), false);
        } else if (delta > 0) {
            currency.take(poolManager, address(this), uint256(uint128(delta)), false);
        }
    }
}
