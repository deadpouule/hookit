// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";

import {HookMiner} from "../src/libraries/HookMiner.sol";
import {MasterLaunchHook} from "../src/MasterLaunchHook.sol";
import {GraduatedFeeHook} from "../src/GraduatedFeeHook.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {BondingLaunchFactory} from "../src/BondingLaunchFactory.sol";
import {HookitSwapRouter} from "../src/HookitSwapRouter.sol";
import {FeeEthRail} from "../src/FeeEthRail.sol";
import {HkitBuyback} from "../src/HkitBuyback.sol";
import {FloorVault} from "../src/FloorVault.sol";
import {FeeEscrow} from "../src/FeeEscrow.sol";
import {ProtocolRevenueDistributor} from "../src/ProtocolRevenueDistributor.sol";
import {BuybackVault} from "../src/BuybackVault.sol";
import {HolderAirdropVault} from "../src/HolderAirdropVault.sol";
import {UniswapV4Deployments} from "../src/libraries/UniswapV4Deployments.sol";
import {HookitDeployLib} from "../src/libraries/HookitDeployLib.sol";
import {HkitLaunchLib} from "../src/libraries/HkitLaunchLib.sol";
import {EthUsdgBridgeLib} from "../src/libraries/EthUsdgBridgeLib.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";
import {ModuleMatrix} from "../test/utils/ModuleMatrix.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";

/// @notice Ink mainnet fork dry-run: dual-rail deploy, HKIT, Master + Classic smoke.
/// @dev `forge script script/DryRunInk.s.sol --fork-url $INK_RPC_URL --disable-code-size-limit -vv`
contract DryRunInkScript is Script {
    uint256 internal constant ANVIL_DEPLOYER_PK =
        0xac0974bec39a39a17e36ba4a292a5b8a36c683c0e11c0521fcd0663fca4ddd4;
    uint160 internal constant EXPECTED_HOOK_FLAGS = uint160(
        Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
            | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
    );
    uint160 internal constant FLAG_MASK = 0x3FFF;

    struct Deployment {
        FloorVault vault;
        FeeEscrow escrow;
        ProtocolRevenueDistributor distributor;
        BuybackVault buybacks;
        HolderAirdropVault airdrops;
        MasterLaunchHook hook;
        LaunchFactory factory;
        GraduatedFeeHook graduated;
        BondingLaunchFactory bonding;
        HookitSwapRouter router;
        FeeEthRail feeRail;
        HkitBuyback hkitBuyback;
        address hkit;
        PoolKey hkitKey;
        uint256 hkitLaunchId;
    }

    function run() public {
        uint256 pk = _deployerPk();
        address deployer = vm.addr(pk);
        address ops = vm.envOr("OPS_TREASURY", deployer);

        require(block.chainid == UniswapV4Deployments.INK_MAINNET, "wrong chain: use Ink fork");
        UniswapV4Deployments.Deployment memory v4 = UniswapV4Deployments.get(block.chainid);
        require(v4.poolManager.code.length > 0, "PoolManager missing on fork");

        vm.deal(deployer, 100 ether);
        vm.deal(ops, 1 ether);

        console.log("=== Hookit Ink dry-run (dual-rail) ===");
        console.log("chainId", block.chainid);
        console.log("deployer", deployer);

        Deployment memory d = _deploy(pk, deployer, ops, IPoolManager(v4.poolManager));
        _logDeployment(d);
        _validateDeployment(d, v4);
        _smokeHkitBuyAndBuyback(pk, deployer, d);
        _smokeLaunchAndBuy(pk, deployer, d);
        _smokeBondingGraduateAndBuy(pk, deployer, d);

        console.log("DRY_RUN_OK");
    }

    function _deploy(uint256 pk, address deployer, address ops, IPoolManager manager)
        internal
        returns (Deployment memory d)
    {
        vm.startBroadcast(pk);

        d.vault = new FloorVault(deployer, manager);
        d.escrow = new FeeEscrow(deployer, manager);
        d.distributor = new ProtocolRevenueDistributor(deployer, ops, manager);
        d.buybacks = new BuybackVault(deployer, manager);
        d.airdrops = new HolderAirdropVault(deployer, manager);

        bytes memory ctorArgs = abi.encode(manager, d.vault, d.escrow, d.distributor, d.buybacks, d.airdrops, deployer);
        (address predicted, bytes32 salt) =
            HookMiner.find(HookMiner.CREATE2_DEPLOYER, EXPECTED_HOOK_FLAGS, type(MasterLaunchHook).creationCode, ctorArgs);
        d.hook = new MasterLaunchHook{salt: salt}(manager, d.vault, d.escrow, d.distributor, d.buybacks, d.airdrops, deployer);
        require(address(d.hook) == predicted, "hook address mismatch");

        d.factory = new LaunchFactory(manager, d.hook, deployer, ops);
        HookitDeployLib.seedQuotes(d.factory);

        uint160 gFlags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
        bytes memory gArgs = abi.encode(manager, d.escrow, d.distributor, deployer);
        (address gPredicted, bytes32 gSalt) =
            HookMiner.find(HookMiner.CREATE2_DEPLOYER, gFlags, type(GraduatedFeeHook).creationCode, gArgs);
        d.graduated = new GraduatedFeeHook{salt: gSalt}(manager, d.escrow, d.distributor, deployer);
        require(address(d.graduated) == gPredicted, "graduated hook mismatch");
        require(uint160(address(d.graduated)) & FLAG_MASK == gFlags, "grad flags");

        d.bonding = new BondingLaunchFactory(manager, d.graduated, d.escrow, d.distributor, deployer, ops);
        d.graduated.setFactory(address(d.bonding));
        HookitDeployLib.seedBondingQuotes(d.bonding);

        d.router = new HookitSwapRouter(manager);
        d.feeRail = new FeeEthRail(deployer, manager, UniswapV4Deployments.get(block.chainid).stableQuote);
        d.hkitBuyback = new HkitBuyback(deployer, manager, d.distributor);

        d.hook.setFactory(address(d.factory));
        d.vault.setOperator(address(d.hook), true);
        d.vault.setOperator(address(d.distributor), true);
        d.escrow.setOperator(address(d.hook), true);
        d.escrow.setOperator(address(d.bonding), true);
        d.escrow.setOperator(address(d.graduated), true);
        d.distributor.setOperator(address(d.hook), true);
        d.distributor.setOperator(address(d.bonding), true);
        d.distributor.setOperator(address(d.graduated), true);
        d.buybacks.setOperator(address(d.hook), true);
        d.airdrops.setOperator(address(d.hook), true);
        d.distributor.setFeeRail(d.feeRail);
        EthUsdgBridgeLib.tryWireBest(manager, d.feeRail);

        (d.hkitLaunchId, d.hkit,, d.hkitKey) =
            HkitLaunchLib.fairLaunch(d.factory, d.distributor, d.hkitBuyback, "ipfs://hookit-hkit-dry-run");

        vm.stopBroadcast();
    }

    function _validateDeployment(Deployment memory d, UniswapV4Deployments.Deployment memory v4) internal view {
        uint160 hookFlags = uint160(address(d.hook)) & FLAG_MASK;
        require(hookFlags == EXPECTED_HOOK_FLAGS, "hook flag mismatch");

        require(d.factory.isQuoteAllowed(address(0)), "ETH quote");
        require(d.factory.isQuoteAllowed(v4.stableQuote), "USDG quote");
        (bool usdgOk,,,) = d.bonding.quoteConfigs(v4.stableQuote);
        require(usdgOk, "bonding USDG");

        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        for (uint256 i; i < stocks.length; ++i) {
            require(d.factory.isQuoteAllowed(stocks[i].token), "wStock quote missing");
            (bool stockOk,,,) = d.bonding.quoteConfigs(stocks[i].token);
            require(stockOk, "bonding wStock");
        }

        require(d.distributor.nativeToken() == d.hkit, "HKIT not native");
        require(
            d.distributor.flywheelMode() == ProtocolRevenueDistributor.FlywheelMode.BuybackBurn, "flywheel mode"
        );
        require(d.distributor.buybackExecutor() == address(d.hkitBuyback), "buyback executor");
        require(d.hkitLaunchId == 1, "HKIT should be launch #1");
        if (!d.feeRail.ethBridgeSet()) {
            console.log("WARN: FeeEthRail eth bridge not live yet (deferred)");
        }
    }

    function _smokeHkitBuyAndBuyback(uint256 pk, address deployer, Deployment memory d) internal {
        uint256 balBefore = IERC20(d.hkit).balanceOf(deployer);
        vm.startBroadcast(pk);
        d.router.swapExactIn{value: 0.2 ether}(d.hkitKey, true, 0.2 ether, 1, 0);
        vm.stopBroadcast();
        require(IERC20(d.hkit).balanceOf(deployer) > balBefore, "HKIT buy failed");

        vm.startBroadcast(pk);
        if (d.distributor.pending(Currency.wrap(address(0))) > 0) {
            d.distributor.distribute(Currency.wrap(address(0)));
        }
        d.distributor.flushBuybackEth();
        uint256 pot = d.distributor.buybackEth();
        vm.stopBroadcast();

        // HKIT anti-MEV: buyback swap must be a later block than the user buy (same origin).
        vm.roll(block.number + 1);

        if (pot > 0) {
            uint256 supplyBefore = IERC20(d.hkit).totalSupply();
            vm.startBroadcast(pk);
            d.hkitBuyback.execute(pot, 1);
            vm.stopBroadcast();
            require(IERC20(d.hkit).totalSupply() < supplyBefore, "buyback burn failed");
        }
        console.log("HKIT smoke buy + buyback OK");
    }

    function _smokeLaunchAndBuy(uint256 pk, address deployer, Deployment memory d) internal {
        BitmaskConfig.Modules memory modules = ModuleMatrix.kitchenSink();
        uint256 bitmask = BitmaskConfig.pack(modules);

        vm.startBroadcast(pk);
        (uint256 launchId, address token, PoolId poolId) = d.factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "DryRun",
                symbol: "DRY",
                metadataURI: "ipfs://hookit-dry-run",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(address(0)),
                tickSpacing: 60,
                startingTick: 0,
                bitmask: bitmask,
                customHook: IHooks(address(0))
            })
        );
        vm.stopBroadcast();

        PoolKey memory key = d.factory.poolKeyOf(launchId);
        require(key.hooks == IHooks(address(d.hook)), "wrong hook on pool");

        uint256 balBefore = IERC20(token).balanceOf(deployer);
        vm.startBroadcast(pk);
        d.router.swapExactIn{value: 0.1 ether}(key, true, 0.1 ether, 1, 0);
        vm.stopBroadcast();

        require(IERC20(token).balanceOf(deployer) > balBefore, "smoke buy failed");
        require(d.vault.reserve(token) > 0, "kitchen sink floor empty");

        console.log("Master smoke launchId", launchId);
        console.log("Master smoke token", token);
        console.logBytes32(PoolId.unwrap(poolId));
    }

    function _smokeBondingGraduateAndBuy(uint256 pk, address deployer, Deployment memory d) internal {
        vm.deal(deployer, deployer.balance + 10 ether);

        vm.startBroadcast(pk);
        (uint256 launchId, address token) = d.bonding.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            BondingLaunchFactory.LaunchParams({
                name: "ClassicDry",
                symbol: "CLD",
                metadataURI: "ipfs://hookit-classic-dry",
                totalSupply: 0,
                quote: Currency.wrap(address(0)),
                creatorTaxBps: 0
            })
        );
        vm.stopBroadcast();

        uint256 target = d.bonding.graduationQuoteWei(Currency.wrap(address(0)));
        require(target == 4.2 ether, "grad target");
        uint256 feeBps = ProtocolConstants.BASE_FEE_BPS;
        uint256 gross = (target * ProtocolConstants.BPS_DENOMINATOR) / (ProtocolConstants.BPS_DENOMINATOR - feeBps);
        gross += gross / 100;
        require(deployer.balance >= gross + 0.1 ether, "need ETH for classic smoke");

        vm.startBroadcast(pk);
        d.bonding.buy{value: gross}(launchId, 0, 1);
        vm.stopBroadcast();

        (,,, BondingLaunchFactory.Phase phase,,,,,,,,,,,) = d.bonding.launches(launchId);
        require(phase == BondingLaunchFactory.Phase.Graduated, "not graduated");

        PoolKey memory gKey = d.bonding.poolKeyOf(launchId);
        require(gKey.hooks == IHooks(address(d.graduated)), "wrong graduated hook");

        uint256 balBefore = IERC20(token).balanceOf(deployer);
        bool zfo = Currency.unwrap(gKey.currency0) == address(0);
        vm.startBroadcast(pk);
        d.router.swapExactIn{value: 0.05 ether}(gKey, zfo, 0.05 ether, 1, 0);
        vm.stopBroadcast();
        require(IERC20(token).balanceOf(deployer) > balBefore, "post-grad buy failed");

        console.log("Classic smoke launchId", launchId);
        console.log("Classic smoke token", token);
    }

    function _deployerPk() internal view returns (uint256 pk) {
        try vm.envBytes32("DRY_RUN_PK") returns (bytes32 raw) {
            pk = uint256(raw);
        } catch {
            pk = ANVIL_DEPLOYER_PK;
        }
    }

    function _logDeployment(Deployment memory d) internal view {
        console.log("FloorVault", address(d.vault));
        console.log("FeeEscrow", address(d.escrow));
        console.log("Distributor", address(d.distributor));
        console.log("BuybackVault", address(d.buybacks));
        console.log("MasterLaunchHook", address(d.hook));
        console.log("LaunchFactory", address(d.factory));
        console.log("GraduatedFeeHook", address(d.graduated));
        console.log("BondingLaunchFactory", address(d.bonding));
        console.log("HookitSwapRouter", address(d.router));
        console.log("FeeEthRail", address(d.feeRail));
        console.log("HkitBuyback", address(d.hkitBuyback));
        console.log("HKIT", d.hkit);
        console.log("HKIT launchId", d.hkitLaunchId);
    }
}
