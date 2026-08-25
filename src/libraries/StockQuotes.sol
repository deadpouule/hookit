// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title StockQuotes
/// @notice Coinbase tokenized stocks (B20) on Base mainnet + Chainlink total-return feeds.
/// @dev Addresses from https://docs.base.org/base-chain/asset-issuance/tokenized-stocks-on-base
///      These precompiles exist on Base (8453), not Base Sepolia. Seed via `LaunchFactory.setQuote`.
library StockQuotes {
    uint256 internal constant BASE_MAINNET = 8453;

    struct Listing {
        address token;
        address usdFeed;
        uint8 decimals;
    }

    address internal constant AAPLc = 0xb200000000000000000000C2e324d24d7eEcd1fb;
    address internal constant AMZNc = 0xb200000000000000000000d9192b6B456483C2E8;
    address internal constant COINc = 0xb200000000000000000000c85a31389D71F3ecfb;
    address internal constant CRCLc = 0xB20000000000000000000019f6E7C675b73C2e4D;
    address internal constant GOOGLc = 0xb2000000000000000000002D0BA3164cc74f58B7;
    address internal constant INTCc = 0xB2000000000000000000004AFF16039bA04bdFBc;
    address internal constant METAc = 0xb2000000000000000000008bC8786B856E61707C;
    address internal constant MSFTc = 0xB200000000000000000000Ab99cFa739E253872B;
    address internal constant MSTRc = 0xb2000000000000000000004884b426556b92883d;
    address internal constant NVDAc = 0xb20000000000000000000078ee7ce2fE4908108C;
    address internal constant SNDKc = 0xb200000000000000000000397293Cb8cda9a10c5;
    address internal constant SPCXc = 0xb2000000000000000000007b9fcbd005511aCBd5;
    address internal constant TSLAc = 0xb2000000000000000000001e800a7f5189430cD0;

    address internal constant FEED_AAPL = 0x787f13dEa48Db0897CbCDD985de77809D837F988;
    address internal constant FEED_AMZN = 0x06A8E4b3aBB3B7543d8396FB2B763d22820cB295;
    address internal constant FEED_COIN = 0x408e44f504A7371a345F03a73dDC96A4b48e8aa7;
    address internal constant FEED_CRCL = 0x0231cF2635D1E17bB5c2462cc7504Ba1fBd61f33;
    address internal constant FEED_GOOGL = 0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2;
    address internal constant FEED_INTC = 0xAB657C39bac0D5886250D70849e2E3E008F2EECB;
    address internal constant FEED_META = 0x6526aE6797A76123638b863AeE4dD27Ba4E4b27D;
    address internal constant FEED_MSFT = 0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c;
    address internal constant FEED_MSTR = 0xB3cE282CD188b35DA0E38D8Bc7d58e33173D202a;
    address internal constant FEED_NVDA = 0x04689a41629776563E6822F76f2e57D148d28513;
    address internal constant FEED_SNDK = 0x388b0dC46C0Fb05A74BeE0994fa5b02c6Fcca2eA;
    address internal constant FEED_SPCX = 0x6A634B235903C4ad6376892180d6fF8612e3Fa68;
    address internal constant FEED_TSLA = 0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4;

    function listings() internal pure returns (Listing[] memory all) {
        all = new Listing[](13);
        all[0] = Listing(AAPLc, FEED_AAPL, 18);
        all[1] = Listing(AMZNc, FEED_AMZN, 18);
        all[2] = Listing(COINc, FEED_COIN, 18);
        all[3] = Listing(CRCLc, FEED_CRCL, 18);
        all[4] = Listing(GOOGLc, FEED_GOOGL, 18);
        all[5] = Listing(INTCc, FEED_INTC, 18);
        all[6] = Listing(METAc, FEED_META, 18);
        all[7] = Listing(MSFTc, FEED_MSFT, 18);
        all[8] = Listing(MSTRc, FEED_MSTR, 18);
        all[9] = Listing(NVDAc, FEED_NVDA, 18);
        all[10] = Listing(SNDKc, FEED_SNDK, 18);
        all[11] = Listing(SPCXc, FEED_SPCX, 18);
        all[12] = Listing(TSLAc, FEED_TSLA, 18);
    }
}
