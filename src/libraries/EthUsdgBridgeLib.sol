// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

import {FeeEthRail} from "../FeeEthRail.sol";
import {QuotronsInk} from "./QuotronsInk.sol";
import {QuotronBridge} from "./QuotronBridge.sol";

/// @title EthUsdgBridgeLib
/// @notice Wire `FeeEthRail` to an **already-live** USDG↔ETH/WETH v4 pool (Quotrons / Ink liquidity).
/// @dev Production must not seed empty proprietary LP — use Quotrons WETH rails / existing depth.
///      Fork tests may `initializeEmpty` then seed via `EthUsdgBridgeSeeder`.
library EthUsdgBridgeLib {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    uint24 internal constant FEE = 3_000;
    int24 internal constant TICK_SPACING = 60;
    /// @dev ~1 ETH ≈ 4000 stable (6 decimals) — test init only.
    int24 internal constant INIT_TICK = -198_120;

    error BridgePoolMissing();
    error BadBridgeKey();

    function poolKey(address stable) internal pure returns (PoolKey memory key) {
        key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(stable),
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });
    }

    /// @notice Register a live bridge. Reverts if the pool has no initialized price.
    function wireLive(IPoolManager manager, FeeEthRail feeRail, PoolKey memory key, address wethToken) internal {
        address c0 = Currency.unwrap(key.currency0);
        address c1 = Currency.unwrap(key.currency1);
        address usdg = feeRail.usdg();
        bool hasUsdg = c0 == usdg || c1 == usdg;
        bool hasEth = c0 == address(0) || c1 == address(0);
        bool hasWeth = wethToken != address(0) && (c0 == wethToken || c1 == wethToken);
        if (!hasUsdg || (!hasEth && !hasWeth)) revert BadBridgeKey();
        if (!QuotronBridge.isAllowedBridgeHook(address(key.hooks))) revert BadBridgeKey();

        (uint160 sqrtPriceX96,,,) = manager.getSlot0(key.toId());
        if (sqrtPriceX96 == 0) revert BridgePoolMissing();

        feeRail.setEthBridge(key, hasEth ? address(0) : wethToken);
    }

    /// @notice Discover a live USDG↔ETH or USDG↔WETH v4 pool and wire `FeeEthRail`.
    /// @dev Quotrons WETH→USDG rails are keeper pots (not a public reverse AMM). Returns false if
    ///      no public USDG bridge exists yet — fees can still rail wStock→USDG and ETH quotes work.
    function tryWireBest(IPoolManager manager, FeeEthRail feeRail) internal returns (bool wired) {
        address usdg = feeRail.usdg();
        address weth = QuotronsInk.WETH;
        uint24[5] memory fees = [uint24(100), 500, 3_000, 10_000, FEE];
        int24[5] memory spacings = [int24(1), 10, 60, 200, TICK_SPACING];

        // Prefer native ETH/USDG, then WETH/USDG.
        for (uint256 i; i < fees.length; ++i) {
            for (uint256 j; j < spacings.length; ++j) {
                PoolKey memory ethKey = PoolKey({
                    currency0: Currency.wrap(address(0)),
                    currency1: Currency.wrap(usdg),
                    fee: fees[i],
                    tickSpacing: spacings[j],
                    hooks: IHooks(address(0))
                });
                (uint160 sqrtEth,,,) = manager.getSlot0(ethKey.toId());
                if (sqrtEth != 0) {
                    feeRail.setEthBridge(ethKey, address(0));
                    return true;
                }

                bool wethIs0 = uint160(weth) < uint160(usdg);
                PoolKey memory wethKey = PoolKey({
                    currency0: Currency.wrap(wethIs0 ? weth : usdg),
                    currency1: Currency.wrap(wethIs0 ? usdg : weth),
                    fee: fees[i],
                    tickSpacing: spacings[j],
                    hooks: IHooks(address(0))
                });
                (uint160 sqrtWeth,,,) = manager.getSlot0(wethKey.toId());
                if (sqrtWeth != 0) {
                    feeRail.setEthBridge(wethKey, weth);
                    return true;
                }
            }
        }
        return false;
    }

    /// @dev Test/fork helper: initialize empty ETH/stable pool if missing (does not seed LP).
    function initializeEmpty(IPoolManager manager, address stable) internal {
        PoolKey memory key = poolKey(stable);
        (uint160 sqrtPriceX96,,,) = manager.getSlot0(key.toId());
        if (sqrtPriceX96 == 0) {
            manager.initialize(key, TickMath.getSqrtPriceAtTick(INIT_TICK));
        }
    }

    function ethUsdgKey() internal pure returns (PoolKey memory key) {
        return poolKey(QuotronsInk.USDG);
    }

    function wethUsdgKey() internal pure returns (PoolKey memory key) {
        address weth = QuotronsInk.WETH;
        address usdg = QuotronsInk.USDG;
        bool wethIs0 = uint160(weth) < uint160(usdg);
        key = PoolKey({
            currency0: Currency.wrap(wethIs0 ? weth : usdg),
            currency1: Currency.wrap(wethIs0 ? usdg : weth),
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });
    }
}
