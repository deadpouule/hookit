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

/// @notice Ink smoke: launchMulti (ETH + USDG) + buy/sell on primary ETH pool.
/// @dev Phase 1: `MULTI_PHASE=launch forge script ... --broadcast`
///      Phase 2: `MULTI_PHASE=sell MULTI_LAUNCH_ID=<id> forge script ... --broadcast` (next block)
contract SmokeLaunchMultiInkScript is Script {
    address internal constant USDG = 0xe343167631d89B6Ffc58B88d6b7fB0228795491D;
    uint256 internal constant ETH_USD_X18 = 2_491e18;

    function run() public {
        string memory phase = vm.envOr("MULTI_PHASE", string("launch"));
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

        LaunchFactory.MarketInput[] memory markets = new LaunchFactory.MarketInput[](2);
        markets[0] = LaunchFactory.MarketInput({quote: Currency.wrap(address(0)), bps: 6_000});
        markets[1] = LaunchFactory.MarketInput({quote: Currency.wrap(USDG), bps: 4_000});

        BitmaskConfig.Modules memory modules = ModuleMatrix.fromMask(1);
        uint256 bitmask = BitmaskConfig.pack(modules);

        console.log("user", user);
        console.log("ethBefore", user.balance);

        vm.startBroadcast(pk);
        factory.setEthUsdPrice(ETH_USD_X18);

        (uint256 launchId, address token, PoolId poolId) = factory.launchMulti{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchMultiParams({
                name: "Hooktest Multi",
                symbol: "HKMLT",
                metadataURI: "ipfs://hooktest-multi",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                markets: markets,
                tickSpacing: ProtocolConstants.DEFAULT_TICK_SPACING,
                bitmask: bitmask,
                customHook: IHooks(address(0)),
                floorQuoteIndex: 0
            })
        );

        require(factory.launchMarketCount(launchId) == 2, "market count");

        PoolKey memory key = factory.poolKeyOf(launchId);
        uint256 buyWei = vm.envOr("MULTI_BUY_WEI", uint256(0.001 ether));
        bool zeroForOne = _buyZeroForOne(key, token);
        uint160 buyLimit = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
        router.swapExactIn{value: buyWei}(key, zeroForOne, buyWei, 1, buyLimit);
        vm.stopBroadcast();

        console.log("launchId", launchId);
        console.log("token", token);
        console.logBytes32(PoolId.unwrap(poolId));
        console.log("marketCount", factory.launchMarketCount(launchId));
        console.log("tokenBal", IERC20(token).balanceOf(user));
        console.log("ethAfter", user.balance);
        console.log("MULTI_LAUNCH_OK");
    }

    function _sellAll() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));
        HookitSwapRouter router = HookitSwapRouter(payable(vm.envAddress("HOOKIT_SWAP_ROUTER")));
        uint256 launchId = vm.envUint("MULTI_LAUNCH_ID");

        PoolKey memory key = factory.poolKeyOf(launchId);
        address token = Currency.unwrap(key.currency0) == address(0)
            ? Currency.unwrap(key.currency1)
            : Currency.unwrap(key.currency0);

        uint256 tokenBal = IERC20(token).balanceOf(user);
        require(tokenBal > 0, "no tokens");

        vm.startBroadcast(pk);
        IERC20(token).approve(address(router), tokenBal);
        bool sellZeroForOne = !_buyZeroForOne(key, token);
        uint160 sellLimit = sellZeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
        router.swapExactIn(key, sellZeroForOne, tokenBal, 1, sellLimit);
        vm.stopBroadcast();

        console.log("ethAfter", user.balance);
        console.log("tokenAfter", IERC20(token).balanceOf(user));
        console.log("MULTI_SELL_OK");
    }

    function _buyZeroForOne(PoolKey memory key, address token) internal pure returns (bool) {
        return Currency.unwrap(key.currency1) == token;
    }
}
