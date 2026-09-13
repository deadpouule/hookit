import assert from "node:assert/strict";
import test from "node:test";

import { buildDocsSections, DOCS_NAV } from "./docs-content";
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
  assert.equal(
    sections.find((section) => section.id === "overview")?.blocks.some((block) => block.type === "totem"),
    false,
  );
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
  assert.equal(sections.find((section) => section.id === "dynamic-fees")?.hookId, "dynamic-fees");
  assert.equal(sections.find((section) => section.id === "floor")?.hookId, "backed-floor");
  assert.ok(
    sections
      .find((section) => section.id === "hooks")
      ?.blocks.some((block) => block.type === "hook-title" && block.hookId === "deepen-lps"),
  );
});
