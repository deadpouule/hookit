// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {QuotronsInk} from "../src/libraries/QuotronsInk.sol";

/// @dev forge script script/ProbeInkBridge.s.sol --rpc-url $INK_RPC_URL -vv
contract ProbeInkBridge is Script {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    function run() external view {
        IPoolManager pm = IPoolManager(0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32);
        address usdg = QuotronsInk.USDG;
        address weth = QuotronsInk.WETH;
        address usdt0 = QuotronsInk.USDT0;
        address eth = address(0);

        address[4] memory tokens = [eth, weth, usdt0, usdg];
        uint24[5] memory fees = [uint24(100), 500, 3000, 10000, 0x800000];
        int24[5] memory sps = [int24(1), 10, 60, 200, 60];
        address[2] memory hooks = [address(0), QuotronsInk.STOCK_HOOK];

        uint256 found;
        for (uint256 a; a < tokens.length; ++a) {
            for (uint256 b = a + 1; b < tokens.length; ++b) {
                address x = tokens[a];
                address y = tokens[b];
                for (uint256 f; f < fees.length; ++f) {
                    for (uint256 s; s < sps.length; ++s) {
                        for (uint256 h; h < hooks.length; ++h) {
                            if (fees[f] == 0x800000 && hooks[h] == address(0)) continue;
                            if (fees[f] != 0x800000 && hooks[h] != address(0)) continue;
                            bool q0 = uint160(x) < uint160(y);
                            PoolKey memory key = PoolKey({
                                currency0: Currency.wrap(q0 ? x : y),
                                currency1: Currency.wrap(q0 ? y : x),
                                fee: fees[f],
                                tickSpacing: sps[s],
                                hooks: IHooks(hooks[h])
                            });
                            (uint160 sqrt,,,) = pm.getSlot0(key.toId());
                            if (sqrt != 0) {
                                console.log("--- LIVE ---");
                                console.log("a", x);
                                console.log("b", y);
                                console.log("fee", fees[f]);
                                console.logInt(sps[s]);
                                console.log("hooks", hooks[h]);
                                found++;
                            }
                        }
                    }
                }
            }
        }
        console.log("found", found);
    }
}
