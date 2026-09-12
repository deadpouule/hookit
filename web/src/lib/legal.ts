export const LEGAL_ACK_KEY = "hookit:legal-ack:v1";

export const TERMS_HREF = "/terms";
export const PRIVACY_HREF = "/privacy";

export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: "Your wallet, your keys",
    paragraphs: [
      "Hookit is a self-custodial interface. You trade and launch from your own wallet. We never hold, custody, or can recover your funds. A transaction cannot be undone once your wallet signs it.",
    ],
  },
  {
    title: "Permissionless launches",
    paragraphs: [
      "Anyone can launch a token here. We do not approve, vet, or endorse any token, team, or hook configuration. The index also lists tokens we did not launch. You are responsible for checking the contract address before you trade.",
    ],
  },
  {
    title: "No financial advice",
    paragraphs: [
      "Prices move. A token can lose all of its value. Nothing on Hookit is financial, legal, or tax advice. Do your own research and do not trade funds you cannot afford to lose.",
    ],
  },
  {
    title: "Smart contracts and software",
    paragraphs: [
      "Master hooks, factories, and the web app are provided as is, without warranties. Contracts may be unaudited, contain bugs, or become unavailable. Networks, RPCs, and third-party services (including Uniswap) can fail or change.",
    ],
  },
  {
    title: "Acceptable use",
    paragraphs: [
      "Do not use Hookit to violate law, impersonate others, or imply a partnership or audit we did not grant. Write the name in lowercase as hook it when you refer to the protocol.",
    ],
  },
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: "What we see",
    paragraphs: [
      "Hookit does not ask for your name, email, or identity documents. If you connect a wallet, that public address is used locally in your browser to quote, swap, and launch. We do not take custody of keys.",
    ],
  },
  {
    title: "Onchain data",
    paragraphs: [
      "Swaps, launches, and token metadata you publish are written to a public blockchain. Anyone can read them. We cannot delete onchain history.",
    ],
  },
  {
    title: "This website",
    paragraphs: [
      "The app stores small preferences in your browser (for example, that you accepted these notices). Hosting and analytics providers may receive standard request logs such as IP address, browser type, and pages viewed. Optional error reporting only runs when a project DSN is configured.",
    ],
  },
  {
    title: "Third parties",
    paragraphs: [
      "Quotes and swaps may call public RPCs, Uniswap interfaces, IPFS gateways, and similar infrastructure. Their privacy practices apply to those requests.",
    ],
  },
];
