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

/// @notice Live Ink probe: vanilla Master launch + buys + dump so the TV chart has real wicks.
/// @dev `CHART_PHASE=launch|buy|sell` — split txs so candles land in different minutes.
contract SmokeChartWickInkScript is Script {
    function run() public {
        string memory phase = vm.envOr("CHART_PHASE", string("launch"));
        if (keccak256(bytes(phase)) == keccak256("buy")) {
            _buyMore();
            return;
        }
        if (keccak256(bytes(phase)) == keccak256("sell")) {
            _dump();
            return;
        }
        _launchAndBuy();
    }

    function _launchAndBuy() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));
        HookitSwapRouter router = HookitSwapRouter(payable(vm.envAddress("HOOKIT_SWAP_ROUTER")));

        console.log("user", user);
        console.log("ethBefore", user.balance);

        vm.startBroadcast(pk);
        (uint256 launchId, address token, PoolId poolId) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "Chart Probe",
                symbol: "CHPR",
                metadataURI: "ipfs://hookit-chart-probe",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(address(0)),
                tickSpacing: ProtocolConstants.DEFAULT_TICK_SPACING,
                startingTick: 0,
                bitmask: 0,
                customHook: IHooks(address(0)),
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );

        PoolKey memory key = factory.poolKeyOf(launchId);
        uint256 buyWei = vm.envOr("CHART_BUY_WEI", uint256(0.002 ether));
        bool zeroForOne = _buyZeroForOne(key, token);
        uint160 buyLimit = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
        router.swapExactIn{value: buyWei}(key, zeroForOne, buyWei, 1, buyLimit);
        vm.stopBroadcast();

        console.log("launchId", launchId);
        console.log("token", token);
        console.logBytes32(PoolId.unwrap(poolId));
        console.log("tokenBal", IERC20(token).balanceOf(user));
        console.log("ethAfter", user.balance);
        console.log("CHART_LAUNCH_OK");
    }

    function _buyMore() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));
        HookitSwapRouter router = HookitSwapRouter(payable(vm.envAddress("HOOKIT_SWAP_ROUTER")));
        uint256 launchId = vm.envUint("CHART_LAUNCH_ID");
        PoolKey memory key = factory.poolKeyOf(launchId);
        address token = _tokenOf(key);
        uint256 buyWei = vm.envOr("CHART_BUY_WEI", uint256(0.003 ether));

        vm.startBroadcast(pk);
        bool zeroForOne = _buyZeroForOne(key, token);
        uint160 buyLimit = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
        router.swapExactIn{value: buyWei}(key, zeroForOne, buyWei, 1, buyLimit);
        vm.stopBroadcast();

        console.log("token", token);
        console.log("tokenBal", IERC20(token).balanceOf(vm.addr(pk)));
        console.log("CHART_BUY_OK");
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
        uint256 sellAmt = (tokenBal * 7) / 10;

        vm.startBroadcast(pk);
        IERC20(token).approve(address(router), sellAmt);
        bool sellZeroForOne = !_buyZeroForOne(key, token);
        uint160 sellLimit = sellZeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
        router.swapExactIn(key, sellZeroForOne, sellAmt, 1, sellLimit);
        vm.stopBroadcast();

        console.log("token", token);
        console.log("sold", sellAmt);
        console.log("tokenAfter", IERC20(token).balanceOf(user));
        console.log("CHART_SELL_OK");
    }

    function _tokenOf(PoolKey memory key) internal pure returns (address) {
        return
            Currency.unwrap(key.currency0) == address(0)
                ? Currency.unwrap(key.currency1)
                : Currency.unwrap(key.currency0);
    }

    function _buyZeroForOne(PoolKey memory key, address token) internal pure returns (bool) {
        return Currency.unwrap(key.currency1) == token;
    }
}
