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
import {FloorVault} from "../src/FloorVault.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ModuleMatrix} from "../test/utils/ModuleMatrix.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {UniswapV4Deployments} from "../src/libraries/UniswapV4Deployments.sol";

/// @notice Ink smoke: Master launch with Backed Floor + LP Donate, then a quote buy.
/// @dev ETH pair by default (donate in ETH). `FLOOR_QUOTE=aapl` uses wAAPLx.
///      forge script script/SmokeFloorLpInk.s.sol --rpc-url $INK_RPC_URL --broadcast -vv
contract SmokeFloorLpInkScript is Script {
    uint256 internal constant ETH_USD_X18 = 2_500e18;

    function run() public {
        require(block.chainid == QuotronStockQuotes.INK_MAINNET, "Ink only");
        string memory phase = vm.envOr("FLOOR_PHASE", string("launch"));
        if (keccak256(bytes(phase)) == keccak256("lp")) {
            _lpCollect();
            return;
        }
        _launchAndBuy();
    }

    function _lpCollect() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));
        HookitSwapRouter router = HookitSwapRouter(payable(vm.envAddress("HOOKIT_SWAP_ROUTER")));
        uint256 launchId = vm.envUint("FLOOR_LAUNCH_ID");
        address aapl = QuotronStockQuotes.wAAPLx;
        PoolKey memory key = factory.poolKeyOf(launchId);
        address token = Currency.unwrap(key.currency0);
        IPoolManager manager = IPoolManager(UniswapV4Deployments.get(block.chainid).poolManager);

        uint256 tokenBefore = IERC20(token).balanceOf(user);
        uint256 aaplBefore = IERC20(aapl).balanceOf(user);
        console.log("tokenBefore", tokenBefore);
        console.log("aaplBefore", aaplBefore);

        // Narrow in-range band (not the locked seed range) so we can later remove and collect donate.
        int24 tickLower = -179760;
        int24 tickUpper = -179700;
        int256 liq = int256(uint256(1e18));

        vm.startBroadcast(pk);
        PoolModifyLiquidityTest liqRouter = new PoolModifyLiquidityTest(manager);
        IERC20(token).approve(address(liqRouter), type(uint256).max);
        IERC20(aapl).approve(address(liqRouter), type(uint256).max);

        liqRouter.modifyLiquidity(
            key,
            ModifyLiquidityParams({tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: liq, salt: bytes32(0)}),
            ""
        );

        uint256 aaplAfterMint = IERC20(aapl).balanceOf(user);
        uint256 buyAapl = vm.envOr("FLOOR_BUY_AAPL", uint256(0.002 ether));
        if (IERC20(aapl).balanceOf(user) >= buyAapl) {
            IERC20(aapl).approve(address(router), buyAapl);
            bool zeroForOne = _buyZeroForOne(key, token);
            uint160 buyLimit = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
            router.swapExactIn(key, zeroForOne, buyAapl, 1, buyLimit);
        }

        liqRouter.modifyLiquidity(
            key,
            ModifyLiquidityParams({tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: -liq, salt: bytes32(0)}),
            ""
        );
        vm.stopBroadcast();

        uint256 tokenAfter = IERC20(token).balanceOf(user);
        uint256 aaplAfter = IERC20(aapl).balanceOf(user);
        console.log("aaplAfterMint", aaplAfterMint);
        console.log("tokenAfter", tokenAfter);
        console.log("aaplAfter", aaplAfter);
        console.log("FLOOR_LP_COLLECT_OK");
    }

    function _launchAndBuy() internal {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));
        HookitSwapRouter router = HookitSwapRouter(payable(vm.envAddress("HOOKIT_SWAP_ROUTER")));
        MasterLaunchHook hook = MasterLaunchHook(payable(vm.envAddress("MASTER_LAUNCH_HOOK")));
        FloorVault vault = FloorVault(payable(vm.envAddress("FLOOR_VAULT")));

        bool useAapl = keccak256(bytes(vm.envOr("FLOOR_QUOTE", string("eth")))) == keccak256("aapl");
        address aapl = QuotronStockQuotes.wAAPLx;
        Currency quote = useAapl ? Currency.wrap(aapl) : Currency.wrap(address(0));

        // BIT_BACKED_FLOOR | BIT_LP_DONATE — 50/50 hook pot, 2% hook tax.
        BitmaskConfig.Modules memory m = ModuleMatrix.fromMask(uint16((1 << 1) | (1 << 8)));
        m.hookTaxBps = 200;
        uint256 bitmask = BitmaskConfig.pack(m);

        console.log("user", user);
        console.log("ethBefore", user.balance);
        console.log("aaplBefore", IERC20(aapl).balanceOf(user));
        console.log("useAapl", useAapl);
        console.log("floorBps", uint256(m.floorAllocationBps));
        console.log("lpDonateBps", uint256(m.lpDonateBps));
        console.log("hookTaxBps", uint256(m.hookTaxBps));

        uint256 buyEth = vm.envOr("FLOOR_BUY_WEI", uint256(0.00008 ether));
        uint256 buyAapl = vm.envOr("FLOOR_BUY_AAPL", uint256(0.003 ether)); // 0.003 wAAPLx ≈ $0.90

        require(user.balance > ProtocolConstants.LAUNCH_FEE_WEI + 0.00005 ether, "top up ETH for launch+gas");
        if (useAapl) {
            require(IERC20(aapl).balanceOf(user) >= buyAapl, "need wAAPLx for buy");
        } else {
            require(user.balance > ProtocolConstants.LAUNCH_FEE_WEI + buyEth + 0.00005 ether, "top up ETH for buy");
        }

        vm.startBroadcast(pk);
        try factory.setEthUsdPrice(ETH_USD_X18) {} catch {}

        (uint256 launchId, address token, PoolId poolId) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "Floor LP Probe",
                symbol: "FLPD",
                metadataURI: "ipfs://hooktest-floor-lp",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: quote,
                tickSpacing: ProtocolConstants.DEFAULT_TICK_SPACING,
                startingTick: 0,
                bitmask: bitmask,
                customHook: IHooks(address(0)),
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0,
                vestPacked: 0
            })
        );

        PoolKey memory key = factory.poolKeyOf(launchId);
        bool zeroForOne = _buyZeroForOne(key, token);
        uint160 buyLimit = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;

        uint256 pendingBefore = hook.pendingLpDonate(poolId);
        if (useAapl) {
            IERC20(aapl).approve(address(router), buyAapl);
            router.swapExactIn(key, zeroForOne, buyAapl, 1, buyLimit);
        } else {
            router.swapExactIn{value: buyEth}(key, zeroForOne, buyEth, 1, buyLimit);
        }
        vm.stopBroadcast();

        uint256 pendingAfter = hook.pendingLpDonate(poolId);
        uint256 floorReserve = vault.reserve(token);
        uint256 floorX18 = vault.floorPriceX18(token);

        console.log("launchId", launchId);
        console.log("token", token);
        console.logBytes32(PoolId.unwrap(poolId));
        console.log("tokenBal", IERC20(token).balanceOf(user));
        console.log("pendingBefore", pendingBefore);
        console.log("pendingAfter", pendingAfter);
        console.log("floorReserve", floorReserve);
        console.log("floorX18", floorX18);
        console.log("ethAfter", user.balance);
        console.log("aaplAfter", IERC20(aapl).balanceOf(user));
        console.log("FLOOR_LP_SMOKE_OK");
    }

    function _buyZeroForOne(PoolKey memory key, address token) internal pure returns (bool) {
        return Currency.unwrap(key.currency1) == token;
    }
}
