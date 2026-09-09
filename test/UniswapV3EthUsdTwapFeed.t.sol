// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

import {IERC20Balance, IUniswapV3OraclePool, UniswapV3EthUsdTwapFeed} from "../src/UniswapV3EthUsdTwapFeed.sol";

contract MockBalanceToken is IERC20Balance {
    mapping(address => uint256) public balanceOf;

    function setBalance(address account, uint256 amount) external {
        balanceOf[account] = amount;
    }
}

contract MockV3OraclePool is IUniswapV3OraclePool {
    address public immutable token0;
    address public immutable token1;
    uint128 public liquidity = 8e16;
    int24 public spotTick = 198_128;
    int24 public meanTick = 198_128;
    uint32 public observationTimestamp;
    bool public initialized = true;

    constructor(address stable, address weth) {
        token0 = stable;
        token1 = weth;
    }

    function setState(
        uint128 liquidity_,
        int24 spotTick_,
        int24 meanTick_,
        uint32 observationTimestamp_,
        bool initialized_
    ) external {
        liquidity = liquidity_;
        spotTick = spotTick_;
        meanTick = meanTick_;
        observationTimestamp = observationTimestamp_;
        initialized = initialized_;
    }

    function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool) {
        return (0, spotTick, 0, 64, 64, 0, true);
    }

    function observations(uint256) external view returns (uint32, int56, uint160, bool) {
        return (observationTimestamp, 0, 0, initialized);
    }

    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
    {
        tickCumulatives = new int56[](2);
        secondsPerLiquidityCumulativeX128s = new uint160[](2);
        tickCumulatives[0] = 0;
        tickCumulatives[1] = int56(meanTick) * int56(uint56(secondsAgos[0]));
    }
}

contract UniswapV3EthUsdTwapFeedTest is Test {
    MockBalanceToken internal stable;
    MockBalanceToken internal weth;
    MockV3OraclePool internal pool;
    UniswapV3EthUsdTwapFeed internal feed;

    function setUp() external {
        vm.warp(10_000);
        stable = new MockBalanceToken();
        weth = new MockBalanceToken();
        pool = new MockV3OraclePool(address(stable), address(weth));
        stable.setBalance(address(pool), 500_000e6);
        weth.setBalance(address(pool), 190 ether);
        pool.setState(8e16, 198_128, 198_128, uint32(block.timestamp - 60), true);

        feed = new UniswapV3EthUsdTwapFeed(
            pool, address(weth), address(stable), 30 minutes, 1 hours, 300, 1e16, 100 ether, 250_000e6
        );
    }

    function testReturnsEightDecimalEthUsdTwap() external view {
        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        assertApproxEqRel(uint256(answer), 2_493e8, 0.01e18);
        assertEq(updatedAt, block.timestamp - 60);
        assertEq(feed.decimals(), 8);
    }

    function testRevertsWhenObservationIsStale() external {
        pool.setState(8e16, 198_128, 198_128, uint32(block.timestamp - 1 hours - 1), true);
        vm.expectRevert(UniswapV3EthUsdTwapFeed.StaleObservation.selector);
        feed.latestRoundData();
    }

    function testRevertsWhenSpotDivergesFromTwap() external {
        pool.setState(8e16, 198_500, 198_128, uint32(block.timestamp - 60), true);
        vm.expectRevert(UniswapV3EthUsdTwapFeed.ExcessiveDeviation.selector);
        feed.latestRoundData();
    }

    function testRevertsWhenPoolDepthFallsBelowFloor() external {
        weth.setBalance(address(pool), 99 ether);
        vm.expectRevert(UniswapV3EthUsdTwapFeed.InsufficientLiquidity.selector);
        feed.latestRoundData();
    }
}
