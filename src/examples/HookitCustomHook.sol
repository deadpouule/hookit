// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "../base/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

/// @title HookitCustomHook
/// @notice Minimal example custom hook for Hookit launches (no Hookit modules — passive pass-through).
/// @dev Mine with `DeployCustomHook.s.sol` before launching via the factory.
contract HookitCustomHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    event CustomPoolInitialized(bytes32 indexed poolId, address indexed caller);

    constructor(IPoolManager poolManager_) BaseHook(poolManager_) {}

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: false,
            beforeAddLiquidity: true,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: false,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function _beforeInitialize(address sender, PoolKey calldata key, uint160) internal override returns (bytes4) {
        emit CustomPoolInitialized(PoolId.unwrap(key.toId()), sender);
        return this.beforeInitialize.selector;
    }

    function _beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        internal
        pure
        override
        returns (bytes4)
    {
        return this.beforeAddLiquidity.selector;
    }
}
