// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title TokenAddressMiner
/// @notice CREATE2 helpers for Hookit-branded launch token addresses.
library TokenAddressMiner {
    /// @dev Last hex nibble of every Hookit-launched token (…8 — closest single-char brand to “h”).
    uint8 internal constant SUFFIX_NIBBLE = 0x8;

    uint256 internal constant MAX_LOOP = 4096;

    error TokenSaltNotFound();

    function hasBrandSuffix(address token) internal pure returns (bool) {
        return uint160(token) & 0xF == SUFFIX_NIBBLE;
    }

    function computeAddress(address deployer, bytes32 salt, bytes32 initCodeHash) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash)))));
    }

    /// @dev Mine a CREATE2 salt so `create2` with `initCode` yields an address ending in `SUFFIX_NIBBLE`.
    function findSalt(address deployer, bytes memory initCode, bytes32 entropy) internal pure returns (bytes32 salt) {
        bytes32 initCodeHash = keccak256(initCode);
        for (uint256 i; i < MAX_LOOP; ++i) {
            salt = keccak256(abi.encodePacked("HOOKIT.TOKEN", entropy, i));
            if (hasBrandSuffix(computeAddress(deployer, salt, initCodeHash))) return salt;
        }
        revert TokenSaltNotFound();
    }

    function deploy(address deployer, bytes memory initCode, bytes32 entropy) internal returns (address token) {
        bytes32 salt = findSalt(deployer, initCode, entropy);
        assembly ("memory-safe") {
            token := create2(0, add(initCode, 0x20), mload(initCode), salt)
        }
        if (token == address(0)) revert TokenSaltNotFound();
    }
}
