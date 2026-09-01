// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "solmate/src/tokens/ERC20.sol";
import {ILaunchToken} from "./interfaces/ILaunchToken.sol";
import {IHolderAirdropSync} from "./interfaces/IHolderAirdropSync.sol";

/// @title LaunchToken
/// @notice Fixed-supply, burnable ERC-20 with self-describing metadata.
contract LaunchToken is ERC20, ILaunchToken {
    address public immutable override creator;
    string public override metadataURI;
    address public immutable holderTracker;

    error ZeroAddress();
    error ZeroSupply();

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 supply,
        address creator_,
        address recipient,
        string memory metadataURI_,
        address holderTracker_
    ) ERC20(name_, symbol_, 18) {
        if (creator_ == address(0) || recipient == address(0)) revert ZeroAddress();
        if (supply == 0) revert ZeroSupply();
        creator = creator_;
        metadataURI = metadataURI_;
        holderTracker = holderTracker_;
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

    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        address from = msg.sender;
        balanceOf[from] -= amount;
        unchecked {
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
        _syncHolder(from, to);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] -= amount;
        unchecked {
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
        _syncHolder(from, to);
        return true;
    }

    function _mint(address to, uint256 amount) internal override {
        totalSupply += amount;
        unchecked {
            balanceOf[to] += amount;
        }
        emit Transfer(address(0), to, amount);
        _syncHolder(address(0), to);
    }

    function _burn(address from, uint256 amount) internal override {
        balanceOf[from] -= amount;
        unchecked {
            totalSupply -= amount;
        }
        emit Transfer(from, address(0), amount);
        _syncHolder(from, address(0));
    }

    function _syncHolder(address from, address to) private {
        address tracker = holderTracker;
        if (tracker == address(0)) return;
        // Skip genesis mint — infra recipients are excluded before swaps begin.
        if (from == address(0)) return;
        if (from != address(0)) IHolderAirdropSync(tracker).syncHolder(address(this), from);
        if (to != address(0) && to != from) IHolderAirdropSync(tracker).syncHolder(address(this), to);
    }
}
