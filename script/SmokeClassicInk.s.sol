// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

import {BondingLaunchFactory} from "../src/BondingLaunchFactory.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";

/// @notice Ink smoke: Classic bonding launch + small buy + sell back.
/// @dev Phase 1: `CLASSIC_PHASE=launch forge script ... --broadcast`
///      Phase 2: `CLASSIC_PHASE=sell CLASSIC_LAUNCH_ID=<id> forge script ... --broadcast`
contract SmokeClassicInkScript is Script {
    function run() public {
        string memory phase = vm.envOr("CLASSIC_PHASE", string("launch"));
        if (keccak256(bytes(phase)) == keccak256("sell")) {
            _sellAll();
            return;
        }
        _launchAndBuy();
    }

    function _launchAndBuy() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        BondingLaunchFactory bonding = BondingLaunchFactory(payable(vm.envAddress("BONDING_FACTORY")));

        console.log("user", user);
        console.log("ethBefore", user.balance);

        vm.startBroadcast(pk);
        (uint256 launchId, address token) = bonding.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            BondingLaunchFactory.LaunchParams({
                name: "Hooktest Classic",
                symbol: "HKCLS",
                metadataURI: "ipfs://hooktest-classic",
                totalSupply: 0,
                quote: Currency.wrap(address(0)),
                creatorTaxBps: 0,
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );

        uint256 buyWei = vm.envOr("CLASSIC_BUY_WEI", uint256(0.001 ether));
        bonding.buy{value: buyWei}(launchId, buyWei, 1);
        vm.stopBroadcast();

        console.log("launchId", launchId);
        console.log("token", token);
        console.log("tokenBal", IERC20(token).balanceOf(user));
        console.log("ethAfter", user.balance);
        console.log("CLASSIC_LAUNCH_OK");
    }

    function _sellAll() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        BondingLaunchFactory bonding = BondingLaunchFactory(payable(vm.envAddress("BONDING_FACTORY")));
        uint256 launchId = vm.envUint("CLASSIC_LAUNCH_ID");

        (
            address token,
            ,,,,,,,,,,,,,
        ) = bonding.launches(launchId);
        uint256 tokenBal = IERC20(token).balanceOf(user);
        require(tokenBal > 0, "no tokens");

        console.log("user", user);
        console.log("ethBefore", user.balance);
        console.log("tokenBal", tokenBal);

        vm.startBroadcast(pk);
        IERC20(token).approve(address(bonding), tokenBal);
        bonding.sell(launchId, tokenBal, 1);
        vm.stopBroadcast();

        console.log("ethAfter", user.balance);
        console.log("tokenAfter", IERC20(token).balanceOf(user));
        console.log("CLASSIC_SELL_OK");
    }
}
