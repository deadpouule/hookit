// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Called by LaunchToken on every balance change when holder airdrop is enabled.
interface IHolderAirdropSync {
    function syncHolder(address token, address account) external;
}
