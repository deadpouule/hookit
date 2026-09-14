// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LaunchpadTestBase, LaunchTokenLike} from "./utils/LaunchpadTestBase.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {SupplyCapLib} from "../src/libraries/SupplyCapLib.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";

/// @notice Master launch-time dev buy vs the protection modules (found live on Ink: a 0.0003 ETH dev
///         buy on an anti-snipe launch returned 0.5% of the tokens because the creator paid their own
///         98% sniper tax).
contract LaunchDevBuyTest is LaunchpadTestBase {
    uint256 internal constant SUPPLY = 1_000_000_000e18;

    function setUp() public {
        deployProtocol();
    }

    function _launchWithDevBuy(BitmaskConfig.Modules memory modules, uint256 devBuyWei)
        internal
        returns (address token, uint256 tokensOut)
    {
        uint256 launchId;
        (launchId, token,) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI + devBuyWei}(
            LaunchFactory.LaunchParams({
                name: "Dev",
                symbol: "DEV",
                metadataURI: "ipfs://dev",
                totalSupply: SUPPLY,
                quote: Currency.wrap(address(0)),
                tickSpacing: 60,
                startingTick: 0,
                bitmask: BitmaskConfig.pack(modules),
                customHook: IHooks(address(0)),
                devBuyQuoteIn: devBuyWei,
                minDevBuyTokensOut: 1,
                vestPacked: 0
            })
        );
        launchId;
        tokensOut = LaunchTokenLike(token).balanceOf(address(this));
    }

    /// Dev buy is the creator's own first trade: it must not pay the anti-snipe tax.
    function testDevBuyIsExemptFromAntiSnipeTax() public {
        uint256 devBuy = 0.01 ether;
        (, uint256 plainOut) = _launchWithDevBuy(defaultModules(), devBuy);

        BitmaskConfig.Modules memory snipe = defaultModules();
        snipe.antiSnipe = true;
        snipe.initialSnipeTaxBps = 9_800;
        snipe.antiSnipeDurationSeconds = 5;
        (address token, uint256 snipeOut) = _launchWithDevBuy(snipe, devBuy);

        assertGt(plainOut, 0, "plain dev buy");
        emit log_named_decimal_uint("plain dev buy tokens", plainOut, 18);
        emit log_named_decimal_uint("anti-snipe dev buy tokens", snipeOut, 18);
        // Same curve, same size, same block: outputs must match (no 98% haircut on the creator).
        assertApproxEqRel(snipeOut, plainOut, 1e15, "dev buy taxed by anti-snipe");

        // The sniper tax still applies to the next buyer inside the window.
        address sniper = makeAddr("sniper");
        vm.deal(sniper, 1 ether);
        vm.startPrank(sniper);
        swapRouter.swap{value: devBuy}(
            factory.poolKeyOf(factory.launchCount()),
            SwapParams({
                zeroForOne: true, amountSpecified: -int256(devBuy), sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(sniper)
        );
        vm.stopPrank();
        uint256 sniperOut = LaunchTokenLike(token).balanceOf(sniper);
        assertLt(sniperOut, snipeOut / 20, "sniper should be taxed ~98%");
    }

    /// Max-tx still binds the dev buy: the UI has to clamp, otherwise the launch reverts.
    function testDevBuyAboveMaxTxRevertsLaunch() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.maxTx = true;
        m.maxTxBps = ProtocolConstants.MIN_TX_BPS; // 0.1% of supply per swap
        uint256 devBuy = 0.01 ether; // ~0.78% of supply on the default curve

        // v4 wraps hook reverts (WrappedError) - the inner selector is SupplyCapLib.MaxTxExceeded.
        vm.expectRevert();
        factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI + devBuy}(
            LaunchFactory.LaunchParams({
                name: "Dev",
                symbol: "DEV",
                metadataURI: "ipfs://dev",
                totalSupply: SUPPLY,
                quote: Currency.wrap(address(0)),
                tickSpacing: 60,
                startingTick: 0,
                bitmask: BitmaskConfig.pack(m),
                customHook: IHooks(address(0)),
                devBuyQuoteIn: devBuy,
                minDevBuyTokensOut: 1,
                vestPacked: 0
            })
        );
    }
}
