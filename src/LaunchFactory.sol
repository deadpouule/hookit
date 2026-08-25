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

interface IAggregatorV3 {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

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
    /// @notice Optional Chainlink ETH/USD feed; anyone may `syncEthUsdPrice`.
    address public ethUsdFeed;

    struct QuoteConfig {
        bool allowed;
        uint8 decimals;
        uint256 usdPriceX18;
        address usdFeed;
    }

    /// @notice ERC-20 quotes (USDC, xStocks, …). Native ETH is always allowed.
    mapping(address => QuoteConfig) public quoteConfigs;

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
    mapping(uint256 => uint256) public launchBitmasks;
    mapping(uint256 => uint64) public launchedAt;
    mapping(uint256 => Currency) public launchQuote;
    mapping(uint256 => int24) public launchTickSpacing;
    mapping(uint256 => uint24) public launchFeeFlag;

    event LaunchFeeSet(uint256 fee);
    event TreasurySet(address indexed treasury);
    event EthUsdPriceSet(uint256 ethUsdPriceX18);
    event QuoteSet(address indexed token, bool allowed, uint8 decimals, uint256 usdPriceX18, address usdFeed);
    event LaunchConfigured(
        uint256 indexed launchId, uint256 bitmask, Currency quote, int24 tickSpacing, uint24 fee
    );
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
    error UnknownLaunch();
    error InvalidFeed();
    error StalePrice();

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

    function setEthUsdFeed(address feed) external onlyOwner {
        ethUsdFeed = feed;
    }

    /// @notice Allow or revoke an ERC-20 quote (USDC, chain-native ERC-20s, …). Native ETH cannot be set here.
    function setQuote(address token, bool allowed, uint8 decimals, uint256 usdPriceX18, address usdFeed)
        external
        onlyOwner
    {
        _setQuote(token, allowed, decimals, usdPriceX18, usdFeed);
    }

    function isQuoteAllowed(address token) public view returns (bool) {
        if (token == address(0)) return true;
        return quoteConfigs[token].allowed;
    }

    /// @notice Target FDV in the quote's native wei ($4k at the configured USD price).
    function mcapQuoteFor(address token) public view returns (uint256) {
        return _mcapQuote(Currency.wrap(token));
    }

    /// @notice Pull ETH/USD from Chainlink into `ethUsdPriceX18` (8-decimal feeds scaled to 18).
    function syncEthUsdPrice() public {
        if (ethUsdFeed == address(0)) revert InvalidFeed();
        ethUsdPriceX18 = _usdFromFeed(ethUsdFeed, 1 days);
        emit EthUsdPriceSet(ethUsdPriceX18);
    }

    /// @notice Target launch FDV in quote wei (ETH for native launches).
    function launchMcapQuoteWei() public view returns (uint256) {
        return FixedPointMath.mcapQuoteFromUsd(ProtocolConstants.TARGET_LAUNCH_MCAP_USD_X18, ethUsdPriceX18);
    }

    function _mcapQuote(Currency quote) internal view returns (uint256) {
        address token = Currency.unwrap(quote);
        if (token == address(0)) return launchMcapQuoteWei();
        QuoteConfig memory q = quoteConfigs[token];
        if (!q.allowed) revert InvalidQuote();
        uint256 usd = q.usdFeed != address(0) ? _usdFromFeed(q.usdFeed, 3 days) : q.usdPriceX18;
        if (usd == 0) revert InvalidQuote();
        return FixedPointMath.mcapQuoteWei(ProtocolConstants.TARGET_LAUNCH_MCAP_USD_X18, usd, q.decimals);
    }

    function _setQuote(address token, bool allowed, uint8 decimals, uint256 usdPriceX18, address usdFeed) private {
        if (token == address(0)) revert InvalidQuote();
        if (allowed && (decimals == 0 || decimals > 18)) revert InvalidQuote();
        if (allowed && usdFeed == address(0) && usdPriceX18 == 0) revert InvalidQuote();
        quoteConfigs[token] = QuoteConfig({
            allowed: allowed,
            decimals: decimals,
            usdPriceX18: usdPriceX18,
            usdFeed: usdFeed
        });
        emit QuoteSet(token, allowed, decimals, usdPriceX18, usdFeed);
    }

    function _usdFromFeed(address feed, uint256 maxAge) internal view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = IAggregatorV3(feed).latestRoundData();
        if (answer <= 0) revert InvalidQuote();
        if (updatedAt == 0 || updatedAt + maxAge < block.timestamp) revert StalePrice();
        uint8 dec = IAggregatorV3(feed).decimals();
        uint256 price = uint256(answer);
        if (dec < 18) price *= 10 ** (18 - dec);
        else if (dec > 18) price /= 10 ** (dec - 18);
        return price;
    }

    /// @notice Paginated launches for indexers / the app. `startId` is 1-indexed.
    function getLaunchPage(uint256 startId, uint256 limit)
        external
        view
        returns (LaunchInfo[] memory infos, uint256[] memory bitmasks, uint64[] memory timestamps, uint256 total)
    {
        total = launchCount;
        if (startId == 0 || startId > total || limit == 0) {
            return (new LaunchInfo[](0), new uint256[](0), new uint64[](0), total);
        }
        uint256 end = startId + limit - 1;
        if (end > total) end = total;
        uint256 n = end - startId + 1;
        infos = new LaunchInfo[](n);
        bitmasks = new uint256[](n);
        timestamps = new uint64[](n);
        for (uint256 i; i < n; ++i) {
            uint256 id = startId + i;
            infos[i] = launches[id];
            bitmasks[i] = launchBitmasks[id];
            timestamps[i] = launchedAt[id];
        }
    }

    function poolKeyOf(uint256 launchId) external view returns (PoolKey memory key) {
        LaunchInfo storage info = launches[launchId];
        if (info.token == address(0)) revert UnknownLaunch();
        Currency quote = launchQuote[launchId];
        bool tokenIs0 = uint160(info.token) < uint160(Currency.unwrap(quote));
        key = PoolKey({
            currency0: tokenIs0 ? Currency.wrap(info.token) : quote,
            currency1: tokenIs0 ? quote : Currency.wrap(info.token),
            fee: launchFeeFlag[launchId],
            tickSpacing: launchTickSpacing[launchId],
            hooks: info.hooks
        });
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
        uint256 mcapQuote = _mcapQuote(params.quote);
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
        launchBitmasks[launchId] = packed;
        launchedAt[launchId] = uint64(block.timestamp);
        launchQuote[launchId] = params.quote;
        launchTickSpacing[launchId] = spacing;
        launchFeeFlag[launchId] = fee;

        emit LaunchConfigured(launchId, packed, params.quote, spacing, fee);
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
