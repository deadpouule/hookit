// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {FixedPointMath} from "./FixedPointMath.sol";
import {ProtocolConstants} from "./ProtocolConstants.sol";
import {BitmaskConfig} from "./BitmaskConfig.sol";

interface ISupplyCapToken {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

/// @title SupplyCapLib
/// @notice External library: max-tx / max-wallet checks for MasterLaunchHook.
/// @dev Linked (not inlined) so the hook stays under EIP-170.
library SupplyCapLib {
    using BitmaskConfig for uint256;

    error MaxTxExceeded();
    error MaxWalletExceeded();
    error HookDataRequired();

    function checkMaxTx(
        address token,
        bool tokenIsCurrency0,
        uint16 bps,
        uint256 specifiedAbs,
        bool isBuy,
        bool exactInput,
        uint160 sqrtPriceX96,
        uint256 totalFeeBps
    ) external view {
        uint256 cap = FixedPointMath.applyBps(ISupplyCapToken(token).totalSupply(), bps);
        if (cap == 0) return;

        uint256 tokenAmt;
        if (isBuy) {
            if (exactInput) {
                uint256 quoteNet = specifiedAbs - FixedPointMath.applyBps(specifiedAbs, totalFeeBps);
                tokenAmt = FixedPointMath.tokenFromQuote(quoteNet, sqrtPriceX96, tokenIsCurrency0);
            } else {
                tokenAmt = specifiedAbs;
            }
        } else if (exactInput) {
            tokenAmt = specifiedAbs;
        } else {
            tokenAmt = FixedPointMath.tokenFromQuote(specifiedAbs, sqrtPriceX96, tokenIsCurrency0);
        }
        if (tokenAmt > cap) revert MaxTxExceeded();
    }

    function checkMaxWalletBeforeBuy(
        address token,
        bool tokenIsCurrency0,
        uint256 packed,
        bytes calldata hookData,
        bool exactInput,
        uint256 specifiedAbs,
        uint160 sqrtPriceX96,
        uint256 totalFeeBps
    ) external view {
        if (hookData.length < 32) revert HookDataRequired();
        address recipient = abi.decode(hookData, (address));
        if (recipient == address(0)) revert HookDataRequired();

        uint256 cap = FixedPointMath.applyBps(ISupplyCapToken(token).totalSupply(), packed.maxWalletBps());
        if (cap == 0) return;

        uint256 tokenIn = exactInput
            ? FixedPointMath.tokenFromQuote(
                specifiedAbs - (specifiedAbs * totalFeeBps / ProtocolConstants.BPS_DENOMINATOR),
                sqrtPriceX96,
                tokenIsCurrency0
            )
            : specifiedAbs;
        if (tokenIn == 0) return;

        if (ISupplyCapToken(token).balanceOf(recipient) + tokenIn > cap) revert MaxWalletExceeded();
    }
}
