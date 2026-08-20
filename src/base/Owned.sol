// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title Owned
/// @notice Minimal Ownable with single-step transfer.
abstract contract Owned {
    address public owner;

    event OwnerUpdated(address indexed user, address indexed newOwner);

    error Unauthorized();

    constructor(address _owner) {
        owner = _owner;
        emit OwnerUpdated(address(0), _owner);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function setOwner(address newOwner) external onlyOwner {
        owner = newOwner;
        emit OwnerUpdated(msg.sender, newOwner);
    }
}
