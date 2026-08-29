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
import {QuotronBridge} from "./libraries/QuotronBridge.sol";
import {TokenAddressMiner} from "./libraries/TokenAddressMiner.sol";
import {IMasterLaunchHook} from "./interfaces/IMasterLaunchHook.sol";

interface IAggregatorV3 {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @title LaunchFactory
/// @notice Permissionless factory: mint ERC-20, init v4 pool(s), and seed locked unilateral positions atomically.
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
    /// @notice On-chain ETH/USD feed (Redstone push on Ink); anyone may `syncEthUsdPrice`.
    address public ethUsdFeed;

    struct QuoteConfig {
        bool allowed;
        uint8 decimals;
        uint256 usdPriceX18;
        address usdFeed;
    }

    /// @notice ERC-20 quotes (USDG, Quotrons wStocks, …). Native ETH is always allowed.
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

    struct MarketInput {
        Currency quote;
        uint16 bps;
    }

    struct LaunchMultiParams {
        string name;
        string symbol;
        string metadataURI;
        uint256 totalSupply;
        MarketInput[] markets;
        int24 tickSpacing;
        uint256 bitmask;
        IHooks customHook;
        /// @dev Reserved for future backed-floor multi support; must index a selected market today.
        uint8 floorQuoteIndex;
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

    struct LaunchMarket {
        Currency quote;
        uint16 bps;
        PoolId poolId;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
    }

    struct PoolPlan {
        PoolKey key;
        uint160 sqrtPriceX96;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        bool tokenIsCurrency0;
        Currency quote;
        uint16 bps;
    }

    struct PoolSeed {
        PoolKey key;
        uint160 sqrtPriceX96;
        int24 tickLower;
        int24 tickUpper;
        int256 liquidityDelta;
    }

    mapping(uint256 => LaunchInfo) public launches;
    mapping(address => uint256) public tokenLaunchId;
    mapping(uint256 => uint256) public launchBitmasks;
    mapping(uint256 => uint64) public launchedAt;
    mapping(uint256 => Currency) public launchQuote;
    mapping(uint256 => int24) public launchTickSpacing;
    mapping(uint256 => uint24) public launchFeeFlag;

    /// @notice Non-zero when created via `launchMulti` (1–5 canonical markets).
    mapping(uint256 => uint8) public launchMarketCount;
    mapping(uint256 => mapping(uint256 => LaunchMarket)) public launchMarkets;
    mapping(PoolId => uint256) public poolLaunchId;
    mapping(PoolId => uint8) public poolMarketIndex;
    mapping(uint256 => uint8) public launchFloorQuoteIndex;

    /// @notice When true, only hooks in `allowedCustomHooks` may be used (Master always allowed).
    bool public customHookAllowlistEnabled;
    mapping(address => bool) public allowedCustomHooks;

    event LaunchFeeSet(uint256 fee);
    event TreasurySet(address indexed treasury);
    event EthUsdPriceSet(uint256 ethUsdPriceX18);
    event QuoteSet(address indexed token, bool allowed, uint8 decimals, uint256 usdPriceX18, address usdFeed);
    event CustomHookAllowlistEnabled(bool enabled);
    event CustomHookAllowed(address indexed hook, bool allowed);
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
    event MultiLaunchConfigured(
        uint256 indexed launchId, uint8 marketCount, uint8 floorQuoteIndex, uint256 bitmask
    );
    event MarketLaunched(
        uint256 indexed launchId,
        uint8 indexed marketIndex,
        PoolId poolId,
        Currency quote,
        uint16 bps,
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
    error UnknownLaunch();
    error UnknownMarket();
    error InvalidFeed();
    error StalePrice();
    error CustomHookNotAllowed();
    error InvalidMarketCount();
    error InvalidMarketBps();
    error DuplicateQuote();
    error FloorNotSupportedInMulti();
    error InvalidFloorQuoteIndex();

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

    function setCustomHookAllowlistEnabled(bool enabled) external onlyOwner {
        customHookAllowlistEnabled = enabled;
        emit CustomHookAllowlistEnabled(enabled);
    }

    function setCustomHookAllowed(address hook, bool allowed) external onlyOwner {
        allowedCustomHooks[hook] = allowed;
        emit CustomHookAllowed(hook, allowed);
    }

    function setEthUsdPrice(uint256 ethUsdPriceX18_) external onlyOwner {
        if (ethUsdPriceX18_ == 0) revert InvalidQuote();
        ethUsdPriceX18 = ethUsdPriceX18_;
        emit EthUsdPriceSet(ethUsdPriceX18_);
    }

    function setEthUsdFeed(address feed) external onlyOwner {
        ethUsdFeed = feed;
    }

    /// @notice Allow or revoke an ERC-20 quote (USDG, Quotrons wStocks, …). Native ETH cannot be set here.
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

    /// @notice USD price (1e18) used for quote sizing — live Quotrons sqrtPrice for wStocks when available.
    function quoteUsdPriceX18(address token) public view returns (uint256) {
        if (token == address(0)) return ethUsdPriceX18;
        QuoteConfig memory q = quoteConfigs[token];
        if (!q.allowed) revert InvalidQuote();
        return _quoteUsdX18(token, q);
    }

    /// @notice Pull ETH/USD from the configured on-chain feed into `ethUsdPriceX18`.
    function syncEthUsdPrice() public {
        if (ethUsdFeed == address(0)) revert InvalidFeed();
        ethUsdPriceX18 = _usdFromFeed(ethUsdFeed, ProtocolConstants.ORACLE_MAX_AGE);
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
        uint256 usd = _quoteUsdX18(token, q);
        if (usd == 0) revert InvalidQuote();
        return FixedPointMath.mcapQuoteWei(ProtocolConstants.TARGET_LAUNCH_MCAP_USD_X18, usd, q.decimals);
    }

    /// @dev Quotrons wStocks: live pool sqrtPrice (USDG≈$1). Else on-chain feed, else stored snapshot.
    function _quoteUsdX18(address token, QuoteConfig memory q) internal view returns (uint256) {
        if (QuotronBridge.isQuotronStock(token)) {
            uint256 live = QuotronBridge.usdPriceX18(poolManager, token);
            if (live != 0) return live;
        }
        if (q.usdFeed != address(0)) {
            return _usdFromFeed(q.usdFeed, ProtocolConstants.ORACLE_MAX_AGE);
        }
        return q.usdPriceX18;
    }

    function _setQuote(address token, bool allowed, uint8 decimals, uint256 usdPriceX18, address usdFeed) private {
        if (token == address(0)) revert InvalidQuote();
        if (allowed && (decimals == 0 || decimals > 18)) revert InvalidQuote();
        bool needsPrice = usdFeed == address(0) && usdPriceX18 == 0 && !QuotronBridge.isQuotronStock(token);
        if (allowed && needsPrice) revert InvalidQuote();
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
        return poolKeyOfMarket(launchId, 0);
    }

    function poolKeyOfMarket(uint256 launchId, uint256 marketIndex) public view returns (PoolKey memory key) {
        LaunchInfo storage info = launches[launchId];
        if (info.token == address(0)) revert UnknownLaunch();

        Currency quote;
        if (launchMarketCount[launchId] > 0) {
            if (marketIndex >= launchMarketCount[launchId]) revert UnknownMarket();
            quote = launchMarkets[launchId][marketIndex].quote;
        } else {
            if (marketIndex != 0) revert UnknownMarket();
            quote = launchQuote[launchId];
        }

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

        _collectLaunchFee(params.quote.isAddressZero());

        token = _deployToken(params.name, params.symbol, params.totalSupply, msg.sender, params.metadataURI);

        (IHooks hooks, bool useCustom, uint256 packed, uint24 fee) =
            _resolveLaunchConfig(params.customHook, params.bitmask);

        PoolPlan memory plan = _computePoolPlan(
            token, params.quote, params.totalSupply, params.totalSupply, spacing, hooks, fee
        );

        if (!useCustom) {
            _prepareMasterLaunch(plan, packed, msg.sender, token);
        }

        IERC20Minimal(token).approve(address(poolManager), params.totalSupply);
        _unlockPlans(_plansToArray(plan));

        launchId = ++launchCount;
        poolId = plan.key.toId();
        _recordSingleLaunch(launchId, token, msg.sender, hooks, useCustom, plan, packed, spacing, fee, params.quote);

        emit LaunchConfigured(launchId, packed, params.quote, spacing, fee);
        emit TokenLaunched(
            launchId, token, msg.sender, poolId, hooks, useCustom, plan.tickLower, plan.tickUpper, plan.liquidity
        );
    }

    /// @notice Deploy one token and 1–5 permanently locked v4 markets atomically (PAIR-style multi-pair).
    /// @dev Backed floor is disabled in v1 multi launches. Custom hook applies to every market.
    function launchMulti(LaunchMultiParams calldata params)
        external
        payable
        returns (uint256 launchId, address token, PoolId primaryPoolId)
    {
        if (params.totalSupply == 0) revert InvalidSupply();
        uint256 marketLen = params.markets.length;
        if (marketLen < ProtocolConstants.MIN_LAUNCH_MARKETS || marketLen > ProtocolConstants.MAX_LAUNCH_MARKETS) {
            revert InvalidMarketCount();
        }
        if (params.floorQuoteIndex >= marketLen) revert InvalidFloorQuoteIndex();

        int24 spacing = params.tickSpacing == 0 ? ProtocolConstants.DEFAULT_TICK_SPACING : params.tickSpacing;
        if (spacing <= 0) revert InvalidTickSpacing();

        bool hasNative;
        uint256 bpsSum;
        for (uint256 i; i < marketLen; ++i) {
            MarketInput calldata m = params.markets[i];
            if (m.bps == 0) revert InvalidMarketBps();
            bpsSum += m.bps;
            _assertQuoteAllowed(m.quote);
            if (m.quote.isAddressZero()) hasNative = true;
            for (uint256 j = i + 1; j < marketLen; ++j) {
                if (Currency.unwrap(m.quote) == Currency.unwrap(params.markets[j].quote)) revert DuplicateQuote();
            }
        }
        if (bpsSum != ProtocolConstants.BPS_DENOMINATOR) revert InvalidMarketBps();

        (IHooks hooks, bool useCustom, uint256 packed, uint24 fee) =
            _resolveLaunchConfig(params.customHook, params.bitmask);
        if ((packed & BitmaskConfig.BACKED_FLOOR_ENABLED) != 0) revert FloorNotSupportedInMulti();

        _collectLaunchFee(hasNative);

        token = _deployToken(params.name, params.symbol, params.totalSupply, msg.sender, params.metadataURI);

        uint256[] memory tokenAmounts = _splitSupply(params.totalSupply, params.markets);

        PoolPlan[] memory plans = new PoolPlan[](marketLen);
        for (uint256 i; i < marketLen; ++i) {
            MarketInput calldata m = params.markets[i];
            plans[i] = _computePoolPlan(token, m.quote, tokenAmounts[i], params.totalSupply, spacing, hooks, fee);
            plans[i].bps = m.bps;
            if (!useCustom) {
                _prepareMasterLaunch(plans[i], packed, msg.sender, token);
            }
        }

        IERC20Minimal(token).approve(address(poolManager), params.totalSupply);
        _unlockPlans(plans);

        launchId = ++launchCount;
        primaryPoolId = plans[0].key.toId();

        launches[launchId] = LaunchInfo({
            token: token,
            creator: msg.sender,
            hooks: hooks,
            customHook: useCustom,
            poolId: primaryPoolId,
            tickLower: plans[0].tickLower,
            tickUpper: plans[0].tickUpper,
            liquidity: plans[0].liquidity
        });
        tokenLaunchId[token] = launchId;
        launchBitmasks[launchId] = packed;
        launchedAt[launchId] = uint64(block.timestamp);
        launchQuote[launchId] = params.markets[0].quote;
        launchTickSpacing[launchId] = spacing;
        launchFeeFlag[launchId] = fee;
        launchMarketCount[launchId] = uint8(marketLen);
        launchFloorQuoteIndex[launchId] = params.floorQuoteIndex;

        for (uint256 i; i < marketLen; ++i) {
            PoolPlan memory plan = plans[i];
            PoolId pid = plan.key.toId();
            launchMarkets[launchId][i] = LaunchMarket({
                quote: plan.quote,
                bps: plan.bps,
                poolId: pid,
                tickLower: plan.tickLower,
                tickUpper: plan.tickUpper,
                liquidity: plan.liquidity
            });
            poolLaunchId[pid] = launchId;
            poolMarketIndex[pid] = uint8(i);

            emit MarketLaunched(
                launchId, uint8(i), pid, plan.quote, plan.bps, plan.tickLower, plan.tickUpper, plan.liquidity
            );
        }

        emit LaunchConfigured(launchId, packed, params.markets[0].quote, spacing, fee);
        emit MultiLaunchConfigured(launchId, uint8(marketLen), params.floorQuoteIndex, packed);
        emit TokenLaunched(
            launchId,
            token,
            msg.sender,
            primaryPoolId,
            hooks,
            useCustom,
            plans[0].tickLower,
            plans[0].tickUpper,
            plans[0].liquidity
        );
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();

        PoolSeed[] memory seeds = abi.decode(data, (PoolSeed[]));
        for (uint256 i; i < seeds.length; ++i) {
            PoolSeed memory s = seeds[i];
            poolManager.initialize(s.key, s.sqrtPriceX96);

            (BalanceDelta delta,) = poolManager.modifyLiquidity(
                s.key,
                ModifyLiquidityParams({
                    tickLower: s.tickLower,
                    tickUpper: s.tickUpper,
                    liquidityDelta: s.liquidityDelta,
                    salt: LAUNCH_SALT
                }),
                ""
            );

            _settleDelta(s.key.currency0, delta.amount0());
            _settleDelta(s.key.currency1, delta.amount1());
        }
        return "";
    }

    function _deployToken(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply,
        address creator,
        string memory metadataURI_
    ) internal returns (address token) {
        bytes memory initCode = abi.encodePacked(
            type(LaunchToken).creationCode,
            abi.encode(name_, symbol_, totalSupply, creator, address(this), metadataURI_)
        );
        bytes32 entropy = keccak256(abi.encodePacked(name_, symbol_, creator, totalSupply, metadataURI_, launchCount));
        token = TokenAddressMiner.deploy(address(this), initCode, entropy);
    }

    function _collectLaunchFee(bool needsNativeDust) internal {
        if (msg.value < launchFee) revert LaunchFeeRequired();
        uint256 keep = needsNativeDust && launchFee > 0 ? 1 : 0;
        uint256 toTreasury = launchFee - keep;
        if (toTreasury > 0) {
            CurrencyLibrary.ADDRESS_ZERO.transfer(treasury, toTreasury);
        }
        uint256 extra = msg.value - launchFee;
        if (extra > 0) {
            if (!needsNativeDust) revert NativeNotAccepted();
            CurrencyLibrary.ADDRESS_ZERO.transfer(msg.sender, extra);
        }
    }

    function _resolveLaunchConfig(IHooks customHook, uint256 bitmask)
        internal
        view
        returns (IHooks hooks, bool useCustom, uint256 packed, uint24 fee)
    {
        useCustom = address(customHook) != address(0) && address(customHook) != address(masterHook);
        if (useCustom && customHookAllowlistEnabled && !allowedCustomHooks[address(customHook)]) {
            revert CustomHookNotAllowed();
        }
        hooks = useCustom ? customHook : IHooks(address(masterHook));

        packed = bitmask;
        BitmaskConfig.Modules memory modules = BitmaskConfig.unpack(packed);
        packed = BitmaskConfig.pack(modules);

        fee = (!useCustom && modules.dynamicFees) ? LPFeeLibrary.DYNAMIC_FEE_FLAG : 0;
    }

    function _assertQuoteAllowed(Currency quote) internal view {
        if (!isQuoteAllowed(Currency.unwrap(quote))) revert InvalidQuote();
        if (Currency.unwrap(quote) != address(0)) {
            quoteUsdPriceX18(Currency.unwrap(quote));
        }
    }

    function _splitSupply(uint256 totalSupply, MarketInput[] calldata markets)
        internal
        pure
        returns (uint256[] memory amounts)
    {
        uint256 len = markets.length;
        amounts = new uint256[](len);
        uint256 allocated;
        for (uint256 i; i < len - 1; ++i) {
            amounts[i] = totalSupply * markets[i].bps / ProtocolConstants.BPS_DENOMINATOR;
            allocated += amounts[i];
        }
        amounts[len - 1] = totalSupply - allocated;
    }

    function _computePoolPlan(
        address token,
        Currency quote,
        uint256 tokenAmount,
        uint256 priceSupply,
        int24 spacing,
        IHooks hooks,
        uint24 fee
    ) internal view returns (PoolPlan memory plan) {
        if (tokenAmount == 0 || priceSupply == 0) revert InvalidSupply();

        bool tokenIsCurrency0 = uint160(token) < uint160(Currency.unwrap(quote));
        plan.tokenIsCurrency0 = tokenIsCurrency0;
        plan.quote = quote;
        plan.key = PoolKey({
            currency0: tokenIsCurrency0 ? Currency.wrap(token) : quote,
            currency1: tokenIsCurrency0 ? quote : Currency.wrap(token),
            fee: fee,
            tickSpacing: spacing,
            hooks: hooks
        });

        bool tokenIsCurrency1 = !tokenIsCurrency0;
        uint256 mcapQuote = _mcapQuote(quote);
        int24 startingTick =
            FixedPointMath.startingTickForMcap(priceSupply, mcapQuote, spacing, tokenIsCurrency1);

        if (tokenIsCurrency0) {
            int24 startAligned = FixedPointMath.alignTickUp(startingTick, spacing);
            plan.tickLower = startAligned;
            plan.tickUpper = TickMath.maxUsableTick(spacing);
            if (plan.tickUpper <= plan.tickLower) plan.tickLower = plan.tickUpper - spacing;
            uint160 lowerSqrt = TickMath.getSqrtPriceAtTick(plan.tickLower);
            plan.sqrtPriceX96 =
                lowerSqrt <= TickMath.MIN_SQRT_PRICE + 1 ? TickMath.MIN_SQRT_PRICE + 1 : lowerSqrt - 1;
            plan.liquidity = FixedPointMath.liquidityForAmount0(
                TickMath.getSqrtPriceAtTick(plan.tickLower),
                TickMath.getSqrtPriceAtTick(plan.tickUpper),
                tokenAmount
            );
        } else {
            int24 startAligned = FixedPointMath.alignTickDown(startingTick, spacing);
            plan.tickLower = TickMath.minUsableTick(spacing);
            plan.tickUpper = startAligned;
            if (plan.tickUpper <= plan.tickLower) plan.tickUpper = plan.tickLower + spacing;
            uint160 upperSqrt = TickMath.getSqrtPriceAtTick(plan.tickUpper);
            // Spot above the range so modifyLiquidity is token1-only (no quote dust required).
            if (upperSqrt >= TickMath.MAX_SQRT_PRICE - 2) {
                plan.sqrtPriceX96 = TickMath.MAX_SQRT_PRICE - 1;
            } else {
                plan.sqrtPriceX96 = upperSqrt + 1;
            }
            plan.liquidity = FixedPointMath.liquidityForAmount1(
                TickMath.getSqrtPriceAtTick(plan.tickLower),
                TickMath.getSqrtPriceAtTick(plan.tickUpper),
                tokenAmount
            );
        }
    }

    function _prepareMasterLaunch(PoolPlan memory plan, uint256 packed, address creator, address token) internal {
        masterHook.prepareLaunch(
            IMasterLaunchHook.PrepareParams({
                key: plan.key,
                bitmask: packed,
                creator: creator,
                token: token,
                tickLower: plan.tickLower,
                tickUpper: plan.tickUpper,
                tokenIsCurrency0: plan.tokenIsCurrency0
            })
        );
    }

    function _plansToArray(PoolPlan memory plan) internal pure returns (PoolPlan[] memory plans) {
        plans = new PoolPlan[](1);
        plans[0] = plan;
    }

    function _unlockPlans(PoolPlan[] memory plans) internal {
        PoolSeed[] memory seeds = new PoolSeed[](plans.length);
        for (uint256 i; i < plans.length; ++i) {
            PoolPlan memory plan = plans[i];
            seeds[i] = PoolSeed({
                key: plan.key,
                sqrtPriceX96: plan.sqrtPriceX96,
                tickLower: plan.tickLower,
                tickUpper: plan.tickUpper,
                liquidityDelta: int256(uint256(plan.liquidity))
            });
        }
        poolManager.unlock(abi.encode(seeds));
    }

    function _recordSingleLaunch(
        uint256 launchId,
        address token,
        address creator,
        IHooks hooks,
        bool useCustom,
        PoolPlan memory plan,
        uint256 packed,
        int24 spacing,
        uint24 fee,
        Currency quote
    ) internal {
        launches[launchId] = LaunchInfo({
            token: token,
            creator: creator,
            hooks: hooks,
            customHook: useCustom,
            poolId: plan.key.toId(),
            tickLower: plan.tickLower,
            tickUpper: plan.tickUpper,
            liquidity: plan.liquidity
        });
        tokenLaunchId[token] = launchId;
        launchBitmasks[launchId] = packed;
        launchedAt[launchId] = uint64(block.timestamp);
        launchQuote[launchId] = quote;
        launchTickSpacing[launchId] = spacing;
        launchFeeFlag[launchId] = fee;
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
