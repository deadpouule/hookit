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
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";

import {HookitSwapRouter} from "../src/HookitSwapRouter.sol";
import {BaseSepoliaAddresses} from "../src/libraries/BaseSepoliaAddresses.sol";
import {HookitDeployLib} from "../src/libraries/HookitDeployLib.sol";
import {MasterLaunchHook} from "../src/MasterLaunchHook.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {FloorVault} from "../src/FloorVault.sol";
import {FeeEscrow} from "../src/FeeEscrow.sol";
import {ProtocolRevenueDistributor} from "../src/ProtocolRevenueDistributor.sol";
import {BuybackVault} from "../src/BuybackVault.sol";
import {HolderAirdropVault} from "../src/HolderAirdropVault.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {LaunchTokenLike} from "./utils/LaunchpadTestBase.sol";
import {MockQuoteToken} from "./mocks/MockQuoteToken.sol";

contract MintableUsdc is MockQuoteToken {
    constructor() MockQuoteToken("USD Coin", "USDC", 6) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Composite buy (USDC → ETH → launch token) on a Base Sepolia v4 fork.
/// @dev Seeds a zero-hook ETH/USDC bridge pool on the fork — no Ink mainnet deploy required.
contract ForkCompositeSwapTest is Test {
    using PoolIdLibrary for PoolKey;

    IPoolManager internal manager;
    FloorVault internal vault;
    FeeEscrow internal escrow;
    ProtocolRevenueDistributor internal distributor;
    BuybackVault internal buybacks;
    HolderAirdropVault internal airdrops;
    MasterLaunchHook internal hook;
    LaunchFactory internal factory;
    HookitSwapRouter internal router;
    PoolModifyLiquidityTest internal liquidityRouter;
    MintableUsdc internal usdc;
    address internal trader = address(0xA11CE);
    address internal ops = address(0xB0B);

    receive() external payable {}

    function setUp() public {
        string memory rpc = vm.envOr("BASE_SEPOLIA_RPC_URL", string("https://sepolia.base.org"));
        try vm.createSelectFork(rpc) {
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

        vm.deal(address(this), 500 ether);
        vm.deal(trader, 10 ether);
        vm.deal(ops, 1 ether);

        _deployProtocol();
        router = new HookitSwapRouter(manager);
        liquidityRouter = new PoolModifyLiquidityTest(manager);

        usdc = new MintableUsdc();
        factory.setQuote(address(usdc), true, 6, 1e18, address(0));
    }

    function _deployProtocol() internal {
        vault = new FloorVault(address(this), manager);
        escrow = new FeeEscrow(address(this), manager);
        distributor = new ProtocolRevenueDistributor(address(this), ops, manager);
        buybacks = new BuybackVault(address(this), manager);
        airdrops = new HolderAirdropVault(address(this), manager);

        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
        address flagsAddr = address(flags | (uint160(0xC0FFEE) << 144));
        bytes memory args = abi.encode(manager, vault, escrow, distributor, buybacks, airdrops, address(this));
        deployCodeTo("MasterLaunchHook.sol:MasterLaunchHook", args, flagsAddr);
        hook = MasterLaunchHook(payable(flagsAddr));

        factory = new LaunchFactory(manager, hook, address(this), ops);
        HookitDeployLib.seedQuotes(factory);
        hook.setFactory(address(factory));
        vault.setOperator(address(hook), true);
        escrow.setOperator(address(hook), true);
        distributor.setOperator(address(hook), true);
        buybacks.setOperator(address(hook), true);
        airdrops.setOperator(address(hook), true);
    }

    function _seedBridgePool() internal returns (PoolKey memory bridgeKey) {
        bridgeKey = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(address(usdc)),
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        // ~1 ETH ≈ 3000 USDC at tick -198120 (raw price matches 18 vs 6 decimals).
        manager.initialize(bridgeKey, TickMath.getSqrtPriceAtTick(-198_120));

        usdc.mint(address(this), 50_000_000e6);
        usdc.approve(address(liquidityRouter), type(uint256).max);
        liquidityRouter.modifyLiquidity{value: 50 ether}(
            bridgeKey,
            ModifyLiquidityParams({tickLower: -600, tickUpper: 600, liquidityDelta: 1e18, salt: 0}),
            ""
        );
    }

    function testForkCompositeBuyUsdcToEthToToken() public {
        PoolKey memory bridgeKey = _seedBridgePool();

        BitmaskConfig.Modules memory m;
        (, address token,) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "Composite",
                symbol: "CMP",
                metadataURI: "",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(address(0)),
                tickSpacing: 60,
                startingTick: 0,
                bitmask: BitmaskConfig.pack(m),
                customHook: IHooks(address(0))
            })
        );

        PoolKey memory hookKey = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(token),
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        uint256 usdcIn = 500e6;
        usdc.transfer(trader, usdcIn);

        vm.startPrank(trader);
        usdc.approve(address(router), usdcIn);

        uint256 balBefore = LaunchTokenLike(token).balanceOf(trader);
        uint256 tokensOut = router.swapExactInComposite(
            bridgeKey,
            false,
            usdcIn,
            hookKey,
            true,
            Currency.wrap(address(0)),
            1,
            TickMath.MAX_SQRT_PRICE - 1,
            TickMath.MIN_SQRT_PRICE + 1
        );
        vm.stopPrank();

        assertGt(tokensOut, 0);
        assertEq(LaunchTokenLike(token).balanceOf(trader), balBefore + tokensOut);
    }

    function testForkCompositeRevertsIfBridgeHasHooks() public {
        PoolKey memory bridgeKey = _seedBridgePool();
        bridgeKey.hooks = IHooks(address(hook));

        PoolKey memory hookKey = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(address(0xBEEF)),
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        usdc.transfer(trader, 100e6);
        vm.startPrank(trader);
        usdc.approve(address(router), 100e6);
        vm.expectRevert(HookitSwapRouter.UnauthorizedBridgeHook.selector);
        router.swapExactInComposite(
            bridgeKey,
            false,
            100e6,
            hookKey,
            true,
            Currency.wrap(address(0)),
            1,
            TickMath.MAX_SQRT_PRICE - 1,
            TickMath.MIN_SQRT_PRICE + 1
        );
        vm.stopPrank();
    }
}
