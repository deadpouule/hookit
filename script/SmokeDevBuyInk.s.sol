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

/// @notice Live Ink probe: vanilla ETH Master launch that carries a dev buy in the launch tx,
///         so `DevBuyExecuted` fires and the token page can light up the "Dev buy" badge.
/// @dev `DEVBUY_PHASE=launch|sell`; `DEVBUY_WEI` sizes the dev buy (default 0.0002 ETH).
contract SmokeDevBuyInkScript is Script {
    function run() public {
        require(block.chainid == QuotronStockQuotes.INK_MAINNET, "Ink only");
        string memory phase = vm.envOr("DEVBUY_PHASE", string("launch"));
        if (keccak256(bytes(phase)) == keccak256("sell")) {
            _sell();
            return;
        }
        _launch();
    }

    function _launch() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));
        uint256 devBuyWei = vm.envOr("DEVBUY_WEI", uint256(0.0002 ether));

        console.log("user", user);
        console.log("ethBefore", user.balance);
        console.log("devBuyWei", devBuyWei);
        require(
            user.balance > ProtocolConstants.LAUNCH_FEE_WEI + devBuyWei + 0.00005 ether, "top up ETH for launch+gas"
        );

        vm.startBroadcast(pk);
        (uint256 launchId, address token, PoolId poolId) = factory.launch{
            value: ProtocolConstants.LAUNCH_FEE_WEI + devBuyWei
        }(
            LaunchFactory.LaunchParams({
                name: "Hook Dev Buy",
                symbol: "HDEV",
                metadataURI: "ipfs://hookit-ink-dev-buy",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(address(0)),
                tickSpacing: ProtocolConstants.DEFAULT_TICK_SPACING,
                startingTick: 0,
                bitmask: 0,
                customHook: IHooks(address(0)),
                devBuyQuoteIn: devBuyWei,
                minDevBuyTokensOut: 1,
                vestPacked: 0
            })
        );
        vm.stopBroadcast();

        uint256 tokenBal = IERC20(token).balanceOf(user);
        require(tokenBal > 0, "dev buy delivered no tokens");

        console.log("launchId", launchId);
        console.log("token", token);
        console.logBytes32(PoolId.unwrap(poolId));
        console.log("tokenBal", tokenBal);
        console.log("ethAfter", user.balance);
        console.log("DEVBUY_LAUNCH_OK");
    }

    function _sell() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));
        HookitSwapRouter router = HookitSwapRouter(payable(vm.envAddress("HOOKIT_SWAP_ROUTER")));
        uint256 launchId = vm.envUint("DEVBUY_LAUNCH_ID");

        PoolKey memory key = factory.poolKeyOf(launchId);
        address token = Currency.unwrap(key.currency0) == address(0)
            ? Currency.unwrap(key.currency1)
            : Currency.unwrap(key.currency0);
        uint256 tokenBal = IERC20(token).balanceOf(user);
        require(tokenBal > 0, "nothing to sell");

        console.log("user", user);
        console.log("ethBefore", user.balance);
        console.log("token", token);
        console.log("tokenBal", tokenBal);

        vm.startBroadcast(pk);
        IERC20(token).approve(address(router), tokenBal);
        bool sellZeroForOne = Currency.unwrap(key.currency0) == token;
        uint160 sellLimit = sellZeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
        router.swapExactIn(key, sellZeroForOne, tokenBal, 1, sellLimit);
        vm.stopBroadcast();

        console.log("tokenAfter", IERC20(token).balanceOf(user));
        console.log("ethAfter", user.balance);
        console.log("DEVBUY_SELL_OK");
    }
}
