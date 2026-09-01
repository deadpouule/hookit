// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BitmaskConfig} from "../../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../../src/libraries/ProtocolConstants.sol";

/// @notice Builds valid `BitmaskConfig.Modules` from on/off module masks for tests and smoke scripts.
library ModuleMatrix {
    uint16 internal constant MODULE_COUNT = 11;
    /// @dev Core toggle modules (bits 0–8) — exhaustive 512-combination matrix.
    uint16 internal constant MASK_SPACE = 512;
    /// @dev Extended mask including holder airdrop + creator-share-to-hook (bits 9–10).
    uint16 internal constant EXTENDED_MASK_SPACE = 2048;

    uint16 internal constant BIT_ANTI_SNIPE = 1 << 0;
    uint16 internal constant BIT_BACKED_FLOOR = 1 << 1;
    uint16 internal constant BIT_ANTI_MEV = 1 << 2;
    uint16 internal constant BIT_MAX_TX = 1 << 3;
    uint16 internal constant BIT_MAX_WALLET = 1 << 4;
    uint16 internal constant BIT_DYNAMIC_FEES = 1 << 5;
    uint16 internal constant BIT_BUYBACK_VESTING = 1 << 6;
    uint16 internal constant BIT_AUTO_BURN = 1 << 7;
    uint16 internal constant BIT_LP_DONATE = 1 << 8;
    uint16 internal constant BIT_HOLDER_AIRDROP = 1 << 9;
    uint16 internal constant BIT_CREATOR_SHARE_TO_HOOK = 1 << 10;

    function fromMask(uint16 mask) internal pure returns (BitmaskConfig.Modules memory m) {
        m = _coreFromMask(mask & (MASK_SPACE - 1));
        m = _applyExtendedBits(m, mask);
        return _rebalanceFeeRoutes(m);
    }

    function fromExtendedMask(uint16 mask) internal pure returns (BitmaskConfig.Modules memory m) {
        return fromMask(mask & (EXTENDED_MASK_SPACE - 1));
    }

    function kitchenSink() internal pure returns (BitmaskConfig.Modules memory m) {
        // Creator-share-to-hook conflicts with buyback vesting in `BitmaskConfig`.
        uint16 mask = uint16(EXTENDED_MASK_SPACE - 1) & ~BIT_BUYBACK_VESTING;
        return fromExtendedMask(mask);
    }

    function maxOpenFeeBps(BitmaskConfig.Modules memory m) internal pure returns (uint256) {
        uint256 openFee = uint256(ProtocolConstants.BASE_FEE_BPS) + m.hookTaxBps;
        if (m.antiSnipe) openFee += m.initialSnipeTaxBps;
        return openFee;
    }

    function _coreFromMask(uint16 mask) private pure returns (BitmaskConfig.Modules memory m) {
        m.antiSnipe = mask & BIT_ANTI_SNIPE != 0;
        m.backedFloor = mask & BIT_BACKED_FLOOR != 0;
        m.antiMev = mask & BIT_ANTI_MEV != 0;
        m.maxTx = mask & BIT_MAX_TX != 0;
        m.maxWallet = mask & BIT_MAX_WALLET != 0;
        m.dynamicFees = mask & BIT_DYNAMIC_FEES != 0;
        m.buybackVesting = mask & BIT_BUYBACK_VESTING != 0;
        m.autoBurn = mask & BIT_AUTO_BURN != 0;
        m.lpDonate = mask & BIT_LP_DONATE != 0;

        if (m.antiSnipe) {
            m.antiSnipeDurationSeconds = 900;
            m.initialSnipeTaxBps = 1_500;
        }
        if (m.maxTx) m.maxTxBps = 100;
        if (m.maxWallet) m.maxWalletBps = 200;
        if (m.backedFloor) m.floorAllocationBps = 1_000;
        if (m.autoBurn) m.autoBurnBps = 1_000;
        if (m.lpDonate) m.lpDonateBps = 1_000;

        return _ensureHookTax(m);
    }

    function _applyExtendedBits(BitmaskConfig.Modules memory m, uint16 mask)
        private
        pure
        returns (BitmaskConfig.Modules memory)
    {
        m.holderAirdrop = mask & BIT_HOLDER_AIRDROP != 0;
        m.creatorShareToHook = mask & BIT_CREATOR_SHARE_TO_HOOK != 0;
        if (m.holderAirdrop) m.holderAirdropBps = 500;
        return _ensureHookTax(m);
    }

    function _ensureHookTax(BitmaskConfig.Modules memory m) private pure returns (BitmaskConfig.Modules memory) {
        uint256 routed;
        if (m.backedFloor) routed += m.floorAllocationBps;
        if (m.autoBurn) routed += m.autoBurnBps;
        if (m.lpDonate) routed += m.lpDonateBps;
        if (m.holderAirdrop) routed += m.holderAirdropBps;
        if (routed > 0 && m.hookTaxBps == 0 && !m.creatorShareToHook) m.hookTaxBps = 200;
        if (m.dynamicFees) {
            if (m.dynamicFeeMinTotalBps == 0) m.dynamicFeeMinTotalBps = ProtocolConstants.BASE_FEE_BPS;
            if (m.hookTaxBps == 0) m.hookTaxBps = 200;
            m.dynamicFeeRampUp = true;
            if (m.dynamicFeeVolumeTargetScale == 0) {
                m.dynamicFeeVolumeTargetScale = ProtocolConstants.DYNAMIC_FEE_DEFAULT_VOLUME_TARGET_SCALE;
            }
        }
        return m;
    }

    /// @dev Enabled fee-route modules must total 100% of the hook tax pot.
    function _rebalanceFeeRoutes(BitmaskConfig.Modules memory m) private pure returns (BitmaskConfig.Modules memory) {
        uint256 count;
        if (m.backedFloor) count++;
        if (m.autoBurn) count++;
        if (m.lpDonate) count++;
        if (m.holderAirdrop) count++;
        if (count == 0) return m;

        uint16 base = uint16(ProtocolConstants.BPS_DENOMINATOR / count);
        uint16 rem = uint16(ProtocolConstants.BPS_DENOMINATOR - base * count);
        uint256 idx;

        if (m.backedFloor) {
            m.floorAllocationBps = base + (idx < rem ? 1 : 0);
            idx++;
        } else {
            m.floorAllocationBps = 0;
        }
        if (m.autoBurn) {
            m.autoBurnBps = base + (idx < rem ? 1 : 0);
            idx++;
        } else {
            m.autoBurnBps = 0;
        }
        if (m.lpDonate) {
            m.lpDonateBps = base + (idx < rem ? 1 : 0);
            idx++;
        } else {
            m.lpDonateBps = 0;
        }
        if (m.holderAirdrop) {
            m.holderAirdropBps = base + (idx < rem ? 1 : 0);
        } else {
            m.holderAirdropBps = 0;
        }
        return m;
    }
}
