// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ProtocolConstants} from "./ProtocolConstants.sol";

/// @title BitmaskConfig
/// @notice Packs/unpacks per-pool launch modules into a single `uint256`.
/// @dev Launcher picks enabled modules and percentages at launch; the bitmask is immutable after deploy.
///      Validation only rejects values outside hook math bounds (fee sums, bps fields), not product policy.
/// @dev Layout:
///      bit 0        ANTI_SNIPE_ENABLED
///      bit 1        BACKED_FLOOR_ENABLED
///      bit 2        ANTI_MEV_COOLDOWN_ENABLED
///      bit 3        MAX_TX_ENABLED
///      bit 4        MAX_WALLET_ENABLED
///      bit 5        DYNAMIC_FEES_ENABLED
///      bit 6        BUYBACK_VESTING_ENABLED
///      bits 7-22    hookTaxBps (uint16) — extra fee for hook modules (not creator)
///      bits 23-38   antiSnipeDurationSeconds (uint16)
///      bits 39-54   maxTxBps (uint16)
///      bits 55-70   maxWalletBps (uint16)
///      bits 71-94   floorAllocationBps (uint24) — % of hook tax pot
///      bits 95-110  initialSnipeTaxBps (uint16)
///      bit 111      AUTO_BURN_ENABLED
///      bit 112      LP_DONATE_ENABLED
///      bits 113-128 autoBurnBps (uint16) — % of hook tax pot
///      bits 129-144 lpDonateBps (uint16) — % of hook tax pot
///      bit 145      HOLDER_AIRDROP_ENABLED
///      bits 146-161 holderAirdropBps (uint16) — % of hook pot
///      bit 162      CREATOR_SHARE_TO_HOOK — route creator's 70% of base into the hook pot
///      bits 163-194 buybackVestingDurationSeconds (uint32) — linear vest for creator proceeds
///      bits 195-210 dynamicFeeMinTotalBps (uint16) — min total swap fee when dynamic fees on
///      bit 211       DYNAMIC_FEE_RAMP_UP — fees rise with volume (clear = fees fall with volume)
///      bits 212-227  dynamicFeeVolumeTargetScale (uint16) — ramp saturates at scale × 1e18 quote / 24h
library BitmaskConfig {
    uint256 internal constant ANTI_SNIPE_ENABLED = 1 << 0;
    uint256 internal constant BACKED_FLOOR_ENABLED = 1 << 1;
    uint256 internal constant ANTI_MEV_COOLDOWN_ENABLED = 1 << 2;
    uint256 internal constant MAX_TX_ENABLED = 1 << 3;
    uint256 internal constant MAX_WALLET_ENABLED = 1 << 4;
    uint256 internal constant DYNAMIC_FEES_ENABLED = 1 << 5;
    uint256 internal constant BUYBACK_VESTING_ENABLED = 1 << 6;
    uint256 internal constant AUTO_BURN_ENABLED = 1 << 111;
    uint256 internal constant LP_DONATE_ENABLED = 1 << 112;
    uint256 internal constant HOLDER_AIRDROP_ENABLED = 1 << 145;
    uint256 internal constant CREATOR_SHARE_TO_HOOK_ENABLED = 1 << 162;

    uint256 internal constant HOOK_TAX_SHIFT = 7;
    uint256 internal constant SNIPE_DURATION_SHIFT = 23;
    uint256 internal constant MAX_TX_SHIFT = 39;
    uint256 internal constant MAX_WALLET_SHIFT = 55;
    uint256 internal constant FLOOR_ALLOC_SHIFT = 71;
    uint256 internal constant INITIAL_SNIPE_TAX_SHIFT = 95;
    uint256 internal constant AUTO_BURN_BPS_SHIFT = 113;
    uint256 internal constant LP_DONATE_BPS_SHIFT = 129;
    uint256 internal constant HOLDER_AIRDROP_BPS_SHIFT = 146;
    uint256 internal constant BUYBACK_VESTING_DURATION_SHIFT = 163;
    uint256 internal constant DYNAMIC_FEE_MIN_TOTAL_SHIFT = 195;
    uint256 internal constant DYNAMIC_FEE_RAMP_UP_ENABLED = 1 << 211;
    uint256 internal constant DYNAMIC_FEE_VOLUME_TARGET_SHIFT = 212;

    uint256 internal constant UINT16_MASK = 0xFFFF;
    uint256 internal constant UINT32_MASK = 0xFFFFFFFF;
    uint256 internal constant UINT24_MASK = 0xFFFFFF;

    struct Modules {
        bool antiSnipe;
        bool backedFloor;
        bool antiMev;
        bool maxTx;
        bool maxWallet;
        bool dynamicFees;
        bool buybackVesting;
        bool autoBurn;
        bool lpDonate;
        bool holderAirdrop;
        bool creatorShareToHook;
        uint16 hookTaxBps;
        uint16 antiSnipeDurationSeconds;
        uint16 maxTxBps;
        uint16 maxWalletBps;
        uint24 floorAllocationBps;
        uint16 initialSnipeTaxBps;
        uint16 autoBurnBps;
        uint16 lpDonateBps;
        uint16 holderAirdropBps;
        uint32 buybackVestingDurationSeconds;
        uint16 dynamicFeeMinTotalBps;
        bool dynamicFeeRampUp;
        uint16 dynamicFeeVolumeTargetScale;
    }

    function pack(Modules memory m) internal pure returns (uint256 packed) {
        _validate(m);
        packed = (m.antiSnipe ? ANTI_SNIPE_ENABLED : 0) | (m.backedFloor ? BACKED_FLOOR_ENABLED : 0)
            | (m.antiMev ? ANTI_MEV_COOLDOWN_ENABLED : 0) | (m.maxTx ? MAX_TX_ENABLED : 0)
            | (m.maxWallet ? MAX_WALLET_ENABLED : 0) | (m.dynamicFees ? DYNAMIC_FEES_ENABLED : 0)
            | (m.buybackVesting ? BUYBACK_VESTING_ENABLED : 0) | (m.autoBurn ? AUTO_BURN_ENABLED : 0)
            | (m.lpDonate ? LP_DONATE_ENABLED : 0) | (m.holderAirdrop ? HOLDER_AIRDROP_ENABLED : 0)
            | (m.creatorShareToHook ? CREATOR_SHARE_TO_HOOK_ENABLED : 0) | (uint256(m.hookTaxBps) << HOOK_TAX_SHIFT)
            | (uint256(m.antiSnipeDurationSeconds) << SNIPE_DURATION_SHIFT) | (uint256(m.maxTxBps) << MAX_TX_SHIFT)
            | (uint256(m.maxWalletBps) << MAX_WALLET_SHIFT) | (uint256(m.floorAllocationBps) << FLOOR_ALLOC_SHIFT)
            | (uint256(m.initialSnipeTaxBps) << INITIAL_SNIPE_TAX_SHIFT)
            | (uint256(m.autoBurnBps) << AUTO_BURN_BPS_SHIFT) | (uint256(m.lpDonateBps) << LP_DONATE_BPS_SHIFT)
            | (uint256(m.holderAirdropBps) << HOLDER_AIRDROP_BPS_SHIFT)
            | (uint256(m.buybackVestingDurationSeconds) << BUYBACK_VESTING_DURATION_SHIFT)
            | (uint256(m.dynamicFeeMinTotalBps) << DYNAMIC_FEE_MIN_TOTAL_SHIFT)
            | (m.dynamicFeeRampUp ? DYNAMIC_FEE_RAMP_UP_ENABLED : 0)
            | (uint256(m.dynamicFeeVolumeTargetScale) << DYNAMIC_FEE_VOLUME_TARGET_SHIFT);
    }

    function unpack(uint256 packed) internal pure returns (Modules memory m) {
        m.antiSnipe = packed & ANTI_SNIPE_ENABLED != 0;
        m.backedFloor = packed & BACKED_FLOOR_ENABLED != 0;
        m.antiMev = packed & ANTI_MEV_COOLDOWN_ENABLED != 0;
        m.maxTx = packed & MAX_TX_ENABLED != 0;
        m.maxWallet = packed & MAX_WALLET_ENABLED != 0;
        m.dynamicFees = packed & DYNAMIC_FEES_ENABLED != 0;
        m.buybackVesting = packed & BUYBACK_VESTING_ENABLED != 0;
        m.autoBurn = packed & AUTO_BURN_ENABLED != 0;
        m.lpDonate = packed & LP_DONATE_ENABLED != 0;
        m.holderAirdrop = packed & HOLDER_AIRDROP_ENABLED != 0;
        m.creatorShareToHook = packed & CREATOR_SHARE_TO_HOOK_ENABLED != 0;
        m.hookTaxBps = uint16((packed >> HOOK_TAX_SHIFT) & UINT16_MASK);
        m.antiSnipeDurationSeconds = uint16((packed >> SNIPE_DURATION_SHIFT) & UINT16_MASK);
        m.maxTxBps = uint16((packed >> MAX_TX_SHIFT) & UINT16_MASK);
        m.maxWalletBps = uint16((packed >> MAX_WALLET_SHIFT) & UINT16_MASK);
        m.floorAllocationBps = uint24((packed >> FLOOR_ALLOC_SHIFT) & UINT24_MASK);
        m.initialSnipeTaxBps = uint16((packed >> INITIAL_SNIPE_TAX_SHIFT) & UINT16_MASK);
        m.autoBurnBps = uint16((packed >> AUTO_BURN_BPS_SHIFT) & UINT16_MASK);
        m.lpDonateBps = uint16((packed >> LP_DONATE_BPS_SHIFT) & UINT16_MASK);
        m.holderAirdropBps = uint16((packed >> HOLDER_AIRDROP_BPS_SHIFT) & UINT16_MASK);
        m.buybackVestingDurationSeconds = uint32((packed >> BUYBACK_VESTING_DURATION_SHIFT) & UINT32_MASK);
        m.dynamicFeeMinTotalBps = uint16((packed >> DYNAMIC_FEE_MIN_TOTAL_SHIFT) & UINT16_MASK);
        m.dynamicFeeRampUp = packed & DYNAMIC_FEE_RAMP_UP_ENABLED != 0;
        m.dynamicFeeVolumeTargetScale = uint16((packed >> DYNAMIC_FEE_VOLUME_TARGET_SHIFT) & UINT16_MASK);
    }

    function enabled(uint256 packed, uint256 flag) internal pure returns (bool) {
        return packed & flag != 0;
    }

    function hookTaxBps(uint256 packed) internal pure returns (uint16) {
        return uint16((packed >> HOOK_TAX_SHIFT) & UINT16_MASK);
    }

    function antiSnipeDurationSeconds(uint256 packed) internal pure returns (uint16) {
        return uint16((packed >> SNIPE_DURATION_SHIFT) & UINT16_MASK);
    }

    function maxTxBps(uint256 packed) internal pure returns (uint16) {
        return uint16((packed >> MAX_TX_SHIFT) & UINT16_MASK);
    }

    function maxWalletBps(uint256 packed) internal pure returns (uint16) {
        return uint16((packed >> MAX_WALLET_SHIFT) & UINT16_MASK);
    }

    function floorAllocationBps(uint256 packed) internal pure returns (uint24) {
        return uint24((packed >> FLOOR_ALLOC_SHIFT) & UINT24_MASK);
    }

    function autoBurnBps(uint256 packed) internal pure returns (uint16) {
        return uint16((packed >> AUTO_BURN_BPS_SHIFT) & UINT16_MASK);
    }

    function lpDonateBps(uint256 packed) internal pure returns (uint16) {
        return uint16((packed >> LP_DONATE_BPS_SHIFT) & UINT16_MASK);
    }

    function holderAirdropBps(uint256 packed) internal pure returns (uint16) {
        return uint16((packed >> HOLDER_AIRDROP_BPS_SHIFT) & UINT16_MASK);
    }

    function buybackVestingDurationSeconds(uint256 packed) internal pure returns (uint32) {
        uint32 duration = uint32((packed >> BUYBACK_VESTING_DURATION_SHIFT) & UINT32_MASK);
        if (duration == 0 && packed & BUYBACK_VESTING_ENABLED != 0) {
            return uint32(ProtocolConstants.BUYBACK_VESTING_DURATION);
        }
        return duration;
    }

    function dynamicFeeMinTotalBps(uint256 packed) internal pure returns (uint16) {
        uint16 minTotal = uint16((packed >> DYNAMIC_FEE_MIN_TOTAL_SHIFT) & UINT16_MASK);
        if (minTotal == 0 && packed & DYNAMIC_FEES_ENABLED != 0) {
            return ProtocolConstants.BASE_FEE_BPS;
        }
        return minTotal;
    }

    function dynamicFeeVolumeTargetScale(uint256 packed) internal pure returns (uint16) {
        uint16 scale = uint16((packed >> DYNAMIC_FEE_VOLUME_TARGET_SHIFT) & UINT16_MASK);
        if (scale == 0 && packed & DYNAMIC_FEES_ENABLED != 0) {
            return ProtocolConstants.DYNAMIC_FEE_DEFAULT_VOLUME_TARGET_SCALE;
        }
        return scale;
    }

    function initialSnipeTaxBps(uint256 packed) internal pure returns (uint16) {
        uint16 tax = uint16((packed >> INITIAL_SNIPE_TAX_SHIFT) & UINT16_MASK);
        if (tax == 0 && packed & ANTI_SNIPE_ENABLED != 0) {
            return ProtocolConstants.DEFAULT_INITIAL_SNIPE_TAX_BPS;
        }
        return tax;
    }

    function _validate(Modules memory m) private pure {
        if (m.hookTaxBps > ProtocolConstants.MAX_HOOK_TAX_BPS) revert HookTaxTooHigh();
        if (m.initialSnipeTaxBps > ProtocolConstants.MAX_SNIPE_TAX_BPS) revert SnipeTaxTooHigh();
        if (m.maxTxBps > ProtocolConstants.MAX_TX_BPS) revert MaxTxTooHigh();
        if (m.maxWalletBps > ProtocolConstants.MAX_WALLET_BPS) revert MaxWalletTooHigh();
        if (m.maxTx && m.maxTxBps < ProtocolConstants.MIN_TX_BPS) revert MaxTxTooLow();
        if (m.maxWallet && m.maxWalletBps < ProtocolConstants.MIN_WALLET_BPS) revert MaxWalletTooLow();
        if (m.floorAllocationBps > ProtocolConstants.MAX_FLOOR_ALLOCATION_BPS) revert FloorAllocTooHigh();
        if (m.autoBurnBps > ProtocolConstants.MAX_AUTO_BURN_BPS) revert AutoBurnTooHigh();
        if (m.lpDonateBps > ProtocolConstants.MAX_LP_DONATE_BPS) revert LpDonateTooHigh();
        if (m.holderAirdropBps > ProtocolConstants.MAX_HOLDER_AIRDROP_BPS) revert HolderAirdropTooHigh();
        // Steady fees (base + hook tax) capped at 10% on every Master launch.
        if (uint256(ProtocolConstants.BASE_FEE_BPS) + m.hookTaxBps > ProtocolConstants.MAX_TOTAL_FEE_BPS) {
            revert TotalFeeTooHigh();
        }
        uint256 routed;
        if (m.backedFloor) routed += m.floorAllocationBps;
        if (m.autoBurn) routed += m.autoBurnBps;
        if (m.lpDonate) routed += m.lpDonateBps;
        if (m.holderAirdrop) routed += m.holderAirdropBps;
        if (routed > ProtocolConstants.BPS_DENOMINATOR) revert FeeRouteTooHigh();
        if (routed > 0 && routed != ProtocolConstants.BPS_DENOMINATOR) revert FeeRouteIncomplete();
        // Fee sinks need a funded hook pot: hook tax and/or creator's 70% of base.
        if (routed > 0 && m.hookTaxBps == 0 && !m.creatorShareToHook) revert HookFundingRequired();
        if (m.creatorShareToHook && m.buybackVesting) revert CreatorShareConflict();
        if (m.buybackVesting) {
            uint32 duration = m.buybackVestingDurationSeconds;
            if (duration == 0) duration = uint32(ProtocolConstants.BUYBACK_VESTING_DURATION);
            if (duration < ProtocolConstants.MIN_BUYBACK_VESTING_DURATION) revert BuybackVestingTooShort();
            if (duration > ProtocolConstants.MAX_BUYBACK_VESTING_DURATION) revert BuybackVestingTooLong();
        }
        if (m.dynamicFees) {
            uint16 minTotal = m.dynamicFeeMinTotalBps;
            if (minTotal == 0) minTotal = ProtocolConstants.BASE_FEE_BPS;
            if (minTotal < ProtocolConstants.BASE_FEE_BPS) revert DynamicFeeMinTooLow();
            uint256 maxTotal = uint256(ProtocolConstants.BASE_FEE_BPS) + m.hookTaxBps;
            if (minTotal + ProtocolConstants.MIN_DYNAMIC_FEE_TOTAL_GAP_BPS > maxTotal) {
                revert DynamicFeeRangeInvalid();
            }
        }
        uint256 openFee = uint256(ProtocolConstants.BASE_FEE_BPS) + m.hookTaxBps;
        if (m.antiSnipe) openFee += m.initialSnipeTaxBps;
        if (openFee > ProtocolConstants.BPS_DENOMINATOR) revert OpenFeeTooHigh();
    }

    error HookTaxTooHigh();
    error HookFundingRequired();
    error CreatorShareConflict();
    error TotalFeeTooHigh();
    error SnipeTaxTooHigh();
    error MaxTxTooHigh();
    error MaxTxTooLow();
    error MaxWalletTooHigh();
    error MaxWalletTooLow();
    error FloorAllocTooHigh();
    error AutoBurnTooHigh();
    error LpDonateTooHigh();
    error HolderAirdropTooHigh();
    error FeeRouteTooHigh();
    error FeeRouteIncomplete();
    error OpenFeeTooHigh();
    error BuybackVestingTooShort();
    error BuybackVestingTooLong();
    error DynamicFeeMinTooLow();
    error DynamicFeeRangeInvalid();
}
