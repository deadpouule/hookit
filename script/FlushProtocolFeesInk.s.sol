// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

import {ProtocolRevenueDistributor} from "../src/ProtocolRevenueDistributor.sol";
import {HkitBuyback} from "../src/HkitBuyback.sol";
import {FeeEthRail} from "../src/FeeEthRail.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";

/// @notice Permissionless one-shot: flush protocol `pending` -> 20% ops / 80% flywheel, optionally buyback+burn HTST.
/// @dev Prefer the Linode daily keeper (`deploy/linode/fee-keeper`) in prod.
///      Soft launch has no automated on-chain hook — this forge script is the manual/ops fallback.
///
///      Preview:
///        forge script script/FlushProtocolFeesInk.s.sol --rpc-url $INK_RPC_URL -vv
///      Broadcast:
///        forge script script/FlushProtocolFeesInk.s.sol --rpc-url $INK_RPC_URL --broadcast
///
///      Env:
///        PRIVATE_KEY              - required for --broadcast
///        DISTRIBUTOR              - default live Ink distributor
///        HKIT_BUYBACK             - default live Ink HkitBuyback
///        MIN_USDG_OUT             - min USDG out per stock rail (default 0)
///        EXECUTE_BUYBACK          - "true" to call HkitBuyback.execute after ETH flush (default true)
///        BUYBACK_MIN_TOKENS_OUT   - min HTST out (default 0)
contract FlushProtocolFeesInkScript is Script {
    /// @dev Live Ink stack from RedeployHookitInk (override via env).
    address internal constant DEFAULT_DISTRIBUTOR = 0x10d0350B143B40509C7c5461d66Ba28C5AD4b24F;
    address internal constant DEFAULT_HKIT_BUYBACK = 0xF5923Fd54049E9896f6795B531e08DF2f728E917;

    function run() external {
        require(block.chainid == QuotronStockQuotes.INK_MAINNET, "Ink only");

        ProtocolRevenueDistributor distributor =
            ProtocolRevenueDistributor(payable(vm.envOr("DISTRIBUTOR", DEFAULT_DISTRIBUTOR)));
        HkitBuyback buyback = HkitBuyback(payable(vm.envOr("HKIT_BUYBACK", DEFAULT_HKIT_BUYBACK)));
        uint256 minUsdgOut = vm.envOr("MIN_USDG_OUT", uint256(0));
        bool executeBuyback = vm.envOr("EXECUTE_BUYBACK", true);
        uint256 minTokensOut = vm.envOr("BUYBACK_MIN_TOKENS_OUT", uint256(0));

        address usdg = address(0);
        FeeEthRail rail = distributor.feeRail();
        if (address(rail) != address(0)) usdg = rail.usdg();

        console.log("Distributor", address(distributor));
        console.log("HkitBuyback", address(buyback));
        console.log("opsTreasury", distributor.opsTreasury());
        console.log("nativeToken (HTST)", distributor.nativeToken());
        console.log("USDG", usdg);
        console.log("buybackEth before", distributor.buybackEth());

        Currency eth = Currency.wrap(address(0));
        _logPending("ETH", distributor, eth);
        if (usdg != address(0)) _logPending("USDG", distributor, Currency.wrap(usdg));

        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        for (uint256 i; i < stocks.length; ++i) {
            _logPending(_stockLabel(stocks[i].token), distributor, Currency.wrap(stocks[i].token));
        }

        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0));
        if (pk == 0) {
            console.log("No PRIVATE_KEY - preview only (re-run with --broadcast + PRIVATE_KEY to flush)");
            console.log("FLUSH_PROTOCOL_FEES_PREVIEW");
            return;
        }

        vm.startBroadcast(pk);

        // 1) Native ETH pending -> 20% opsTreasury / 80% buybackEth
        _tryDistributeEth(distributor, eth);

        // 2) Each Quotrons wStock with pending -> rail to USDG -> 20/80 (USDG to ops + buybackExecutor)
        for (uint256 i; i < stocks.length; ++i) {
            _tryDistributeStock(distributor, stocks[i].token, minUsdgOut);
        }

        // 3) Native USDG pending (if any left / dust) -> 20/80
        if (usdg != address(0)) {
            _tryDistributeUsdg(distributor, Currency.wrap(usdg));
        }

        // 4) Spend buybackEth on HTST buy+burn (ETH path only)
        if (executeBuyback) {
            // Flush creator-fee buyback credits into the pot first (no-op if empty).
            distributor.flushBuybackEth();
            uint256 pot = distributor.buybackEth();
            console.log("buybackEth after flush", pot);
            if (pot > 0) {
                uint256 burned = buyback.execute(pot, minTokensOut);
                console.log("BuybackBurned HTST", burned);
            } else {
                console.log("No buybackEth - skip HkitBuyback.execute");
                console.log("(wStock fees become USDG at buybackExecutor, not ETH pot)");
            }
        } else {
            console.log("EXECUTE_BUYBACK=false - skipped");
        }

        vm.stopBroadcast();

        console.log("buybackEth after", distributor.buybackEth());
        console.log("FLUSH_PROTOCOL_FEES_OK");
    }

    function _logPending(string memory label, ProtocolRevenueDistributor d, Currency c) private view {
        uint256 amt = d.pending(c);
        if (amt == 0) return;
        console.log("--- pending", label);
        console.log("amount", amt);
    }

    function _tryDistributeEth(ProtocolRevenueDistributor d, Currency eth) private {
        uint256 amt = d.pending(eth);
        if (amt == 0) {
            console.log("skip distribute ETH (empty)");
            return;
        }
        console.log("distribute ETH", amt);
        d.distribute(eth);
    }

    function _tryDistributeUsdg(ProtocolRevenueDistributor d, Currency usdg) private {
        uint256 amt = d.pending(usdg);
        if (amt == 0) {
            console.log("skip distribute USDG (empty)");
            return;
        }
        console.log("distribute USDG", amt);
        d.distribute(usdg);
    }

    function _tryDistributeStock(ProtocolRevenueDistributor d, address stock, uint256 minUsdgOut) private {
        Currency c = Currency.wrap(stock);
        uint256 amt = d.pending(c);
        if (amt == 0) return;
        console.log("distributeToBuyback stock", stock);
        console.log("pending", amt);
        try d.distributeToBuyback(c, minUsdgOut) {
            console.log("stock flush ok");
        } catch Error(string memory reason) {
            console.log("stock flush failed");
            console.log(reason);
        } catch {
            console.log("stock flush failed (low-level)");
        }
    }

    function _stockLabel(address token) private pure returns (string memory) {
        if (token == QuotronStockQuotes.wNVDAx) return "wNVDAx";
        if (token == QuotronStockQuotes.wMCDx) return "wMCDx";
        if (token == QuotronStockQuotes.wTSLAx) return "wTSLAx";
        if (token == QuotronStockQuotes.wAAPLx) return "wAAPLx";
        if (token == QuotronStockQuotes.wAMZNx) return "wAMZNx";
        if (token == QuotronStockQuotes.wGOOGLx) return "wGOOGLx";
        if (token == QuotronStockQuotes.wMSTRx) return "wMSTRx";
        if (token == QuotronStockQuotes.wNFLXx) return "wNFLXx";
        if (token == QuotronStockQuotes.wSPYx) return "wSPYx";
        return "wStock";
    }
}
