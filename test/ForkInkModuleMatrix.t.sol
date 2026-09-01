// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {InkForkTestBase} from "./utils/InkForkTestBase.sol";
import {ModuleMatrix} from "./utils/ModuleMatrix.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {MasterLaunchHook} from "../src/MasterLaunchHook.sol";

/// @notice Ink fork: representative module combinations (kitchen sink, singles, pairs, fuzz sample).
contract ForkInkModuleMatrixTest is InkForkTestBase {
    using StateLibrary for IPoolManager;

    // ─── Kitchen sink ─────────────────────────────────────────────────────────

    function testFork_KitchenSink_AllModules() public onlyFork {
        _smokeLaunchAndSwap(ModuleMatrix.MASK_SPACE - 1);
    }

    // ─── One module at a time ─────────────────────────────────────────────────

    function testFork_Single_AntiSnipe() public onlyFork {
        _smokeLaunchAndSwap(ModuleMatrix.BIT_ANTI_SNIPE);
    }

    function testFork_Single_BackedFloor() public onlyFork {
        _smokeLaunchAndSwap(ModuleMatrix.BIT_BACKED_FLOOR);
    }

    function testFork_Single_AntiMev() public onlyFork {
        _smokeLaunchAndSwap(ModuleMatrix.BIT_ANTI_MEV);
    }

    function testFork_Single_MaxTx() public onlyFork {
        _smokeLaunchAndSwap(ModuleMatrix.BIT_MAX_TX);
    }

    function testFork_Single_MaxWallet() public onlyFork {
        _smokeLaunchAndSwap(ModuleMatrix.BIT_MAX_WALLET);
    }

    function testFork_Single_DynamicFees() public onlyFork {
        _smokeLaunchAndSwap(ModuleMatrix.BIT_DYNAMIC_FEES);
    }

    function testFork_Single_BuybackVesting() public onlyFork {
        _smokeLaunchAndSwap(ModuleMatrix.BIT_BUYBACK_VESTING);
    }

    function testFork_Single_AutoBurn() public onlyFork {
        _smokeLaunchAndSwap(ModuleMatrix.BIT_AUTO_BURN);
    }

    function testFork_Single_LpDonate() public onlyFork {
        _smokeLaunchAndSwap(ModuleMatrix.BIT_LP_DONATE);
    }

    // ─── Meaningful pairs users might combine ─────────────────────────────────

    function testFork_Pair_AntiSnipeAntiMev() public onlyFork {
        _smokeLaunchAndSwap(ModuleMatrix.BIT_ANTI_SNIPE | ModuleMatrix.BIT_ANTI_MEV);
    }

    function testFork_Pair_FloorAndBurn() public onlyFork {
        _smokeLaunchAndSwap(ModuleMatrix.BIT_BACKED_FLOOR | ModuleMatrix.BIT_AUTO_BURN);
    }

    function testFork_Pair_FloorAndDonate() public onlyFork {
        _smokeLaunchAndSwap(ModuleMatrix.BIT_BACKED_FLOOR | ModuleMatrix.BIT_LP_DONATE);
    }

    function testFork_Pair_BurnAndDonate() public onlyFork {
        _smokeLaunchAndSwap(ModuleMatrix.BIT_AUTO_BURN | ModuleMatrix.BIT_LP_DONATE);
    }

    function testFork_Pair_MaxTxMaxWallet() public onlyFork {
        _smokeLaunchAndSwap(ModuleMatrix.BIT_MAX_TX | ModuleMatrix.BIT_MAX_WALLET);
    }

    function testFork_Pair_TaxAndBuyback() public onlyFork {
        _smokeLaunchAndSwap(ModuleMatrix.BIT_BUYBACK_VESTING | ModuleMatrix.BIT_ANTI_SNIPE);
    }

    function testFork_Triple_FloorBurnDonate() public onlyFork {
        _smokeLaunchAndSwap(ModuleMatrix.BIT_BACKED_FLOOR | ModuleMatrix.BIT_AUTO_BURN | ModuleMatrix.BIT_LP_DONATE);
    }

    // ─── Fuzz sample on fork (32 masks) ───────────────────────────────────────

    function testFork_Fuzz_ModuleMaskSample(uint8 seed) public onlyFork {
        uint16 mask = uint16(uint256(seed) * 17 % ModuleMatrix.MASK_SPACE);
        _smokeLaunchAndSwap(mask);
    }

    // ─── Behavioral on fork ───────────────────────────────────────────────────

    function testFork_MaxWallet_RevertsOnExcess() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.maxWallet = true;
        m.maxWalletBps = 10;
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, Currency.wrap(address(0)), m, 60, 1_000_000_000e18, "MW", "MW");

        _routerBuy(trader, l.key, l.token, 5 ether);
        vm.expectRevert();
        _routerBuy(trader, l.key, l.token, 2 ether);
    }

    function testFork_BuybackVesting_CreditsVault() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.buybackVesting = true;
        m.hookTaxBps = 100;
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, Currency.wrap(address(0)), m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "BB", "BB");

        _routerBuy(trader, l.key, l.token, 1 ether);
        (, uint128 streamed,,,) = buybacks.streams(creator, l.token);
        assertGt(streamed, 0);
        assertEq(escrow.balanceOf(creator, Currency.wrap(address(0))), 0);
    }

    function testFork_DynamicFees_FlagOnPool() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.dynamicFees = true;
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, Currency.wrap(address(0)), m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "DF", "DF");
        assertTrue(l.key.fee & LPFeeLibrary.DYNAMIC_FEE_FLAG != 0);
        _routerBuy(trader, l.key, l.token, 0.1 ether);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function _smokeLaunchAndSwap(uint16 mask) internal {
        BitmaskConfig.Modules memory m = ModuleMatrix.fromMask(mask);
        BitmaskConfig.pack(m);

        InkForkTestBase.LaunchResult memory l =
            _launch(creator, Currency.wrap(address(0)), m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "Mod", "MOD");

        uint256 supplyBefore = IERC20(l.token).totalSupply();
        (uint256 g0Before, uint256 g1Before) = manager.getFeeGrowthGlobals(l.poolId);

        _routerBuy(trader, l.key, l.token, 0.2 ether);
        assertGt(_tokenBalance(l.token, trader), 0);

        if (m.backedFloor) assertGt(vault.reserve(l.token), 0);
        if (m.buybackVesting) {
            (, uint128 streamed,,,) = buybacks.streams(creator, l.token);
            assertGt(streamed, 0);
        }
        if (m.autoBurn) assertLt(IERC20(l.token).totalSupply(), supplyBefore);
        if (m.lpDonate) {
            (uint256 g0After, uint256 g1After) = manager.getFeeGrowthGlobals(l.poolId);
            assertTrue(g0After > g0Before || g1After > g1Before);
        }

        if (!m.antiMev) {
            vm.roll(block.number + 1);
            uint256 bal = _tokenBalance(l.token, trader);
            _routerSell(trader, l.key, l.token, bal / 8);
        }
    }
}
