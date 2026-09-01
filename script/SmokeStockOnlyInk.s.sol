// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

import {LaunchFactory} from "../src/LaunchFactory.sol";
import {HookitSwapRouter} from "../src/HookitSwapRouter.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ModuleMatrix} from "../test/utils/ModuleMatrix.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {QuotronBridge} from "../src/libraries/QuotronBridge.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";

/// @notice Ink smoke: stock-only launchMulti + composite buy (ETH or USDG bridge leg).
/// @dev Phase 1: `STOCK_PHASE=launch forge script ... --broadcast`
///      Phase 2: `STOCK_PHASE=buy STOCK_LAUNCH_ID=<id> forge script ... --broadcast`
///      Phase 3: `STOCK_PHASE=sell STOCK_LAUNCH_ID=<id> forge script ... --broadcast`
contract SmokeStockOnlyInkScript is Script {
    address internal constant W_NVDA = 0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5;
    address internal constant W_SPY = 0xE7E553Cd128F0011777323A0b44a7b96EA1CB540;
    address internal constant W_AAPL = 0x943BF64D566c32A2Bcd41AC92FB63C111cC9De8f;
    uint256 internal constant ETH_USD_X18 = 2_491e18;

    function run() public {
        string memory phase = vm.envOr("STOCK_PHASE", string("launch"));
        bytes32 p = keccak256(bytes(phase));
        if (p == keccak256("sell")) {
            _sellAll();
            return;
        }
        if (p == keccak256("buy")) {
            _buyComposite();
            return;
        }
        _launch();
    }

    function _launch() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));

        LaunchFactory.MarketInput[] memory markets = new LaunchFactory.MarketInput[](3);
        markets[0] = LaunchFactory.MarketInput({quote: Currency.wrap(W_NVDA), bps: 5_000});
        markets[1] = LaunchFactory.MarketInput({quote: Currency.wrap(W_SPY), bps: 3_000});
        markets[2] = LaunchFactory.MarketInput({quote: Currency.wrap(W_AAPL), bps: 2_000});

        BitmaskConfig.Modules memory modules = ModuleMatrix.fromMask(1);
        uint256 bitmask = BitmaskConfig.pack(modules);

        console.log("user", user);
        console.log("ethBefore", user.balance);

        vm.startBroadcast(pk);
        factory.setEthUsdPrice(ETH_USD_X18);

        (uint256 launchId, address token, PoolId poolId) = factory.launchMulti{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchMultiParams({
                name: "Hooktest Multi Stock",
                symbol: "HKMST",
                metadataURI: "ipfs://hooktest-multi-stock",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                markets: markets,
                tickSpacing: ProtocolConstants.DEFAULT_TICK_SPACING,
                bitmask: bitmask,
                customHook: IHooks(address(0)),
                floorQuoteIndex: 0,
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );
        vm.stopBroadcast();

        console.log("launchId", launchId);
        console.log("token", token);
        console.logBytes32(PoolId.unwrap(poolId));
        console.log("marketCount", factory.launchMarketCount(launchId));
        for (uint256 i; i < factory.launchMarketCount(launchId); ++i) {
            (Currency q, uint16 bps,,,,) = factory.launchMarkets(launchId, i);
            console.log("market", i, Currency.unwrap(q), bps);
        }
        (Currency primaryQuote,,,,,) = factory.launchMarkets(launchId, 0);
        console.log("primaryQuote", Currency.unwrap(primaryQuote));
        console.log("STOCK_LAUNCH_OK");
    }

    function _buyComposite() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));
        HookitSwapRouter router = HookitSwapRouter(payable(vm.envAddress("HOOKIT_SWAP_ROUTER")));
        uint256 launchId = vm.envUint("STOCK_LAUNCH_ID");

        PoolKey memory hookKey = factory.poolKeyOfMarket(launchId, 0);
        address token = Currency.unwrap(hookKey.currency0) == W_NVDA || Currency.unwrap(hookKey.currency0) == W_SPY
            ? Currency.unwrap(hookKey.currency1)
            : Currency.unwrap(hookKey.currency0);
        Currency quote = hookKey.currency0 == Currency.wrap(token) ? hookKey.currency1 : hookKey.currency0;

        bool useEth = vm.envOr("STOCK_BUY_WITH_ETH", true);
        uint256 buyWei = vm.envOr("STOCK_BUY_WEI", uint256(0.0005 ether));

        console.log("user", user);
        console.log("token", token);
        console.log("quote", Currency.unwrap(quote));
        console.log("useEth", useEth);
        console.log("buyWei", buyWei);

        vm.startBroadcast(pk);

        if (useEth) {
            // Attempt ETH → quote → token via composite (requires bridge ETH→wNVDA or similar).
            PoolKey memory bridgeKey = PoolKey({
                currency0: Currency.wrap(address(0)),
                currency1: quote,
                fee: 0,
                tickSpacing: 60,
                hooks: IHooks(address(0))
            });
            bool bridgeZfo = Currency.unwrap(bridgeKey.currency0) == address(0);
            bool hookZfo = Currency.unwrap(hookKey.currency1) == token;
            uint256 out = router.swapExactInComposite{value: buyWei}(
                bridgeKey,
                bridgeZfo,
                buyWei,
                hookKey,
                hookZfo,
                quote,
                1,
                bridgeZfo ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1,
                hookZfo ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            );
            console.log("tokensOut", out);
        } else {
            // USDG → wNVDA via Quotrons, then hook leg (matches ForkInkCompositeAndRail).
            address usdg = QuotronBridge.usdg();
            PoolKey memory bridgeKey = QuotronBridge.poolKey(W_NVDA);
            bool bridgeZfo = QuotronBridge.zeroForOne(W_NVDA, usdg);
            uint256 usdgIn = vm.envOr("STOCK_USDG_IN", uint256(5e6));
            IERC20(usdg).approve(address(router), usdgIn);
            bool hookZfo = Currency.unwrap(hookKey.currency1) == token;
            uint256 out = router.swapExactInComposite(
                bridgeKey,
                bridgeZfo,
                usdgIn,
                hookKey,
                hookZfo,
                Currency.wrap(W_NVDA),
                1,
                0,
                0
            );
            console.log("tokensOut", out);
        }

        vm.stopBroadcast();
        console.log("tokenBal", IERC20(token).balanceOf(user));
        console.log("STOCK_BUY_OK");
    }

    function _sellAll() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));
        HookitSwapRouter router = HookitSwapRouter(payable(vm.envAddress("HOOKIT_SWAP_ROUTER")));
        uint256 launchId = vm.envUint("STOCK_LAUNCH_ID");

        PoolKey memory hookKey = factory.poolKeyOfMarket(launchId, 0);
        address token = Currency.unwrap(hookKey.currency0) == W_NVDA || Currency.unwrap(hookKey.currency0) == W_SPY
            ? Currency.unwrap(hookKey.currency1)
            : Currency.unwrap(hookKey.currency0);

        uint256 tokenBal = IERC20(token).balanceOf(vm.addr(pk));
        require(tokenBal > 0, "no tokens");

        vm.startBroadcast(pk);
        IERC20(token).approve(address(router), tokenBal);
        bool sellZfo = Currency.unwrap(hookKey.currency0) == token;
        router.swapExactIn(
            hookKey,
            sellZfo,
            tokenBal,
            1,
            sellZfo ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
        );
        vm.stopBroadcast();
        console.log("STOCK_SELL_OK");
    }
}
