// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";

/// @title McapVest
/// @notice Packed USD-mcap unlock schedules for BuybackVault + HolderAirdropVault.
/// @dev One `uint256` holds both modules (buyback in the low 128 bits, airdrop in the high 128).
///      Kind 0 (time) is a no-op — vaults keep their existing time / epoch behavior.
library McapVest {
    uint8 internal constant KIND_TIME = 0;
    uint8 internal constant KIND_CLIFF = 1;
    uint8 internal constant KIND_STEPS = 2;
    uint8 internal constant MAX_STEPS = 6;
    uint8 internal constant PRESET_COUNT = 7;
    /// Buyback cliff / steps start at 10M (preset index 1). Airdrop may use 5M (index 0).
    uint8 internal constant BUYBACK_MIN_PRESET = 1;

    uint256 internal constant AIRDROP_SHIFT = 128;

    struct Step {
        uint8 preset;
        uint8 pct;
    }

    struct Plan {
        uint8 kind;
        uint32 durationSeconds;
        uint8 cliffPreset;
        uint8 stepCount;
        Step[6] steps;
    }

    /// 5M, 10M, 50M, 100M, 500M, 1B, 10B — whole USD.
    function presetUsd(uint8 idx) internal pure returns (uint64) {
        if (idx == 0) return 5_000_000;
        if (idx == 1) return 10_000_000;
        if (idx == 2) return 50_000_000;
        if (idx == 3) return 100_000_000;
        if (idx == 4) return 500_000_000;
        if (idx == 5) return 1_000_000_000;
        if (idx == 6) return 10_000_000_000;
        revert InvalidPreset();
    }

    function join(uint128 buyback, uint128 airdrop) internal pure returns (uint256 packed) {
        packed = uint256(buyback) | (uint256(airdrop) << AIRDROP_SHIFT);
    }

    function buybackSlice(uint256 packed) internal pure returns (uint128) {
        return uint128(packed);
    }

    function airdropSlice(uint256 packed) internal pure returns (uint128) {
        return uint128(packed >> AIRDROP_SHIFT);
    }

    function pack(Plan memory p) internal pure returns (uint128 packed) {
        validate(p, false);
        packed = uint128(uint256(p.kind) & 3);
        packed |= uint128(uint256(p.durationSeconds) << 2);
        packed |= uint128(uint256(p.cliffPreset & 7) << 34);
        packed |= uint128(uint256(p.stepCount & 7) << 37);
        uint256 cursor = 40;
        for (uint256 i; i < MAX_STEPS; ++i) {
            uint256 step = (uint256(p.steps[i].preset) & 7) | (uint256(p.steps[i].pct) << 3);
            packed |= uint128(step << cursor);
            cursor += 11;
        }
    }

    function unpack(uint128 packed) internal pure returns (Plan memory p) {
        p.kind = uint8(packed & 3);
        p.durationSeconds = uint32(uint256(packed) >> 2);
        p.cliffPreset = uint8((uint256(packed) >> 34) & 7);
        p.stepCount = uint8((uint256(packed) >> 37) & 7);
        uint256 cursor = 40;
        for (uint256 i; i < MAX_STEPS; ++i) {
            uint256 step = (uint256(packed) >> cursor) & 0x7FF;
            p.steps[i].preset = uint8(step & 7);
            p.steps[i].pct = uint8(step >> 3);
            cursor += 11;
        }
    }

    /// @dev `bps` of the pot / stream that is unlocked at `fdvUsd` (whole USD). Time plans return 0
    ///      so the caller keeps using duration / epoch logic.
    function unlockedBps(Plan memory p, uint256 fdvUsd) internal pure returns (uint16) {
        if (p.kind == KIND_TIME) return 0;
        if (p.kind == KIND_CLIFF) {
            return fdvUsd >= uint256(presetUsd(p.cliffPreset)) ? 10_000 : 0;
        }
        uint256 acc;
        uint256 n = p.stepCount;
        if (n > MAX_STEPS) n = MAX_STEPS;
        for (uint256 i; i < n; ++i) {
            if (fdvUsd >= uint256(presetUsd(p.steps[i].preset))) acc += uint256(p.steps[i].pct) * 100;
        }
        if (acc > 10_000) acc = 10_000;
        return uint16(acc);
    }

    function fdvUsdWhole(uint256 quoteAmount, uint256 quoteUsdX18, uint8 decimals) internal pure returns (uint256) {
        if (quoteAmount == 0 || quoteUsdX18 == 0 || decimals > 36) return 0;
        return FullMath.mulDiv(quoteAmount, quoteUsdX18, 10 ** uint256(decimals)) / 1e18;
    }

    function validate(Plan memory p, bool buyback) internal pure {
        if (p.kind > KIND_STEPS) revert InvalidKind();
        if (p.kind == KIND_TIME) return;
        uint8 minPreset = buyback ? BUYBACK_MIN_PRESET : 0;
        if (p.kind == KIND_CLIFF) {
            if (p.cliffPreset >= PRESET_COUNT || p.cliffPreset < minPreset) revert InvalidPreset();
            return;
        }
        if (p.stepCount == 0 || p.stepCount > MAX_STEPS) revert InvalidSteps();
        uint256 sum;
        uint64 prev;
        for (uint256 i; i < p.stepCount; ++i) {
            uint8 preset = p.steps[i].preset;
            if (preset >= PRESET_COUNT || preset < minPreset) revert InvalidPreset();
            uint64 usd = presetUsd(preset);
            if (i > 0 && usd <= prev) revert StepsNotIncreasing();
            prev = usd;
            sum += p.steps[i].pct;
        }
        if (sum != 100) revert StepPctSum();
    }

    error InvalidKind();
    error InvalidPreset();
    error InvalidSteps();
    error StepsNotIncreasing();
    error StepPctSum();
}
