import { LAUNCH_FEE_ETH } from "@/lib/constants";

const FLOW = [
  { t: "Connect", d: `Ink + ${LAUNCH_FEE_ETH} ETH fee` },
  { t: "Token & pair", d: "Name, art, quote" },
  { t: "Protection", d: "Optional shields" },
  { t: "Tokenomics", d: "Optional sinks" },
  { t: "Fees", d: "Tax + pot split" },
  { t: "Launch", d: "Token + locked LP" },
] as const;

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
              {i < FLOW.length - 1 ? (
                <span className="docs-flow-rail" aria-hidden>
                  <i className="docs-flow-dot" />
                  <i className="docs-flow-dot docs-flow-dot--late" />
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
