// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TransientStateLibrary} from "@uniswap/v4-core/src/libraries/TransientStateLibrary.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";

import {Owned} from "./base/Owned.sol";
import {LaunchFactory} from "./LaunchFactory.sol";
import {IMasterLaunchHook} from "./interfaces/IMasterLaunchHook.sol";
import {FixedPointMath} from "./libraries/FixedPointMath.sol";
import {CurrencySettler} from "./libraries/CurrencySettler.sol";
import {ProtocolConstants} from "./libraries/ProtocolConstants.sol";

interface IERC20Supply {
    function totalSupply() external view returns (uint256);
}

/// @title MultiPairArbExecutor
/// @notice Buys the launch token on the cheapest USD leg and sells on the richest, in one unlock.
/// @dev Deployed paused with `maxClipUsdX18 = 0`. Does nothing until the owner unpauses, sets a clip,
///      points MasterLaunchHook.arbExecutor here, and flips `arbActive`. Live Ink hooks cannot be
///      upgraded in place — this path is for the next factory/hook deploy.
contract MultiPairArbExecutor is Owned, IUnlockCallback {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using CurrencySettler for Currency;
    using StateLibrary for IPoolManager;
    using TransientStateLibrary for IPoolManager;

    uint16 public constant DEFAULT_MIN_DEVIATION_BPS = 1_000;
    /// @dev Never clip more than 0.50% of supply at the cheap-leg spot (keeps the 1% quote fee inside the swap).
    uint16 public constant MAX_CLIP_SUPPLY_BPS = 50;

    IPoolManager public immutable poolManager;
    LaunchFactory public immutable factory;
    IMasterLaunchHook public immutable hook;

    bool public paused = true;
    uint256 public maxClipUsdX18;
    uint16 public minDeviationBps = DEFAULT_MIN_DEVIATION_BPS;
    mapping(address => bool) public operators;

    struct Preview {
        uint8 marketCount;
        uint8 cheapIndex;
        uint8 richIndex;
        uint256 cheapUsdX18;
        uint256 richUsdX18;
        uint256 deviationBps;
        uint256 clipQuoteWei;
        bool executable;
    }

    struct UnlockData {
        uint256 launchId;
        uint8 cheapIndex;
        uint8 richIndex;
        PoolKey cheapKey;
        PoolKey richKey;
        bool cheapTokenIs0;
        bool richTokenIs0;
        Currency token;
        uint256 clipQuoteWei;
    }

    event OperatorSet(address indexed operator, bool allowed);
    event PausedSet(bool paused);
    event MaxClipUsdSet(uint256 maxClipUsdX18);
    event MinDeviationBpsSet(uint16 bps);
    event ArbExecuted(
        uint256 indexed launchId,
        uint8 cheapIndex,
        uint8 richIndex,
        uint256 clipQuoteWei,
        uint256 tokenSold,
        uint256 quoteOut
    );

    error NotPoolManager();
    error ZeroAddress();
    error Paused();
    error ClipZero();
    error ArbInactive();
    error NotArbExecutor();
    error NotMultiPair();
    error DeviationTooSmall();
    error NoInventory();
    error InvalidDeviation();

    modifier onlyKeeper() {
        if (msg.sender != owner && !operators[msg.sender]) revert Unauthorized();
        _;
    }

    constructor(IPoolManager manager_, LaunchFactory factory_, IMasterLaunchHook hook_, address owner_) Owned(owner_) {
        if (address(manager_) == address(0) || address(factory_) == address(0) || address(hook_) == address(0)) {
            revert ZeroAddress();
        }
        poolManager = manager_;
        factory = factory_;
        hook = hook_;
    }

    receive() external payable {}

    function setOperator(address operator, bool allowed) external onlyOwner {
        operators[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PausedSet(paused_);
    }

    function setMaxClipUsdX18(uint256 maxClipUsdX18_) external onlyOwner {
        maxClipUsdX18 = maxClipUsdX18_;
        emit MaxClipUsdSet(maxClipUsdX18_);
    }

    function setMinDeviationBps(uint16 bps) external onlyOwner {
        if (bps == 0 || bps > ProtocolConstants.BPS_DENOMINATOR) revert InvalidDeviation();
        minDeviationBps = bps;
        emit MinDeviationBpsSet(bps);
    }

    function withdraw(Currency currency, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        currency.transfer(to, amount);
    }

    /// @notice Quote USD prices per whole token on each market and the clip that `execute` would use.
    function preview(uint256 launchId) public view returns (Preview memory p) {
        p.marketCount = factory.launchMarketCount(launchId);
        if (p.marketCount < 2) return p;

        uint256 cheapUsd = type(uint256).max;
        uint256 richUsd;
        for (uint256 i; i < p.marketCount; ++i) {
            PoolKey memory key = factory.poolKeyOfMarket(launchId, i);
            uint256 usd = _tokenUsdX18(key);
            if (usd == 0) continue;
            if (usd < cheapUsd) {
                cheapUsd = usd;
                p.cheapIndex = uint8(i);
                p.cheapUsdX18 = usd;
            }
            if (usd >= richUsd) {
                richUsd = usd;
                p.richIndex = uint8(i);
                p.richUsdX18 = usd;
            }
        }

        if (p.cheapUsdX18 == 0 || p.cheapIndex == p.richIndex) return p;
        p.deviationBps = (p.richUsdX18 - p.cheapUsdX18) * ProtocolConstants.BPS_DENOMINATOR / p.cheapUsdX18;

        PoolKey memory cheapKey = factory.poolKeyOfMarket(launchId, p.cheapIndex);
        IMasterLaunchHook.LaunchState memory st = hook.launchState(cheapKey.toId());
        p.clipQuoteWei = _clipQuoteWei(cheapKey, st);

        p.executable = !paused && maxClipUsdX18 != 0 && hook.arbActive() && hook.arbExecutor() == address(this)
            && p.deviationBps >= minDeviationBps && p.clipQuoteWei != 0;
    }

    function execute(uint256 launchId)
        external
        onlyKeeper
        returns (uint256 clipQuoteWei, uint256 tokenSold, uint256 quoteOut)
    {
        if (paused) revert Paused();
        if (maxClipUsdX18 == 0) revert ClipZero();
        if (!hook.arbActive()) revert ArbInactive();
        if (hook.arbExecutor() != address(this)) revert NotArbExecutor();

        Preview memory p = preview(launchId);
        if (p.marketCount < 2) revert NotMultiPair();
        if (p.cheapUsdX18 == 0 || p.cheapIndex == p.richIndex || p.deviationBps < minDeviationBps) {
            revert DeviationTooSmall();
        }
        if (p.clipQuoteWei == 0) revert NoInventory();

        PoolKey memory cheapKey = factory.poolKeyOfMarket(launchId, p.cheapIndex);
        PoolKey memory richKey = factory.poolKeyOfMarket(launchId, p.richIndex);
        IMasterLaunchHook.LaunchState memory cheapSt = hook.launchState(cheapKey.toId());
        IMasterLaunchHook.LaunchState memory richSt = hook.launchState(richKey.toId());

        bytes memory result = poolManager.unlock(
            abi.encode(
                UnlockData({
                    launchId: launchId,
                    cheapIndex: p.cheapIndex,
                    richIndex: p.richIndex,
                    cheapKey: cheapKey,
                    richKey: richKey,
                    cheapTokenIs0: cheapSt.tokenIsCurrency0,
                    richTokenIs0: richSt.tokenIsCurrency0,
                    token: Currency.wrap(cheapSt.token),
                    clipQuoteWei: p.clipQuoteWei
                })
            )
        );
        return abi.decode(result, (uint256, uint256, uint256));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        UnlockData memory u = abi.decode(data, (UnlockData));

        bool buyZfo = !u.cheapTokenIs0;
        poolManager.swap(
            u.cheapKey,
            SwapParams({
                zeroForOne: buyZfo,
                amountSpecified: -int256(u.clipQuoteWei),
                sqrtPriceLimitX96: buyZfo ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );

        int256 tokenDelta = poolManager.currencyDelta(address(this), u.token);
        if (tokenDelta <= 0) revert NoInventory();
        uint256 tokenSold = uint256(tokenDelta);

        bool sellZfo = u.richTokenIs0;
        poolManager.swap(
            u.richKey,
            SwapParams({
                zeroForOne: sellZfo,
                amountSpecified: -int256(tokenSold),
                sqrtPriceLimitX96: sellZfo ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );

        Currency richQuote = u.richTokenIs0 ? u.richKey.currency1 : u.richKey.currency0;
        int256 quoteDelta = poolManager.currencyDelta(address(this), richQuote);
        uint256 quoteOut = quoteDelta > 0 ? uint256(quoteDelta) : 0;

        _clearDelta(u.cheapKey.currency0);
        _clearDelta(u.cheapKey.currency1);
        _clearDelta(u.richKey.currency0);
        _clearDelta(u.richKey.currency1);

        emit ArbExecuted(u.launchId, u.cheapIndex, u.richIndex, u.clipQuoteWei, tokenSold, quoteOut);
        return abi.encode(u.clipQuoteWei, tokenSold, quoteOut);
    }

    function _clearDelta(Currency currency) private {
        int256 delta = poolManager.currencyDelta(address(this), currency);
        if (delta < 0) {
            currency.settle(poolManager, address(this), uint256(-delta), false);
        }
        delta = poolManager.currencyDelta(address(this), currency);
        if (delta > 0) {
            currency.take(poolManager, address(this), uint256(delta), false);
        }
    }

    function _tokenUsdX18(PoolKey memory key) private view returns (uint256) {
        IMasterLaunchHook.LaunchState memory st = hook.launchState(key.toId());
        if (!st.initialized) return 0;
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(key.toId());
        if (sqrtPriceX96 == 0) return 0;

        uint256 quoteWei = FixedPointMath.quoteFromToken(1 ether, sqrtPriceX96, st.tokenIsCurrency0);
        address quote = Currency.unwrap(st.quote);
        uint256 quoteUsd = quote == address(0) ? factory.ethUsdPriceX18() : factory.quoteUsdPriceX18(quote);
        if (quoteUsd == 0) return 0;

        uint8 decimals = 18;
        if (quote != address(0)) {
            (, decimals,,) = factory.quoteConfigs(quote);
            if (decimals == 0) return 0;
        }
        return quoteWei * quoteUsd / (10 ** uint256(decimals));
    }

    function _clipQuoteWei(PoolKey memory cheapKey, IMasterLaunchHook.LaunchState memory st)
        private
        view
        returns (uint256 clip)
    {
        if (maxClipUsdX18 == 0) return 0;
        address quote = Currency.unwrap(st.quote);
        uint256 quoteUsd = quote == address(0) ? factory.ethUsdPriceX18() : factory.quoteUsdPriceX18(quote);
        if (quoteUsd == 0) return 0;

        uint8 decimals = 18;
        if (quote != address(0)) {
            (, decimals,,) = factory.quoteConfigs(quote);
            if (decimals == 0) return 0;
        }

        clip = maxClipUsdX18 * (10 ** uint256(decimals)) / quoteUsd;
        uint256 bal = quote == address(0) ? address(this).balance : IERC20Minimal(quote).balanceOf(address(this));
        if (clip > bal) clip = bal;

        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(cheapKey.toId());
        uint256 supply = IERC20Supply(st.token).totalSupply();
        if (sqrtPriceX96 != 0 && supply != 0) {
            uint256 depthQuote = FixedPointMath.quoteFromToken(
                supply * MAX_CLIP_SUPPLY_BPS / ProtocolConstants.BPS_DENOMINATOR, sqrtPriceX96, st.tokenIsCurrency0
            );
            if (depthQuote != 0 && clip > depthQuote) clip = depthQuote;
        }
    }
}
