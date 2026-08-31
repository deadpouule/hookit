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
import {LaunchToken} from "../src/LaunchToken.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ModuleMatrix} from "../test/utils/ModuleMatrix.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";

/// @notice Ink mainnet: launch several tokens with distinct module sets, buy each, optionally sell later.
/// @dev Phase 1: `MATRIX_PHASE=launch forge script script/ModuleMatrixInk.s.sol --rpc-url $INK_RPC_URL --broadcast`
///      Phase 2: `MATRIX_PHASE=sell MATRIX_LAUNCH_IDS=3,4,5,6,7 forge script ... --broadcast` (next block)
contract ModuleMatrixInkScript is Script {
    uint256 internal constant ETH_USD_X18 = 2_491e18;
    uint256 internal constant CASE_COUNT = 5;

    struct CaseSpec {
        string name;
        string symbol;
        string uri;
        uint16 mask;
        bool custom;
    }

    function run() public {
        string memory phase = vm.envOr("MATRIX_PHASE", string("launch"));
        bytes32 p = keccak256(bytes(phase));
        if (p == keccak256("sell")) {
            _sellAll();
            return;
        }
        _launchAll();
    }

    function _launchAll() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));
        HookitSwapRouter router = HookitSwapRouter(payable(vm.envAddress("HOOKIT_SWAP_ROUTER")));
        uint256 buyWei = vm.envOr("MATRIX_BUY_WEI", uint256(0.0002 ether));

        console.log("user", user);
        console.log("ethBefore", user.balance);
        console.log("buyWei", buyWei);

        CaseSpec[CASE_COUNT] memory specs = _cases();

        vm.startBroadcast(pk);
        factory.setEthUsdPrice(ETH_USD_X18);

        for (uint256 i = 0; i < CASE_COUNT; i++) {
            CaseSpec memory spec = specs[i];
            BitmaskConfig.Modules memory modules = _modulesFor(spec);
            uint256 bitmask = BitmaskConfig.pack(modules);

            (uint256 launchId, address token, PoolId poolId) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
                LaunchFactory.LaunchParams({
                    name: spec.name,
                    symbol: spec.symbol,
                    metadataURI: spec.uri,
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
            router.swapExactIn{value: buyWei}(key, zeroForOne, buyWei, 1, buyLimit);

            uint256 storedMask = factory.launchBitmasks(launchId);
            require(storedMask == bitmask, "bitmask mismatch");

            console.log("--- case", i);
            console.logString(spec.name);
            console.log("launchId", launchId);
            console.log("token", token);
            console.logBytes32(PoolId.unwrap(poolId));
            console.log("bitmask", bitmask);
            console.log("tokenBal", IERC20(token).balanceOf(user));
            console.log("creator", LaunchToken(token).creator());
            console.logString(LaunchToken(token).metadataURI());
        }

        vm.stopBroadcast();

        console.log("ethAfter", user.balance);
        console.log("MATRIX_LAUNCH_OK");
    }

    function _sellAll() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));
        HookitSwapRouter router = HookitSwapRouter(payable(vm.envAddress("HOOKIT_SWAP_ROUTER")));
        string memory idsCsv = vm.envString("MATRIX_LAUNCH_IDS");

        console.log("user", user);
        console.log("ethBefore", user.balance);
        console.logString(idsCsv);

        vm.startBroadcast(pk);

        uint256 cursor;
        while (cursor < bytes(idsCsv).length) {
            (uint256 launchId, uint256 next) = _nextLaunchId(idsCsv, cursor);
            cursor = next;
            if (launchId == 0) continue;

            PoolKey memory key = factory.poolKeyOf(launchId);
            address token = Currency.unwrap(key.currency0) == address(0)
                ? Currency.unwrap(key.currency1)
                : Currency.unwrap(key.currency0);

            uint256 tokenBal = IERC20(token).balanceOf(user);
            if (tokenBal == 0) {
                console.log("skip empty launchId", launchId);
                continue;
            }

            IERC20(token).approve(address(router), tokenBal);
            bool sellZeroForOne = !_buyZeroForOne(key, token);
            uint160 sellLimit = sellZeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
            router.swapExactIn(key, sellZeroForOne, tokenBal, 1, sellLimit);

            console.log("sold launchId", launchId);
            console.log("token", token);
            console.log("tokenAfter", IERC20(token).balanceOf(user));
        }

        vm.stopBroadcast();

        console.log("ethAfter", user.balance);
        console.log("MATRIX_SELL_OK");
    }

    function _cases() internal pure returns (CaseSpec[CASE_COUNT] memory specs) {
        specs[0] = CaseSpec("Hook Anti Snipe", "HSNIP", "ipfs://hookit-ink-anti-snipe", 1, false);
        specs[1] = CaseSpec("Hook Floor", "HFLOOR", "ipfs://hookit-ink-floor", 2, false);
        specs[2] = CaseSpec("Hook Burn LP", "HBURN", "ipfs://hookit-ink-burn-lp", 384, false);
        specs[3] = CaseSpec("Hook Limits", "HLIM", "ipfs://hookit-ink-limits", 28, false);
        specs[4] = CaseSpec("Hook Airdrop", "HAIR", "ipfs://hookit-ink-airdrop", 0, true);
    }

    function _modulesFor(CaseSpec memory spec) internal pure returns (BitmaskConfig.Modules memory m) {
        if (spec.custom) {
            m.dynamicFees = true;
            m.buybackVesting = true;
            m.holderAirdrop = true;
            m.holderAirdropBps = 1_500;
            m.hookTaxBps = 300;
            return m;
        }
        return ModuleMatrix.fromMask(spec.mask);
    }

    function _buyZeroForOne(PoolKey memory key, address token) internal pure returns (bool) {
        return Currency.unwrap(key.currency1) == token;
    }

    function _nextLaunchId(string memory csv, uint256 start) internal pure returns (uint256 id, uint256 next) {
        bytes memory b = bytes(csv);
        uint256 n;
        bool inNum;
        for (uint256 i = start; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c >= 48 && c <= 57) {
                n = n * 10 + (c - 48);
                inNum = true;
            } else if (inNum) {
                return (n, i + 1);
            }
        }
        if (inNum) return (n, b.length);
        return (0, b.length);
    }
}
