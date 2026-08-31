// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";

import {Owned} from "./base/Owned.sol";
import {LaunchToken} from "./LaunchToken.sol";
import {GraduatedFeeHook} from "./GraduatedFeeHook.sol";
import {LiquidityLocker} from "./LiquidityLocker.sol";
import {FeeEscrow} from "./FeeEscrow.sol";
import {ProtocolRevenueDistributor} from "./ProtocolRevenueDistributor.sol";
import {BondingConstants} from "./libraries/BondingConstants.sol";
import {BondingMath} from "./libraries/BondingMath.sol";
import {TokenAddressMiner} from "./libraries/TokenAddressMiner.sol";
import {ProtocolConstants} from "./libraries/ProtocolConstants.sol";
import {FixedPointMath} from "./libraries/FixedPointMath.sol";
import {QuotronBridge} from "./libraries/QuotronBridge.sol";

interface IAggregatorV3 {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @title BondingLaunchFactory
/// @notice Classic rail: bonding curve → graduate to a fee=0 Uniswap v4 pool + GraduatedFeeHook.
/// @dev Graduation is always 4.2 ETH (or USD-equivalent in USDG / wStock). Steady fees = base 1% +
///      optional creator tax, hard-capped at 10% total (same economics as MasterLaunchHook).
contract BondingLaunchFactory is Owned {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    enum Phase {
        Bonding,
        Graduated
    }

    struct LaunchParams {
        string name;
        string symbol;
        string metadataURI;
        uint256 totalSupply; // 0 → BondingConstants.TOTAL_SUPPLY
        Currency quote; // address(0) = ETH; else must be an allowed quote (USDG / wStock)
        uint16 creatorTaxBps; // deprecated — must be 0 (Classic is base 1% only)
        /// @dev Optional quote spent on the first curve buy, atomically with launch (0 = skip).
        uint256 devBuyQuoteIn;
        /// @dev Slippage guard for the bundled dev buy.
        uint256 minDevBuyTokensOut;
    }

    struct Launch {
        address token;
        address creator;
        address quote;
        Phase phase;
        uint16 creatorTaxBps;
        uint256 totalSupply;
        uint256 curveSupply;
        uint256 tokensSold;
        uint256 realQuote;
        uint256 virtualQuote;
        uint256 virtualToken;
        uint256 graduationQuote;
        PoolId poolId;
        uint64 launchedAt;
        uint64 graduatedAt;
    }

    struct QuoteConfig {
        bool allowed;
        uint8 decimals;
        uint256 usdPriceX18;
        address usdFeed;
    }

    IPoolManager public immutable poolManager;
    GraduatedFeeHook public immutable feeHook;
    LiquidityLocker public immutable locker;
    FeeEscrow public immutable escrow;
    ProtocolRevenueDistributor public immutable distributor;
    address public treasury;

    uint256 public launchFee = ProtocolConstants.LAUNCH_FEE_WEI;
    uint256 public launchCount;
    uint256 public ethUsdPriceX18 = ProtocolConstants.DEFAULT_LAUNCH_ETH_USD_X18;
    address public ethUsdFeed;

    mapping(uint256 => Launch) public launches;
    mapping(address => uint256) public tokenLaunchId;
    mapping(address => QuoteConfig) public quoteConfigs;

    event TokenLaunched(
        uint256 indexed launchId, address indexed token, address indexed creator, address quote, uint256 graduationQuote
    );
    event Bought(uint256 indexed launchId, address indexed buyer, uint256 quoteIn, uint256 tokensOut, uint256 feeQuote);
    event Sold(uint256 indexed launchId, address indexed seller, uint256 tokensIn, uint256 quoteOut, uint256 feeQuote);
    event Graduated(
        uint256 indexed launchId, PoolId indexed poolId, uint256 quoteLp, uint256 tokenLp, uint128 liquidity
    );
    event QuoteSet(address indexed token, bool allowed, uint8 decimals, uint256 usdPriceX18, address usdFeed);
    event EthUsdPriceSet(uint256 priceX18, address feed);

    error LaunchFeeRequired();
    error InvalidSupply();
    error CreatorTaxTooHigh();
    error TotalFeeTooHigh();
    error NotBonding();
    error AlreadyGraduated();
    error NotReadyToGraduate();
    error ZeroAmount();
    error TransferFailed();
    error InsufficientOutput();
    error CurveSoldOut();
    error InvalidQuote();
    error StalePrice();
    error NativeMismatch();
    error DevBuyTooLarge();
    error DevBuyQuoteTooHigh();

    constructor(
        IPoolManager manager_,
        GraduatedFeeHook feeHook_,
        FeeEscrow escrow_,
        ProtocolRevenueDistributor distributor_,
        address owner_,
        address treasury_
    ) Owned(owner_) {
        poolManager = manager_;
        feeHook = feeHook_;
        escrow = escrow_;
        distributor = distributor_;
        treasury = treasury_;
        locker = new LiquidityLocker(manager_, address(this));
    }

    receive() external payable {}

    function setLaunchFee(uint256 fee) external onlyOwner {
        launchFee = fee;
    }

    function setTreasury(address treasury_) external onlyOwner {
        treasury = treasury_;
    }

    function setEthUsdPrice(uint256 priceX18, address feed) external onlyOwner {
        if (feed == address(0) && priceX18 == 0) revert InvalidQuote();
        ethUsdPriceX18 = priceX18;
        ethUsdFeed = feed;
        emit EthUsdPriceSet(priceX18, feed);
    }

    function setQuote(address token, bool allowed, uint8 decimals, uint256 usdPriceX18, address usdFeed)
        external
        onlyOwner
    {
        if (token == address(0)) revert InvalidQuote();
        if (allowed && (decimals == 0 || decimals > 18)) revert InvalidQuote();
        bool needsPrice = usdFeed == address(0) && usdPriceX18 == 0 && !QuotronBridge.isQuotronStock(token);
        if (allowed && needsPrice) revert InvalidQuote();
        quoteConfigs[token] =
            QuoteConfig({allowed: allowed, decimals: decimals, usdPriceX18: usdPriceX18, usdFeed: usdFeed});
        emit QuoteSet(token, allowed, decimals, usdPriceX18, usdFeed);
    }

    function syncEthUsdPrice() external {
        if (ethUsdFeed == address(0)) revert InvalidQuote();
        ethUsdPriceX18 = _usdFromFeed(ethUsdFeed, ProtocolConstants.ORACLE_MAX_AGE);
        emit EthUsdPriceSet(ethUsdPriceX18, ethUsdFeed);
    }

    /// @notice USD price (1e18) used for quote sizing — live Quotrons sqrtPrice for wStocks when available.
    function quoteUsdPriceX18(address token) public view returns (uint256) {
        if (token == address(0)) return ethUsdPriceX18;
        QuoteConfig memory q = quoteConfigs[token];
        if (!q.allowed) revert InvalidQuote();
        return _quoteUsdX18(token, q);
    }

    /// @notice Graduation target in quote wei: 4.2 ETH, or the USD-equivalent for USDG / wStock.
    function graduationQuoteWei(Currency quote) public view returns (uint256) {
        address token = Currency.unwrap(quote);
        if (token == address(0)) return ProtocolConstants.GRADUATION_ETH_WEI;

        QuoteConfig memory q = quoteConfigs[token];
        if (!q.allowed) revert InvalidQuote();
        uint256 ethUsd = ethUsdFeed != address(0)
            ? _usdFromFeed(ethUsdFeed, ProtocolConstants.ORACLE_MAX_AGE)
            : ethUsdPriceX18;
        uint256 quoteUsd = _quoteUsdX18(token, q);
        if (ethUsd == 0 || quoteUsd == 0) revert InvalidQuote();

        // graduationUsd = 4.2 * ethUsd ; then convert to quote native decimals.
        uint256 graduationUsdX18 = FullMath.mulDiv(ProtocolConstants.GRADUATION_ETH_WEI, ethUsd, 1 ether);
        return FixedPointMath.mcapQuoteWei(graduationUsdX18, quoteUsd, q.decimals);
    }

    /// @dev Quotrons wStocks: live pool sqrtPrice (USDG≈$1). Else Chainlink feed, else stored snapshot.
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

    function launch(LaunchParams calldata params) external payable returns (uint256 launchId, address token) {
        uint256 devBuy = params.devBuyQuoteIn;
        bool nativeQuote = params.quote.isAddressZero();
        uint256 requiredNative = launchFee + (nativeQuote ? devBuy : 0);
        if (msg.value < requiredNative) revert LaunchFeeRequired();
        if (launchFee > 0) CurrencyLibrary.ADDRESS_ZERO.transfer(treasury, launchFee);
        uint256 extra = msg.value - requiredNative;
        if (extra > 0) {
            if (!nativeQuote) revert NativeMismatch();
            CurrencyLibrary.ADDRESS_ZERO.transfer(msg.sender, extra);
        }

        _validateFees(params.creatorTaxBps);
        _assertQuoteAllowed(params.quote);

        uint256 supply = params.totalSupply == 0 ? BondingConstants.TOTAL_SUPPLY : params.totalSupply;
        if (supply == 0) revert InvalidSupply();
        uint256 onCurve = BondingMath.curveSupply(supply);
        if (onCurve == 0 || onCurve >= supply) revert InvalidSupply();

        uint256 graduationQuote = graduationQuoteWei(params.quote);
        uint256 virtualQuote = FullMath.mulDiv(
            graduationQuote, BondingConstants.VIRTUAL_QUOTE_START_ETH, ProtocolConstants.GRADUATION_ETH_WEI
        );
        if (virtualQuote == 0) virtualQuote = 1;

        if (devBuy > 0) {
            _validateDevBuyQuote(devBuy, virtualQuote, onCurve, supply);
            if (!nativeQuote) {
                if (!IERC20Minimal(Currency.unwrap(params.quote)).transferFrom(msg.sender, address(this), devBuy)) {
                    revert TransferFailed();
                }
            }
        }

        token = TokenAddressMiner.deploy(
            address(this),
            abi.encodePacked(
                type(LaunchToken).creationCode,
                abi.encode(params.name, params.symbol, supply, msg.sender, address(this), params.metadataURI)
            ),
            keccak256(abi.encodePacked(params.name, params.symbol, msg.sender, supply, params.metadataURI, launchCount))
        );

        launchId = ++launchCount;
        launches[launchId] = Launch({
            token: token,
            creator: msg.sender,
            quote: Currency.unwrap(params.quote),
            phase: Phase.Bonding,
            creatorTaxBps: params.creatorTaxBps,
            totalSupply: supply,
            curveSupply: onCurve,
            tokensSold: 0,
            realQuote: 0,
            virtualQuote: virtualQuote,
            virtualToken: onCurve,
            graduationQuote: graduationQuote,
            poolId: PoolId.wrap(bytes32(0)),
            launchedAt: uint64(block.timestamp),
            graduatedAt: 0
        });
        tokenLaunchId[token] = launchId;

        emit TokenLaunched(launchId, token, msg.sender, Currency.unwrap(params.quote), graduationQuote);

        if (devBuy > 0) {
            _executeBuy(launchId, msg.sender, devBuy, params.minDevBuyTokensOut, nativeQuote);
        }
    }

    /// @notice Buy on the curve. Pay ETH via `msg.value` when quote is native; else `quoteIn` ERC-20.
    /// @dev Last buy may partially fill remaining curve supply and refund unused quote.
    function buy(uint256 launchId, uint256 quoteIn, uint256 minTokensOut)
        external
        payable
        returns (uint256 tokensOut, uint256 feeQuote)
    {
        return _executeBuy(launchId, msg.sender, quoteIn, minTokensOut, false);
    }

    function _executeBuy(
        uint256 launchId,
        address buyer,
        uint256 quoteIn,
        uint256 minTokensOut,
        bool devBuyFromLaunch
    ) private returns (uint256 tokensOut, uint256 feeQuote) {
        Launch storage l = launches[launchId];
        if (l.phase != Phase.Bonding) revert NotBonding();
        if (l.tokensSold >= l.curveSupply) revert CurveSoldOut();

        uint256 paid = devBuyFromLaunch && l.quote == address(0)
            ? quoteIn
            : _pullQuote(l.quote, quoteIn);
        if (paid == 0) revert ZeroAmount();

        uint256 maxDevTokens = FixedPointMath.applyBps(l.totalSupply, ProtocolConstants.MAX_DEV_BUY_BPS);
        uint256 available = l.curveSupply - l.tokensSold;
        uint256 totalBps = uint256(ProtocolConstants.BASE_FEE_BPS);
        uint256 quoteForCurve = paid - FixedPointMath.applyBps(paid, totalBps);

        (tokensOut,,) = BondingMath.buyQuoteIn(l.virtualQuote, l.virtualToken, quoteForCurve);

        uint256 refundGross;
        if (tokensOut > available) {
            uint256 quoteNeeded;
            (quoteNeeded, l.virtualQuote, l.virtualToken) =
                BondingMath.quoteInForTokensOut(l.virtualQuote, l.virtualToken, available);
            tokensOut = available;
            uint256 grossNeeded = totalBps >= ProtocolConstants.BPS_DENOMINATOR
                ? quoteNeeded
                : (quoteNeeded * ProtocolConstants.BPS_DENOMINATOR + (ProtocolConstants.BPS_DENOMINATOR - totalBps - 1))
                    / (ProtocolConstants.BPS_DENOMINATOR - totalBps);
            if (grossNeeded > paid) grossNeeded = paid;
            refundGross = paid - grossNeeded;
            paid = grossNeeded;
            quoteForCurve = quoteNeeded;
            (feeQuote,) = _splitFee(paid);
        } else {
            (feeQuote, quoteForCurve) = _splitFee(paid);
            (, l.virtualQuote, l.virtualToken) =
                BondingMath.buyQuoteIn(l.virtualQuote, l.virtualToken, quoteForCurve);
        }

        if (devBuyFromLaunch && tokensOut > maxDevTokens) revert DevBuyTooLarge();
        if (tokensOut < minTokensOut) revert InsufficientOutput();

        _payFees(l.creator, l.quote, feeQuote);

        l.tokensSold += tokensOut;
        l.realQuote += quoteForCurve;

        if (!IERC20Minimal(l.token).transfer(buyer, tokensOut)) revert TransferFailed();
        if (refundGross > 0) _pushQuote(l.quote, buyer, refundGross);

        emit Bought(launchId, buyer, quoteForCurve, tokensOut, feeQuote);

        if (l.realQuote >= l.graduationQuote || l.tokensSold >= l.curveSupply) _graduate(launchId);
    }

    function sell(uint256 launchId, uint256 tokensIn, uint256 minQuoteOut)
        external
        returns (uint256 quoteOut, uint256 feeQuote)
    {
        Launch storage l = launches[launchId];
        if (l.phase != Phase.Bonding) revert NotBonding();
        if (tokensIn == 0) revert ZeroAmount();

        if (!IERC20Minimal(l.token).transferFrom(msg.sender, address(this), tokensIn)) revert TransferFailed();

        (quoteOut, l.virtualQuote, l.virtualToken) =
            BondingMath.sellTokenIn(l.virtualQuote, l.virtualToken, tokensIn);
        if (quoteOut > l.realQuote) quoteOut = l.realQuote;

        l.tokensSold -= tokensIn;
        l.realQuote -= quoteOut;

        uint256 netOut;
        (feeQuote, netOut) = _splitFee(quoteOut);
        if (netOut < minQuoteOut) revert InsufficientOutput();
        _payFees(l.creator, l.quote, feeQuote);
        _pushQuote(l.quote, msg.sender, netOut);

        emit Sold(launchId, msg.sender, tokensIn, netOut, feeQuote);
    }

    function graduate(uint256 launchId) external {
        Launch storage l = launches[launchId];
        if (l.phase != Phase.Bonding) revert AlreadyGraduated();
        if (l.realQuote < l.graduationQuote) revert NotReadyToGraduate();
        _graduate(launchId);
    }

    function poolKeyOf(uint256 launchId) public view returns (PoolKey memory key) {
        Launch storage l = launches[launchId];
        bool tokenIs0 = uint160(l.token) < uint160(l.quote);
        key = PoolKey({
            currency0: tokenIs0 ? Currency.wrap(l.token) : Currency.wrap(l.quote),
            currency1: tokenIs0 ? Currency.wrap(l.quote) : Currency.wrap(l.token),
            fee: BondingConstants.POOL_FEE,
            tickSpacing: BondingConstants.TICK_SPACING,
            hooks: IHooks(address(feeHook))
        });
    }

    function _graduate(uint256 launchId) private {
        Launch storage l = launches[launchId];
        if (l.phase != Phase.Bonding) return;

        uint256 quoteLp = l.realQuote;
        uint256 tokenLp = l.totalSupply - l.tokensSold;
        if (quoteLp == 0 || tokenLp == 0) revert NotReadyToGraduate();

        address token = l.token;
        address quote = l.quote;
        bool tokenIs0 = uint160(token) < uint160(quote);
        PoolKey memory key = poolKeyOf(launchId);

        feeHook.registerLaunch(key, token, quote, l.creator, tokenIs0);

        uint256 amount0 = tokenIs0 ? tokenLp : quoteLp;
        uint256 amount1 = tokenIs0 ? quoteLp : tokenLp;
        uint160 sqrtPriceX96 = BondingMath.sqrtPriceFromReserves(amount0, amount1);
        if (sqrtPriceX96 <= TickMath.MIN_SQRT_PRICE) sqrtPriceX96 = TickMath.MIN_SQRT_PRICE + 1;
        if (sqrtPriceX96 >= TickMath.MAX_SQRT_PRICE) sqrtPriceX96 = TickMath.MAX_SQRT_PRICE - 1;

        (uint128 liquidity, int24 tickLower, int24 tickUpper) =
            BondingMath.liquidityFullRange(sqrtPriceX96, BondingConstants.TICK_SPACING, amount0, amount1);

        IERC20Minimal(token).approve(address(locker), tokenLp);
        if (quote != address(0)) IERC20Minimal(quote).approve(address(locker), quoteLp);

        uint256 ethValue = quote == address(0) ? quoteLp : 0;
        locker.seed{value: ethValue}(
            key, sqrtPriceX96, tickLower, tickUpper, liquidity, quote, quoteLp, token, tokenLp
        );

        l.phase = Phase.Graduated;
        l.poolId = key.toId();
        l.graduatedAt = uint64(block.timestamp);
        l.realQuote = 0;

        emit Graduated(launchId, l.poolId, quoteLp, tokenLp, liquidity);
    }

    function _validateFees(uint16 creatorTaxBps) private pure {
        // Classic rail: base 1% only. Extra creator tax removed (use Master hook tax instead).
        if (creatorTaxBps != 0) revert CreatorTaxTooHigh();
    }

    function _validateDevBuyQuote(uint256 devBuy, uint256 virtualQuote, uint256 virtualToken, uint256 supply)
        private
        pure
    {
        uint256 maxTokens = FixedPointMath.applyBps(supply, ProtocolConstants.MAX_DEV_BUY_BPS);
        if (maxTokens == 0) revert DevBuyQuoteTooHigh();
        uint256 maxNet;
        (maxNet,,) = BondingMath.quoteInForTokensOut(virtualQuote, virtualToken, maxTokens);
        uint256 totalBps = uint256(ProtocolConstants.BASE_FEE_BPS);
        uint256 maxGross = totalBps >= ProtocolConstants.BPS_DENOMINATOR
            ? maxNet
            : (maxNet * ProtocolConstants.BPS_DENOMINATOR + (ProtocolConstants.BPS_DENOMINATOR - totalBps - 1))
                / (ProtocolConstants.BPS_DENOMINATOR - totalBps);
        if (devBuy > maxGross) revert DevBuyQuoteTooHigh();
    }

    function _assertQuoteAllowed(Currency quote) private view {
        address token = Currency.unwrap(quote);
        if (token == address(0)) return;
        if (!quoteConfigs[token].allowed) revert InvalidQuote();
    }

    function _pullQuote(address quote, uint256 quoteIn) private returns (uint256 paid) {
        if (quote == address(0)) {
            if (msg.value == 0) revert ZeroAmount();
            if (quoteIn != 0 && quoteIn != msg.value) revert NativeMismatch();
            return msg.value;
        }
        if (msg.value != 0) revert NativeMismatch();
        if (quoteIn == 0) revert ZeroAmount();
        if (!IERC20Minimal(quote).transferFrom(msg.sender, address(this), quoteIn)) revert TransferFailed();
        return quoteIn;
    }

    function _pushQuote(address quote, address to, uint256 amount) private {
        if (amount == 0) return;
        if (quote == address(0)) {
            CurrencyLibrary.ADDRESS_ZERO.transfer(to, amount);
        } else if (!IERC20Minimal(quote).transfer(to, amount)) {
            revert TransferFailed();
        }
    }

    function _splitFee(uint256 amount) private pure returns (uint256 feeQuote, uint256 netAmount) {
        feeQuote = FixedPointMath.applyBps(amount, ProtocolConstants.BASE_FEE_BPS);
        netAmount = amount - feeQuote;
    }

    function _payFees(address creator, address quote, uint256 feeQuote) private {
        if (feeQuote == 0) return;
        uint256 creatorShare = FixedPointMath.applyBps(feeQuote, ProtocolConstants.CREATOR_SHARE_BPS);
        uint256 protocolAmt = feeQuote - creatorShare;
        Currency c = Currency.wrap(quote);

        if (quote == address(0)) {
            if (creatorShare > 0) escrow.credit{value: creatorShare}(creator, c, creatorShare);
            if (protocolAmt > 0) distributor.notify{value: protocolAmt}(c, protocolAmt);
        } else {
            if (creatorShare > 0) {
                if (!IERC20Minimal(quote).transfer(address(escrow), creatorShare)) revert TransferFailed();
                escrow.creditInternal(creator, c, creatorShare);
            }
            if (protocolAmt > 0) {
                if (!IERC20Minimal(quote).transfer(address(distributor), protocolAmt)) revert TransferFailed();
                distributor.notifyInternal(c, protocolAmt);
            }
        }
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
}
