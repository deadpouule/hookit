// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

import {LaunchFactory} from "../src/LaunchFactory.sol";
import {BondingLaunchFactory} from "../src/BondingLaunchFactory.sol";
import {HookitSwapRouter} from "../src/HookitSwapRouter.sol";
import {MasterLaunchHook} from "../src/MasterLaunchHook.sol";
import {BuybackVault} from "../src/BuybackVault.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ModuleMatrix} from "../test/utils/ModuleMatrix.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";

/// @notice Live Ink smoke: Master (min tx + min wallet + buyback vesting + tiny dev buy)
///         then a Classic bonding launch. Probe phase proves oversize buys revert.
///
///         Phase launch (broadcast):
///           forge script script/SmokeMinTxVestClassicInk.s.sol --rpc-url $INK_RPC_URL --broadcast -vv
///         Phase probe (fork only — deal() extra ETH, no spend):
///           SMOKE_PHASE=probe SMOKE_LAUNCH_ID=<id> forge script script/SmokeMinTxVestClassicInk.s.sol --rpc-url $INK_RPC_URL -vv
///         Phase claim (after ~1–2 min; linear vest, no 7-day wait):
///           SMOKE_PHASE=claim SMOKE_TOKEN=0x... forge script script/SmokeMinTxVestClassicInk.s.sol --rpc-url $INK_RPC_URL --broadcast -vv
///
/// @dev Wallet is thin (~0.001 ETH). Launch fees are dropped to 0.0001 ETH for the two
///      launches then restored to 0.0005 ETH in the same broadcast.
contract SmokeMinTxVestClassicInkScript is Script {
    /// @dev Canonical Ink factories from `deploy/ink/addresses.json` (UI catalogue).
    address internal constant DEFAULT_FACTORY = 0xc4ba4E6c5233dED0FDEBA344508688D796C2cde7;
    address internal constant DEFAULT_BONDING = 0x376A629742aD7a76Df57eda1Df7CD000363c1529;
    address internal constant DEFAULT_ROUTER = 0x332e59C831Df0045E557334F3735f3CA5C011ABf;
    address internal constant DEFAULT_HOOK = 0xF092f9fdF95a31671e2562b3d0Ba7c2FD3b8aAC8;
    address internal constant DEFAULT_BUYBACKS = 0x5Bf81f623A15695957d4465D4A26e7c2913ff553;

    uint256 internal constant TEMP_LAUNCH_FEE = 0.0001 ether;
    uint256 internal constant DEV_BUY_WEI = 0.000025 ether;
    uint256 internal constant LEGAL_BUY_WEI = 0.000025 ether;
    uint256 internal constant CLASSIC_DEV_BUY_WEI = 0.00002 ether;
    /// @dev ~0.15% of the ~2.02 ETH launch FDV — over the 0.1% min tx cap.
    uint256 internal constant OVERSIZE_TX_WEI = 0.003 ether;
    /// @dev ~0.1% of FDV after a tiny existing balance — under max tx, over max wallet.
    uint256 internal constant OVERSIZE_WALLET_WEI = 0.002 ether;

    function run() public {
        require(block.chainid == QuotronStockQuotes.INK_MAINNET, "Ink only");
        string memory phase = vm.envOr("SMOKE_PHASE", string("launch"));
        if (keccak256(bytes(phase)) == keccak256("probe")) {
            _probeLimits();
            return;
        }
        if (keccak256(bytes(phase)) == keccak256("claim")) {
            _claimVested();
            return;
        }
        _launchBoth();
    }

    function _launchBoth() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        LaunchFactory factory = LaunchFactory(payable(vm.envOr("LAUNCH_FACTORY", DEFAULT_FACTORY)));
        BondingLaunchFactory bonding = BondingLaunchFactory(payable(vm.envOr("BONDING_FACTORY", DEFAULT_BONDING)));
        HookitSwapRouter router = HookitSwapRouter(payable(vm.envOr("HOOKIT_SWAP_ROUTER", DEFAULT_ROUTER)));
        BuybackVault buybacks = BuybackVault(payable(vm.envOr("BUYBACK_VAULT", DEFAULT_BUYBACKS)));

        // maxTx | maxWallet | buybackVesting
        BitmaskConfig.Modules memory m = ModuleMatrix.fromMask(
            uint16(ModuleMatrix.BIT_MAX_TX | ModuleMatrix.BIT_MAX_WALLET | ModuleMatrix.BIT_BUYBACK_VESTING)
        );
        m.maxTxBps = ProtocolConstants.MIN_TX_BPS;
        m.maxWalletBps = ProtocolConstants.MIN_WALLET_BPS;
        m.buybackVestingDurationSeconds = ProtocolConstants.MIN_BUYBACK_VESTING_DURATION;
        m.hookTaxBps = 0;
        uint256 bitmask = BitmaskConfig.pack(m);

        uint256 needed =
            TEMP_LAUNCH_FEE + DEV_BUY_WEI + TEMP_LAUNCH_FEE + CLASSIC_DEV_BUY_WEI + LEGAL_BUY_WEI + 0.00015 ether;
        console.log("user", user);
        console.log("ethBefore", user.balance);
        console.log("bitmask", bitmask);
        console.log("maxTxBps", uint256(m.maxTxBps));
        console.log("maxWalletBps", uint256(m.maxWalletBps));
        console.log("vestSeconds", uint256(m.buybackVestingDurationSeconds));
        console.log("mcapQuoteWei", factory.launchMcapQuoteWei());
        require(user.balance > needed, "top up ETH for gas+launches");

        vm.startBroadcast(pk);

        uint256 priorMasterFee = factory.launchFee();
        uint256 priorBondingFee = bonding.launchFee();
        factory.setLaunchFee(TEMP_LAUNCH_FEE);
        bonding.setLaunchFee(TEMP_LAUNCH_FEE);

        (uint256 masterId, address masterToken, PoolId poolId) = factory.launch{value: TEMP_LAUNCH_FEE + DEV_BUY_WEI}(
            LaunchFactory.LaunchParams({
                name: "MinTx Vest Probe",
                symbol: "MTXV",
                metadataURI: "ipfs://hookit-mintx-vest-probe",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(address(0)),
                tickSpacing: ProtocolConstants.DEFAULT_TICK_SPACING,
                startingTick: 0,
                bitmask: bitmask,
                customHook: IHooks(address(0)),
                devBuyQuoteIn: DEV_BUY_WEI,
                minDevBuyTokensOut: 1
            })
        );

        (uint256 classicId, address classicToken) = bonding.launch{value: TEMP_LAUNCH_FEE + CLASSIC_DEV_BUY_WEI}(
            BondingLaunchFactory.LaunchParams({
                name: "Classic Curve Probe",
                symbol: "CLCP",
                metadataURI: "ipfs://hookit-classic-curve-probe",
                totalSupply: 0,
                quote: Currency.wrap(address(0)),
                creatorTaxBps: 0,
                devBuyQuoteIn: CLASSIC_DEV_BUY_WEI,
                minDevBuyTokensOut: 1
            })
        );

        factory.setLaunchFee(priorMasterFee);
        bonding.setLaunchFee(priorBondingFee);

        PoolKey memory key = factory.poolKeyOf(masterId);
        bool zeroForOne = _buyZeroForOne(key, masterToken);
        uint160 buyLimit = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
        router.swapExactIn{value: LEGAL_BUY_WEI}(key, zeroForOne, LEGAL_BUY_WEI, 1, buyLimit);

        vm.stopBroadcast();

        (Currency streamCur, uint128 streamAmt, uint64 streamStart, uint128 streamClaimed, uint64 streamDur) =
            buybacks.streams(user, masterToken);

        console.log("masterLaunchId", masterId);
        console.log("masterToken", masterToken);
        console.logBytes32(PoolId.unwrap(poolId));
        console.log("masterTokenBal", IERC20(masterToken).balanceOf(user));
        console.log("classicLaunchId", classicId);
        console.log("classicToken", classicToken);
        console.log("classicTokenBal", IERC20(classicToken).balanceOf(user));
        console.log("streamAmount", uint256(streamAmt));
        console.log("streamStart", uint256(streamStart));
        console.log("streamDuration", uint256(streamDur));
        console.log("streamClaimed", uint256(streamClaimed));
        console.log("streamCurrency", Currency.unwrap(streamCur));
        console.log("vestedNow", buybacks.vestedOf(user, masterToken));
        console.log("ethAfter", user.balance);
        console.log("restoredMasterFee", factory.launchFee());
        console.log("restoredBondingFee", bonding.launchFee());
        console.log("UI master /token/%s", masterToken);
        console.log("UI classic /token/%s", classicToken);
        console.log("MINTX_LAUNCH_OK");
        console.log("Next probe: SMOKE_PHASE=probe SMOKE_LAUNCH_ID=%s", masterId);
        console.log("Next claim: wait ~1-2 min then SMOKE_PHASE=claim SMOKE_TOKEN=%s", masterToken);
    }

    function _probeLimits() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        uint256 launchId = vm.envUint("SMOKE_LAUNCH_ID");
        LaunchFactory factory = LaunchFactory(payable(vm.envOr("LAUNCH_FACTORY", DEFAULT_FACTORY)));
        HookitSwapRouter router = HookitSwapRouter(payable(vm.envOr("HOOKIT_SWAP_ROUTER", DEFAULT_ROUTER)));

        PoolKey memory key = factory.poolKeyOf(launchId);
        (address token,,,,,,,) = factory.launches(launchId);
        bool zeroForOne = _buyZeroForOne(key, token);
        uint160 buyLimit = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
        uint256 bal = IERC20(token).balanceOf(user);
        uint256 cap =
            ProtocolConstants.DEFAULT_LAUNCH_SUPPLY * ProtocolConstants.MIN_TX_BPS / ProtocolConstants.BPS_DENOMINATOR;

        console.log("user", user);
        console.log("token", token);
        console.log("tokenBal", bal);
        console.log("capTokens", cap);

        vm.deal(user, 10 ether);
        vm.startPrank(user);

        bool txReverted;
        bool txWasMaxTx;
        try router.swapExactIn{value: OVERSIZE_TX_WEI}(key, zeroForOne, OVERSIZE_TX_WEI, 1, buyLimit) {
            console.log("OVERSIZE_TX_UNEXPECTED_OK");
        } catch (bytes memory reason) {
            txReverted = true;
            txWasMaxTx = _containsSelector(reason, MasterLaunchHook.MaxTxExceeded.selector);
            console.log("oversizeTxReverted", txReverted);
            console.log("oversizeTxMaxTxExceeded", txWasMaxTx);
            if (!txWasMaxTx) {
                bool walletHit = _containsSelector(reason, MasterLaunchHook.MaxWalletExceeded.selector);
                console.log("oversizeTxMaxWalletExceeded", walletHit);
                if (!walletHit) console.logBytes(reason);
            }
        }

        bool walletReverted;
        bool walletWasMaxWallet;
        try router.swapExactIn{value: OVERSIZE_WALLET_WEI}(key, zeroForOne, OVERSIZE_WALLET_WEI, 1, buyLimit) {
            console.log("OVERSIZE_WALLET_UNEXPECTED_OK");
        } catch (bytes memory reason) {
            walletReverted = true;
            walletWasMaxWallet = _containsSelector(reason, MasterLaunchHook.MaxWalletExceeded.selector);
            bool walletWasMaxTx = _containsSelector(reason, MasterLaunchHook.MaxTxExceeded.selector);
            console.log("oversizeWalletReverted", walletReverted);
            console.log("oversizeWalletMaxWalletExceeded", walletWasMaxWallet);
            console.log("oversizeWalletMaxTxExceeded", walletWasMaxTx);
            if (!walletWasMaxWallet && !walletWasMaxTx) console.logBytes(reason);
        }

        vm.stopPrank();

        require(txReverted, "oversize tx did not revert");
        require(walletReverted, "oversize wallet buy did not revert");
        console.log("MINTX_PROBE_OK");
    }

    function _claimVested() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        address token = vm.envAddress("SMOKE_TOKEN");
        BuybackVault buybacks = BuybackVault(payable(vm.envOr("BUYBACK_VAULT", DEFAULT_BUYBACKS)));

        uint256 vested = buybacks.vestedOf(user, token);
        console.log("user", user);
        console.log("token", token);
        console.log("vested", vested);
        require(vested > 0, "nothing vested yet - wait longer");

        vm.startBroadcast(pk);
        buybacks.claim(token);
        vm.stopBroadcast();

        console.log("vestedAfter", buybacks.vestedOf(user, token));
        console.log("MINTX_CLAIM_OK");
    }

    function _buyZeroForOne(PoolKey memory key, address token) internal pure returns (bool) {
        return Currency.unwrap(key.currency1) == token;
    }

    function _containsSelector(bytes memory reason, bytes4 sel) internal pure returns (bool) {
        if (reason.length < 4) return false;
        for (uint256 i; i + 4 <= reason.length; ++i) {
            bytes4 word;
            assembly {
                word := mload(add(add(reason, 32), i))
            }
            if (word == sel) return true;
        }
        return false;
    }
}
