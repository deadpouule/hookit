// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";

import {BitmaskConfig} from "./BitmaskConfig.sol";
import {ProtocolConstants} from "./ProtocolConstants.sol";
import {LaunchFactory} from "../LaunchFactory.sol";
import {ProtocolRevenueDistributor} from "../ProtocolRevenueDistributor.sol";
import {HkitBuyback} from "../HkitBuyback.sol";
import {IFloorVault} from "../interfaces/IFloorVault.sol";

/// @title HkitLaunchLib
/// @notice Fair-launch HOOKIT/HKIT as the protocol native token (ETH pair, buyback flywheel).
library HkitLaunchLib {
    function defaultModules() internal pure returns (BitmaskConfig.Modules memory m) {
        m.antiSnipe = true;
        m.antiMev = true;
        m.lpDonate = true;
        m.creatorTaxBps = 0;
        m.antiSnipeDurationSeconds = ProtocolConstants.HKIT_ANTI_SNIPE_DURATION_SECONDS;
        m.initialSnipeTaxBps = ProtocolConstants.DEFAULT_INITIAL_SNIPE_TAX_BPS;
        m.lpDonateBps = ProtocolConstants.HKIT_LP_DONATE_BPS;
    }

    /// @notice Launch HKIT, register as native token, configure buyback executor.
    function fairLaunch(
        LaunchFactory factory,
        ProtocolRevenueDistributor distributor,
        HkitBuyback buyback,
        string memory metadataURI
    ) internal returns (uint256 launchId, address token, PoolId poolId, PoolKey memory key) {
        (launchId, token, poolId) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "HOOKIT",
                symbol: "HKIT",
                metadataURI: metadataURI,
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(address(0)),
                tickSpacing: ProtocolConstants.DEFAULT_TICK_SPACING,
                startingTick: 0,
                bitmask: BitmaskConfig.pack(defaultModules()),
                customHook: IHooks(address(0))
            })
        );
        key = factory.poolKeyOf(launchId);

        distributor.setNativeToken(token, IFloorVault(address(0)));
        distributor.setFlywheelMode(ProtocolRevenueDistributor.FlywheelMode.BuybackBurn);
        buyback.configure(token, key);
        distributor.setBuybackExecutor(address(buyback));
    }
}
