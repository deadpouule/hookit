// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";

import {BitmaskConfig} from "./BitmaskConfig.sol";
import {FixedPointMath} from "./FixedPointMath.sol";
import {ProtocolConstants} from "./ProtocolConstants.sol";
import {FeeEscrow} from "../FeeEscrow.sol";
import {FloorVault} from "../FloorVault.sol";
import {HolderAirdropVault} from "../HolderAirdropVault.sol";
import {BuybackVault} from "../BuybackVault.sol";
import {ProtocolRevenueDistributor} from "../ProtocolRevenueDistributor.sol";

/// @title FeeSplitLib
/// @notice External library: 60/10/30 base split + hook-tax module routing.
/// @dev Linked (not inlined) so MasterLaunchHook stays under EIP-170. DELEGATECALL so
///      claim transfers originate from the hook. Caller writes pending module cuts.
library FeeSplitLib {
    using BitmaskConfig for uint256;
    using CurrencyLibrary for Currency;

    struct Targets {
        ProtocolRevenueDistributor distributor;
        FeeEscrow escrow;
        FloorVault vault;
        BuybackVault buybacks;
        HolderAirdropVault airdropVault;
    }

    struct Result {
        uint256 creatorEscrowAmt;
        uint256 protocolShare;
        uint256 floorCut;
        uint256 buybackAmt;
        uint256 autoBurnCut;
        uint256 deepenLpsCut;
        uint256 airdropCut;
        uint256 hktShare;
    }

    function distribute(
        IPoolManager manager,
        Currency quote,
        address token,
        address creator,
        uint256 packed,
        uint256 feeAmount,
        uint16 snipeBps,
        uint16 effectiveHookTaxBps,
        bool fromPoolClaims,
        bool protocolTakesAll,
        bool hktDropReady,
        Targets calldata t
    ) external returns (Result memory r) {
        if (protocolTakesAll) {
            _fund(manager, quote, address(t.distributor), feeAmount, fromPoolClaims);
            if (feeAmount > 0) t.distributor.notifyInternal(quote, feeAmount);
            r.protocolShare = feeAmount;
            return r;
        }

        uint256 totalBps = uint256(ProtocolConstants.BASE_FEE_BPS) + uint256(effectiveHookTaxBps) + uint256(snipeBps);
        if (totalBps == 0) return r;

        _splitBase(feeAmount, effectiveHookTaxBps, totalBps, hktDropReady, r);
        _routeCreator(manager, quote, token, creator, packed, fromPoolClaims, t, r);
        _routeHookPot(manager, quote, token, packed, fromPoolClaims, t, r);
    }

    function _splitBase(
        uint256 feeAmount,
        uint16 effectiveHookTaxBps,
        uint256 totalBps,
        bool hktDropReady,
        Result memory r
    ) private pure {
        uint256 hookTaxAmount = feeAmount * uint256(effectiveHookTaxBps) / totalBps;
        (uint256 creatorShare, uint256 hktShare, uint256 protocolFromBase) =
            ProtocolConstants.splitBaseFee(feeAmount - hookTaxAmount);
        if (!hktDropReady) {
            protocolFromBase += hktShare;
            hktShare = 0;
        }
        // Reuse fields as scratch: protocolShare = protocolFromBase + leftover hook pot (filled later).
        // floorCut temporarily holds the hook pot before module cuts are applied.
        r.creatorEscrowAmt = creatorShare;
        r.hktShare = hktShare;
        r.protocolShare = protocolFromBase;
        r.floorCut = hookTaxAmount;
    }

    function _routeCreator(
        IPoolManager manager,
        Currency quote,
        address token,
        address creator,
        uint256 packed,
        bool fromPoolClaims,
        Targets calldata t,
        Result memory r
    ) private {
        uint256 creatorShare = r.creatorEscrowAmt;
        if (packed.enabled(BitmaskConfig.CREATOR_SHARE_TO_HOOK_ENABLED)) {
            r.floorCut += creatorShare;
            r.creatorEscrowAmt = 0;
            return;
        }
        if (token == t.distributor.nativeToken() && t.distributor.nativeToken() != address(0)) {
            r.buybackAmt = creatorShare;
            r.creatorEscrowAmt = 0;
            _fund(manager, quote, address(t.distributor), creatorShare, fromPoolClaims);
            if (creatorShare > 0) t.distributor.notifyBuybackInternal(quote, creatorShare);
            return;
        }
        if (packed.enabled(BitmaskConfig.BUYBACK_VESTING_ENABLED) && creatorShare > 0) {
            r.buybackAmt = creatorShare;
            r.creatorEscrowAmt = 0;
            _fund(manager, quote, address(t.buybacks), creatorShare, fromPoolClaims);
            t.buybacks.creditInternal(creator, token, quote, creatorShare, packed.buybackVestingDurationSeconds());
            return;
        }
        _fund(manager, quote, address(t.escrow), creatorShare, fromPoolClaims);
        if (creatorShare > 0) t.escrow.creditInternal(creator, quote, creatorShare);
    }

    function _routeHookPot(
        IPoolManager manager,
        Currency quote,
        address token,
        uint256 packed,
        bool fromPoolClaims,
        Targets calldata t,
        Result memory r
    ) private {
        uint256 hookPot = r.floorCut;
        uint256 floorCut = packed.enabled(BitmaskConfig.BACKED_FLOOR_ENABLED)
            ? FixedPointMath.applyBps(hookPot, packed.floorAllocationBps())
            : 0;
        uint256 autoBurnCut = packed.enabled(BitmaskConfig.AUTO_BURN_ENABLED)
            ? FixedPointMath.applyBps(hookPot, packed.autoBurnBps())
            : 0;
        uint256 deepenLpsCut = packed.enabled(BitmaskConfig.DEEPEN_LPS_ENABLED)
            ? FixedPointMath.applyBps(hookPot, packed.deepenLpsBps())
            : 0;
        uint256 airdropCut = packed.enabled(BitmaskConfig.HOLDER_AIRDROP_ENABLED)
            ? FixedPointMath.applyBps(hookPot, packed.holderAirdropBps())
            : 0;

        uint256 routed = floorCut + autoBurnCut + deepenLpsCut + airdropCut;
        if (routed > hookPot) {
            airdropCut = 0;
            routed = floorCut + autoBurnCut + deepenLpsCut;
            if (routed > hookPot) {
                deepenLpsCut = 0;
                routed = floorCut + autoBurnCut;
                if (routed > hookPot) {
                    autoBurnCut = 0;
                    routed = floorCut;
                }
            }
        }

        r.floorCut = floorCut;
        r.autoBurnCut = autoBurnCut;
        r.deepenLpsCut = deepenLpsCut;
        r.airdropCut = airdropCut;
        r.protocolShare += hookPot - routed;

        _fund(manager, quote, address(t.distributor), r.protocolShare, fromPoolClaims);
        if (r.protocolShare > 0) t.distributor.notifyInternal(quote, r.protocolShare);

        _fund(manager, quote, address(t.vault), floorCut, fromPoolClaims);
        if (floorCut > 0) t.vault.depositInternal(token, quote, floorCut);

        _fund(manager, quote, address(t.airdropVault), airdropCut, fromPoolClaims);
        if (airdropCut > 0) t.airdropVault.depositInternal(token, quote, airdropCut);
    }

    function _fund(IPoolManager manager, Currency quote, address to, uint256 amount, bool fromPoolClaims) private {
        if (amount == 0) return;
        if (fromPoolClaims) {
            manager.transfer(to, quote.toId(), amount);
        } else {
            quote.transfer(to, amount);
        }
    }
}
