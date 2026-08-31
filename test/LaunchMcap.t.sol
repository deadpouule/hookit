// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {LaunchpadTestBase, LaunchTokenLike} from "./utils/LaunchpadTestBase.sol";
import {FixedPointMath} from "../src/libraries/FixedPointMath.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";

contract LaunchMcapTest is LaunchpadTestBase {
    using StateLibrary for IPoolManager;

    function setUp() public {
        deployProtocol();
    }

    function testLaunchFdvIsFourThousandUsd() public {
        assertEq(factory.ethUsdPriceX18(), ProtocolConstants.DEFAULT_LAUNCH_ETH_USD_X18);

        uint256 expectedMcapEth = factory.launchMcapQuoteWei();
        assertEq(expectedMcapEth, 1 ether, "at $4k ETH price, FDV should be 1 ETH");

        uint256 supply = ProtocolConstants.DEFAULT_LAUNCH_SUPPLY;
        (, address token, PoolId poolId,) = launchToken(defaultModules(), 0, supply);

        (uint160 sqrtPriceX96,,,) = manager.getSlot0(poolId);
        uint256 spotMcap = FixedPointMath.quoteFromToken(supply, sqrtPriceX96, false);

        // Initialized just above tickUpper; allow small rounding vs tick boundary.
        assertApproxEqRel(spotMcap, expectedMcapEth, 0.01e18, "spot FDV");
        assertGt(sqrtPriceX96, 0);
        assertLt(LaunchTokenLike(token).balanceOf(address(factory)), 1e15);
    }

    function testLaunchMcapScalesWithEthUsdPrice() public {
        factory.setEthUsdPrice(2_000e18);
        uint256 expectedMcapEth = factory.launchMcapQuoteWei();
        assertEq(expectedMcapEth, 2 ether);

        (,, PoolId poolId,) = launchToken(defaultModules(), 0, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);
        (uint160 sqrtPriceX96,,,) = manager.getSlot0(poolId);
        uint256 spotMcap = FixedPointMath.quoteFromToken(ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, sqrtPriceX96, false);
        assertApproxEqRel(spotMcap, expectedMcapEth, 0.01e18);
    }
}
