import type { ReactNode } from "react";

import { MasterHookGlyph } from "@/components/home/market/CategoryGlyphs";
import { HookLogo } from "@/components/home/market/HookLogo";
import { PairingMark } from "@/components/launch/PairingMark";
import { LAUNCH_WIZARD_HOOK_IDS, MASTER_LAUNCH_STEPS } from "@/lib/launch-wizard";
import { EXPLORE_HOOKS, type BrowseHookId } from "@/lib/master-hooks";

const STEP_COPY: Record<(typeof MASTER_LAUNCH_STEPS)[number]["id"], { title: string; note: string }> = {
  1: {
    title: "Name, art, and the quote the pool will trade against.",
    note: "ETH, USDG, or a Quotrons wStock. Multi-pair can add more markets later in this step. Metadata pins on-chain via IPFS.",
  },
  2: {
    title: "Optional shields that freeze at launch.",
    note: "Anti-MEV, Anti-Snipe, Max Tx, Max Wallet. Off by default. You cannot edit them after the tx.",
  },
  3: {
    title: "Where hook-tax value goes over the life of the token.",
    note: "Holder Airdrop, Auto-Burn, Backed Floor, Buyback Vesting, Deepen LPs. Buyback Vesting cannot combine with Creator → Hook.",
  },
  4: {
    title: "How much extra tax sits on top of the mandatory 1%.",
    note: "Fixed hook tax or Dynamic Fees (not both). Creator → Hook can route the 60% creator cut into the pot.",
  },
  5: {
    title: "Split the hook pot to 100% across the sinks you turned on.",
    note: "Floor + burn + deepen + airdrop must sum to 100% when any of them is on. No pot if tax is 0 and Creator → Hook is off.",
  },
  6: {
    title: "Read the recap, set an optional same-tx dev buy, sign.",
    note: "Bitmask and vestPacked freeze here. LP locks in the same transaction. Trading is live when the receipt lands.",
  },
};

function hook(id: BrowseHookId) {
  const found = EXPLORE_HOOKS.find((item) => item.id === id);
  if (!found) throw new Error(`missing hook ${id}`);
  return found;
}

function WizardChrome({ step, children }: { step: number; children: ReactNode }) {
  const label = MASTER_LAUNCH_STEPS[step - 1]?.label ?? "Token & pair";
  return (
    <div className="docs-wizard-shot">
      <div className="docs-wizard-shot-head">
        <span className="token-type-badge token-type-badge--master token-hooks-count-badge launch-wizard-master-badge">
          <MasterHookGlyph className="token-type-badge-glyph" />
          Master launch
        </span>
        <strong>Create a hooked token</strong>
        <div className="docs-wizard-shot-dots">
          {MASTER_LAUNCH_STEPS.map((item) => (
            <i key={item.id} className={item.id === step ? "is-on" : undefined} />
          ))}
          <span>
            {step} / 6 {label}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}

function HookRow({ ids }: { ids: BrowseHookId[] }) {
  return (
    <ul className="docs-launch-hook-row">
      {ids.map((id) => {
        const item = hook(id);
        return (
          <li key={id}>
            <HookLogo hookId={item.id} theme={item.theme} />
            <span>{item.title}</span>
          </li>
        );
      })}
    </ul>
  );
}

function StepScreen({ step }: { step: (typeof MASTER_LAUNCH_STEPS)[number]["id"] }) {
  switch (step) {
    case 1:
      return (
        <WizardChrome step={1}>
          <p className="docs-wizard-shot-h">Token details</p>
          <div className="docs-wizard-shot-form">
            <div className="docs-wizard-shot-logo">Logo</div>
            <div className="docs-wizard-shot-fields">
              <label>
                Name
                <span>My Token</span>
              </label>
              <label>
                Symbol
                <span>TKN</span>
              </label>
            </div>
          </div>
          <div className="docs-wizard-shot-pair">
            <PairingMark id="eth" size="sm" />
            <span>Pair · ETH</span>
          </div>
        </WizardChrome>
      );
    case 2:
      return (
        <WizardChrome step={2}>
          <p className="docs-wizard-shot-h">Protection</p>
          <HookRow ids={LAUNCH_WIZARD_HOOK_IDS[2]} />
        </WizardChrome>
      );
    case 3:
      return (
        <WizardChrome step={3}>
          <p className="docs-wizard-shot-h">Tokenomics</p>
          <HookRow ids={LAUNCH_WIZARD_HOOK_IDS[3]} />
        </WizardChrome>
      );
    case 4:
      return (
        <WizardChrome step={4}>
          <p className="docs-wizard-shot-h">Trading fees</p>
          <HookRow ids={[...LAUNCH_WIZARD_HOOK_IDS[4], "fixed-fee"]} />
        </WizardChrome>
      );
    case 5:
      return (
        <WizardChrome step={5}>
          <p className="docs-wizard-shot-h">Fee split</p>
          <div className="docs-launch-split">
            <span className="docs-launch-split-seg docs-launch-split-seg--burn" style={{ flex: 80 }}>
              <HookLogo hookId="auto-burn" theme="crimson" color="#fecaca" />
              <b>Auto-Burn 80%</b>
            </span>
            <span className="docs-launch-split-seg docs-launch-split-seg--deep" style={{ flex: 20 }}>
              <HookLogo hookId="deepen-lps" theme="nature" color="#bbf7d0" />
              <b>Deepen LPs 20%</b>
            </span>
          </div>
        </WizardChrome>
      );
    case 6:
      return (
        <WizardChrome step={6}>
          <p className="docs-wizard-shot-h">Review & launch</p>
          <dl className="docs-launch-review">
            <div>
              <dt>Supply</dt>
              <dd>1,000,000,000</dd>
            </div>
            <div>
              <dt>Base fee</dt>
              <dd>1% · 60 / 10 / 30</dd>
            </div>
            <div>
              <dt>LP</dt>
              <dd>Locked same tx</dd>
            </div>
          </dl>
        </WizardChrome>
      );
  }
}

export function DocsLaunchSteps() {
  return (
    <figure className="docs-schema">
      <figcaption>Master Launch Studio, step by step</figcaption>
      <ol className="docs-launch-walk">
        {MASTER_LAUNCH_STEPS.map((step) => {
          const copy = STEP_COPY[step.id];
          return (
            <li key={step.id} className="docs-launch-walk-item">
              <div className="docs-launch-walk-copy">
                <p className="docs-launch-walk-kicker">
                  Step {step.id} · {step.label}
                </p>
                <h4>{copy.title}</h4>
                <p>{copy.note}</p>
              </div>
              <StepScreen step={step.id} />
            </li>
          );
        })}
      </ol>
      <p className="docs-schema-note">
        Same screens as /launch/custom. Bitmask and vestPacked freeze when you sign. Classic uses a
        shorter bonding form instead of these six steps.
      </p>
    </figure>
  );
}
