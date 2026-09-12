import assert from "node:assert/strict";
import test from "node:test";

import { LEGAL_ACK_KEY, PRIVACY_SECTIONS, TERMS_HREF, TERMS_SECTIONS } from "./legal";

test("legal ack key is versioned so a copy change can re-prompt", () => {
  assert.equal(LEGAL_ACK_KEY, "hookit:legal-ack:v1");
  assert.equal(TERMS_HREF, "/terms");
});

test("terms and privacy notices have the self-custody and no-advice clauses", () => {
  const terms = TERMS_SECTIONS.flatMap((s) => s.paragraphs).join(" ");
  assert.match(terms, /never hold/i);
  assert.match(terms, /financial/i);
  assert.match(terms, /Anyone can launch/i);
  const privacy = PRIVACY_SECTIONS.flatMap((s) => s.paragraphs).join(" ");
  assert.match(privacy, /wallet/i);
  assert.match(privacy, /onchain/i);
});
