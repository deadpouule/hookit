// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "solmate/src/tokens/ERC20.sol";
import {ILaunchToken} from "./interfaces/ILaunchToken.sol";

/// @title LaunchToken
/// @notice Fixed-supply, burnable ERC-20 with self-describing metadata.
contract LaunchToken is ERC20, ILaunchToken {
    address public immutable override creator;
    string public override metadataURI;

    error ZeroAddress();
    error ZeroSupply();

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 supply,
        address creator_,
        address recipient,
        string memory metadataURI_
    ) ERC20(name_, symbol_, 18) {
        if (creator_ == address(0) || recipient == address(0)) revert ZeroAddress();
        if (supply == 0) revert ZeroSupply();
        creator = creator_;
        metadataURI = metadataURI_;
        _mint(recipient, supply);
    }

    function burn(uint256 amount) external override {
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) external override {
        uint256 allowed = allowance[account][msg.sender];
        if (allowed != type(uint256).max) allowance[account][msg.sender] = allowed - amount;
        _burn(account, amount);
    }
}
