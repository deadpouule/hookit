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
import {HookitSwapRouter} from "../src/HookitSwapRouter.sol";
import {MasterLaunchHook} from "../src/MasterLaunchHook.sol";
import {BuybackVault} from "../src/BuybackVault.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ModuleMatrix} from "../test/utils/ModuleMatrix.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";

/// @notice Launch ETH Master token with Dynamic Fees + Buyback Vesting (7d min), then probe both.
/// @dev Phase 1 — launch + two buys (small/large) to show dynamic fee ramp:
///        forge script script/SmokeDynFeeVestInk.s.sol --rpc-url $INK_RPC_URL --broadcast -vv
///      Phase 2 — after ≥1 min, claim tiny vested creator fees (linear unlock, no need to wait 7d):
///        DYNFEE_PHASE=claim DYNFEE_TOKEN=0x... forge script script/SmokeDynFeeVestInk.s.sol --rpc-url $INK_RPC_URL --broadcast -vv
contract SmokeDynFeeVestInkScript is Script {
    uint256 internal constant ETH_USD_X18 = 2_500e18;

    function run() public {
        require(block.chainid == QuotronStockQuotes.INK_MAINNET, "Ink only");
        string memory phase = vm.envOr("DYNFEE_PHASE", string("launch"));
        if (keccak256(bytes(phase)) == keccak256("claim")) {
            _claimVested();
            return;
        }
        _launchAndProbe();
    }

    function _launchAndProbe() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));
        HookitSwapRouter router = HookitSwapRouter(payable(vm.envAddress("HOOKIT_SWAP_ROUTER")));
        MasterLaunchHook hook = MasterLaunchHook(payable(vm.envAddress("MASTER_LAUNCH_HOOK")));
        BuybackVault buybacks = BuybackVault(payable(vm.envAddress("BUYBACK_VAULT")));

        // BIT_DYNAMIC_FEES (1<<5) | BIT_BUYBACK_VESTING (1<<6)
        BitmaskConfig.Modules memory m = ModuleMatrix.fromMask(uint16(32 + 64));
        // On-chain minimum vest = 7 days (linear — claim a slice after minutes, not weeks).
        m.buybackVestingDurationSeconds = ProtocolConstants.MIN_BUYBACK_VESTING_DURATION;
        // Wide dynamic band so small vs large buys differ clearly.
        m.hookTaxBps = 400; // max total = 5%
        m.dynamicFeeMinTotalBps = 100; // 1% floor (= base only when depth unused)
        m.dynamicFeeDepthSaturationBps = 2_000; // hit max after consuming 20% of in-range depth
        m.dynamicFeeRampUp = true;
        uint256 bitmask = BitmaskConfig.pack(m);

        console.log("user", user);
        console.log("ethBefore", user.balance);
        console.log("bitmask", bitmask);
        console.log("vestSeconds", uint256(m.buybackVestingDurationSeconds));

        uint256 smallWei = vm.envOr("DYNFEE_SMALL_WEI", uint256(0.00015 ether));
        uint256 largeWei = vm.envOr("DYNFEE_LARGE_WEI", uint256(0.0008 ether));

        // Keep gas+buys under a thin wallet (~0.002 ETH).
        require(
            user.balance > ProtocolConstants.LAUNCH_FEE_WEI + smallWei + largeWei + 0.0002 ether,
            "top up ETH for gas+buys"
        );

        vm.startBroadcast(pk);
        // Owner snapshot — ignore if feed path is used elsewhere.
        try factory.setEthUsdPrice(ETH_USD_X18) {} catch {}

        (uint256 launchId, address token, PoolId poolId) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "DynFee Vest Probe",
                symbol: "DFVST",
                metadataURI: "ipfs://hooktest-dynfee-vest",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(address(0)),
                tickSpacing: ProtocolConstants.DEFAULT_TICK_SPACING,
                startingTick: 0,
                bitmask: bitmask,
                customHook: IHooks(address(0)),
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );

        PoolKey memory key = factory.poolKeyOf(launchId);
        bool zeroForOne = _buyZeroForOne(key, token);
        uint160 buyLimit = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;

        uint16 feeSmallBefore = hook.dynamicFeeForSwap(poolId, smallWei, true);
        uint16 feeLargeBefore = hook.dynamicFeeForSwap(poolId, largeWei, true);
        console.log("previewHookTaxBps small", uint256(feeSmallBefore));
        console.log("previewHookTaxBps large", uint256(feeLargeBefore));

        router.swapExactIn{value: smallWei}(key, zeroForOne, smallWei, 1, buyLimit);
        uint16 feeAfterSmall = hook.dynamicFeeForSwap(poolId, largeWei, true);
        console.log("previewHookTaxBps largeAfterSmallBuy", uint256(feeAfterSmall));

        router.swapExactIn{value: largeWei}(key, zeroForOne, largeWei, 1, buyLimit);
        vm.stopBroadcast();

        (Currency streamCur, uint128 streamAmt, uint64 streamStart, uint128 streamClaimed, uint64 streamDur) =
            buybacks.streams(user, token);

        console.log("launchId", launchId);
        console.log("token", token);
        console.logBytes32(PoolId.unwrap(poolId));
        console.log("tokenBal", IERC20(token).balanceOf(user));
        console.log("streamAmount", uint256(streamAmt));
        console.log("streamStart", uint256(streamStart));
        console.log("streamDuration", uint256(streamDur));
        console.log("streamClaimed", uint256(streamClaimed));
        console.log("streamCurrency", Currency.unwrap(streamCur));
        console.log("vestedNow", buybacks.vestedOf(user, token));
        console.log("UI: open /token/%s (or paste address)", token);
        console.log("DYNFEE_LAUNCH_OK");
        console.log("Next: wait ~1-2 min then DYNFEE_PHASE=claim DYNFEE_TOKEN=%s", token);
    }

    function _claimVested() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        address token = vm.envAddress("DYNFEE_TOKEN");
        BuybackVault buybacks = BuybackVault(payable(vm.envAddress("BUYBACK_VAULT")));

        uint256 vested = buybacks.vestedOf(user, token);
        console.log("user", user);
        console.log("token", token);
        console.log("vested", vested);
        require(vested > 0, "nothing vested yet - wait longer");

        vm.startBroadcast(pk);
        buybacks.claim(token);
        vm.stopBroadcast();

        console.log("vestedAfter", buybacks.vestedOf(user, token));
        console.log("DYNFEE_CLAIM_OK");
    }

    function _buyZeroForOne(PoolKey memory key, address token) internal pure returns (bool) {
        return Currency.unwrap(key.currency1) == token;
    }
}
