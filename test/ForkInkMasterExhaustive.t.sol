// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {InkForkTestBase} from "./utils/InkForkTestBase.sol";
import {ModuleMatrix} from "./utils/ModuleMatrix.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";

/// @notice Ink fork: exhaustive 512 MasterLaunchHook module masks (8 × 64), ETH + sample USDG.
contract ForkInkMasterExhaustiveTest is InkForkTestBase {
    using StateLibrary for IPoolManager;
    using CurrencyLibrary for Currency;

    function testFork_AllMasks_Batch0() public onlyFork { _runMaskBatch(0, 64, Currency.wrap(address(0))); }
    function testFork_AllMasks_Batch1() public onlyFork { _runMaskBatch(64, 64, Currency.wrap(address(0))); }
    function testFork_AllMasks_Batch2() public onlyFork { _runMaskBatch(128, 64, Currency.wrap(address(0))); }
    function testFork_AllMasks_Batch3() public onlyFork { _runMaskBatch(192, 64, Currency.wrap(address(0))); }
    function testFork_AllMasks_Batch4() public onlyFork { _runMaskBatch(256, 64, Currency.wrap(address(0))); }
    function testFork_AllMasks_Batch5() public onlyFork { _runMaskBatch(320, 64, Currency.wrap(address(0))); }
    function testFork_AllMasks_Batch6() public onlyFork { _runMaskBatch(384, 64, Currency.wrap(address(0))); }
    function testFork_AllMasks_Batch7() public onlyFork { _runMaskBatch(448, 64, Currency.wrap(address(0))); }

    /// @notice USDG quote sample: every 8th mask (64 launches) to keep fork runtime bounded.
    function testFork_Usdg_MaskSample() public onlyFork {
        for (uint16 i; i < 64; ++i) {
            _smoke(uint16(i * 8), usdg);
        }
    }

    /// @notice wSPY quote sample: every 16th mask (32 launches).
    function testFork_Wspyx_MaskSample() public onlyFork {
        for (uint16 i; i < 32; ++i) {
            _smoke(uint16(i * 16), wspyx);
        }
    }

    function _runMaskBatch(uint16 start, uint16 count, Currency quote) internal {
        for (uint16 i; i < count; ++i) {
            _smoke(start + i, quote);
        }
    }

    function _smoke(uint16 mask, Currency quote) internal {
        BitmaskConfig.Modules memory m = ModuleMatrix.fromMask(mask);
        BitmaskConfig.pack(m);

        InkForkTestBase.LaunchResult memory l = _launch(
            creator,
            quote,
            m,
            60,
            ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
            "Ex",
            "EX"
        );

        uint256 supplyBefore = IERC20(l.token).totalSupply();
        (uint256 g0Before, uint256 g1Before) = manager.getFeeGrowthGlobals(l.poolId);

        uint256 buyIn = quote.isAddressZero() ? 0.15 ether : (quote == usdg ? 500e6 : 0.03e18);
        _routerBuy(trader, l.key, l.token, buyIn);
        assertGt(_tokenBalance(l.token, trader), 0);

        if (m.backedFloor) assertGt(vault.reserve(l.token), 0);
        if (m.buybackVesting) {
            (uint128 streamed,,) = buybacks.streams(creator, quote);
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
            if (bal > 0) _routerSell(trader, l.key, l.token, bal / 10);
        }
    }
}
