// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";

import {FeeEscrow} from "../src/FeeEscrow.sol";
import {ProtocolRevenueDistributor} from "../src/ProtocolRevenueDistributor.sol";
import {GraduatedFeeHook} from "../src/GraduatedFeeHook.sol";
import {BondingLaunchFactory} from "../src/BondingLaunchFactory.sol";
import {BondingConstants} from "../src/libraries/BondingConstants.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {LaunchToken} from "../src/LaunchToken.sol";

contract BondingLaunchTest is Test, Deployers {
    using CurrencyLibrary for Currency;

    FeeEscrow internal escrow;
    ProtocolRevenueDistributor internal distributor;
    GraduatedFeeHook internal feeHook;
    BondingLaunchFactory internal bonding;

    address internal ops = address(0xB0B);
    address internal creator = address(0xC0FFEE);
    address internal trader = address(0xBEEF);

    function setUp() public {
        deployFreshManagerAndRouters();
        vm.deal(address(this), 10_000 ether);
        vm.deal(creator, 100 ether);
        vm.deal(trader, 100 ether);
        vm.deal(ops, 1 ether);

        escrow = new FeeEscrow(address(this), manager);
        distributor = new ProtocolRevenueDistributor(address(this), ops, manager);

        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
        address hookAddr = address(flags | (uint160(0xB0AD) << 144));
        bytes memory args = abi.encode(manager, escrow, distributor, address(this));
        deployCodeTo("GraduatedFeeHook.sol:GraduatedFeeHook", args, hookAddr);
        feeHook = GraduatedFeeHook(payable(hookAddr));

        bonding = new BondingLaunchFactory(manager, feeHook, escrow, distributor, address(this), ops);
        feeHook.setFactory(address(bonding));

        escrow.setOperator(address(bonding), true);
        escrow.setOperator(address(feeHook), true);
        distributor.setOperator(address(bonding), true);
        distributor.setOperator(address(feeHook), true);
        feeHook.setOperator(address(this), true);
    }

    function test_GraduationIs42Eth() public view {
        assertEq(bonding.graduationQuoteWei(Currency.wrap(address(0))), 4.2 ether);
        assertEq(ProtocolConstants.GRADUATION_ETH_WEI, 4.2 ether);
    }

    function test_SteadyFeeCappedAt10Percent_MasterAndBonding() public {
        BitmaskConfig.Modules memory m;
        m.hookTaxBps = ProtocolConstants.MAX_HOOK_TAX_BPS; // 9% → total 10%
        BitmaskConfig.pack(m);

        m.hookTaxBps = ProtocolConstants.MAX_HOOK_TAX_BPS + 1;
        vm.expectRevert(BitmaskConfig.HookTaxTooHigh.selector);
        this.packModules(m);

        // Classic rejects any creator tax (base 1% only).
        vm.prank(creator);
        vm.expectRevert(BondingLaunchFactory.CreatorTaxTooHigh.selector);
        bonding.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            BondingLaunchFactory.LaunchParams({
                name: "X",
                symbol: "X",
                metadataURI: "",
                totalSupply: 0,
                quote: Currency.wrap(address(0)),
                creatorTaxBps: 1
            })
        );
    }

    function packModules(BitmaskConfig.Modules memory m) external pure returns (uint256) {
        return BitmaskConfig.pack(m);
    }

    function test_BondingLaunchBuyAndGraduate() public {
        vm.prank(creator);
        (uint256 launchId, address token) = bonding.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            BondingLaunchFactory.LaunchParams({
                name: "Classic",
                symbol: "CLS",
                metadataURI: "",
                totalSupply: 0,
                quote: Currency.wrap(address(0)),
                creatorTaxBps: 0
            })
        );

        assertEq(LaunchToken(token).balanceOf(address(bonding)), BondingConstants.TOTAL_SUPPLY);
        assertEq(_graduation(launchId), 4.2 ether);

        // Net of 1% fee: need > 4.2 / 0.99 ETH to graduate.
        vm.prank(trader);
        (uint256 tokensOut,) = bonding.buy{value: 4.25 ether}(launchId, 0, 1);
        assertGt(tokensOut, 0);
        assertEq(uint8(_phase(launchId)), uint8(BondingLaunchFactory.Phase.Graduated));

        PoolKey memory key = bonding.poolKeyOf(launchId);
        assertEq(address(key.hooks), address(feeHook));
        assertEq(key.fee, 0);

        vm.prank(trader);
        swapRouter.swap{value: 0.05 ether}(
            key,
            SwapParams({
                zeroForOne: true,
                amountSpecified: -int256(0.05 ether),
                sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );

        PoolId poolId = key.toId();
        uint256 pendingEth = feeHook.pendingFees(poolId, Currency.wrap(address(0)))
            + feeHook.pendingCreatorTax(poolId, Currency.wrap(address(0)));
        uint256 pendingTok =
            feeHook.pendingFees(poolId, Currency.wrap(token)) + feeHook.pendingCreatorTax(poolId, Currency.wrap(token));
        assertGt(pendingEth, 0);
        assertEq(pendingTok, 0);
    }

    function test_BondingSellBeforeGraduate() public {
        vm.prank(creator);
        (uint256 launchId, address token) = bonding.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            BondingLaunchFactory.LaunchParams({
                name: "Classic",
                symbol: "CLS",
                metadataURI: "",
                totalSupply: 0,
                quote: Currency.wrap(address(0)),
                creatorTaxBps: 0
            })
        );

        vm.prank(trader);
        (uint256 bought,) = bonding.buy{value: 0.5 ether}(launchId, 0, 1);
        assertEq(uint8(_phase(launchId)), uint8(BondingLaunchFactory.Phase.Bonding));

        vm.startPrank(trader);
        IERC20Minimal(token).approve(address(bonding), bought / 2);
        (uint256 quoteOut,) = bonding.sell(launchId, bought / 2, 1);
        vm.stopPrank();
        assertGt(quoteOut, 0);
    }

    function test_SweepQuoteFees() public {
        vm.prank(creator);
        (uint256 launchId, address token) = bonding.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            BondingLaunchFactory.LaunchParams({
                name: "Classic",
                symbol: "CLS",
                metadataURI: "",
                totalSupply: 0,
                quote: Currency.wrap(address(0)),
                creatorTaxBps: 0
            })
        );

        vm.prank(trader);
        bonding.buy{value: 4.25 ether}(launchId, 0, 1);
        assertEq(uint8(_phase(launchId)), uint8(BondingLaunchFactory.Phase.Graduated));

        PoolKey memory key = bonding.poolKeyOf(launchId);

        vm.prank(trader);
        swapRouter.swap{value: 0.1 ether}(
            key,
            SwapParams({
                zeroForOne: true,
                amountSpecified: -int256(0.1 ether),
                sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );

        uint256 bal = IERC20Minimal(token).balanceOf(trader);
        vm.startPrank(trader);
        IERC20Minimal(token).approve(address(swapRouter), bal / 4);
        swapRouter.swap(
            key,
            SwapParams({
                zeroForOne: false,
                amountSpecified: -int256(bal / 4),
                sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
        vm.stopPrank();

        PoolId poolId = key.toId();
        Currency eth = Currency.wrap(address(0));
        if (feeHook.pendingFees(poolId, eth) + feeHook.pendingCreatorTax(poolId, eth) > 0) {
            uint256 creatorBefore = escrow.balanceOf(creator, eth);
            feeHook.sweepQuote(poolId);
            assertGt(escrow.balanceOf(creator, eth), creatorBefore);
        } else {
            feeHook.sweepWithConversion(key, 1);
            assertGt(escrow.balanceOf(creator, eth) + distributor.pending(eth), 0);
        }
    }

    function test_GraduationEquivalentUsdg() public {
        // Mock USDG @ $1, ETH @ $4000 → 4.2 ETH = $16,800 = 16800e6 USDG.
        address usdg = address(0x1111111111111111111111111111111111111111);
        bonding.setQuote(usdg, true, 6, 1e18, address(0));
        bonding.setEthUsdPrice(4_000e18, address(0));

        uint256 target = bonding.graduationQuoteWei(Currency.wrap(usdg));
        assertEq(target, 16_800e6);
    }

    function _phase(uint256 launchId) internal view returns (BondingLaunchFactory.Phase) {
        (,,, BondingLaunchFactory.Phase phase,,,,,,,,,,,) = bonding.launches(launchId);
        return phase;
    }

    function _graduation(uint256 launchId) internal view returns (uint256) {
        (,,,,,,,,,,, uint256 graduationQuote,,,) = bonding.launches(launchId);
        return graduationQuote;
    }
}
