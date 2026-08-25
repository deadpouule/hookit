// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LaunchpadTestBase, LaunchTokenLike} from "./utils/LaunchpadTestBase.sol";
import {HookitSwapRouter} from "../src/HookitSwapRouter.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

contract HookitSwapRouterTest is LaunchpadTestBase {
    HookitSwapRouter internal router;
    address internal trader = address(0xA11CE);

    function setUp() public {
        deployProtocol();
        router = new HookitSwapRouter(manager);
        vm.deal(trader, 50 ether);
    }

    function testBuyThenSellExactIn() public {
        (, address token,, PoolKey memory key) =
            launchToken(defaultModules(), 0, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);

        vm.startPrank(trader);
        uint256 tokensOut = router.swapExactIn{value: 0.05 ether}(key, true, 0.05 ether, 1, 0);
        assertGt(tokensOut, 0);
        assertEq(LaunchTokenLike(token).balanceOf(trader), tokensOut);

        uint256 sellAmount = tokensOut / 4;
        LaunchTokenLike(token).approve(address(router), sellAmount);
        uint256 ethBefore = trader.balance;
        uint256 ethOut = router.swapExactIn(key, false, sellAmount, 1, 0);
        assertGt(ethOut, 0);
        assertEq(trader.balance, ethBefore + ethOut);
        vm.stopPrank();
    }

    function testSlippageReverts() public {
        (,,, PoolKey memory key) = launchToken(defaultModules(), 0, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);

        vm.prank(trader);
        vm.expectRevert(HookitSwapRouter.InsufficientOutput.selector);
        router.swapExactIn{value: 0.01 ether}(key, true, 0.01 ether, type(uint256).max, TickMath.MIN_SQRT_PRICE + 1);
    }

    function testGetLaunchPageAndPoolKey() public {
        (uint256 launchId, address token,,) =
            launchToken(defaultModules(), 0, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);

        (LaunchFactory.LaunchInfo[] memory infos, uint256[] memory bitmasks, uint64[] memory timestamps, uint256 total)
        = factory.getLaunchPage(1, 10);

        assertEq(total, 1);
        assertEq(infos.length, 1);
        assertEq(infos[0].token, token);
        assertEq(infos[0].creator, address(this));
        assertEq(bitmasks.length, 1);
        assertGt(timestamps[0], 0);

        PoolKey memory key = factory.poolKeyOf(launchId);
        assertEq(Currency.unwrap(key.currency0), address(0));
        assertEq(Currency.unwrap(key.currency1), token);
        assertEq(key.tickSpacing, 60);
        assertEq(key.fee, 0);
        assertEq(address(key.hooks), address(hook));
    }
}
