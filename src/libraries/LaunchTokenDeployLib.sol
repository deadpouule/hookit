// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LaunchToken} from "../LaunchToken.sol";
import {BitmaskConfig} from "./BitmaskConfig.sol";
import {TokenAddressMiner} from "./TokenAddressMiner.sol";
import {MasterLaunchHook} from "../MasterLaunchHook.sol";

/// @title LaunchTokenDeployLib
/// @notice CREATE2 token deploy kept out of LaunchFactory bytecode.
library LaunchTokenDeployLib {
    function deploy(
        address factory,
        string memory name_,
        string memory symbol_,
        uint256 totalSupply,
        address creator,
        string memory metadataURI_,
        uint256 bitmask,
        MasterLaunchHook masterHook,
        uint256 launchCount
    ) external returns (address token) {
        address tracker;
        if (BitmaskConfig.unpack(bitmask).holderAirdrop) {
            tracker = masterHook.holderAirdropVault();
        }
        bytes memory initCode = abi.encodePacked(
            type(LaunchToken).creationCode,
            abi.encode(name_, symbol_, totalSupply, creator, factory, metadataURI_, tracker)
        );
        bytes32 entropy = keccak256(abi.encodePacked(name_, symbol_, creator, totalSupply, metadataURI_, launchCount));
        token = TokenAddressMiner.deploy(factory, initCode, entropy);
    }
}
