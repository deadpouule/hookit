export const LEGAL_ACK_KEY = "hookit:legal-ack:v3";

export const TERMS_HREF = "/terms";
export const PRIVACY_HREF = "/privacy";
export const LEGAL_UPDATED = "12 September 2026";

export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export type LegalPage = {
  kicker: string;
  title: string;
  lead: string;
  sections: LegalSection[];
};

export const TERMS_PAGE: LegalPage = {
  kicker: "Terms",
  title: "What this software actually is",
  lead: "hook it is a website and a set of contracts. It is not a broker, a bank, an exchange desk, or someone you can call to unwind a trade. If this page does not sit right, leave. Using the app means you accept it.",
  sections: [
    {
      title: "A site that talks to Uniswap, nothing in the middle",
      paragraphs: [
        "hook it runs on Ink. You launch and trade from your own wallet, into Uniswap v4 pools and the contracts we published. We never hold your ETH, your tokens, or your keys, and there is no account for us to freeze or refund. Once your wallet signs and the chain includes it, that is the result. We cannot reverse it.",
        "Two launch paths exist. Master opens a pool with a shared hook and locked LP from the first block. Classic sells on a bonding curve first and graduates into a pool later. Both are permissionless. Nobody at hook it reviews a ticker before it goes live.",
      ],
    },
    {
      title: "Listed is not recommended",
      paragraphs: [
        "Anyone can deploy here. The name, picture, links, and story on a token page were typed by whoever launched it. We do not check them. Showing up in Explore means a factory transaction landed. It is not a listing, a partnership, or a vibe check from us.",
        "The board also surfaces tokens that did not come through our launch flow. Treat the page as a map of what the chain already has, then confirm the contract address from somewhere that is not this tab.",
      ],
    },
    {
      title: "None of this is advice",
      paragraphs: [
        "Nothing on hook it is financial, legal, or tax advice. These markets move fast and a lot of tokens go to zero. Only size what you can lose in full, and do the work yourself before you click swap.",
      ],
    },
    {
      title: "No audit sticker, no rescue button",
      paragraphs: [
        "The factories, the master hook, the routers, and this interface are offered as is. Parts may be unaudited. Bugs can lock, leak, or mis-account funds. Networks, RPCs, and Uniswap itself can fail or change. To the extent the law allows, we are not liable for losses from using the software.",
        "A hook module is a setting, not a guarantee. Backed floor, anti-snipe, max wallet, buybacks, airdrops, and the rest do what the bytecode says, including when that bytecode is wrong. If a creator configured something ugly, we cannot reach in and fix their pool.",
      ],
    },
    {
      title: "How fees actually leave a swap",
      paragraphs: [
        "Master pools take fees through the hook, quote-side, instead of a Uniswap LP fee. There is a base cut, and a launch can add extra hook tax to feed modules. Classic starts on the curve with the base cut only, then graduates. Creator, $HKT, and protocol shares are readable on-chain and on the token page. We can earn from flow. That does not make a token safer.",
        "If a module needs a keeper (buybacks, airdrops, deepening, and similar), those jobs are convenience. If they stall, the balances usually still sit in the contracts. Someone else can often poke them and pay the gas. Do not treat a bot as a promise.",
      ],
    },
    {
      title: "The numbers on the page are a snapshot",
      paragraphs: [
        "Price, market cap, floor, volume, and candles are built from chain data, our indexer, and sometimes third-party charts. They can be minutes behind, incomplete, or wrong on a thin pool. A market cap on empty liquidity is arithmetic, not a bid.",
        "A quote in the swap box is an estimate against the pool or curve as we see it. Liquidity can move before your wallet lands. What you receive can be less. Nothing on screen is an offer to deal.",
      ],
    },
    {
      title: "The site can vanish. The chain does not care",
      paragraphs: [
        "We do not promise uptime. The interface can go down, change, or get pulled. The contracts keep existing without it. You can still talk to them with another client if you know what you are doing.",
      ],
    },
    {
      title: "What sits on you",
      paragraphs: [
        "You follow the law where you live, including any rule about digital assets and any tax you owe. Do not use hook it where that would be illegal, and do not use it if you are sanctioned. Wallet security is yours. So is checking the address you are about to sign against.",
        "Do not launch a token that impersonates a person or a project, steals a brand, or exists to trap buyers. Do not imply we audited you, partnered with you, or blessed the hook. Write the name in lowercase when you talk about the protocol: hook it.",
      ],
    },
    {
      title: "Other people's pipes",
      paragraphs: [
        "A session here also talks to software we do not run: your wallet, Ink RPCs, Uniswap, image hosts, IPFS gateways, chart vendors, and the explorer behind our links. Each has its own terms. What those requests can reveal is in the privacy page.",
      ],
    },
    {
      title: "If we rewrite this",
      paragraphs: [
        "This page can change. Still using the site after a change means you accept the new text. The first-visit acknowledgment in your browser is versioned, so a real rewrite asks again instead of hiding behind a click from months ago.",
      ],
    },
  ],
};

export const PRIVACY_PAGE: LegalPage = {
  kicker: "Privacy",
  title: "How little we hold on you",
  lead: "There is no sign-up and no customer file. A wallet is not an account. What is public is public because it is on a chain, and no notice can pull that back.",
  sections: [
    {
      title: "We do not ask who you are",
      paragraphs: [
        "hook it does not collect a name, email, phone, or ID. Browsing the board does not open a profile. Connecting a wallet only hands the public address to your browser so the app can quote, swap, launch, and show balances. We never take the keys.",
      ],
    },
    {
      title: "What stays on your machine",
      paragraphs: [
        "A few preferences live in local storage on your device: that you accepted this notice (under a key beginning with hookit:legal-ack), plus small UI choices like chart range. Those values are not a login. Clearing site data deletes them, and the welcome screen comes back.",
        "We do not set an account cookie. Wallet connect uses whatever your wallet extension already uses.",
      ],
    },
    {
      title: "What the servers see anyway",
      paragraphs: [
        "Hosting still sees the ordinary leftovers of a web request: IP address, page, time, user agent. That is how you keep a site up, not how we build a dossier, and we do not join those logs to a wallet on purpose.",
        "Vercel Analytics may record anonymized page views. If a Sentry project DSN is configured, the app can send crash reports. Neither is required for the product to work, and neither is sold.",
      ],
    },
    {
      title: "Ink is not a private room",
      paragraphs: [
        "Launches, swaps, hook settings, and the metadata you publish are written to a public ledger. Anyone can read them, forever. We did not invent that, and we cannot unpublish it. Neither can you.",
        "A creator wallet, a social link, or an image URL you type at launch is on-chain with the token. Treat those fields as a poster, not a private form. An address is a nickname, not a mask. Anyone who learns it is yours can replay everything it ever did.",
      ],
    },
    {
      title: "Who else your browser calls",
      paragraphs: [
        "Quotes and swaps may hit public RPCs, Uniswap interfaces, IPFS gateways, and chart APIs. Token art is often loaded from whatever URL the deployer stored. Those hosts see a request from you, under their rules, not ours.",
        "Signing a transaction leaves through your wallet and whatever RPC that wallet uses. That is a different product.",
      ],
    },
    {
      title: "We are not in the data-broker business",
      paragraphs: [
        "We do not sell, rent, or trade a personal profile, mostly because we do not have one. The honest inventory is a server log line, optional analytics, optional crash reports, and whatever you already broadcast on-chain.",
      ],
    },
    {
      title: "If this page moves",
      paragraphs: [
        "A material change gets written here and can re-prompt the welcome screen. The terms page covers the rest of what using hook it means.",
      ],
    },
  ],
};

export const TERMS_SECTIONS = TERMS_PAGE.sections;
export const PRIVACY_SECTIONS = PRIVACY_PAGE.sections;
