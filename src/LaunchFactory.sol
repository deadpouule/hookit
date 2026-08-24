// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";

import {Owned} from "./base/Owned.sol";
import {LaunchToken} from "./LaunchToken.sol";
import {MasterLaunchHook} from "./MasterLaunchHook.sol";
import {BitmaskConfig} from "./libraries/BitmaskConfig.sol";
import {FixedPointMath} from "./libraries/FixedPointMath.sol";
import {ProtocolConstants} from "./libraries/ProtocolConstants.sol";
import {CurrencySettler} from "./libraries/CurrencySettler.sol";
import {IMasterLaunchHook} from "./interfaces/IMasterLaunchHook.sol";

/// @title LaunchFactory
/// @notice Permissionless factory: mint ERC-20, init a v4 pool, and seed a locked unilateral position atomically.
contract LaunchFactory is Owned, IUnlockCallback {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using CurrencySettler for Currency;
    using BitmaskConfig for uint256;

    bytes32 public constant LAUNCH_SALT = keccak256("HOOKIT.LAUNCH");

    IPoolManager public immutable poolManager;
    MasterLaunchHook public immutable masterHook;
    address public treasury;

    uint256 public launchFee = ProtocolConstants.LAUNCH_FEE_WEI;
    uint256 public launchCount;

    /// @notice ETH/USD price with 18 decimals — used to convert the fixed $4k FDV into ETH at launch.
    uint256 public ethUsdPriceX18 = ProtocolConstants.DEFAULT_LAUNCH_ETH_USD_X18;

    struct LaunchParams {
        string name;
        string symbol;
        string metadataURI;
        uint256 totalSupply;
        Currency quote;
        int24 tickSpacing;
        int24 startingTick;
        uint256 bitmask;
        IHooks customHook;
    }

    struct LaunchInfo {
        address token;
        address creator;
        IHooks hooks;
        bool customHook;
        PoolId poolId;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
    }

    mapping(uint256 => LaunchInfo) public launches;
    mapping(address => uint256) public tokenLaunchId;

    event LaunchFeeSet(uint256 fee);
    event TreasurySet(address indexed treasury);
    event EthUsdPriceSet(uint256 ethUsdPriceX18);
    event TokenLaunched(
        uint256 indexed launchId,
        address indexed token,
        address indexed creator,
        PoolId poolId,
        IHooks hooks,
        bool customHook,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    );

    error InvalidQuote();
    error InvalidSupply();
    error InvalidTickSpacing();
    error LaunchFeeRequired();
    error NativeNotAccepted();
    error NotPoolManager();
    error UnknownAction();

    constructor(IPoolManager _poolManager, MasterLaunchHook _masterHook, address owner_, address treasury_)
        Owned(owner_)
    {
        poolManager = _poolManager;
        masterHook = _masterHook;
        treasury = treasury_;
    }

    receive() external payable {}

    function setLaunchFee(uint256 fee) external onlyOwner {
        launchFee = fee;
        emit LaunchFeeSet(fee);
    }

    function setTreasury(address treasury_) external onlyOwner {
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function setEthUsdPrice(uint256 ethUsdPriceX18_) external onlyOwner {
        if (ethUsdPriceX18_ == 0) revert InvalidQuote();
        ethUsdPriceX18 = ethUsdPriceX18_;
        emit EthUsdPriceSet(ethUsdPriceX18_);
    }

    /// @notice Target launch FDV in quote wei (ETH for native launches).
    function launchMcapQuoteWei() public view returns (uint256) {
        return FixedPointMath.mcapQuoteFromUsd(ProtocolConstants.TARGET_LAUNCH_MCAP_USD_X18, ethUsdPriceX18);
    }

    /// @notice Create a token, initialize its Uniswap v4 pool, and lock 100% of supply as a unilateral position.
    function launch(LaunchParams calldata params) external payable returns (uint256 launchId, address token, PoolId poolId) {
        if (params.totalSupply == 0) revert InvalidSupply();
        int24 spacing = params.tickSpacing == 0 ? ProtocolConstants.DEFAULT_TICK_SPACING : params.tickSpacing;
        if (spacing <= 0) revert InvalidTickSpacing();

        if (msg.value < launchFee) revert LaunchFeeRequired();
        if (launchFee > 0) {
            CurrencyLibrary.ADDRESS_ZERO.transfer(treasury, launchFee);
        }
        uint256 extra = msg.value - launchFee;
        if (extra > 0) {
            if (!params.quote.isAddressZero()) revert NativeNotAccepted();
            CurrencyLibrary.ADDRESS_ZERO.transfer(msg.sender, extra);
        }

        token = address(
            new LaunchToken(
                params.name, params.symbol, params.totalSupply, msg.sender, address(this), params.metadataURI
            )
        );

        bool tokenIsCurrency0 = uint160(token) < uint160(Currency.unwrap(params.quote));
        Currency currency0 = tokenIsCurrency0 ? Currency.wrap(token) : params.quote;
        Currency currency1 = tokenIsCurrency0 ? params.quote : Currency.wrap(token);

        bool useCustom = address(params.customHook) != address(0) && address(params.customHook) != address(masterHook);
        IHooks hooks = useCustom ? params.customHook : IHooks(address(masterHook));

        uint256 packed = params.bitmask;
        BitmaskConfig.Modules memory modules = BitmaskConfig.unpack(packed);
        // Re-pack to enforce caps (unpack does not validate; pack does).
        packed = BitmaskConfig.pack(modules);

        uint24 fee = (!useCustom && modules.dynamicFees)
            ? LPFeeLibrary.DYNAMIC_FEE_FLAG
            : 0;

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: fee,
            tickSpacing: spacing,
            hooks: hooks
        });

        int24 tickLower;
        int24 tickUpper;
        uint160 sqrtPriceX96;
        bool tokenIsCurrency1 = !tokenIsCurrency0;
        uint256 mcapQuote = launchMcapQuoteWei();
        int24 startingTick = FixedPointMath.startingTickForMcap(
            params.totalSupply, mcapQuote, spacing, tokenIsCurrency1
        );
        int24 startAligned;
        if (tokenIsCurrency0) {
            // 100% token0 when price is below the range.
            startAligned = FixedPointMath.alignTickUp(startingTick, spacing);
            tickLower = startAligned;
            tickUpper = TickMath.maxUsableTick(spacing);
            if (tickUpper <= tickLower) tickLower = tickUpper - spacing;
            uint160 lowerSqrt = TickMath.getSqrtPriceAtTick(tickLower);
            sqrtPriceX96 = lowerSqrt <= TickMath.MIN_SQRT_PRICE + 1 ? TickMath.MIN_SQRT_PRICE + 1 : lowerSqrt - 1;
        } else {
            // 100% token1 when price is above the range.
            startAligned = FixedPointMath.alignTickDown(startingTick, spacing);
            tickLower = TickMath.minUsableTick(spacing);
            tickUpper = startAligned;
            if (tickUpper <= tickLower) tickUpper = tickLower + spacing;
            uint160 upperSqrt = TickMath.getSqrtPriceAtTick(tickUpper);
            sqrtPriceX96 = upperSqrt >= TickMath.MAX_SQRT_PRICE - 1 ? TickMath.MAX_SQRT_PRICE - 1 : upperSqrt + 1;
        }

        uint128 liquidity = tokenIsCurrency0
            ? FixedPointMath.liquidityForAmount0(
                TickMath.getSqrtPriceAtTick(tickLower), TickMath.getSqrtPriceAtTick(tickUpper), params.totalSupply
            )
            : FixedPointMath.liquidityForAmount1(
                TickMath.getSqrtPriceAtTick(tickLower), TickMath.getSqrtPriceAtTick(tickUpper), params.totalSupply
            );

        if (!useCustom) {
            masterHook.prepareLaunch(
                IMasterLaunchHook.PrepareParams({
                    key: key,
                    bitmask: packed,
                    creator: msg.sender,
                    token: token,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    tokenIsCurrency0: tokenIsCurrency0
                })
            );
        }

        IERC20Minimal(token).approve(address(poolManager), params.totalSupply);

        poolManager.unlock(abi.encode(key, sqrtPriceX96, tickLower, tickUpper, int256(uint256(liquidity))));

        launchId = ++launchCount;
        poolId = key.toId();
        launches[launchId] = LaunchInfo({
            token: token,
            creator: msg.sender,
            hooks: hooks,
            customHook: useCustom,
            poolId: poolId,
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidity: liquidity
        });
        tokenLaunchId[token] = launchId;

        emit TokenLaunched(launchId, token, msg.sender, poolId, hooks, useCustom, tickLower, tickUpper, liquidity);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();

        (
            PoolKey memory key,
            uint160 sqrtPriceX96,
            int24 tickLower,
            int24 tickUpper,
            int256 liquidityDelta
        ) = abi.decode(data, (PoolKey, uint160, int24, int24, int256));
        poolManager.initialize(key, sqrtPriceX96);

        (BalanceDelta delta,) = poolManager.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidityDelta: liquidityDelta,
                salt: LAUNCH_SALT
            }),
            ""
        );

        _settleDelta(key.currency0, delta.amount0());
        _settleDelta(key.currency1, delta.amount1());
        return "";
    }

    function _settleDelta(Currency currency, int128 delta) private {
        if (delta < 0) {
            uint256 amount = uint256(uint128(-delta));
            currency.settle(poolManager, address(this), amount, false);
        } else if (delta > 0) {
            currency.take(poolManager, address(this), uint256(uint128(delta)), false);
        }
    }
}
