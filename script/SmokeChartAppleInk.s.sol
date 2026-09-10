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
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";

/// @notice Live Ink probe: vanilla Master launch quoted in wAAPLx, then spaced buys/dumps.
/// @dev `CHART_PHASE=launch|buy|sell` — split txs so candles land in different minutes.
contract SmokeChartAppleInkScript is Script {
    function run() public {
        require(block.chainid == QuotronStockQuotes.INK_MAINNET, "Ink only");
        string memory phase = vm.envOr("CHART_PHASE", string("launch"));
        if (keccak256(bytes(phase)) == keccak256("buy")) {
            _buyMore();
            return;
        }
        if (keccak256(bytes(phase)) == keccak256("sell")) {
            _dump();
            return;
        }
        _launch();
    }

    function _launch() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        address aapl = QuotronStockQuotes.wAAPLx;
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));

        console.log("user", user);
        console.log("ethBefore", user.balance);
        console.log("aaplBefore", IERC20(aapl).balanceOf(user));
        require(user.balance > ProtocolConstants.LAUNCH_FEE_WEI + 0.00005 ether, "top up ETH for launch+gas");

        vm.startBroadcast(pk);
        (uint256 launchId, address token, PoolId poolId) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "Apple Chart",
                symbol: "APCH",
                metadataURI: "ipfs://hookit-apple-chart",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(aapl),
                tickSpacing: ProtocolConstants.DEFAULT_TICK_SPACING,
                startingTick: 0,
                bitmask: 0,
                customHook: IHooks(address(0)),
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0,
                vestPacked: 0
            })
        );
        vm.stopBroadcast();

        console.log("launchId", launchId);
        console.log("token", token);
        console.logBytes32(PoolId.unwrap(poolId));
        console.log("ethAfter", user.balance);
        console.log("CHART_APPLE_LAUNCH_OK");
    }

    function _buyMore() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        address aapl = QuotronStockQuotes.wAAPLx;
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));
        HookitSwapRouter router = HookitSwapRouter(payable(vm.envAddress("HOOKIT_SWAP_ROUTER")));
        uint256 launchId = vm.envUint("CHART_LAUNCH_ID");
        PoolKey memory key = factory.poolKeyOf(launchId);
        address token = _tokenOf(key);
        uint256 buyAapl = vm.envOr("CHART_BUY_AAPL", uint256(0.008 ether));
        require(IERC20(aapl).balanceOf(user) >= buyAapl, "need wAAPLx");

        vm.startBroadcast(pk);
        IERC20(aapl).approve(address(router), buyAapl);
        bool zeroForOne = _buyZeroForOne(key, token);
        uint160 buyLimit = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
        router.swapExactIn(key, zeroForOne, buyAapl, 1, buyLimit);
        vm.stopBroadcast();

        console.log("token", token);
        console.log("tokenBal", IERC20(token).balanceOf(user));
        console.log("aaplAfter", IERC20(aapl).balanceOf(user));
        console.log("CHART_APPLE_BUY_OK");
    }

    function _dump() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));
        HookitSwapRouter router = HookitSwapRouter(payable(vm.envAddress("HOOKIT_SWAP_ROUTER")));
        uint256 launchId = vm.envUint("CHART_LAUNCH_ID");
        PoolKey memory key = factory.poolKeyOf(launchId);
        address token = _tokenOf(key);
        uint256 tokenBal = IERC20(token).balanceOf(user);
        require(tokenBal > 0, "no tokens");
        uint256 sellBps = vm.envOr("CHART_SELL_BPS", uint256(4_000));
        uint256 sellAmt = (tokenBal * sellBps) / 10_000;
        require(sellAmt > 0, "sell amt 0");

        vm.startBroadcast(pk);
        IERC20(token).approve(address(router), sellAmt);
        bool sellZeroForOne = !_buyZeroForOne(key, token);
        uint160 sellLimit = sellZeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
        router.swapExactIn(key, sellZeroForOne, sellAmt, 1, sellLimit);
        vm.stopBroadcast();

        console.log("token", token);
        console.log("sold", sellAmt);
        console.log("tokenAfter", IERC20(token).balanceOf(user));
        console.log("CHART_APPLE_SELL_OK");
    }

    function _tokenOf(PoolKey memory key) internal pure returns (address) {
        return Currency.unwrap(key.currency0) == QuotronStockQuotes.wAAPLx
            ? Currency.unwrap(key.currency1)
            : Currency.unwrap(key.currency0);
    }

    function _buyZeroForOne(PoolKey memory key, address token) internal pure returns (bool) {
        return Currency.unwrap(key.currency1) == token;
    }
}
