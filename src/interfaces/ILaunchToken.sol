// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface ILaunchToken {
    function creator() external view returns (address);
    function metadataURI() external view returns (string memory);
    function burn(uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
}
