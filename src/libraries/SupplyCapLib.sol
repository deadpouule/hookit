// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {FixedPointMath} from "./FixedPointMath.sol";

interface ISupplyCapToken {
    function totalSupply() external view returns (uint256);
}

/// @title SupplyCapLib
/// @notice External library: max-tx check for MasterLaunchHook.
/// @dev Linked (not inlined) so the hook stays under EIP-170.
library SupplyCapLib {
    error MaxTxExceeded();

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
}
