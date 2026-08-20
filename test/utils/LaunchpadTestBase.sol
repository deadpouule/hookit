// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";

import {MasterLaunchHook} from "../../src/MasterLaunchHook.sol";
import {LaunchFactory} from "../../src/LaunchFactory.sol";
import {FloorVault} from "../../src/FloorVault.sol";
import {FeeEscrow} from "../../src/FeeEscrow.sol";
import {ProtocolRevenueDistributor} from "../../src/ProtocolRevenueDistributor.sol";
import {BuybackVault} from "../../src/BuybackVault.sol";
import {BitmaskConfig} from "../../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../../src/libraries/ProtocolConstants.sol";

abstract contract LaunchpadTestBase is Test, Deployers {
    FloorVault internal vault;
    FeeEscrow internal escrow;
    ProtocolRevenueDistributor internal distributor;
    BuybackVault internal buybacks;
    MasterLaunchHook internal hook;
    LaunchFactory internal factory;
    address internal ops = address(0xB0B);

    function hookFlags() internal pure returns (address) {
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
        // Namespace to avoid colliding with other etched addresses in the same test process.
        return address(flags | (uint160(0xA11CE) << 144));
    }

    function deployProtocol() internal {
        deployFreshManagerAndRouters();
        vm.deal(address(this), 10_000 ether);
        vm.deal(ops, 1 ether);

        vault = new FloorVault(address(this), manager);
        escrow = new FeeEscrow(address(this), manager);
        distributor = new ProtocolRevenueDistributor(address(this), ops, manager);
        buybacks = new BuybackVault(address(this), manager);

        address flags = hookFlags();
        bytes memory args = abi.encode(manager, vault, escrow, distributor, buybacks, address(this));
        deployCodeTo("MasterLaunchHook.sol:MasterLaunchHook", args, flags);
        hook = MasterLaunchHook(payable(flags));

        factory = new LaunchFactory(manager, hook, address(this), ops);
        hook.setFactory(address(factory));

        vault.setOperator(address(hook), true);
        vault.setOperator(address(distributor), true);
        vault.setOperator(address(this), true);
        escrow.setOperator(address(hook), true);
        escrow.setOperator(address(this), true);
        distributor.setOperator(address(hook), true);
        distributor.setOperator(address(this), true);
        buybacks.setOperator(address(hook), true);
        buybacks.setOperator(address(this), true);
    }

    function defaultModules() internal pure returns (BitmaskConfig.Modules memory) {
        return BitmaskConfig.Modules({
            antiSnipe: false,
            backedFloor: false,
            antiMev: false,
            maxTx: false,
            maxWallet: false,
            dynamicFees: false,
            buybackVesting: false,
            creatorTaxBps: 0,
            antiSnipeDurationSeconds: 0,
            maxTxBps: 0,
            maxWalletBps: 0,
            floorAllocationBps: 0,
            initialSnipeTaxBps: 0
        });
    }

    function launchToken(BitmaskConfig.Modules memory modules, int24 startingTick, uint256 supply)
        internal
        returns (uint256 launchId, address token, PoolId poolId, PoolKey memory key)
    {
        uint256 bitmask = BitmaskConfig.pack(modules);
        (launchId, token, poolId) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "Test",
                symbol: "TST",
                metadataURI: "ipfs://test",
                totalSupply: supply,
                quote: Currency.wrap(address(0)),
                tickSpacing: 60,
                startingTick: startingTick,
                bitmask: bitmask,
                customHook: IHooks(address(0))
            })
        );
        key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(token),
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
    }

    function buyExactIn(PoolKey memory key, uint256 ethIn) internal {
        swapRouter.swap{value: ethIn}(
            key,
            SwapParams({zeroForOne: true, amountSpecified: -int256(ethIn), sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(address(this))
        );
    }

    function sellExactIn(PoolKey memory key, address token, uint256 tokenIn) internal {
        LaunchTokenLike(token).approve(address(swapRouter), tokenIn);
        swapRouter.swap(
            key,
            SwapParams({zeroForOne: false, amountSpecified: -int256(tokenIn), sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(address(this))
        );
    }
}

interface LaunchTokenLike {
    function approve(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}
