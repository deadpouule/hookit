// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

import {LaunchpadTestBase, LaunchTokenLike} from "./utils/LaunchpadTestBase.sol";
import {MockQuoteToken} from "./mocks/MockQuoteToken.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";

/// @notice Hooks must coexist on one token: claims-native floor fill, airdrop without nested unlock,
///         and multi-market vesting/airdrop keyed by quote.
contract ModuleCohabitationTest is LaunchpadTestBase, IUnlockCallback {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    address internal trader = address(0xBEEF);
    MockQuoteToken internal quoteA;

    function setUp() public {
        deployProtocol();
        vm.deal(trader, 1000 ether);
        quoteA = new MockQuoteToken("Quote A", "QTA", 18);
        factory.setQuote(address(quoteA), true, 18, 2_000e18, address(0));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        uint256 amount = abi.decode(data, (uint256));
        manager.sync(CurrencyLibrary.ADDRESS_ZERO);
        manager.settle{value: amount}();
        manager.mint(address(vault), 0, amount);
        return "";
    }

    function testClaimsOnlyReserve_FloorFillPaysClaims() public {
        (address token, PoolKey memory key) = _launchFloor();
        _buyAs(trader, key, 0.5 ether);
        vm.roll(block.number + 1);

        manager.unlock(abi.encode(uint256(3 ether)));
        vault.depositInternal(token, Currency.wrap(address(0)), 3 ether);
        assertEq(address(vault).balance, 0);
        assertGt(manager.balanceOf(address(vault), 0), 0);

        uint256 bal = LaunchTokenLike(token).balanceOf(trader);
        uint256 before = trader.balance;
        _sellAs(trader, key, token, bal / 2);
        assertGt(trader.balance, before);
    }

    function testRealEthReserve_FloorFillStillWorks() public {
        (address token, PoolKey memory key) = _launchFloor();
        _buyAs(trader, key, 0.5 ether);
        vm.roll(block.number + 1);

        vault.deposit{value: 3 ether}(token, Currency.wrap(address(0)), 3 ether);

        uint256 bal = LaunchTokenLike(token).balanceOf(trader);
        uint256 before = trader.balance;
        _sellAs(trader, key, token, bal / 2);
        assertGt(trader.balance, before);
    }

    function testAirdropMixedBacking_DoesNotBrickSwaps() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 200;
        m.holderAirdrop = true;
        m.holderAirdropBps = 10_000;
        m.holderAirdropEpochSeconds = 60;
        (uint256 launchId, address token,, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);
        key = factory.poolKeyOf(launchId);

        _buyAs(trader, key, 1 ether);
        assertGt(airdrops.reserve(token), 0);
        assertGt(manager.balanceOf(address(airdrops), 0), 0);

        airdrops.deposit{value: 0.5 ether}(token, Currency.wrap(address(0)), 0.5 ether);

        vm.warp(block.timestamp + 61);
        vm.roll(block.number + 1);
        uint256 claimsBefore = manager.balanceOf(trader, 0);
        _buyAs(trader, key, 0.01 ether);
        assertGt(manager.balanceOf(trader, 0), claimsBefore);
    }

    function testFloorPlusAirdrop_KitchenSinkSellAndEpoch() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 200;
        m.backedFloor = true;
        m.floorAllocationBps = 5_000;
        m.holderAirdrop = true;
        m.holderAirdropBps = 5_000;
        m.holderAirdropEpochSeconds = 60;
        (uint256 launchId, address token,, PoolKey memory key) =
            launchToken(m, 0, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);
        key = factory.poolKeyOf(launchId);

        _buyAs(trader, key, 1 ether);
        vm.roll(block.number + 1);
        assertGt(vault.reserve(token), 0);
        assertGt(airdrops.reserve(token), 0);

        uint256 bal = LaunchTokenLike(token).balanceOf(trader);
        _sellAs(trader, key, token, bal / 4);

        vm.warp(block.timestamp + 61);
        vm.roll(block.number + 1);
        _buyAs(trader, key, 0.02 ether);
        vm.roll(block.number + 1);
        _buyAs(trader, key, 0.02 ether);
        assertGt(airdrops.lastAirdropAt(token), 0);
    }

    function testMultiVesting_EthAndErc20Credit() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.buybackVesting = true;
        m.buybackVestingDurationSeconds = uint32(30 days);
        m.hookTaxBps = 200;

        (uint256 launchId, address token,) = _launchMulti(m, 0);
        PoolKey memory key0 = factory.poolKeyOfMarket(launchId, 0);
        PoolKey memory key1 = factory.poolKeyOfMarket(launchId, 1);

        _buyAs(trader, key0, 1 ether);
        vm.roll(block.number + 1);
        _buyQuote(trader, key1, token, 50e18);
        vm.roll(block.number + 1);

        (, uint128 ethStreamed,,,) = buybacks.streams(address(this), token);
        assertGt(ethStreamed, 0);

        vm.warp(block.timestamp + 31 days);
        uint256 ethBefore = address(this).balance;
        uint256 qBefore = quoteA.balanceOf(address(this));
        buybacks.claim(token);
        assertGt(address(this).balance, ethBefore);
        assertGt(quoteA.balanceOf(address(this)), qBefore);
        assertEq(buybacks.vestedOf(address(this), token), 0);
    }

    function testMultiAirdrop_EthAndErc20Pots() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.holderAirdrop = true;
        m.holderAirdropBps = 10_000;
        m.holderAirdropEpochSeconds = 60;
        m.hookTaxBps = 200;

        (uint256 launchId, address token,) = _launchMulti(m, 0);
        PoolKey memory key0 = factory.poolKeyOfMarket(launchId, 0);
        PoolKey memory key1 = factory.poolKeyOfMarket(launchId, 1);
        Currency eth = Currency.wrap(address(0));
        Currency erc = Currency.wrap(address(quoteA));

        _buyAs(trader, key0, 1 ether);
        vm.roll(block.number + 1);
        _buyQuote(trader, key1, token, 50e18);

        assertGt(airdrops.potOf(token, eth), 0);
        assertGt(airdrops.potOf(token, erc), 0);

        vm.warp(block.timestamp + 61);
        vm.roll(block.number + 1);
        _buyAs(trader, key0, 0.01 ether);
        vm.roll(block.number + 1);
        _buyAs(trader, key0, 0.01 ether);
        assertGt(airdrops.lastAirdropAt(token), 0);

        vm.roll(block.number + 1);
        _buyQuote(trader, key1, token, 1e18);
        vm.roll(block.number + 1);
        _buyQuote(trader, key1, token, 1e18);
        assertGt(airdrops.lastAirdropAtQuote(token, erc.toId()), 0);
    }

    function _launchFloor() internal returns (address token, PoolKey memory key) {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 200;
        m.backedFloor = true;
        m.floorAllocationBps = 10_000;
        uint256 launchId;
        (launchId, token,, key) = launchToken(m, 0, 1_000_000_000e18);
        key = factory.poolKeyOf(launchId);
    }

    function _launchMulti(BitmaskConfig.Modules memory m, uint8 floorQuoteIndex)
        internal
        returns (uint256 launchId, address token, PoolId primary)
    {
        LaunchFactory.MarketInput[] memory markets = new LaunchFactory.MarketInput[](2);
        markets[0] = LaunchFactory.MarketInput({quote: Currency.wrap(address(0)), bps: 6_000});
        markets[1] = LaunchFactory.MarketInput({quote: Currency.wrap(address(quoteA)), bps: 4_000});
        (launchId, token, primary) = factory.launchMulti{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchMultiParams({
                name: "Cohab",
                symbol: "COH",
                metadataURI: "",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                markets: markets,
                tickSpacing: 60,
                bitmask: BitmaskConfig.pack(m),
                customHook: IHooks(address(0)),
                floorQuoteIndex: floorQuoteIndex,
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0,
                vestPacked: 0
            })
        );
    }

    function _buyAs(address user, PoolKey memory key, uint256 ethIn) internal {
        vm.prank(user);
        swapRouter.swap{value: ethIn}(
            key,
            SwapParams({
                zeroForOne: true, amountSpecified: -int256(ethIn), sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(user)
        );
    }

    function _buyQuote(address user, PoolKey memory key, address token, uint256 quoteIn) internal {
        quoteA.transfer(user, quoteIn);
        vm.startPrank(user);
        quoteA.approve(address(swapRouter), quoteIn);
        bool quoteIsCurrency0 = Currency.unwrap(key.currency0) == address(quoteA);
        swapRouter.swap(
            key,
            SwapParams({
                zeroForOne: quoteIsCurrency0,
                amountSpecified: -int256(quoteIn),
                sqrtPriceLimitX96: quoteIsCurrency0 ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(user)
        );
        vm.stopPrank();
        token;
    }

    function _sellAs(address user, PoolKey memory key, address token, uint256 tokenIn) internal {
        vm.startPrank(user);
        LaunchTokenLike(token).approve(address(swapRouter), tokenIn);
        swapRouter.swap(
            key,
            SwapParams({
                zeroForOne: false, amountSpecified: -int256(tokenIn), sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(user)
        );
        vm.stopPrank();
    }
}
