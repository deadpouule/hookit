// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";

import {FeeEthRail} from "../src/FeeEthRail.sol";
import {EthUsdgBridgeLib} from "../src/libraries/EthUsdgBridgeLib.sol";
import {QuotronsInk} from "../src/libraries/QuotronsInk.sol";
import {UniswapV4Deployments} from "../src/libraries/UniswapV4Deployments.sol";

/// @notice Wire `FeeEthRail` to a live public USDG↔ETH/WETH v4 pool on Ink (no empty seed).
/// @dev Usage:
///   FEE_ETH_RAIL=0x... forge script script/WireFeeEthRailInk.s.sol:WireFeeEthRailInk \
///     --rpc-url $INK_RPC_URL --broadcast
///
/// Optional explicit v4 key (e.g. match a known WETH/USDG market):
///   ETH_BRIDGE_FEE=10000 ETH_BRIDGE_TICK_SPACING=200 ETH_BRIDGE_USE_WETH=true
contract WireFeeEthRailInk is Script {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    function run() external {
        require(block.chainid == QuotronsInk.CHAIN_ID, "Ink only");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        FeeEthRail rail = FeeEthRail(payable(vm.envAddress("FEE_ETH_RAIL")));
        IPoolManager manager = IPoolManager(UniswapV4Deployments.get(block.chainid).poolManager);

        vm.startBroadcast(pk);
        bool wired = _tryWireExplicit(manager, rail) || EthUsdgBridgeLib.tryWireBest(manager, rail);
        vm.stopBroadcast();

        if (wired) {
            console.log("FeeEthRail eth bridge wired");
            console.log("weth", rail.weth());
        } else {
            console.log("No public USDG/ETH or USDG/WETH v4 pool on Ink yet");
            console.log("Known v3 WETH/USDG LP (not usable by FeeEthRail): 0x5A56Ff4B88F0fF5B33d4B0cf541FE76dAf343e46");
            console.log("wStock->USDG via Quotrons still works; ETH quote fees need no bridge");
            console.log("USDT0 mid (Quotrons pot):", QuotronsInk.USDT0);
        }
    }

    function _tryWireExplicit(IPoolManager manager, FeeEthRail rail) private returns (bool) {
        uint24 fee = uint24(vm.envOr("ETH_BRIDGE_FEE", uint256(0)));
        int24 spacing = int24(int256(vm.envOr("ETH_BRIDGE_TICK_SPACING", int256(0))));
        if (fee == 0 || spacing == 0) return false;

        address usdg = rail.usdg();
        bool useWeth = vm.envOr("ETH_BRIDGE_USE_WETH", false);
        address hooks = vm.envOr("ETH_BRIDGE_HOOKS", address(0));

        PoolKey memory key;
        address wethToken = address(0);
        if (useWeth) {
            address weth = QuotronsInk.WETH;
            bool wethIs0 = uint160(weth) < uint160(usdg);
            key = PoolKey({
                currency0: Currency.wrap(wethIs0 ? weth : usdg),
                currency1: Currency.wrap(wethIs0 ? usdg : weth),
                fee: fee,
                tickSpacing: spacing,
                hooks: IHooks(hooks)
            });
            wethToken = weth;
        } else {
            key = PoolKey({
                currency0: Currency.wrap(address(0)),
                currency1: Currency.wrap(usdg),
                fee: fee,
                tickSpacing: spacing,
                hooks: IHooks(hooks)
            });
        }

        (uint160 sqrt,,,) = manager.getSlot0(key.toId());
        if (sqrt == 0) return false;
        EthUsdgBridgeLib.wireLive(manager, rail, key, wethToken);
        return true;
    }
}
