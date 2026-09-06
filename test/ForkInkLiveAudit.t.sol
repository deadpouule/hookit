// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

import {LaunchFactory} from "../src/LaunchFactory.sol";
import {MasterLaunchHook} from "../src/MasterLaunchHook.sol";
import {BondingLaunchFactory} from "../src/BondingLaunchFactory.sol";
import {GraduatedFeeHook} from "../src/GraduatedFeeHook.sol";
import {FloorVault} from "../src/FloorVault.sol";
import {FeeEscrow} from "../src/FeeEscrow.sol";
import {ProtocolRevenueDistributor} from "../src/ProtocolRevenueDistributor.sol";
import {BuybackVault} from "../src/BuybackVault.sol";
import {HolderAirdropVault} from "../src/HolderAirdropVault.sol";
import {HookitSwapRouter} from "../src/HookitSwapRouter.sol";
import {HkitBuyback} from "../src/HkitBuyback.sol";
import {FeeEthRail} from "../src/FeeEthRail.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";
import {UniswapV4Deployments} from "../src/libraries/UniswapV4Deployments.sol";
import {IMasterLaunchHook} from "../src/interfaces/IMasterLaunchHook.sol";

/// @notice Audit the live Ink deploy (addresses.json): wiring, hook flags, every launch, buy/sell.
contract ForkInkLiveAuditTest is Test {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using CurrencyLibrary for Currency;
    using BitmaskConfig for uint256;

    LaunchFactory internal constant FACTORY = LaunchFactory(payable(0xeb05916aC2356956224c7d9B75C0c8c01503d24C));
    MasterLaunchHook internal constant HOOK = MasterLaunchHook(payable(0xfe09ECAb802E3567DF96B94D2A4ec294b6272AC8));
    BondingLaunchFactory internal constant BONDING =
        BondingLaunchFactory(payable(0x0E6504F6E6Aa5e3009Ec3E5aFA52fCa1306f8dBe));
    GraduatedFeeHook internal constant GRADUATED =
        GraduatedFeeHook(payable(0xFe9be77c9b3349ba1095A150BD29a48fc9a9E088));
    FloorVault internal constant VAULT = FloorVault(payable(0xff1EF27c6bD62583F00f62C53AccC0bDcd0Cd9B6));
    FeeEscrow internal constant ESCROW = FeeEscrow(payable(0x0a060F5E97b7b344f5444CaaAAd9F5FE4428B05f));
    ProtocolRevenueDistributor internal constant DIST =
        ProtocolRevenueDistributor(payable(0x302E52f0252360325796b7Eb6A03409de40266AC));
    BuybackVault internal constant BUYBACKS = BuybackVault(payable(0x7c2cCE72Da7fd791E7e4bd1e3b8dda4ee4BA53b1));
    HolderAirdropVault internal constant AIRDROPS =
        HolderAirdropVault(payable(0x869C3fF9F449F1F1470f8B257D73BCBaf52fFE77));
    HookitSwapRouter internal constant ROUTER = HookitSwapRouter(payable(0x23Dcdc9570ccFE93807da99B395db6A24A79A239));
    HkitBuyback internal constant HKIT_BUYBACK = HkitBuyback(payable(0xAF8fac4edfDdc7446E8Eb6282EB04163645b6fd9));
    address internal constant NATIVE = 0x9403CC96dbc7a63Bbd5aF65123653Acd6938f688;
    address internal constant FEE_RAIL = 0xF1fDB0F7DBEBFdC4FF7158f2BC2922722e27FE71;
    address internal constant USDG_WHALE = 0x3e17f00A166C278F357A9aaB4e2148b9c3CFd8E4;

    IPoolManager internal manager;
    Currency internal usdg;
    address internal trader;
    bool internal forkReady;

    modifier onlyFork() {
        if (!forkReady) vm.skip(true);
        _;
    }

    function setUp() public {
        trader = makeAddr("liveAuditTrader");
        string memory rpc = vm.envOr("INK_RPC_URL", string("https://rpc-gel.inkonchain.com"));
        try vm.createSelectFork(rpc) {
            forkReady = block.chainid == 57073 && address(FACTORY).code.length > 0;
        } catch {
            forkReady = false;
        }
        if (!forkReady) return;

        UniswapV4Deployments.Deployment memory d = UniswapV4Deployments.get(57073);
        manager = IPoolManager(d.poolManager);
        usdg = Currency.wrap(d.stableQuote);

        vm.deal(trader, 50 ether);
        vm.prank(USDG_WHALE);
        IERC20(Currency.unwrap(usdg)).transfer(trader, 200_000e6);

        deal(QuotronStockQuotes.wAMZNx, trader, 10e18);
        deal(QuotronStockQuotes.wMSTRx, trader, 10e18);
        deal(QuotronStockQuotes.wSPYx, trader, 10e18);
    }

    function testFork_LiveWiringAndHookFlags() public onlyFork {
        assertEq(address(FACTORY.masterHook()), address(HOOK), "factory.masterHook");
        assertEq(HOOK.factory(), address(FACTORY), "hook.factory");
        assertEq(HOOK.floorVault(), address(VAULT), "hook.vault");
        assertEq(HOOK.feeEscrow(), address(ESCROW), "hook.escrow");
        assertEq(HOOK.revenueDistributor(), address(DIST), "hook.distributor");

        assertEq(HOOK.buybackVault(), address(BUYBACKS), "hook.buybackVault");
        assertEq(address(HOOK.airdropVault()), address(AIRDROPS), "hook.airdropVault");
        assertTrue(BUYBACKS.operators(address(HOOK)), "buybacks<-hook");
        assertTrue(AIRDROPS.operators(address(HOOK)), "airdrops<-hook");
        assertEq(GRADUATED.factory(), address(BONDING), "graduated.factory");

        uint160 hookBits = uint160(address(HOOK)) & Hooks.ALL_HOOK_MASK;
        assertEq(hookBits, HOOK.HOOK_FLAGS(), "MasterLaunchHook address flags != HOOK_FLAGS");
        assertEq(
            hookBits,
            uint160(
                Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                    | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
            )
        );

        uint160 gBits = uint160(address(GRADUATED)) & Hooks.ALL_HOOK_MASK;
        assertEq(
            gBits,
            uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG),
            "GraduatedFeeHook address flags"
        );

        assertTrue(VAULT.operators(address(HOOK)), "vault<-hook");
        assertTrue(VAULT.operators(address(DIST)), "vault<-dist");
        assertTrue(ESCROW.operators(address(HOOK)), "escrow<-hook");
        assertTrue(ESCROW.operators(address(BONDING)), "escrow<-bonding");
        assertTrue(ESCROW.operators(address(GRADUATED)), "escrow<-graduated");
        assertTrue(DIST.operators(address(HOOK)), "dist<-hook");
        assertTrue(DIST.operators(address(BONDING)), "dist<-bonding");
        assertTrue(DIST.operators(address(GRADUATED)), "dist<-graduated");

        assertTrue(FACTORY.customHookAllowlistEnabled(), "custom hook allowlist should be on");
        assertFalse(FACTORY.customHooksEnabled(), "custom hooks should stay off for soft launch");

        assertTrue(FACTORY.isQuoteAllowed(address(0)), "ETH quote");
        assertTrue(FACTORY.isQuoteAllowed(Currency.unwrap(usdg)), "USDG quote");
        assertTrue(FACTORY.isQuoteAllowed(QuotronStockQuotes.wSPYx), "wSPYx quote");
        assertTrue(FACTORY.isQuoteAllowed(QuotronStockQuotes.wAMZNx), "wAMZNx quote");
        assertTrue(FACTORY.isQuoteAllowed(QuotronStockQuotes.wMSTRx), "wMSTRx quote");

        address rail = address(DIST.feeRail());
        assertEq(rail, FEE_RAIL, "distributor.feeRail");
        assertTrue(rail.code.length > 0, "feeRail has code");
        console.log("ethBridgeSet", FeeEthRail(payable(rail)).ethBridgeSet());

        console.log("flywheelMode", uint256(DIST.flywheelMode()));
        console.log("buybackExecutor", DIST.buybackExecutor());
        console.log("nativeToken", DIST.nativeToken());
        console.log("hkitBuyback.configured", HKIT_BUYBACK.configured());
        console.log("hkitBuyback.hkit", HKIT_BUYBACK.hkit());
        console.log("ethUsdFeed", FACTORY.ethUsdFeed());
        console.log("ethUsdStored", FACTORY.ethUsdPriceX18());
        console.log("launchCount", FACTORY.launchCount());
        console.log("bondingCount", BONDING.launchCount());

        assertEq(DIST.nativeToken(), NATIVE, "distributor native = HTST");
        assertTrue(HKIT_BUYBACK.configured(), "HkitBuyback must be configured on HTST");
        assertEq(HKIT_BUYBACK.hkit(), NATIVE, "buyback target");
        assertTrue(FACTORY.ethUsdFeed() != address(0), "ETH/USD feed wired");

        assertTrue(_bytecodeHasSelector(address(ROUTER), ROUTER.swapExactIn.selector), "swapExactIn");
        assertTrue(_bytecodeHasSelector(address(ROUTER), ROUTER.swapExactInComposite.selector), "composite buy");
        assertFalse(
            _bytecodeHasSelector(address(ROUTER), ROUTER.swapExactInCompositeSell.selector),
            "live router lacks composite sell until redeploy"
        );
    }

    function testFork_LiveLaunches_HooksOnchainAndSwap() public onlyFork {
        uint256 n = FACTORY.launchCount();
        assertGe(n, 1, "no master launches");
        uint256 failed;
        for (uint256 id = 1; id <= n; ++id) {
            try this.auditLaunchExternal(id) {
                console.log("OK launch", id);
            } catch (bytes memory reason) {
                ++failed;
                console.log("FAIL launch", id);
                _logRevert(reason);
            }
        }
        assertEq(failed, 0, "one or more live launches failed hook/swap audit");
    }

    function auditLaunchExternal(uint256 id) external {
        vm.stopPrank();
        _auditLaunch(id);
        vm.stopPrank();
    }

    function testFork_LiveBondingEmptyOrWired() public onlyFork {
        uint256 n = BONDING.launchCount();
        console.log("bonding launches", n);
        (bool ok, bytes memory data) = address(BONDING).staticcall(abi.encodeWithSignature("feeHook()"));
        if (ok && data.length >= 32) {
            assertEq(abi.decode(data, (address)), address(GRADUATED), "bonding.feeHook");
        } else {
            console.log("WARN bonding.feeHook() missing on live bytecode");
        }
        assertEq(GRADUATED.factory(), address(BONDING), "graduated.factory");
        assertTrue(ESCROW.operators(address(BONDING)), "escrow<-bonding");
        assertTrue(DIST.operators(address(BONDING)), "dist<-bonding");
        if (n == 0) return;

        for (uint256 id = 1; id <= n; ++id) {
            (address token, address creator, address quote, BondingLaunchFactory.Phase phase,,,,,,,,,,,) =
                BONDING.launches(id);
            console.log("bonding", id, token);
            console.log("  creator", creator);
            console.log("  quote", quote);
            console.log("  phase", uint256(phase));
            if (phase == BondingLaunchFactory.Phase.Graduated) {
                PoolKey memory key = BONDING.poolKeyOf(id);
                assertEq(address(key.hooks), address(GRADUATED), "graduated pool hook");
                (uint160 sqrt,,,) = manager.getSlot0(key.toId());
                assertGt(sqrt, 0, "graduated pool slot0");
            }
        }
    }

    function _auditLaunch(uint256 id) internal {
        (
            address token,
            address creator,
            IHooks hooks,
            bool customHook,
            PoolId poolId,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity
        ) = FACTORY.launches(id);

        uint256 bitmask = FACTORY.launchBitmasks(id);
        uint8 markets = FACTORY.launchMarketCount(id);
        if (markets == 0) markets = 1;

        console.log("--- launch", id);
        console.log(IERC20(token).symbol());
        console.log("token", token);
        console.log("hooks", address(hooks));
        console.log("customHook", customHook);
        console.log("markets", uint256(markets));

        assertFalse(customHook, "soft launch: no custom hooks");
        assertEq(address(hooks), address(HOOK), "launch.hooks != MasterLaunchHook");
        assertGt(uint256(liquidity), 0, "seed liquidity");
        assertTrue(tickUpper > tickLower, "tick range");

        BitmaskConfig.Modules memory mods = BitmaskConfig.unpack(bitmask);
        _logModules(mods);

        for (uint256 m; m < markets; ++m) {
            PoolKey memory key = FACTORY.poolKeyOfMarket(id, m);
            assertEq(address(key.hooks), address(HOOK), "pool key hook");
            if (m == 0) assertEq(PoolId.unwrap(key.toId()), PoolId.unwrap(poolId), "primary poolId");

            uint256 indexedId = FACTORY.poolLaunchId(key.toId());
            if (indexedId == 0) {
                console.log("WARN poolLaunchId unset on live single launch (fixed in source, needs redeploy)");
            } else {
                assertEq(indexedId, id, "poolLaunchId");
            }

            IMasterLaunchHook.LaunchState memory st = HOOK.launchState(key.toId());
            assertTrue(st.initialized, "hook launchState.initialized");
            assertEq(st.token, token, "hook state token");
            assertEq(st.creator, creator, "hook state creator");
            assertEq(HOOK.configs(key.toId()), bitmask, "hook configs bitmask");

            (uint160 sqrt, int24 tick,,) = manager.getSlot0(key.toId());
            assertGt(sqrt, 0, "pool initialized on PoolManager");
            uint128 inRangeLiq = manager.getLiquidity(key.toId());
            (uint128 posLiq,,) = manager.getPositionInfo(
                key.toId(), address(FACTORY), st.tickLower, st.tickUpper, keccak256("HOOKIT.LAUNCH")
            );
            console.log("  tick");
            console.logInt(int256(tick));
            console.log("  tickLower / tickUpper");
            console.logInt(int256(st.tickLower));
            console.logInt(int256(st.tickUpper));
            console.log("  inRangeLiq", uint256(inRangeLiq));
            console.log("  positionLiq", uint256(posLiq));
            assertGt(uint256(posLiq), 0, "factory launch position missing");
            if (inRangeLiq == 0) {
                console.log("WARN current tick outside seed range; swap may still cross into it");
            }

            Currency quote = Currency.unwrap(key.currency0) == token ? key.currency1 : key.currency0;
            assertEq(Currency.unwrap(st.quote), Currency.unwrap(quote), "hook quote");

            vm.startPrank(address(manager));
            vm.expectRevert(MasterLaunchHook.LaunchPositionLocked.selector);
            HOOK.beforeRemoveLiquidity(
                address(FACTORY),
                key,
                ModifyLiquidityParams({
                    tickLower: st.tickLower,
                    tickUpper: st.tickUpper,
                    liquidityDelta: -1,
                    salt: keccak256("HOOKIT.LAUNCH")
                }),
                ""
            );
            vm.stopPrank();

            uint256 tokensBefore = IERC20(token).balanceOf(trader);
            uint256 escrowBefore = ESCROW.balanceOf(creator, quote);
            uint256 pendingBefore = DIST.pending(quote);

            _buyLive(key, token, quote, mods);
            uint256 bought = IERC20(token).balanceOf(trader) - tokensBefore;
            assertGt(bought, 0, "buy credited tokens");

            if (!mods.antiMev) {
                vm.roll(block.number + 1);
                uint256 sellAmt = bought / 5;
                uint256 cap = mods.maxTx && mods.maxTxBps > 0
                    ? IERC20(token).totalSupply() * mods.maxTxBps / 10_000
                    : type(uint256).max;
                if (sellAmt > cap) sellAmt = cap * 9 / 10;
                if (sellAmt > 0) _sellLive(key, token, sellAmt);
            }

            uint256 escrowAfter = ESCROW.balanceOf(creator, quote);
            uint256 pendingAfter = DIST.pending(quote);
            assertTrue(
                escrowAfter > escrowBefore || pendingAfter > pendingBefore,
                "1% base fee must credit escrow and/or distributor"
            );

            if (mods.backedFloor) assertGt(VAULT.reserve(token), 0, "floor reserve after swap");
            if (mods.autoBurn) {
                assertTrue(
                    IERC20(token).totalSupply() < 1_000_000_000e18 || HOOK.pendingAutoBurn(key.toId()) > 0,
                    "autoBurn burn or queue"
                );
            }
            if (mods.holderAirdrop) {
                assertGt(
                    uint256(HolderAirdropVault(payable(address(HOOK.airdropVault()))).epochSeconds(token)),
                    0,
                    "airdrop epoch"
                );
            }
        }
    }

    function _logModules(BitmaskConfig.Modules memory m) internal pure {
        if (m.antiSnipe) {
            console.log("  antiSnipe duration s", uint256(m.antiSnipeDurationSeconds));
        }
        if (m.backedFloor) console.log("  backedFloor");
        if (m.antiMev) console.log("  antiMev");
        if (m.maxTx) console.log("  maxTx bps", uint256(m.maxTxBps));
        if (m.maxWallet) console.log("  maxWallet bps", uint256(m.maxWalletBps));
        if (m.dynamicFees) console.log("  dynamicFees");
        if (m.buybackVesting) console.log("  buybackVesting");
        if (m.autoBurn) console.log("  autoBurn");
        if (m.lpDonate) console.log("  lpDonate");
        if (m.holderAirdrop) console.log("  holderAirdrop");
        if (m.creatorShareToHook) console.log("  creatorShareToHook");
        console.log("  hookTaxBps", uint256(m.hookTaxBps));
    }

    function _buyLive(PoolKey memory key, address token, Currency quote, BitmaskConfig.Modules memory mods) internal {
        bool zeroForOne = Currency.unwrap(key.currency1) == token;
        uint256 amountIn;
        bool tight = mods.maxWallet || mods.maxTx;
        if (quote.isAddressZero()) {
            amountIn = tight ? 0.00005 ether : 0.01 ether;
        } else if (quote == usdg) {
            amountIn = tight ? 5e5 : 20e6;
        } else {
            amountIn = tight ? 1e12 : 0.005e18;
        }

        uint160 limit = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
        vm.startPrank(trader);
        if (!quote.isAddressZero()) IERC20(Currency.unwrap(quote)).approve(address(ROUTER), type(uint256).max);
        try ROUTER.swapExactIn{value: quote.isAddressZero() ? amountIn : 0}(key, zeroForOne, amountIn, 1, limit) {
            vm.stopPrank();
        } catch (bytes memory reason) {
            vm.stopPrank();
            _revert(reason);
        }
    }

    function _sellLive(PoolKey memory key, address token, uint256 tokenIn) internal {
        bool zeroForOne = Currency.unwrap(key.currency0) == token;
        uint160 limit = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
        vm.startPrank(trader);
        IERC20(token).approve(address(ROUTER), type(uint256).max);
        try ROUTER.swapExactIn(key, zeroForOne, tokenIn, 1, limit) {
            vm.stopPrank();
        } catch (bytes memory reason) {
            vm.stopPrank();
            _revert(reason);
        }
    }

    function _revert(bytes memory reason) private pure {
        assembly {
            revert(add(reason, 32), mload(reason))
        }
    }

    function _logRevert(bytes memory reason) internal pure {
        bytes4 sel;
        if (reason.length >= 4) {
            assembly {
                sel := mload(add(reason, 32))
            }
        }
        if (sel == MasterLaunchHook.MaxWalletExceeded.selector) console.log("  revert MaxWalletExceeded");
        else if (sel == MasterLaunchHook.MaxTxExceeded.selector) console.log("  revert MaxTxExceeded");
        else if (sel == MasterLaunchHook.HookDataRequired.selector) console.log("  revert HookDataRequired");
        else if (sel == MasterLaunchHook.SandwichBlocked.selector) console.log("  revert SandwichBlocked");
        else console.logBytes(reason);
    }

    function _bytecodeHasSelector(address target, bytes4 sel) internal view returns (bool) {
        bytes memory code = target.code;
        uint256 len = code.length;
        for (uint256 i; i + 4 <= len; ++i) {
            bytes4 word;
            assembly {
                word := mload(add(add(code, 32), i))
            }
            if (word == sel) return true;
        }
        return false;
    }
}
