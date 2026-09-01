// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

/// @title IMasterLaunchHook
interface IMasterLaunchHook is IHooks {
    struct LaunchState {
        address creator;
        address token;
        Currency quote;
        uint64 launchTimestamp;
        int24 tickLower;
        int24 tickUpper;
        uint128 seedLiquidity;
        bool tokenIsCurrency0;
        bool initialized;
    }

    struct PrepareParams {
        PoolKey key;
        uint256 bitmask;
        address creator;
        address token;
        int24 tickLower;
        int24 tickUpper;
        bool tokenIsCurrency0;
    }

    function configs(PoolId poolId) external view returns (uint256);
    function launchState(PoolId poolId) external view returns (LaunchState memory);
    function prepareLaunch(PrepareParams calldata params) external;
    function factory() external view returns (address);
    function floorVault() external view returns (address);
    function feeEscrow() external view returns (address);
    function revenueDistributor() external view returns (address);
    function buybackVault() external view returns (address);
}
