// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title XStockQuotes
/// @notice xStocks (Backed) tokenized equities on Ink mainnet.
/// @dev Token addresses from https://api.xstocks.fi/api/v2/public/assets (network=Ink).
///      Docs: https://docs.xstocks.fi/docs
///      xStocks use rebasing ERC-20 (`balanceOf` is share-equivalent). 18 decimals on Ink.
///      USD prices are bootstrap snapshots for launch FDV math — refresh via `setQuote` or
///      `script/SeedXStockQuotes.s.sol` (xStocks price-data API). On-chain Chainlink feeds are
///      pull-based Data Streams, not compatible with `LaunchFactory`'s push aggregator reader.
library XStockQuotes {
    uint256 internal constant INK_MAINNET = 57073;

    struct Listing {
        address token;
        uint8 decimals;
        /// @dev USD price scaled to 18 decimals (manual / API snapshot).
        uint256 usdPriceX18;
    }

    address internal constant AAPLx = 0x9d275685dC284C8eB1C79f6ABA7a63Dc75ec890a;
    address internal constant NVDAx = 0xc845b2894dBddd03858fd2D643B4eF725fE0849d;
    address internal constant TSLAx = 0x8aD3c73F833d3F9A523aB01476625F269aEB7Cf0;
    address internal constant MSFTx = 0x5621737f42dAE558b81269FcB9E9E70c19Aa6b35;
    address internal constant GOOGLx = 0xe92f673Ca36C5E2Efd2DE7628f815f84807e803F;
    address internal constant AMZNx = 0x3557Ba345B01EFa20A1bdDC61F573BFD87195081;
    address internal constant METAx = 0x96702be57Cd9777f835117a809C7124fe4ec989A;
    address internal constant COINx = 0x364f210f430eC2448Fc68A49203040F6124096F0;
    address internal constant MSTRx = 0xAE2f842EF90C0d5213259Ab82639D5BBF649b08E;
    address internal constant SPYx = 0x90A2a4c76b5D8c0bc892A69EA28Aa775a8f2dD48;
    address internal constant QQQx = 0xa753A7395cAe905Cd615Da0B82A53E0560f250af;

    function listings() internal pure returns (Listing[] memory all) {
        all = new Listing[](11);
        all[0] = Listing(AAPLx, 18, 309_775 * 1e15); // ~$309.78
        all[1] = Listing(NVDAx, 18, 211_32 * 1e16); // ~$211.32
        all[2] = Listing(TSLAx, 18, 351_9 * 1e16); // ~$351.90
        all[3] = Listing(MSFTx, 18, 486_92 * 1e16);
        all[4] = Listing(GOOGLx, 18, 349_4 * 1e16);
        all[5] = Listing(AMZNx, 18, 263_75 * 1e16);
        all[6] = Listing(METAx, 18, 565_62 * 1e16);
        all[7] = Listing(COINx, 18, 179_9625 * 1e14);
        all[8] = Listing(MSTRx, 18, 121_57 * 1e16);
        all[9] = Listing(SPYx, 18, 767_582 * 1e15);
        all[10] = Listing(QQQx, 18, 713_4755 * 1e14);
    }
}
