import { PairingMark } from "@/components/launch/PairingMark";
import { PAIRING_TOKENS, type PairingTokenId } from "@/lib/pairing-tokens";
import { cn } from "@/lib/utils";

export const STOCK_PAIRING_IDS = PAIRING_TOKENS.filter(
  (token) => token.id !== "eth" && token.id !== "usdg",
).map((token) => token.id);

export function PairingLogoStack({
  ids = STOCK_PAIRING_IDS,
  size = "md",
  className,
}: {
  ids?: PairingTokenId[];
  size?: "sm" | "md";
  className?: string;
}) {
  if (ids.length === 0) return null;

  return (
    <span
      className={cn("pairing-logo-stack", size === "sm" && "pairing-logo-stack--sm", className)}
      aria-hidden
    >
      {ids.map((id) => (
        <span key={id} className="pairing-logo-stack__item">
          <PairingMark id={id} size="md" />
        </span>
      ))}
    </span>
  );
}
