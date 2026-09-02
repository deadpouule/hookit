// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";

import {HookitSwapRouter} from "../../src/HookitSwapRouter.sol";
import {HkitBuyback} from "../../src/HkitBuyback.sol";
import {MasterLaunchHook} from "../../src/MasterLaunchHook.sol";
import {LaunchFactory} from "../../src/LaunchFactory.sol";
import {FloorVault} from "../../src/FloorVault.sol";
import {FeeEscrow} from "../../src/FeeEscrow.sol";
import {ProtocolRevenueDistributor} from "../../src/ProtocolRevenueDistributor.sol";
import {BuybackVault} from "../../src/BuybackVault.sol";
import {HolderAirdropVault} from "../../src/HolderAirdropVault.sol";
import {GraduatedFeeHook} from "../../src/GraduatedFeeHook.sol";
import {BondingLaunchFactory} from "../../src/BondingLaunchFactory.sol";
import {BitmaskConfig} from "../../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../../src/libraries/ProtocolConstants.sol";
import {UniswapV4Deployments} from "../../src/libraries/UniswapV4Deployments.sol";
import {HookitDeployLib} from "../../src/libraries/HookitDeployLib.sol";
import {QuotronStockQuotes} from "../../src/libraries/QuotronStockQuotes.sol";
import {FixedPointMath} from "../../src/libraries/FixedPointMath.sol";

/// @notice Shared Ink mainnet fork harness: deploy Hookit on live v4 state, swap via `HookitSwapRouter`.
abstract contract InkForkTestBase is Test {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using CurrencyLibrary for Currency;

    uint256 internal constant INK_CHAIN = 57073;

    IPoolManager internal manager;
    FloorVault internal vault;
    FeeEscrow internal escrow;
    ProtocolRevenueDistributor internal distributor;
    BuybackVault internal buybacks;
    HolderAirdropVault internal airdrops;
    MasterLaunchHook internal hook;
    LaunchFactory internal factory;
    HookitSwapRouter internal router;
    HkitBuyback internal hkitBuyback;
    GraduatedFeeHook internal graduatedHook;
    BondingLaunchFactory internal bonding;
    /// @dev Legacy name kept for fork tests that asserted the protocol flywheel target.
    address internal nativeHook;

    Currency internal usdg;
    Currency internal wspyx;

    address internal deployer;
    address internal creator;
    address internal trader;
    address internal ops;

    bool internal forkReady;

    receive() external payable {}

    function setUp() public virtual {
        deployer = address(this);
        creator = makeAddr("creator");
        trader = makeAddr("trader");
        ops = makeAddr("ops");

        forkReady = _selectInkFork();
        if (!forkReady) return;

        UniswapV4Deployments.Deployment memory dep = UniswapV4Deployments.get(INK_CHAIN);
        manager = IPoolManager(dep.poolManager);
        usdg = Currency.wrap(dep.stableQuote);

        wspyx = Currency.wrap(QuotronStockQuotes.wSPYx);

        _deployProtocol();
        _fundAccounts();
    }

    function _selectInkFork() internal returns (bool) {
        string memory rpc = vm.envOr("INK_RPC_URL", string("https://rpc-gel.inkonchain.com"));
        try vm.createSelectFork(rpc) {}
        catch {
            return false;
        }
        if (block.chainid != INK_CHAIN) return false;
        address pm = UniswapV4Deployments.get(INK_CHAIN).poolManager;
        return pm.code.length > 0;
    }

    function _deployProtocol() internal {
        vm.deal(deployer, 10_000 ether);
        vm.deal(creator, 500 ether);
        vm.deal(trader, 500 ether);
        vm.deal(ops, 1 ether);

        vault = new FloorVault(deployer, manager);
        escrow = new FeeEscrow(deployer, manager);
        distributor = new ProtocolRevenueDistributor(deployer, ops, manager);
        buybacks = new BuybackVault(deployer, manager);
        airdrops = new HolderAirdropVault(deployer, manager);

        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
        address flagsAddr = address(flags | (uint160(0x1BEEF) << 144));
        bytes memory args = abi.encode(manager, vault, escrow, distributor, buybacks, airdrops, deployer);
        deployCodeTo("MasterLaunchHook.sol:MasterLaunchHook", args, flagsAddr);
        hook = MasterLaunchHook(payable(flagsAddr));

        factory = new LaunchFactory(manager, hook, deployer, ops);
        HookitDeployLib.seedQuotes(factory);
        hook.setFactory(address(factory));

        vault.setOperator(address(hook), true);
        vault.setOperator(address(distributor), true);
        escrow.setOperator(address(hook), true);
        distributor.setOperator(address(hook), true);
        buybacks.setOperator(address(hook), true);
        airdrops.setOperator(address(hook), true);

        router = new HookitSwapRouter(manager);
        hkitBuyback = new HkitBuyback(deployer, manager, distributor);
        nativeHook = address(0);

        _deployBondingRail();
    }

    function _deployBondingRail() internal {
        uint160 gFlags =
            uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG);
        address gAddr = address(gFlags | (uint160(0xB0AD) << 144));
        bytes memory gArgs = abi.encode(manager, escrow, distributor, deployer);
        deployCodeTo("GraduatedFeeHook.sol:GraduatedFeeHook", gArgs, gAddr);
        graduatedHook = GraduatedFeeHook(payable(gAddr));

        bonding = new BondingLaunchFactory(manager, graduatedHook, escrow, distributor, deployer, ops);
        graduatedHook.setFactory(address(bonding));
        graduatedHook.setOperator(deployer, true);

        escrow.setOperator(address(bonding), true);
        escrow.setOperator(address(graduatedHook), true);
        distributor.setOperator(address(bonding), true);
        distributor.setOperator(address(graduatedHook), true);

        // Mirror master quote allowlist for classic rail graduation equivalents.
        UniswapV4Deployments.Deployment memory d = UniswapV4Deployments.get(INK_CHAIN);
        bonding.setQuote(d.stableQuote, true, 6, 1e18, address(0));
        bonding.setEthUsdPrice(ProtocolConstants.DEFAULT_LAUNCH_ETH_USD_X18, address(0));
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        for (uint256 i; i < stocks.length; ++i) {
            bonding.setQuote(stocks[i].token, true, stocks[i].decimals, stocks[i].usdPriceX18, address(0));
        }
    }

    address internal constant USDG_WHALE = 0x3e17f00A166C278F357A9aaB4e2148b9c3CFd8E4;

    function _fundAccounts() internal {
        _fundErc20(Currency.unwrap(usdg), USDG_WHALE, creator, 5_000_000e6);
        _fundErc20(Currency.unwrap(usdg), USDG_WHALE, trader, 5_000_000e6);
        // Quotrons wraps are thinly held; forge `deal` is enough for fork unit tests.
        deal(Currency.unwrap(wspyx), creator, 1_000e18);
        deal(Currency.unwrap(wspyx), trader, 1_000e18);
    }

    function _fundErc20(address token, address whale, address to, uint256 amount) internal {
        vm.prank(whale);
        IERC20(token).transfer(to, amount);
    }

    function _defaultModules() internal pure returns (BitmaskConfig.Modules memory m) {
        m = BitmaskConfig.Modules({
            antiSnipe: false,
            backedFloor: false,
            antiMev: false,
            maxTx: false,
            maxWallet: false,
            dynamicFees: false,
            buybackVesting: false,
            autoBurn: false,
            lpDonate: false,
            holderAirdrop: false,
            creatorShareToHook: false,
            hookTaxBps: 0,
            antiSnipeDurationSeconds: 0,
            maxTxBps: 0,
            maxWalletBps: 0,
            floorAllocationBps: 0,
            initialSnipeTaxBps: 0,
            autoBurnBps: 0,
            lpDonateBps: 0,
            holderAirdropBps: 0,
            buybackVestingDurationSeconds: 0,
            dynamicFeeMinTotalBps: 0,
            dynamicFeeRampUp: false,
            dynamicFeeDepthSaturationBps: 0,
            holderAirdropEpochSeconds: 0
        });
    }

    struct LaunchResult {
        uint256 launchId;
        address token;
        PoolId poolId;
        PoolKey key;
        address launcher;
    }

    function _launch(
        address launcher,
        Currency quote,
        BitmaskConfig.Modules memory modules,
        int24 tickSpacing,
        uint256 supply,
        string memory name,
        string memory symbol
    ) internal returns (LaunchResult memory r) {
        uint256 bitmask = BitmaskConfig.pack(modules);
        vm.prank(launcher);
        (r.launchId, r.token, r.poolId) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: name,
                symbol: symbol,
                metadataURI: "ipfs://hookit-fork",
                totalSupply: supply,
                quote: quote,
                tickSpacing: tickSpacing,
                startingTick: 0,
                bitmask: bitmask,
                customHook: IHooks(address(0)),
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );
        r.key = factory.poolKeyOf(r.launchId);
        r.launcher = launcher;
    }

    function _quoteCurrency(PoolKey memory key, address token) internal pure returns (Currency) {
        if (Currency.unwrap(key.currency0) == token) return key.currency1;
        return key.currency0;
    }

    function _buyZeroForOne(PoolKey memory key, address token) internal pure returns (bool) {
        return Currency.unwrap(key.currency1) == token;
    }

    function _routerBuy(address user, PoolKey memory key, address token, uint256 amountIn) internal {
        Currency quote = _quoteCurrency(key, token);
        bool zeroForOne = _buyZeroForOne(key, token);
        uint160 limit = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;

        vm.startPrank(user);
        if (!quote.isAddressZero()) {
            IERC20(Currency.unwrap(quote)).approve(address(router), type(uint256).max);
        }
        router.swapExactIn{value: quote.isAddressZero() ? amountIn : 0}(key, zeroForOne, amountIn, 1, limit);
        vm.stopPrank();
    }

    function _routerSell(address user, PoolKey memory key, address token, uint256 tokenIn) internal {
        bool zeroForOne = !_buyZeroForOne(key, token);
        uint160 limit = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;

        vm.startPrank(user);
        IERC20(token).approve(address(router), type(uint256).max);
        router.swapExactIn(key, zeroForOne, tokenIn, 1, limit);
        vm.stopPrank();
    }

    function _tokenBalance(address token, address account) internal view returns (uint256) {
        return IERC20(token).balanceOf(account);
    }

    function _maxTxTokenCap(BitmaskConfig.Modules memory m, address token) internal view returns (uint256) {
        if (!m.maxTx || m.maxTxBps == 0) return type(uint256).max;
        return FixedPointMath.applyBps(IERC20(token).totalSupply(), m.maxTxBps);
    }

    /// @dev Buy size that respects max-tx / max-wallet while exercising fee-route modules on fork.
    function _smokeBuyAmountForQuote(BitmaskConfig.Modules memory m, Currency quote) internal view returns (uint256) {
        bool needsVolume = m.backedFloor || m.autoBurn || m.lpDonate || m.buybackVesting || m.holderAirdrop;
        if (quote.isAddressZero()) {
            if (m.maxWallet) return 0.008 ether;
            if (m.maxTx) return needsVolume ? 0.002 ether : 0.001 ether;
            return needsVolume ? 0.5 ether : 0.05 ether;
        }
        if (quote == usdg) {
            if (m.maxWallet) return 30e6;
            return m.maxTx ? 30e6 : (needsVolume ? 500e6 : 100e6);
        }
        if (m.maxWallet) return 0.005e18;
        return m.maxTx ? 0.002e18 : (needsVolume ? 0.1e18 : 0.01e18);
    }

    function _safeSell(
        address user,
        PoolKey memory key,
        address token,
        BitmaskConfig.Modules memory m,
        uint256 sellNumerator,
        uint256 sellDenominator
    ) internal {
        if (m.antiMev) return;
        vm.roll(block.number + 1);
        uint256 bal = _tokenBalance(token, user);
        if (bal == 0) return;
        uint256 sellAmt = bal * sellNumerator / sellDenominator;
        uint256 cap = _maxTxTokenCap(m, token);
        if (sellAmt > cap) sellAmt = cap * 9 / 10;
        if (sellAmt == 0) return;
        _routerSell(user, key, token, sellAmt);
    }

    function _assertModuleSmokeEffects(
        LaunchResult memory l,
        BitmaskConfig.Modules memory m,
        uint256 supplyBefore,
        uint256 g0Before,
        uint256 g1Before
    ) internal {
        // Max-wallet / anti-MEV caps swap patterns — skip volume-heavy module checks.
        if (m.maxWallet || m.antiMev) return;

        if (m.backedFloor) assertGt(vault.reserve(l.token), 0, "floor reserve");
        if (m.buybackVesting) {
            (, uint128 streamed,,,) = buybacks.streams(creator, l.token);
            assertGt(streamed, 0, "buyback stream");
        }
        if (m.autoBurn) {
            uint256 supplyAfter = IERC20(l.token).totalSupply();
            assertTrue(
                supplyAfter < supplyBefore || hook.pendingAutoBurn(l.poolId) > 0,
                "autoBurn should burn or queue"
            );
        }
        if (m.lpDonate) {
            (uint256 g0After, uint256 g1After) = manager.getFeeGrowthGlobals(l.poolId);
            assertTrue(
                g0After > g0Before || g1After > g1Before || hook.pendingLpDonate(l.poolId) > 0,
                "lpDonate fee growth"
            );
        }
    }

    function _moduleSmoke(
        BitmaskConfig.Modules memory m,
        Currency quote,
        string memory name,
        string memory symbol
    ) internal {
        LaunchResult memory l = _launch(creator, quote, m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, name, symbol);

        uint256 supplyBefore = IERC20(l.token).totalSupply();
        (uint256 g0Before, uint256 g1Before) = manager.getFeeGrowthGlobals(l.poolId);

        bool needsVolume = m.backedFloor || m.autoBurn || m.lpDonate || m.buybackVesting || m.holderAirdrop;
        uint256 buyIn = _smokeBuyAmountForQuote(m, quote);
        _routerBuy(trader, l.key, l.token, buyIn);
        assertGt(_tokenBalance(l.token, trader), 0);

        if (m.maxTx && !m.maxWallet && !m.antiMev && needsVolume) {
            for (uint256 i; i < 3; ++i) {
                vm.roll(block.number + 1);
                _routerBuy(trader, l.key, l.token, buyIn);
            }
        }

        _safeSell(trader, l.key, l.token, m, 1, 10);
        _assertModuleSmokeEffects(l, m, supplyBefore, g0Before, g1Before);
    }

    function _claimCreatorFees(address user, Currency quote) internal {
        vm.prank(user);
        escrow.claim(quote);
    }

    function _distributeProtocol(Currency quote) internal {
        distributor.distribute(quote);
    }

    struct BondingResult {
        uint256 launchId;
        address token;
        Currency quote;
        uint256 graduationQuote;
    }

    function _bondingLaunch(
        address launcher,
        Currency quote,
        uint16 creatorTaxBps,
        string memory name,
        string memory symbol
    ) internal returns (BondingResult memory r) {
        vm.prank(launcher);
        (r.launchId, r.token) = bonding.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            BondingLaunchFactory.LaunchParams({
                name: name,
                symbol: symbol,
                metadataURI: "ipfs://bonding-fork",
                totalSupply: 0,
                quote: quote,
                creatorTaxBps: creatorTaxBps,
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );
        r.quote = quote;
        r.graduationQuote = bonding.graduationQuoteWei(quote);
    }

    /// @notice Buy enough quote (gross of fees) to cross the 4.2 ETH-equivalent graduation threshold.
    function _bondingBuyToGraduate(address user, uint256 launchId, Currency quote) internal {
        uint256 target = bonding.graduationQuoteWei(quote);
        // Classic is base 1% only (creator tax removed).
        uint256 feeBps = uint256(ProtocolConstants.BASE_FEE_BPS);
        // gross so that net = gross * (1 - feeBps/10000) >= target
        uint256 gross = (target * ProtocolConstants.BPS_DENOMINATOR) / (ProtocolConstants.BPS_DENOMINATOR - feeBps);
        gross += gross / 100; // +1% slack for rounding
        _bondingBuy(user, launchId, quote, gross);
    }

    function _bondingBuy(address user, uint256 launchId, Currency quote, uint256 amountIn) internal {
        vm.startPrank(user);
        if (quote.isAddressZero()) {
            bonding.buy{value: amountIn}(launchId, 0, 1);
        } else {
            IERC20(Currency.unwrap(quote)).approve(address(bonding), amountIn);
            bonding.buy(launchId, amountIn, 1);
        }
        vm.stopPrank();
    }

    function _bondingPhase(uint256 launchId) internal view returns (BondingLaunchFactory.Phase) {
        (,,, BondingLaunchFactory.Phase phase,,,,,,,,,,,) = bonding.launches(launchId);
        return phase;
    }

    modifier onlyFork() {
        if (!forkReady) vm.skip(true);
        _;
    }
}
