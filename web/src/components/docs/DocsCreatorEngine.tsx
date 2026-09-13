import { LaunchRocketIcon } from "@/components/brand/LaunchRocketIcon";
import { HookLogo } from "@/components/home/market/HookLogo";
import { PairingMark } from "@/components/launch/PairingMark";
import { LAUNCH_FEE_ETH } from "@/lib/constants";
import { EXPLORE_HOOKS, type BrowseHookId } from "@/lib/master-hooks";

function hook(id: BrowseHookId) {
  const found = EXPLORE_HOOKS.find((item) => item.id === id);
  if (!found) throw new Error(`missing hook ${id}`);
  return found;
}

function HookMarks({ ids }: { ids: BrowseHookId[] }) {
  return (
    <ul className="docs-flow-marks">
      {ids.map((id) => {
        const item = hook(id);
        return (
          <li key={id} title={item.title}>
            <HookLogo hookId={item.id} theme={item.theme} />
          </li>
        );
      })}
    </ul>
  );
}

function WalletMarks() {
  return (
    <ul className="docs-flow-wallets">
      <li title="MetaMask">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path fill="#E17726" d="M20.6 3.4 13.2 8.9l1.4-3.3z" />
          <path fill="#E27625" d="m3.4 3.4 7.3 5.6-1.3-3.4z" />
          <path fill="#E27625" d="m17.6 16.2-1.9 2.9 4.1 1.1 1.2-4z" />
          <path fill="#E27625" d="M3 16.2 4.2 20.2 8.3 19.1 6.4 16.2z" />
          <path fill="#D5BFB2" d="m8.3 19.1.8-1.8-2.3-.1z" />
          <path fill="#D5BFB2" d="m14.9 17.3.8 1.8 1.5-1.9z" />
          <path fill="#233447" d="m9.1 11.3-1 1.6 3.6.2-2.6-1.8z" />
          <path fill="#233447" d="m14.9 11.3-2.6 1.8 3.6-.1z" />
        </svg>
      </li>
      <li title="Rabby">
        <svg viewBox="0 0 24 24" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="4" fill="#7084FF" />
          <circle cx="9" cy="12" r="2" fill="#fff" />
          <circle cx="15" cy="12" r="2" fill="#fff" />
          <path d="M8 16.2c1.2.8 2.5 1.1 4 1.1s2.8-.3 4-1.1" stroke="#fff" strokeWidth="1.4" fill="none" />
        </svg>
      </li>
      <li title="WalletConnect">
        <svg viewBox="0 0 24 24" aria-hidden>
          <rect width="24" height="24" rx="6" fill="#3B99FC" />
          <path
            d="M7.2 10.4c2.6-2.6 6.9-2.6 9.6 0l.3.3c.1.1.1.3 0 .4l-1.1 1.1c-.1.1-.2.1-.3 0l-.4-.4c-1.8-1.8-4.7-1.8-6.6 0l-.4.4c-.1.1-.2.1-.3 0L7 11.1c-.1-.1-.1-.3 0-.4z"
            fill="#fff"
          />
        </svg>
      </li>
    </ul>
  );
}

function PairScreen() {
  return (
    <div className="docs-flow-pair">
      <div className="docs-flow-pair-fields">
        <span>My Token</span>
        <span>TKN</span>
      </div>
      <ul className="docs-flow-marks">
        <li>
          <PairingMark id="eth" size="sm" />
        </li>
        <li>
          <PairingMark id="usdg" size="sm" />
        </li>
        <li>
          <PairingMark id="wnvdax" size="sm" />
        </li>
      </ul>
    </div>
  );
}

const FLOW = [
  { t: "Connect", d: `Ink + ${LAUNCH_FEE_ETH} ETH fee`, body: "wallets" as const },
  { t: "Token & pair", d: "Name, art, quote", body: "pair" as const },
  { t: "Protection", d: "Optional shields", body: "prot" as const },
  { t: "Tokenomics", d: "Optional sinks", body: "tokenomics" as const },
  { t: "Fees", d: "Tax + pot split", body: "fees" as const },
  { t: "Launch", d: "Token + locked LP", body: "launch" as const },
];

function NodeBody({ body }: { body: (typeof FLOW)[number]["body"] }) {
  switch (body) {
    case "wallets":
      return <WalletMarks />;
    case "pair":
      return <PairScreen />;
    case "prot":
      return <HookMarks ids={["anti-mev", "anti-snipe", "max-tx", "max-wallet"]} />;
    case "tokenomics":
      return <HookMarks ids={["holder-airdrop", "auto-burn", "backed-floor", "buyback-vesting", "deepen-lps"]} />;
    case "fees":
      return <HookMarks ids={["dynamic-fees", "fixed-fee"]} />;
    case "launch":
      return (
        <span className="launch-coin-nav docs-flow-launch">
          <LaunchRocketIcon />
          Launch
        </span>
      );
  }
}

export function DocsCreatorEngine() {
  return (
    <figure className="docs-schema">
      <figcaption>Creator path</figcaption>
      <div className="docs-flow-engine" role="img" aria-label="Creator flow from connect to launch">
        <ol className="docs-flow-nodes">
          {FLOW.map((node, i) => (
            <li key={node.t} className="docs-flow-node">
              <span className="docs-flow-num">{i + 1}</span>
              <strong>{node.t}</strong>
              <small>{node.d}</small>
              <NodeBody body={node.body} />
              {i < FLOW.length-1 ? (
                <span className="docs-flow-rail" aria-hidden>
                  <i className="docs-flow-dot" />
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
      <p className="docs-schema-note">
        Same wallet. One transaction on Master (two if you need an ERC-20 approve first). Classic
        bonds first, then graduates at 4.2 ETH-eq.
      </p>
    </figure>
  );
}
