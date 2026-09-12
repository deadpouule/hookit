// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Protocol-wide vault: launched tokens accrue here and epoch-push to live $HKT holders.
interface IHktHolderDropVault {
    function hkt() external view returns (address);
    function creditInternal(address token, uint256 amount) external;
    function tryPush(address token) external returns (bool);
}
