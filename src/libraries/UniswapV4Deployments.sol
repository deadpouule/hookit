// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title UniswapV4Deployments
/// @notice Canonical Uniswap v4 addresses by chain.
/// @dev Production mainnet is Ink (57073). Integration tests run on Base Sepolia (84532)
///      because Ink Sepolia (763373) has no Universal Router.
library UniswapV4Deployments {
    uint256 internal constant BASE_SEPOLIA = 84532;
    uint256 internal constant INK_MAINNET = 57073;
    uint256 internal constant INK_SEPOLIA = 763373;

    struct Deployment {
        address poolManager;
        address positionManager;
        address stateView;
        address quoter;
        address universalRouter;
        address permit2;
        address create2Deployer;
        /// @notice Allowed ERC-20 quote at deploy: USDG on Ink, Base Sepolia USDC (testnet stand-in).
        address stableQuote;
        address ethUsdFeed;
        address poolSwapTest;
    }

    error UnsupportedChain(uint256 chainId);
    error InkSepoliaHasNoV4Router();

    function get(uint256 chainId) internal pure returns (Deployment memory d) {
        if (chainId == INK_SEPOLIA) revert InkSepoliaHasNoV4Router();

        if (chainId == BASE_SEPOLIA) {
            return Deployment({
                poolManager: 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408,
                positionManager: 0x4B2C77d209D3405F41a037Ec6c77F7F5b8e2ca80,
                stateView: 0x571291b572ed32ce6751a2Cb2486EbEe8DEfB9B4,
                quoter: 0x4A6513c898fe1B2d0E78d3b0e0A4a151589B1cBa,
                universalRouter: 0x492E6456D9528771018DeB9E87ef7750EF184104,
                permit2: 0x000000000022D473030F116dDEE9F6B43aC78BA3,
                create2Deployer: 0x4e59b44847b379578588920cA78FbF26c0B4956C,
                stableQuote: 0x036CbD53842c5426634e7929541eC2318f3dCF7e,
                ethUsdFeed: 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1,
                poolSwapTest: 0x8B5bcC363ddE2614281aD875bad385E0A785D3B9
            });
        }

        if (chainId == INK_MAINNET) {
            return Deployment({
                poolManager: 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32,
                positionManager: 0x1b35d13a2E2528f192637F14B05f0Dc0e7dEB566,
                stateView: 0x76Fd297e2D437cd7f76d50F01AfE6160f86e9990,
                quoter: 0x3972C00f7ed4885e145823eb7C655375d275A1C5,
                universalRouter: 0x112908daC86e20e7241B0927479Ea3Bf935d1fa0,
                permit2: 0x000000000022D473030F116dDEE9F6B43aC78BA3,
                create2Deployer: 0x4e59b44847b379578588920cA78FbF26c0B4956C,
                stableQuote: 0xe343167631d89B6Ffc58B88d6b7fB0228795491D, // USDG (Paxos)
                ethUsdFeed: 0xdFc720E1ef024bfc768ed9E6F0e7Fc80E28f8CFA,
                poolSwapTest: address(0)
            });
        }

        revert UnsupportedChain(chainId);
    }
}
