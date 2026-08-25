// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";

import {BaseSepoliaAddresses} from "../src/libraries/BaseSepoliaAddresses.sol";
import {HookitDeployLib} from "../src/libraries/HookitDeployLib.sol";
import {MasterLaunchHook} from "../src/MasterLaunchHook.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {FloorVault} from "../src/FloorVault.sol";
import {FeeEscrow} from "../src/FeeEscrow.sol";
import {ProtocolRevenueDistributor} from "../src/ProtocolRevenueDistributor.sol";
import {BuybackVault} from "../src/BuybackVault.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {LaunchTokenLike} from "./utils/LaunchpadTestBase.sol";

/// @notice End-to-end fork tests against live Base Sepolia Uniswap v4 state.
contract ForkBaseSepoliaTest is Test {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    uint256 internal forkId;
    IPoolManager internal manager;
    FloorVault internal vault;
    FeeEscrow internal escrow;
    ProtocolRevenueDistributor internal distributor;
    BuybackVault internal buybacks;
    MasterLaunchHook internal hook;
    LaunchFactory internal factory;
    PoolSwapTest internal swapper;
    address internal ops;

    /// @dev Required: launch-fee payouts and PoolSwapTest ETH refunds use Currency.transfer (plain CALL).
    receive() external payable {}

    function setUp() public {
        string memory rpc = vm.envOr("BASE_SEPOLIA_RPC_URL", string("https://sepolia.base.org"));
        try vm.createSelectFork(rpc) returns (uint256 id) {
            forkId = id;
        } catch {
            vm.skip(true);
            return;
        }
        if (block.chainid != BaseSepoliaAddresses.CHAIN_ID) {
            vm.skip(true);
            return;
        }

        manager = IPoolManager(BaseSepoliaAddresses.POOL_MANAGER);
        if (address(manager).code.length == 0) {
            vm.skip(true);
            return;
        }

        ops = makeAddr("ops");
        vm.deal(address(this), 100 ether);
        vm.deal(ops, 1 ether);

        vault = new FloorVault(address(this), manager);
        escrow = new FeeEscrow(address(this), manager);
        distributor = new ProtocolRevenueDistributor(address(this), ops, manager);
        buybacks = new BuybackVault(address(this), manager);

        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
        address flagsAddr = address(flags | (uint160(0xA11CE) << 144));
        bytes memory args = abi.encode(manager, vault, escrow, distributor, buybacks, address(this));
        deployCodeTo("MasterLaunchHook.sol:MasterLaunchHook", args, flagsAddr);
        hook = MasterLaunchHook(payable(flagsAddr));

        factory = new LaunchFactory(manager, hook, address(this), ops);
        HookitDeployLib.seedQuotes(factory);
        hook.setFactory(address(factory));
        vault.setOperator(address(hook), true);
        escrow.setOperator(address(hook), true);
        distributor.setOperator(address(hook), true);
        buybacks.setOperator(address(hook), true);

        swapper = new PoolSwapTest(manager);
    }

    function testForkPoolManagerExists() public view {
        assertTrue(address(manager).code.length > 0);
    }

    function testForkLaunchAndSwap() public {
        BitmaskConfig.Modules memory m;
        m.antiSnipe = true;
        m.backedFloor = true;
        m.antiSnipeDurationSeconds = 120;
        m.initialSnipeTaxBps = 2_000;
        m.creatorTaxBps = 50;
        m.floorAllocationBps = 1_000;

        (, address token, PoolId poolId) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "Fork",
                symbol: "FRK",
                metadataURI: "",
                totalSupply: 1_000_000_000e18,
                quote: Currency.wrap(address(0)),
                tickSpacing: 60,
                startingTick: 0,
                bitmask: BitmaskConfig.pack(m),
                customHook: IHooks(address(0))
            })
        );

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(token),
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        assertEq(PoolId.unwrap(key.toId()), PoolId.unwrap(poolId));

        (uint160 sqrtPriceX96,,,) = manager.getSlot0(poolId);
        assertGt(sqrtPriceX96, 0);

        swapper.swap{value: 0.05 ether}(
            key,
            SwapParams({zeroForOne: true, amountSpecified: -0.05 ether, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(address(this))
        );
        assertGt(LaunchTokenLike(token).balanceOf(address(this)), 0);
    }
}
