import assert from "node:assert/strict";
import test from "node:test";

import {
  LEGAL_ACK_KEY,
  LEGAL_UPDATED,
  PRIVACY_PAGE,
  PRIVACY_SECTIONS,
  TERMS_HREF,
  TERMS_PAGE,
  TERMS_SECTIONS,
} from "./legal";

test("legal ack key is versioned so a copy change can re-prompt", () => {
  assert.equal(LEGAL_ACK_KEY, "hookit:legal-ack:v3");
  assert.equal(TERMS_HREF, "/terms");
  assert.equal(LEGAL_UPDATED, "12 September 2026");
});

test("terms and privacy keep the self-custody and no-advice clauses", () => {
  const terms = [TERMS_PAGE.lead, ...TERMS_SECTIONS.flatMap((s) => s.paragraphs)].join(" ");
  assert.match(terms, /never hold/i);
  assert.match(terms, /financial/i);
  assert.match(terms, /Anyone can deploy/i);
  assert.match(terms, /Ink/);
  assert.match(terms, /Uniswap v4/);
  const privacy = [PRIVACY_PAGE.lead, ...PRIVACY_SECTIONS.flatMap((s) => s.paragraphs)].join(" ");
  assert.match(privacy, /wallet/i);
  assert.match(privacy, /on-chain|onchain/i);
});

test("legal titles are ours, not a pasted argus heading", () => {
  assert.notEqual(TERMS_PAGE.title.toLowerCase(), "what you accept by using this");
  assert.notEqual(PRIVACY_PAGE.title.toLowerCase(), "what we know about you");
  assert.match(TERMS_PAGE.title, /software/i);
  assert.match(PRIVACY_PAGE.title, /hold/i);
});
