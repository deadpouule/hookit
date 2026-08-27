"use client";

import { PairingMark } from "@/components/launch/PairingMark";
import { PickCard } from "@/components/launch/PickCard";
import {
  PAIRING_TOKENS,
  type PairingTokenId,
} from "@/lib/pairing-tokens";

export function PairingPicker({
  value,
  onChange,
}: {
  value: PairingTokenId;
  onChange: (id: PairingTokenId) => void;
}) {
  return (
    <div>
      <p className="pick-kicker">
        —pair: {PAIRING_TOKENS.find((t) => t.id === value)?.ticker} · {PAIRING_TOKENS.length} markets
        available
      </p>
      <p className="pick-heading">pick your pair</p>
      <div className="pick-grid">
        {PAIRING_TOKENS.map((token) => (
          <PickCard
            key={token.id}
            selected={value === token.id}
            title={token.ticker}
            subtitle={value === token.id && token.classic ? "the classic pair" : token.subtitle}
            onClick={() => onChange(token.id)}
          >
            <PairingMark id={token.id} />
          </PickCard>
        ))}
      </div>
    </div>
  );
}
