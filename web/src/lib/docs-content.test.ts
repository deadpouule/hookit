import assert from "node:assert/strict";
import test from "node:test";

import { buildDocsSections, docsSectionHasArt, DOCS_NAV, type DocsSectionId } from "./docs-content";
import { DOCS_SECTION_IDS } from "./docs";

test("docs nav ids match rendered sections and metadata", () => {
  const sections = buildDocsSections();
  const navIds = DOCS_NAV.flatMap((group) => group.items.map((item) => item.id));
  const sectionIds = sections.map((section) => section.id);
  assert.deepEqual(navIds, sectionIds);
  assert.deepEqual(navIds, DOCS_SECTION_IDS);
});

test("docs no longer advertise the old 70/30 split", () => {
  const blob = JSON.stringify(buildDocsSections());
  assert.equal(blob.includes("70/30"), false);
  assert.equal(blob.includes("70 / 30"), false);
  assert.match(blob, /60 \/ 10 \/ 30/);
});

test("docs place Deepen LPs in Protection and include pro blocks", () => {
  const sections = buildDocsSections();
  const hooks = sections.find((section) => section.id === "hooks");
  const hookText = JSON.stringify(hooks);
  assert.match(hookText, /Deepen LPs sits in Protection/);
  assert.ok(sections.some((section) => section.blocks.some((block) => block.type === "diagram")));
  assert.ok(sections.some((section) => section.blocks.some((block) => block.type === "formulas")));
  assert.ok(sections.some((section) => section.blocks.some((block) => block.type === "hooks")));
  assert.equal(JSON.stringify(sections.find((section) => section.id === "overview")).includes("totem"), false);
});

test("docs cover $HKT thesis and in-depth modules", () => {
  const sections = buildDocsSections();
  const ids = sections.map((section) => section.id);
  assert.ok(ids.includes("hkt"));
  assert.ok(ids.includes("dynamic-fees"));
  assert.ok(ids.includes("buyback-vesting"));
  assert.ok(ids.includes("holder-airdrop"));
  const hkt = JSON.stringify(sections.find((section) => section.id === "hkt"));
  assert.match(hkt, /Hold 1 \$HKT/);
  assert.match(hkt, /Not the Holder Airdrop module/);
  assert.match(hkt, /mandatory/);
  assert.match(hkt, /\$HKT drop \(mandatory\)/);
  assert.equal(hkt.includes("$HKT drop (always on)"), false);
  assert.match(JSON.stringify(sections.find((section) => section.id === "fees")), /cannot be removed or rerouted/);
  assert.equal(sections.find((section) => section.id === "dynamic-fees")?.hookId, "dynamic-fees");
  assert.equal(sections.find((section) => section.id === "floor")?.hookId, "backed-floor");
  assert.match(JSON.stringify(sections.find((section) => section.id === "floor")), /More volume = higher floor/);
  assert.ok(
    sections
      .find((section) => section.id === "hooks")
      ?.blocks.some((block) => block.type === "hook-title" && block.hookId === "deepen-lps"),
  );
});

test("docs cover multi-pair, Quotrons, creator fees, and every hook page", () => {
  const sections = buildDocsSections();
  const ids = sections.map((section) => section.id);
  const required: DocsSectionId[] = [
    "multi-pair",
    "quotrons",
    "creator-fees",
    "anti-snipe",
    "anti-mev",
    "max-tx",
    "max-wallet",
    "deepen-lps",
    "auto-burn",
    "creator-share",
    "fixed-fees",
    "analytics",
  ];
  for (const id of required) {
    assert.ok(ids.includes(id), `missing ${id}`);
  }
  const blob = JSON.stringify(sections);
  assert.match(blob, /BackedFloorNotAllowedInMulti/);
  assert.match(blob, /swapExactInComposite/);
  assert.match(blob, /V4ClaimsRedeemer/);
  assert.equal(blob.includes("supplies the holder set from the indexer"), false);
  assert.match(blob, /holderTracker/);
  assert.match(blob, /LpDeepened/);
  assert.match(blob, /already airdropped/);
  assert.match(blob, /quote accrued into BuybackVault/);
  assert.match(blob, /Six wizard steps/);
  assert.equal(blob.includes("Portfolio. Tokens you created"), false);
  assert.equal(sections.filter((section) => section.id === "floor").length, 1);
});

test("every docs section has a diagram, visual, hook catalog, or formula", () => {
  const missing = buildDocsSections()
    .filter((section) => !docsSectionHasArt(section))
    .map((section) => section.id);
  assert.deepEqual(missing, []);
  const blob = JSON.stringify(buildDocsSections());
  assert.match(blob, /"type":"visual","id":"quotrons"/);
  assert.match(blob, /"type":"visual","id":"multi-pair"/);
  assert.match(blob, /"type":"visual","id":"holder-airdrop"/);
});
