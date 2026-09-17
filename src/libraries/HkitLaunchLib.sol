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
/// @notice Fair-launch the protocol native token (ETH pair, buyback flywheel).
/// @dev Modules: Anti-MEV, Anti-Snipe, Creator → Hook (60% of the 1% into the hook pot),
///      Auto-Burn 80% / Deepen LPs 20%. Protocol 80% of every launch still buys and burns the token.
library HkitLaunchLib {
    function defaultModules() internal pure returns (BitmaskConfig.Modules memory m) {
        m.antiSnipe = true;
        m.antiMev = true;
        m.creatorShareToHook = true;
        m.autoBurn = true;
        m.deepenLps = true;
        m.antiSnipeDurationSeconds = ProtocolConstants.HKIT_ANTI_SNIPE_DURATION_SECONDS;
        m.initialSnipeTaxBps = ProtocolConstants.DEFAULT_INITIAL_SNIPE_TAX_BPS;
        m.autoBurnBps = 8_000;
        m.deepenLpsBps = 2_000;
    }

    /// @notice Launch native token, register flywheel, configure buyback executor.
    function fairLaunch(
        LaunchFactory factory,
        ProtocolRevenueDistributor distributor,
        HkitBuyback buyback,
        string memory name,
        string memory symbol,
        string memory metadataURI
    ) internal returns (uint256 launchId, address token, PoolId poolId, PoolKey memory key) {
        (launchId, token, poolId) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: name,
                symbol: symbol,
                metadataURI: metadataURI,
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(address(0)),
                tickSpacing: ProtocolConstants.DEFAULT_TICK_SPACING,
                startingTick: 0,
                bitmask: BitmaskConfig.pack(defaultModules()),
                customHook: IHooks(address(0)),
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0,
                vestPacked: 0
            })
        );
        key = factory.poolKeyOf(launchId);

        distributor.setNativeToken(token, IFloorVault(address(0)));
        distributor.setFlywheelMode(ProtocolRevenueDistributor.FlywheelMode.BuybackBurn);
        buyback.configure(token, key);
        distributor.setBuybackExecutor(address(buyback));
    }
}
