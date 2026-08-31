// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

import {InkForkTestBase} from "./utils/InkForkTestBase.sol";
import {FeeEthRail} from "../src/FeeEthRail.sol";
import {EthUsdgBridgeLib} from "../src/libraries/EthUsdgBridgeLib.sol";
import {EthUsdgBridgeSeeder} from "../src/EthUsdgBridgeSeeder.sol";
import {QuotronBridge} from "../src/libraries/QuotronBridge.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {HookitSwapRouter} from "../src/HookitSwapRouter.sol";

/// @notice Ink fork: Quotrons composite buy + fee rail wStock→USDG→ETH.
contract ForkInkCompositeAndRailTest is InkForkTestBase {
    using CurrencyLibrary for Currency;

    FeeEthRail internal feeRail;
    EthUsdgBridgeSeeder internal seeder;

    function setUp() public override {
        super.setUp();
        if (!forkReady) return;

        feeRail = new FeeEthRail(deployer, manager, Currency.unwrap(usdg));
        distributor.setFeeRail(feeRail);
        EthUsdgBridgeLib.initializeEmpty(manager, Currency.unwrap(usdg));
        EthUsdgBridgeLib.wireLive(manager, feeRail, EthUsdgBridgeLib.poolKey(Currency.unwrap(usdg)), address(0));
        seeder = new EthUsdgBridgeSeeder(manager);

        deal(Currency.unwrap(usdg), address(this), 2_000_000e6);
        IERC20(Currency.unwrap(usdg)).approve(address(seeder), type(uint256).max);
        seeder.seed{value: 20 ether}(Currency.unwrap(usdg), 2_000_000e6, -600, 600, 1e18);
    }

    function testFork_CompositeUsdgToWspyxToToken() public onlyFork {
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, wspyx, _defaultModules(), 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "Cmp", "CMP");

        PoolKey memory bridgeKey = QuotronBridge.poolKey(QuotronStockQuotes.wSPYx);
        bool bridgeZfo = QuotronBridge.zeroForOne(QuotronStockQuotes.wSPYx, Currency.unwrap(usdg));

        uint256 usdgIn = 50e6;
        vm.startPrank(trader);
        IERC20(Currency.unwrap(usdg)).approve(address(router), usdgIn);

        uint256 balBefore = _tokenBalance(l.token, trader);
        bool hookZfo = _buyZeroForOne(l.key, l.token);
        uint256 tokensOut = router.swapExactInComposite(bridgeKey, bridgeZfo, usdgIn, l.key, hookZfo, wspyx, 1, 0, 0);
        vm.stopPrank();

        assertGt(tokensOut, 0);
        assertEq(_tokenBalance(l.token, trader), balBefore + tokensOut);
    }

    function testFork_FeeRail_StockToUsdgThenBuybackWallet() public onlyFork {
        distributor.setBuybackExecutor(address(hkitBuyback));

        uint256 stockIn = 0.01e18;
        deal(Currency.unwrap(wspyx), address(this), stockIn);
        IERC20(Currency.unwrap(wspyx)).approve(address(distributor), stockIn);
        distributor.notify(wspyx, stockIn);

        uint256 opsUsdgBefore = IERC20(Currency.unwrap(usdg)).balanceOf(ops);
        uint256 buybackUsdgBefore = IERC20(Currency.unwrap(usdg)).balanceOf(address(hkitBuyback));

        distributor.distributeToBuyback(wspyx, 1);

        assertEq(distributor.pending(wspyx), 0);
        assertGt(IERC20(Currency.unwrap(usdg)).balanceOf(ops), opsUsdgBefore);
        assertGt(IERC20(Currency.unwrap(usdg)).balanceOf(address(hkitBuyback)), buybackUsdgBefore);
    }

    function testFork_CompositeRejectsForeignBridgeHook() public onlyFork {
        PoolKey memory bridgeKey = QuotronBridge.poolKey(QuotronStockQuotes.wSPYx);
        bridgeKey.hooks = IHooks(address(hook));

        vm.startPrank(trader);
        IERC20(Currency.unwrap(usdg)).approve(address(router), 1e6);
        vm.expectRevert(HookitSwapRouter.UnauthorizedBridgeHook.selector);
        router.swapExactInComposite(
            bridgeKey,
            true,
            1e6,
            PoolKey({
                currency0: Currency.wrap(address(0)),
                currency1: Currency.wrap(address(0xBEEF)),
                fee: 0,
                tickSpacing: 60,
                hooks: IHooks(address(hook))
            }),
            true,
            Currency.wrap(address(0)),
            1,
            0,
            0
        );
        vm.stopPrank();
    }
}
