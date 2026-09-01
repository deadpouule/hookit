// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {LaunchFactory} from "../src/LaunchFactory.sol";
import {MasterLaunchHook} from "../src/MasterLaunchHook.sol";
import {BondingLaunchFactory} from "../src/BondingLaunchFactory.sol";
import {GraduatedFeeHook} from "../src/GraduatedFeeHook.sol";
import {FloorVault} from "../src/FloorVault.sol";
import {FeeEscrow} from "../src/FeeEscrow.sol";
import {ProtocolRevenueDistributor} from "../src/ProtocolRevenueDistributor.sol";
import {FeeEthRail} from "../src/FeeEthRail.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";

/// @notice Read-only Ink deploy health check (no broadcast).
/// @dev `forge script script/VerifyInkDeploy.s.sol --rpc-url $INK_RPC_URL -vv`
contract VerifyInkDeployScript is Script {
    function run() external view {
        require(block.chainid == QuotronStockQuotes.INK_MAINNET, "Ink only");

        LaunchFactory factory = LaunchFactory(payable(_addr("LAUNCH_FACTORY")));
        MasterLaunchHook hook = MasterLaunchHook(payable(_addr("MASTER_LAUNCH_HOOK")));
        BondingLaunchFactory bonding = BondingLaunchFactory(payable(_addr("BONDING_FACTORY")));
        GraduatedFeeHook graduated = GraduatedFeeHook(payable(_addr("GRADUATED_FEE_HOOK")));
        FloorVault vault = FloorVault(payable(_addr("FLOOR_VAULT")));
        FeeEscrow escrow = FeeEscrow(payable(_addr("FEE_ESCROW")));
        ProtocolRevenueDistributor distributor = ProtocolRevenueDistributor(payable(_addr("DISTRIBUTOR")));
        address router = _addr("HOOKIT_SWAP_ROUTER");
        FeeEthRail feeRail = FeeEthRail(payable(_addr("FEE_ETH_RAIL")));
        address nativeToken = _addr("NATIVE_TOKEN");

        _requireCode(address(factory));
        _requireCode(address(hook));
        _requireCode(address(bonding));
        _requireCode(address(graduated));
        _requireCode(address(vault));
        _requireCode(address(escrow));
        _requireCode(address(distributor));
        _requireCode(router);
        _requireCode(address(feeRail));
        _requireCode(nativeToken);

        require(address(factory.masterHook()) == address(hook), "factory masterHook");
        require(hook.factory() == address(factory), "hook factory");
        require(graduated.factory() == address(bonding), "graduated factory");
        require(vault.operators(address(hook)), "vault operator hook");
        require(vault.operators(address(distributor)), "vault operator distributor");
        require(escrow.operators(address(hook)), "escrow operator hook");
        require(escrow.operators(address(bonding)), "escrow operator bonding");
        require(escrow.operators(address(graduated)), "escrow operator graduated");
        require(distributor.operators(address(hook)), "distributor operator hook");
        require(distributor.operators(address(bonding)), "distributor operator bonding");
        require(distributor.operators(address(graduated)), "distributor operator graduated");

        uint256 launches = factory.launchCount();
        require(launches >= 1, "no launches");

        bool allowlist = factory.customHookAllowlistEnabled();
        console.log("LaunchFactory", address(factory));
        console.log("launchCount", launches);
        console.log("customHookAllowlistEnabled", allowlist);
        console.log("HookitSwapRouter", router);
        console.log("NativeToken", nativeToken);
        console.log("FeeEthRail bridge", feeRail.ethBridgeSet());

        if (!allowlist) {
            console.log("WARN: custom hook allowlist OFF - run HardenInkSoftLaunch.s.sol");
        }

        console.log("VERIFY_INK_OK");
    }

    function _addr(string memory key) internal view returns (address a) {
        a = vm.envAddress(key);
        require(a != address(0), string.concat("missing ", key));
    }

    function _requireCode(address target) internal view {
        require(target.code.length > 0, "no code");
    }
}
