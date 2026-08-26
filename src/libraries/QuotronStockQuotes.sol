// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title QuotronStockQuotes
/// @notice Quotrons wrapped xStocks (w*) on Ink — launch quotes + bridge venue metadata.
/// @dev Markets: https://quotrons.cash/integration/xstocks-manifest.json
///      Wrapped equities pair against USDG on Uniswap v4 with Quotrons' stock hook (dynamic fee).
///      USD prices for launch/graduation prefer live Quotrons pool `sqrtPriceX96` (USDG ≈ $1).
///      `usdPriceX18` snapshots are fallback only when the pool is uninitialized.
library QuotronStockQuotes {
    uint256 internal constant INK_MAINNET = 57073;

    address internal constant QUOTRONS_HOOK = 0x8bb4516059F9149Bc3b89018Fc7537f1F14a30cc;
    address internal constant QUOTRONS_FACTORY = 0xbFA531C90FD9e42aC13Af14823B30e40761dd3A2;
    /// @dev Uniswap DYNAMIC_FEE_FLAG — never hardcode 3000 when deriving pool ids.
    uint24 internal constant QUOTRONS_DYNAMIC_FEE = 0x800000;
    int24 internal constant QUOTRONS_TICK_SPACING = 60;

    struct Listing {
        address token;
        uint8 decimals;
        /// @dev USD price scaled to 18 decimals (manual / API snapshot of underlying equity).
        uint256 usdPriceX18;
        bytes32 quotronPoolId;
    }

    address internal constant wAAPLx = 0x943BF64D566c32A2Bcd41AC92FB63C111cC9De8f;
    address internal constant wAMZNx = 0x910cabdE3EBa7Fc1Ce64fD14bD680b9f60fA0F90;
    address internal constant wGOOGLx = 0xf8c5308F80E459bb53d9EbE689854d9cBb2Caa6f;
    address internal constant wMSTRx = 0x30987adF0B11dc698438a99BA04ec3a1AB2c7EaB;
    address internal constant wNFLXx = 0x7d87fD6A379714194a797c0bBB8B40c30D250856;
    address internal constant wNVDAx = 0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5;
    address internal constant wSPYx = 0xE7E553Cd128F0011777323A0b44a7b96EA1CB540;
    address internal constant wTSLAx = 0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171;

    function listings() internal pure returns (Listing[] memory all) {
        all = new Listing[](8);
        // forgefmt: disable-next-item
        all[0] = Listing({
            token: wAAPLx,
            decimals: 18,
            usdPriceX18: 309_775 * 1e15,
            quotronPoolId: 0x0ef0fe35389f4104afef27864010022976ed1b924e8837b30f308255d07d3092
        });
        // forgefmt: disable-next-item
        all[1] = Listing({
            token: wAMZNx,
            decimals: 18,
            usdPriceX18: 263_75 * 1e16,
            quotronPoolId: 0xc113916ee057276dfd79b4ff4a29be5e98703e410923e4a61e95ccf459223a38
        });
        // forgefmt: disable-next-item
        all[2] = Listing({
            token: wGOOGLx,
            decimals: 18,
            usdPriceX18: 349_4 * 1e16,
            quotronPoolId: 0x5ec6f9fc8178f8b3a9c09b56d073a4503a5ea3f127ece3e8a8d1579c0cf9c3b2
        });
        // forgefmt: disable-next-item
        all[3] = Listing({
            token: wMSTRx,
            decimals: 18,
            usdPriceX18: 121_57 * 1e16,
            quotronPoolId: 0xb7add80f794d65c978346f9e929971d2f12b4f862c89f4c14201872819a39a7d
        });
        // forgefmt: disable-next-item
        all[4] = Listing({
            token: wNFLXx,
            decimals: 18,
            usdPriceX18: 8194 * 1e16,
            quotronPoolId: 0x9f11034d6b2a7bfea38a0c39548c590e4aabd215ffa2b6bbe9bacd29e40238b6
        });
        // forgefmt: disable-next-item
        all[5] = Listing({
            token: wNVDAx,
            decimals: 18,
            usdPriceX18: 211_32 * 1e16,
            quotronPoolId: 0xebe5d3cc94d87cf07cf06c969ca82a67760697535c57800350e210df8547cd11
        });
        // forgefmt: disable-next-item
        all[6] = Listing({
            token: wSPYx,
            decimals: 18,
            usdPriceX18: 767_582 * 1e15,
            quotronPoolId: 0x84b421dc355c6c003fcf4f8100691eddaa0319deb894acb7e9bbf633621694a7
        });
        // forgefmt: disable-next-item
        all[7] = Listing({
            token: wTSLAx,
            decimals: 18,
            usdPriceX18: 351_9 * 1e16,
            quotronPoolId: 0x131ebb0eb148451d7225a52e94a8257b69976e780ebce1615aadf47d8e2aaf19
        });
    }
}
