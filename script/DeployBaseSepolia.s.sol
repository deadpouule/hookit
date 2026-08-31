// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

import {HookMiner} from "../src/libraries/HookMiner.sol";
import {MasterLaunchHook} from "../src/MasterLaunchHook.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {FloorVault} from "../src/FloorVault.sol";
import {FeeEscrow} from "../src/FeeEscrow.sol";
import {ProtocolRevenueDistributor} from "../src/ProtocolRevenueDistributor.sol";
import {HolderAirdropVault} from "../src/HolderAirdropVault.sol";
import {BuybackVault} from "../src/BuybackVault.sol";
import {HkitBuyback} from "../src/HkitBuyback.sol";
import {FeeEthRail} from "../src/FeeEthRail.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {UniswapV4Deployments} from "../src/libraries/UniswapV4Deployments.sol";
import {HookitDeployLib} from "../src/libraries/HookitDeployLib.sol";
import {HkitLaunchLib} from "../src/libraries/HkitLaunchLib.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";

/// @notice Deploys the full Hookit protocol, fair-launches HKIT, then a smoke meme launch + swap.
/// @dev Base Sepolia only — Ink Sepolia has no v4 Universal Router.
contract DeployBaseSepoliaScript is Script {
    function run() public {
        require(block.chainid == UniswapV4Deployments.BASE_SEPOLIA, "Base Sepolia smoke deploy only");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address ops = vm.envOr("OPS_TREASURY", deployer);
        UniswapV4Deployments.Deployment memory v4 = UniswapV4Deployments.get(block.chainid);
        IPoolManager manager = IPoolManager(v4.poolManager);

        vm.startBroadcast(pk);

        FloorVault vault = new FloorVault(deployer, manager);
        FeeEscrow escrow = new FeeEscrow(deployer, manager);
        ProtocolRevenueDistributor distributor = new ProtocolRevenueDistributor(deployer, ops, manager);
        BuybackVault buybacks = new BuybackVault(deployer, manager);
        HolderAirdropVault airdrops = new HolderAirdropVault(deployer, manager);

        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );

        bytes memory ctorArgs = abi.encode(manager, vault, escrow, distributor, buybacks, airdrops, deployer);
        (address predicted, bytes32 salt) =
            HookMiner.find(HookMiner.CREATE2_DEPLOYER, flags, type(MasterLaunchHook).creationCode, ctorArgs);

        MasterLaunchHook hook = new MasterLaunchHook{salt: salt}(manager, vault, escrow, distributor, buybacks, airdrops, deployer);
        require(address(hook) == predicted, "hook address mismatch");

        LaunchFactory factory = new LaunchFactory(manager, hook, deployer, ops);
        HookitDeployLib.seedQuotes(factory);
        FeeEthRail feeRail = new FeeEthRail(deployer, manager, v4.stableQuote);
        HkitBuyback hkitBuyback = new HkitBuyback(deployer, manager, distributor);

        hook.setFactory(address(factory));
        vault.setOperator(address(hook), true);
        vault.setOperator(address(distributor), true);
        escrow.setOperator(address(hook), true);
        distributor.setOperator(address(hook), true);
        buybacks.setOperator(address(hook), true);
        airdrops.setOperator(address(hook), true);
        distributor.setFeeRail(feeRail);
        // Live Quotrons/Ink USDG↔ETH liquidity only — no proprietary seed.

        (uint256 hkitLaunchId, address hkit,,) =
            HkitLaunchLib.fairLaunch(
                factory, distributor, hkitBuyback, "HOOKIT", "HKIT", "ipfs://hookit-hkit"
            );

        uint256 bitmask = BitmaskConfig.pack(
            BitmaskConfig.Modules({
                antiSnipe: true,
                backedFloor: true,
                antiMev: true,
                maxTx: false,
                maxWallet: false,
                dynamicFees: false,
                buybackVesting: false,
                autoBurn: false,
                lpDonate: false,
                holderAirdrop: false,
                creatorShareToHook: false,
                hookTaxBps: 50,
                antiSnipeDurationSeconds: 600,
                maxTxBps: 0,
                maxWalletBps: 0,
                floorAllocationBps: 2_000,
                initialSnipeTaxBps: 5_000,
                autoBurnBps: 0,
                lpDonateBps: 0,
                holderAirdropBps: 0,
                buybackVestingDurationSeconds: 0
            })
        );

        (uint256 launchId, address token, PoolId poolId) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "Hookit Smoke",
                symbol: "SMOKE",
                metadataURI: "ipfs://hookit-smoke",
                totalSupply: 1_000_000_000e18,
                quote: Currency.wrap(address(0)),
                tickSpacing: 60,
                startingTick: 0,
                bitmask: bitmask,
                customHook: IHooks(address(0)),
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );

        PoolSwapTest swapper = PoolSwapTest(v4.poolSwapTest);
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(token),
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        swapper.swap{value: 0.001 ether}(
            key,
            SwapParams({zeroForOne: true, amountSpecified: -0.001 ether, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(deployer)
        );

        vm.stopBroadcast();

        console.log("FloorVault", address(vault));
        console.log("FeeEscrow", address(escrow));
        console.log("Distributor", address(distributor));
        console.log("BuybackVault", address(buybacks));
        console.log("MasterLaunchHook", address(hook));
        console.log("LaunchFactory", address(factory));
        console.log("FeeEthRail", address(feeRail));
        console.log("HkitBuyback", address(hkitBuyback));
        console.log("HKIT", hkit);
        console.log("HKIT launchId", hkitLaunchId);
        console.log("Smoke token", token);
        console.log("Launch id", launchId);
        console.logBytes32(PoolId.unwrap(poolId));
    }
}
