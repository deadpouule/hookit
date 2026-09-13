// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {MasterLaunchHook} from "../src/MasterLaunchHook.sol";
import {MultiPairArbExecutor} from "../src/MultiPairArbExecutor.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";

/// @notice Unpause arb executor, set clip/deviation, authorize keeper wallet, enable hook arb path.
/// @dev `forge script script/ActivateArbInk.s.sol --rpc-url $INK_RPC_URL --broadcast -vv`
///      Optional: `ARB_MAX_CLIP_USD_X18=50000000000000000000000000` (50 USD x18)
///      Optional: `ARB_MIN_DEVIATION_BPS=500` (5%)
contract ActivateArbInkScript is Script {
    function run() external {
        require(block.chainid == QuotronStockQuotes.INK_MAINNET, "Ink only");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address keeper = vm.envOr("ARB_KEEPER_ADDRESS", vm.addr(pk));

        MultiPairArbExecutor executor = MultiPairArbExecutor(payable(vm.envAddress("MULTI_PAIR_ARB_EXECUTOR")));
        MasterLaunchHook hook = MasterLaunchHook(payable(vm.envAddress("MASTER_LAUNCH_HOOK")));

        uint256 maxClip = vm.envOr("ARB_MAX_CLIP_USD_X18", uint256(50e18));
        uint16 minDev = uint16(vm.envOr("ARB_MIN_DEVIATION_BPS", uint256(500)));

        console.log("keeper", keeper);
        console.log("executor", address(executor));
        console.log("hook", address(hook));
        console.log("paused before", executor.paused());
        console.log("arbActive before", hook.arbActive());
        console.log("arbExecutor", hook.arbExecutor());

        vm.startBroadcast(pk);

        executor.setMaxClipUsdX18(maxClip);
        executor.setMinDeviationBps(minDev);
        executor.setOperator(keeper, true);
        executor.setPaused(false);
        hook.setArbActive(true);

        vm.stopBroadcast();

        console.log("paused after", executor.paused());
        console.log("arbActive after", hook.arbActive());
        console.log("maxClipUsdX18", executor.maxClipUsdX18());
        console.log("minDeviationBps", executor.minDeviationBps());
        console.log("keeper allowed", executor.operators(keeper));
        console.log("ACTIVATE_ARB_INK_OK");
    }
}
