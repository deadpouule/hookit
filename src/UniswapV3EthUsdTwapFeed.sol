// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

interface IUniswapV3OraclePool {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function liquidity() external view returns (uint128);
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        );
    function observations(uint256 index)
        external
        view
        returns (
            uint32 blockTimestamp,
            int56 tickCumulative,
            uint160 secondsPerLiquidityCumulativeX128,
            bool initialized
        );
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);
}

interface IERC20Balance {
    function balanceOf(address account) external view returns (uint256);
}

/// @title UniswapV3EthUsdTwapFeed
/// @notice Chainlink-compatible ETH/USD feed backed by a deep WETH/stable Uniswap v3 TWAP.
/// @dev The stable token is assumed to track $1. Pool depth, observation freshness and
///      spot/TWAP divergence guards make this suitable as a launch-sizing oracle, not liquidations.
contract UniswapV3EthUsdTwapFeed {
    IUniswapV3OraclePool public immutable pool;
    address public immutable weth;
    address public immutable stable;
    uint32 public immutable twapWindow;
    uint32 public immutable maxObservationAge;
    uint24 public immutable maxTickDeviation;
    uint128 public immutable minLiquidity;
    uint256 public immutable minWethReserve;
    uint256 public immutable minStableReserve;

    error BadPool();
    error InvalidConfig();
    error InsufficientLiquidity();
    error StaleObservation();
    error ExcessiveDeviation();
    error RoundUnavailable();

    constructor(
        IUniswapV3OraclePool pool_,
        address weth_,
        address stable_,
        uint32 twapWindow_,
        uint32 maxObservationAge_,
        uint24 maxTickDeviation_,
        uint128 minLiquidity_,
        uint256 minWethReserve_,
        uint256 minStableReserve_
    ) {
        if (
            address(pool_) == address(0) || weth_ == address(0) || stable_ == address(0) || twapWindow_ == 0
                || maxObservationAge_ < twapWindow_ || maxTickDeviation_ == 0
        ) revert InvalidConfig();
        address token0 = pool_.token0();
        address token1 = pool_.token1();
        if (token0 != stable_ || token1 != weth_) revert BadPool();

        pool = pool_;
        weth = weth_;
        stable = stable_;
        twapWindow = twapWindow_;
        maxObservationAge = maxObservationAge_;
        maxTickDeviation = maxTickDeviation_;
        minLiquidity = minLiquidity_;
        minWethReserve = minWethReserve_;
        minStableReserve = minStableReserve_;
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function description() external pure returns (string memory) {
        return "Hookit Ink WETH/USDt0 Uniswap v3 TWAP";
    }

    function version() external pure returns (uint256) {
        return 1;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        (int24 meanTick, uint32 observationTimestamp) = _validatedMeanTick();
        uint256 stableRaw = _quoteAtTick(meanTick, 1 ether);
        if (stableRaw == 0 || stableRaw > uint256(type(int256).max) / 100) revert BadPool();

        roundId = uint80(block.number);
        answer = int256(stableRaw * 100); // stable has 6 decimals; feed exposes 8.
        startedAt = block.timestamp - twapWindow;
        updatedAt = observationTimestamp;
        answeredInRound = roundId;
    }

    function getRoundData(uint80) external pure returns (uint80, int256, uint256, uint256, uint80) {
        revert RoundUnavailable();
    }

    function _validatedMeanTick() internal view returns (int24 meanTick, uint32 observationTimestamp) {
        if (
            pool.liquidity() < minLiquidity || IERC20Balance(weth).balanceOf(address(pool)) < minWethReserve
                || IERC20Balance(stable).balanceOf(address(pool)) < minStableReserve
        ) revert InsufficientLiquidity();

        (, int24 spotTick, uint16 observationIndex,,,,) = pool.slot0();
        bool initialized;
        (observationTimestamp,,, initialized) = pool.observations(observationIndex);
        if (
            !initialized || block.timestamp < observationTimestamp
                || block.timestamp - observationTimestamp > maxObservationAge
        ) revert StaleObservation();

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = twapWindow;
        int56[] memory tickCumulatives;
        (tickCumulatives,) = pool.observe(secondsAgos);

        int56 tickDelta = tickCumulatives[1] - tickCumulatives[0];
        int56 window = int56(uint56(twapWindow));
        meanTick = int24(tickDelta / window);
        if (tickDelta < 0 && tickDelta % window != 0) meanTick--;

        int256 deviation = int256(spotTick) - int256(meanTick);
        if (deviation < 0) deviation = -deviation;
        if (uint256(deviation) > maxTickDeviation) revert ExcessiveDeviation();
    }

    function _quoteAtTick(int24 tick, uint128 baseAmount) internal pure returns (uint256 quoteAmount) {
        uint160 sqrtRatioX96 = TickMath.getSqrtPriceAtTick(tick);
        if (sqrtRatioX96 <= type(uint128).max) {
            uint256 ratioX192 = uint256(sqrtRatioX96) * sqrtRatioX96;
            return FullMath.mulDiv(uint256(1) << 192, baseAmount, ratioX192);
        }

        uint256 ratioX128 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, uint256(1) << 64);
        return FullMath.mulDiv(uint256(1) << 128, baseAmount, ratioX128);
    }
}
