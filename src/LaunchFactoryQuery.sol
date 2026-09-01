// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

import {LaunchFactory} from "./LaunchFactory.sol";

/// @notice Read-only launch index helpers kept out of LaunchFactory to save bytecode.
contract LaunchFactoryQuery {
    LaunchFactory public immutable factory;

    constructor(LaunchFactory factory_) {
        factory = factory_;
    }

    /// @notice Paginated launches for indexers / the app. `startId` is 1-indexed.
    function getLaunchPage(uint256 startId, uint256 limit)
        external
        view
        returns (
            LaunchFactory.LaunchInfo[] memory infos,
            uint256[] memory bitmasks,
            uint64[] memory timestamps,
            uint256 total
        )
    {
        total = factory.launchCount();
        if (startId == 0 || startId > total || limit == 0) {
            return (new LaunchFactory.LaunchInfo[](0), new uint256[](0), new uint64[](0), total);
        }
        uint256 end = startId + limit - 1;
        if (end > total) end = total;
        uint256 n = end - startId + 1;
        infos = new LaunchFactory.LaunchInfo[](n);
        bitmasks = new uint256[](n);
        timestamps = new uint64[](n);
        for (uint256 i; i < n; ++i) {
            uint256 id = startId + i;
            (
                address token,
                address creator,
                IHooks hooks,
                bool customHook,
                PoolId poolId,
                int24 tickLower,
                int24 tickUpper,
                uint128 liquidity
            ) = factory.launches(id);
            infos[i] = LaunchFactory.LaunchInfo({
                token: token,
                creator: creator,
                hooks: hooks,
                customHook: customHook,
                poolId: poolId,
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidity: liquidity
            });
            bitmasks[i] = factory.launchBitmasks(id);
            timestamps[i] = factory.launchedAt(id);
        }
    }
}
