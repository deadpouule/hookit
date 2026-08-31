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

/// @notice Ink mainnet smoke: kitchen-sink Master launch + buy/sell (split txs for anti-MEV).
/// @dev Phase 1: `SMOKE_PHASE=launch forge script ... --broadcast`
///      Phase 2: `SMOKE_PHASE=sell SMOKE_LAUNCH_ID=2 forge script ... --broadcast` (next block)
contract SmokeKitchenSinkInkScript is Script {
    uint256 internal constant ETH_USD_X18 = 2_491e18;

    function run() public {
        string memory phase = vm.envOr("SMOKE_PHASE", string("launch"));
        if (keccak256(bytes(phase)) == keccak256("sell")) {
            _sellAll();
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

        BitmaskConfig.Modules memory modules = _fullModules();
        uint256 bitmask = BitmaskConfig.pack(modules);

        vm.startBroadcast(pk);

        factory.setEthUsdPrice(ETH_USD_X18);

        (uint256 launchId, address token, PoolId poolId) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "Hooktest Kitchen",
                symbol: "HKITN",
                metadataURI: "ipfs://hooktest-kitchen-sink",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(address(0)),
                tickSpacing: ProtocolConstants.DEFAULT_TICK_SPACING,
                startingTick: 0,
                bitmask: bitmask,
                customHook: IHooks(address(0)),
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );

        PoolKey memory key = factory.poolKeyOf(launchId);

        uint256 buyWei = vm.envOr("SMOKE_BUY_WEI", uint256(0.0015 ether));
        bool zeroForOne = _buyZeroForOne(key, token);
        uint160 buyLimit = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
        router.swapExactIn{value: buyWei}(key, zeroForOne, buyWei, 1, buyLimit);

        vm.stopBroadcast();

        console.log("launchId", launchId);
        console.log("token", token);
        console.logBytes32(PoolId.unwrap(poolId));
        console.log("bitmask", bitmask);
        console.log("buyWei", buyWei);
        console.log("tokenBal", IERC20(token).balanceOf(user));
        console.log("ethAfter", user.balance);
        console.log("SMOKE_LAUNCH_OK");
    }

    function _sellAll() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));
        HookitSwapRouter router = HookitSwapRouter(payable(vm.envAddress("HOOKIT_SWAP_ROUTER")));
        uint256 launchId = vm.envUint("SMOKE_LAUNCH_ID");

        PoolKey memory key = factory.poolKeyOf(launchId);
        address token = Currency.unwrap(key.currency0) == address(0)
            ? Currency.unwrap(key.currency1)
            : Currency.unwrap(key.currency0);

        uint256 tokenBal = IERC20(token).balanceOf(user);
        require(tokenBal > 0, "no tokens");

        console.log("user", user);
        console.log("ethBefore", user.balance);
        console.log("token", token);
        console.log("tokenBal", tokenBal);

        vm.startBroadcast(pk);
        IERC20(token).approve(address(router), tokenBal);
        bool sellZeroForOne = !_buyZeroForOne(key, token);
        uint160 sellLimit = sellZeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
        router.swapExactIn(key, sellZeroForOne, tokenBal, 1, sellLimit);
        vm.stopBroadcast();

        console.log("ethAfter", user.balance);
        console.log("tokenAfter", IERC20(token).balanceOf(user));
        console.log("SMOKE_SELL_OK");
    }

    function _fullModules() internal pure returns (BitmaskConfig.Modules memory m) {
        m = ModuleMatrix.kitchenSink();
        m.holderAirdrop = true;
        m.holderAirdropBps = 1_000;
    }

    function _buyZeroForOne(PoolKey memory key, address token) internal pure returns (bool) {
        return Currency.unwrap(key.currency1) == token;
    }
}
