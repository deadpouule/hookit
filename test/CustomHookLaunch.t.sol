// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {LaunchpadTestBase, LaunchTokenLike} from "./utils/LaunchpadTestBase.sol";
import {HookitCustomHook} from "../src/examples/HookitCustomHook.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {FixedPointMath} from "../src/libraries/FixedPointMath.sol";

contract CustomHookLaunchTest is LaunchpadTestBase {
    using StateLibrary for IPoolManager;

    HookitCustomHook internal customHook;

    function setUp() public {
        deployProtocol();
        address flags =
            address(uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG) | (uint160(0xC057) << 144));
        deployCodeTo("HookitCustomHook.sol:HookitCustomHook", abi.encode(manager), flags);
        customHook = HookitCustomHook(payable(flags));
        factory.setCustomHookAllowed(address(customHook), true);
        factory.setCustomHooksEnabled(true);
    }

    function testCustomHookLaunch() public {
        (uint256 launchId, address token, PoolId poolId) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "Custom",
                symbol: "CST",
                metadataURI: "ipfs://custom",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(address(0)),
                tickSpacing: 60,
                startingTick: 0,
                bitmask: 0,
                customHook: IHooks(address(customHook)),
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );

        (,, IHooks hooks, bool isCustom,,,,) = factory.launches(launchId);
        assertTrue(isCustom);
        assertEq(address(hooks), address(customHook));
        assertLt(LaunchTokenLike(token).balanceOf(address(factory)), 1e15);

        (uint160 sqrtPriceX96,,,) = manager.getSlot0(poolId);
        uint256 mcap = FixedPointMath.quoteFromToken(ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, sqrtPriceX96, false);
        assertApproxEqRel(mcap, factory.launchMcapQuoteWei(), 0.01e18);
    }

    function testCustomHookRevertsWhenDisabled() public {
        factory.setCustomHooksEnabled(false);
        vm.expectRevert(LaunchFactory.CustomHooksDisabled.selector);
        factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "Custom",
                symbol: "CST",
                metadataURI: "ipfs://custom",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(address(0)),
                tickSpacing: 60,
                startingTick: 0,
                bitmask: 0,
                customHook: IHooks(address(customHook)),
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );
    }

    function testCustomHookRevertsWhenNotAllowlisted() public {
        address flags =
            address(uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG) | (uint160(0xC058) << 144));
        deployCodeTo("HookitCustomHook.sol:HookitCustomHook", abi.encode(manager), flags);
        HookitCustomHook unlisted = HookitCustomHook(payable(flags));

        vm.expectRevert(LaunchFactory.CustomHookNotAllowed.selector);
        factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "Custom",
                symbol: "CST",
                metadataURI: "ipfs://custom",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(address(0)),
                tickSpacing: 60,
                startingTick: 0,
                bitmask: 0,
                customHook: IHooks(address(unlisted)),
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );
    }

    function testCustomHookRevertsWithModules() public {
        factory.setCustomHookAllowed(address(customHook), true);
        BitmaskConfig.Modules memory m = defaultModules();
        m.antiSnipe = true;
        m.initialSnipeTaxBps = 500;
        m.antiSnipeDurationSeconds = 900;
        vm.expectRevert(LaunchFactory.ModulesNotSupportedWithCustomHook.selector);
        factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "Custom",
                symbol: "CST",
                metadataURI: "ipfs://custom",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(address(0)),
                tickSpacing: 60,
                startingTick: 0,
                bitmask: BitmaskConfig.pack(m),
                customHook: IHooks(address(customHook)),
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );
    }
}
