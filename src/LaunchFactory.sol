// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";

import {Owned} from "./base/Owned.sol";
import {MasterLaunchHook} from "./MasterLaunchHook.sol";
import {BitmaskConfig} from "./libraries/BitmaskConfig.sol";
import {FixedPointMath} from "./libraries/FixedPointMath.sol";
import {ProtocolConstants} from "./libraries/ProtocolConstants.sol";
import {QuotronBridge} from "./libraries/QuotronBridge.sol";
import {LaunchFactoryLib} from "./libraries/LaunchFactoryLib.sol";
import {LaunchDevBuyLib} from "./libraries/LaunchDevBuyLib.sol";
import {LaunchTokenDeployLib} from "./libraries/LaunchTokenDeployLib.sol";
import {IMasterLaunchHook} from "./interfaces/IMasterLaunchHook.sol";

/// @title LaunchFactory
/// @notice Permissionless factory: mint ERC-20, init v4 pool(s), and seed locked unilateral positions atomically.
contract LaunchFactory is Owned, IUnlockCallback {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using BitmaskConfig for uint256;

    bytes32 public constant LAUNCH_SALT = keccak256("HOOKIT.LAUNCH");

    IPoolManager public immutable poolManager;
    MasterLaunchHook public immutable masterHook;
    address public treasury;

    uint256 public launchFee = ProtocolConstants.LAUNCH_FEE_WEI;
    uint256 public launchCount;

    /// @notice ETH/USD price with 18 decimals — used to convert the fixed $5k FDV into ETH at launch.
    uint256 public ethUsdPriceX18 = ProtocolConstants.DEFAULT_LAUNCH_ETH_USD_X18;
    /// @notice On-chain ETH/USD feed (Redstone push on Ink); anyone may `syncEthUsdPrice`.
    address public ethUsdFeed;

    struct QuoteConfig {
        bool allowed;
        uint8 decimals;
        uint256 usdPriceX18;
        address usdFeed;
    }

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
        uint256 devBuyQuoteIn;
        uint256 minDevBuyTokensOut;
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
        uint256 devBuyQuoteIn;
        uint256 minDevBuyTokensOut;
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

    mapping(uint256 => LaunchInfo) public launches;
    mapping(address => uint256) public tokenLaunchId;
    mapping(uint256 => uint256) public launchBitmasks;
    mapping(uint256 => uint64) public launchedAt;
    mapping(uint256 => Currency) public launchQuote;
    mapping(uint256 => int24) public launchTickSpacing;
    mapping(uint256 => uint24) public launchFeeFlag;

    /// @notice ERC-20 quotes (USDG, Quotrons wStocks, …). Native ETH is always allowed.
    mapping(address => QuoteConfig) public quoteConfigs;

    /// @notice Non-zero when created via `launchMulti` (1–5 canonical markets).
    mapping(uint256 => uint8) public launchMarketCount;
    mapping(uint256 => mapping(uint256 => LaunchMarket)) public launchMarkets;
    mapping(PoolId => uint256) public poolLaunchId;
    mapping(PoolId => uint8) public poolMarketIndex;
    mapping(uint256 => uint8) public launchFloorQuoteIndex;

    /// @notice When true, only hooks in `allowedCustomHooks` may be used (Master always allowed).
    bool public customHookAllowlistEnabled;
    /// @notice When false, `launch` / `launchMulti` reject any non-Master hook (soft launch default).
    bool public customHooksEnabled;
    mapping(address => bool) public allowedCustomHooks;

    event LaunchFeeSet(uint256 fee);
    event TreasurySet(address indexed treasury);
    event EthUsdPriceSet(uint256 ethUsdPriceX18);
    event QuoteSet(address indexed token, bool allowed, uint8 decimals, uint256 usdPriceX18, address usdFeed);
    event CustomHookAllowlistEnabled(bool enabled);
    event CustomHooksEnabled(bool enabled);
    event CustomHookAllowed(address indexed hook, bool allowed);
    event LaunchConfigured(uint256 indexed launchId, uint256 bitmask, Currency quote, int24 tickSpacing, uint24 fee);
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
    event MultiLaunchConfigured(uint256 indexed launchId, uint8 marketCount, uint8 floorQuoteIndex, uint256 bitmask);
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

    event DevBuyExecuted(uint256 indexed launchId, address indexed buyer, uint256 quoteIn, uint256 tokensOut);

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
    error CustomHooksDisabled();
    error ModulesNotSupportedWithCustomHook();
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
        customHookAllowlistEnabled = true;
        customHooksEnabled = false;
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

    function setCustomHooksEnabled(bool enabled) external onlyOwner {
        customHooksEnabled = enabled;
        emit CustomHooksEnabled(enabled);
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

    /// @notice Target FDV in the quote's native wei ($5k at the configured USD price).
    function mcapQuoteFor(address token) public view returns (uint256) {
        return _mcapQuote(Currency.wrap(token));
    }

    /// @notice USD price (1e18) used for quote sizing — live Quotrons sqrtPrice for wStocks when available.
    function quoteUsdPriceX18(address token) public view returns (uint256) {
        if (token == address(0)) return ethUsdPriceX18;
        QuoteConfig memory q = quoteConfigs[token];
        if (!q.allowed) revert InvalidQuote();
        return LaunchFactoryLib.quoteUsdX18(poolManager, token, _libQuote(q));
    }

    /// @notice Pull ETH/USD from the configured on-chain feed into `ethUsdPriceX18`.
    function syncEthUsdPrice() public {
        if (ethUsdFeed == address(0)) revert InvalidFeed();
        ethUsdPriceX18 = LaunchFactoryLib.usdFromFeed(ethUsdFeed, ProtocolConstants.ORACLE_MAX_AGE);
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
        uint256 usd = LaunchFactoryLib.quoteUsdX18(poolManager, token, _libQuote(q));
        return LaunchFactoryLib.mcapQuoteWei(ProtocolConstants.TARGET_LAUNCH_MCAP_USD_X18, usd, q.decimals);
    }

    function _setQuote(address token, bool allowed, uint8 decimals, uint256 usdPriceX18, address usdFeed) private {
        if (token == address(0)) revert InvalidQuote();
        if (allowed && (decimals == 0 || decimals > 18)) revert InvalidQuote();
        bool needsPrice = usdFeed == address(0) && usdPriceX18 == 0 && !QuotronBridge.isQuotronStock(token);
        if (allowed && needsPrice) revert InvalidQuote();
        quoteConfigs[token] =
            QuoteConfig({allowed: allowed, decimals: decimals, usdPriceX18: usdPriceX18, usdFeed: usdFeed});
        emit QuoteSet(token, allowed, decimals, usdPriceX18, usdFeed);
    }

    function _libQuote(QuoteConfig memory q) private pure returns (LaunchFactoryLib.QuoteConfig memory) {
        return LaunchFactoryLib.QuoteConfig({
            allowed: q.allowed, decimals: q.decimals, usdPriceX18: q.usdPriceX18, usdFeed: q.usdFeed
        });
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

        return LaunchFactoryLib.buildPoolKey(
            info.token, quote, launchFeeFlag[launchId], launchTickSpacing[launchId], info.hooks
        );
    }

    /// @notice Create a token, initialize its Uniswap v4 pool, and lock 100% of supply as a unilateral position.
    function launch(LaunchParams calldata params)
        external
        payable
        returns (uint256 launchId, address token, PoolId poolId)
    {
        if (params.totalSupply == 0) revert InvalidSupply();
        int24 spacing = params.tickSpacing == 0 ? ProtocolConstants.DEFAULT_TICK_SPACING : params.tickSpacing;
        if (spacing <= 0) revert InvalidTickSpacing();

        _collectLaunchFee(params.quote.isAddressZero(), params.devBuyQuoteIn);

        token = LaunchTokenDeployLib.deploy(
            address(this),
            params.name,
            params.symbol,
            params.totalSupply,
            msg.sender,
            params.metadataURI,
            params.bitmask,
            masterHook,
            launchCount
        );

        (IHooks hooks, bool useCustom, uint256 packed, uint24 fee) =
            _resolveLaunchConfig(params.customHook, params.bitmask);

        LaunchFactoryLib.PoolPlan memory plan = LaunchFactoryLib.computePoolPlan(
            token, params.quote, params.totalSupply, params.totalSupply, spacing, hooks, fee, _mcapQuote(params.quote)
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

        _devBuyAfterLaunch(
            launchId, plan.key, token, params.quote, params.totalSupply, params.devBuyQuoteIn, params.minDevBuyTokensOut
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

        (bool hasNative,) = LaunchFactoryLib.validateMarkets(_libMarkets(params.markets));
        for (uint256 i; i < marketLen; ++i) {
            _assertQuoteAllowed(params.markets[i].quote);
        }

        (IHooks hooks, bool useCustom, uint256 packed, uint24 fee) =
            _resolveLaunchConfig(params.customHook, params.bitmask);
        if ((packed & BitmaskConfig.BACKED_FLOOR_ENABLED) != 0) revert FloorNotSupportedInMulti();

        LaunchFactoryLib.collectLaunchFee(treasury, launchFee, hasNative, params.devBuyQuoteIn, msg.value, msg.sender);

        token = LaunchTokenDeployLib.deploy(
            address(this),
            params.name,
            params.symbol,
            params.totalSupply,
            msg.sender,
            params.metadataURI,
            params.bitmask,
            masterHook,
            launchCount
        );

        LaunchFactoryLib.MarketInput[] memory libMarkets = _libMarkets(params.markets);
        uint256[] memory tokenAmounts = LaunchFactoryLib.splitSupply(params.totalSupply, libMarkets);
        uint256[] memory mcapQuotes = new uint256[](marketLen);
        for (uint256 i; i < marketLen; ++i) {
            mcapQuotes[i] = _mcapQuote(params.markets[i].quote);
        }

        LaunchFactoryLib.PoolPlan[] memory plans = LaunchFactoryLib.computeMultiPlans(
            token, libMarkets, tokenAmounts, params.totalSupply, spacing, hooks, fee, mcapQuotes
        );

        if (!useCustom) {
            for (uint256 i; i < marketLen; ++i) {
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
            LaunchFactoryLib.PoolPlan memory plan = plans[i];
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

        _devBuyAfterLaunch(
            launchId,
            plans[0].key,
            token,
            params.markets[0].quote,
            params.totalSupply,
            params.devBuyQuoteIn,
            params.minDevBuyTokensOut
        );
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        uint8 kind = abi.decode(data, (uint8));
        if (kind == 1) {
            (, LaunchDevBuyLib.SwapCall memory call) = abi.decode(data, (uint8, LaunchDevBuyLib.SwapCall));
            return LaunchDevBuyLib.handleUnlockSwap(poolManager, call);
        }
        (, LaunchFactoryLib.PoolSeed[] memory seeds) = abi.decode(data, (uint8, LaunchFactoryLib.PoolSeed[]));
        LaunchFactoryLib.executeUnlockSeeds(poolManager, LAUNCH_SALT, seeds, address(this));
        return "";
    }

    function _collectLaunchFee(bool needsNativeDust, uint256 devBuyQuoteIn) internal {
        LaunchFactoryLib.collectLaunchFee(treasury, launchFee, needsNativeDust, devBuyQuoteIn, msg.value, msg.sender);
    }

    function _devBuyAfterLaunch(
        uint256 launchId,
        PoolKey memory key,
        address token,
        Currency quote,
        uint256 totalSupply,
        uint256 devBuyQuoteIn,
        uint256 minTokensOut
    ) internal {
        uint256 tokensOut = LaunchDevBuyLib.runDevBuy(
            poolManager,
            address(this),
            msg.sender,
            key,
            token,
            quote,
            totalSupply,
            devBuyQuoteIn,
            minTokensOut,
            _mcapQuote(quote)
        );
        if (devBuyQuoteIn > 0) emit DevBuyExecuted(launchId, msg.sender, devBuyQuoteIn, tokensOut);
    }

    function _resolveLaunchConfig(IHooks customHook, uint256 bitmask)
        internal
        view
        returns (IHooks hooks, bool useCustom, uint256 packed, uint24 fee)
    {
        useCustom = address(customHook) != address(0) && address(customHook) != address(masterHook);
        if (useCustom && !customHooksEnabled) revert CustomHooksDisabled();
        if (useCustom && bitmask != 0) revert ModulesNotSupportedWithCustomHook();
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

    function _libMarkets(MarketInput[] calldata markets)
        private
        pure
        returns (LaunchFactoryLib.MarketInput[] memory libMarkets)
    {
        uint256 len = markets.length;
        libMarkets = new LaunchFactoryLib.MarketInput[](len);
        for (uint256 i; i < len; ++i) {
            libMarkets[i] = LaunchFactoryLib.MarketInput({quote: markets[i].quote, bps: markets[i].bps});
        }
    }

    function _prepareMasterLaunch(LaunchFactoryLib.PoolPlan memory plan, uint256 packed, address creator, address token)
        internal
    {
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

    function _plansToArray(LaunchFactoryLib.PoolPlan memory plan)
        internal
        pure
        returns (LaunchFactoryLib.PoolPlan[] memory plans)
    {
        plans = new LaunchFactoryLib.PoolPlan[](1);
        plans[0] = plan;
    }

    function _unlockPlans(LaunchFactoryLib.PoolPlan[] memory plans) internal {
        poolManager.unlock(abi.encode(uint8(0), LaunchFactoryLib.poolPlansToSeeds(plans)));
    }

    function _recordSingleLaunch(
        uint256 launchId,
        address token,
        address creator,
        IHooks hooks,
        bool useCustom,
        LaunchFactoryLib.PoolPlan memory plan,
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
}
