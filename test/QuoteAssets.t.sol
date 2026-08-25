// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {LaunchpadTestBase} from "./utils/LaunchpadTestBase.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {FixedPointMath} from "../src/libraries/FixedPointMath.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {BaseSepoliaAddresses} from "../src/libraries/BaseSepoliaAddresses.sol";
import {MockQuoteToken} from "./mocks/MockQuoteToken.sol";

contract QuoteAssetsTest is LaunchpadTestBase {
    using StateLibrary for IPoolManager;

    function setUp() public {
        deployProtocol();
    }

    function testUsdcIsAllowedByDefault() public view {
        assertTrue(factory.isQuoteAllowed(address(0)));
        assertTrue(factory.isQuoteAllowed(BaseSepoliaAddresses.USDC));
        assertEq(factory.mcapQuoteFor(BaseSepoliaAddresses.USDC), 4_000 * 1e6);
    }

    function testUnknownErc20QuoteReverts() public {
        vm.expectRevert(LaunchFactory.InvalidQuote.selector);
        factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "Bad",
                symbol: "BAD",
                metadataURI: "",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(address(0xBEEF)),
                tickSpacing: 60,
                startingTick: 0,
                bitmask: 0,
                customHook: IHooks(address(0))
            })
        );
    }

    function testStockQuoteLaunchHitsFourThousandUsd() public {
        MockQuoteToken aapl = new MockQuoteToken("Apple", "AAPLc", 18);
        factory.setQuote(address(aapl), true, 18, 200e18, address(0));

        uint256 expected = factory.mcapQuoteFor(address(aapl));
        assertEq(expected, 20 ether, "$4k / $200 = 20 shares");

        uint256 supply = ProtocolConstants.DEFAULT_LAUNCH_SUPPLY;
        (address token, PoolId poolId) = _launch(Currency.wrap(address(aapl)), supply);

        bool tokenIs0 = uint160(token) < uint160(address(aapl));
        (uint160 sqrtPriceX96,,,) = manager.getSlot0(poolId);
        uint256 spotMcap = FixedPointMath.quoteFromToken(supply, sqrtPriceX96, tokenIs0);
        assertApproxEqRel(spotMcap, expected, 0.01e18);
    }

    function testSixDecimalStableMcap() public {
        MockQuoteToken usd = new MockQuoteToken("USD Coin", "USDC", 6);
        factory.setQuote(address(usd), true, 6, 1e18, address(0));
        assertEq(factory.mcapQuoteFor(address(usd)), 4_000 * 1e6);
    }

    function testDisableStockQuote() public {
        MockQuoteToken tsla = new MockQuoteToken("Tesla", "TSLAc", 18);
        factory.setQuote(address(tsla), true, 18, 250e18, address(0));
        factory.setQuote(address(tsla), false, 18, 250e18, address(0));
        assertFalse(factory.isQuoteAllowed(address(tsla)));
        vm.expectRevert(LaunchFactory.InvalidQuote.selector);
        _launch(Currency.wrap(address(tsla)), ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);
    }

    function _launch(Currency quote, uint256 supply) internal returns (address token, PoolId poolId) {
        uint256 bitmask = BitmaskConfig.pack(defaultModules());
        (, token, poolId) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "Test",
                symbol: "TST",
                metadataURI: "",
                totalSupply: supply,
                quote: quote,
                tickSpacing: 60,
                startingTick: 0,
                bitmask: bitmask,
                customHook: IHooks(address(0))
            })
        );
        quote;
    }
}
