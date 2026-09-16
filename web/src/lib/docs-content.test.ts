import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildDocsSections, docsSectionForHook, docsSectionHasArt, DOCS_NAV, type DocsSectionId } from "./docs-content";
import { DOCS_SECTION_IDS } from "./docs";
import { EXPLORE_HOOKS } from "./master-hooks";

test("docs nav ids match rendered sections and metadata", () => {
  const sections = buildDocsSections();
  const navIds = DOCS_NAV.flatMap((group) => group.items.map((item) => item.id));
  const sectionIds = sections.map((section) => section.id);
  assert.deepEqual(navIds, sectionIds);
  assert.deepEqual(navIds, DOCS_SECTION_IDS);
});

test("every browse hook has a docs section for the hooks popup", () => {
  for (const hook of EXPLORE_HOOKS) {
    const section = docsSectionForHook(hook.id);
    assert.ok(section, `missing docs section for ${hook.id}`);
    assert.ok(
      section.blocks.some((block) => block.type === "visual" || block.type === "p"),
      `${hook.id} should explain itself`,
    );
  }
});

test("docs no longer advertise the old 70/30 split", () => {
  const blob = JSON.stringify(buildDocsSections());
  assert.equal(blob.includes("70/30"), false);
  assert.equal(blob.includes("70 / 30"), false);
  assert.match(blob, /60 \/ 10 \/ 30/);
});

test("hook docs skip Master-module boilerplate intros", () => {
  const blob = JSON.stringify(buildDocsSections());
  assert.equal(blob.includes("A Master module."), false);
  assert.equal(blob.includes("Optional Master module."), false);
  assert.equal(blob.includes("Optional Master fee mode."), false);
});

test("docs place Deepen LPs in Protection and include pro blocks", () => {
  const sections = buildDocsSections();
  const hooks = sections.find((section) => section.id === "hooks");
  const hookText = JSON.stringify(hooks);
  assert.match(hookText, /Deepen LPs sits in Protection/);
  assert.ok(sections.some((section) => section.blocks.some((block) => block.type === "diagram")));
  assert.ok(sections.some((section) => section.blocks.some((block) => block.type === "formulas")));
  assert.ok(sections.some((section) => section.blocks.some((block) => block.type === "hooks")));
  assert.ok(sections.some((section) => section.blocks.some((block) => block.type === "diagram" && block.id === "rails")));
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
  assert.match(hkt, /Uniswap v4 hooked token/);
  assert.match(hkt, /80% Auto-Burn/);
  assert.match(hkt, /20% Deepen LPs/);
  assert.match(hkt, /Creator → Hook/);
  assert.match(hkt, /fees taken on \$HKT swaps burn \$HKT/);
  assert.match(hkt, /hkt-burn/);
  assert.match(hkt, /Live on Ink/);
  assert.match(hkt, /57073/);
  assert.equal(hkt.includes("Not live yet"), false);
  assert.equal(hkt.includes("HOOKTEST"), false);
  assert.equal(hkt.includes("HTST"), false);
  assert.equal(sections.find((section) => section.id === "hkt")?.group, "Tokenomics");
  assert.equal(DOCS_NAV.some((group) => group.group === "Tokenomics"), true);
  assert.equal(ids.at(-1), "terms");
  assert.equal(ids.indexOf("hkt"), ids.indexOf("integration") - 1);
  assert.ok(ids.indexOf("math") < ids.indexOf("hkt"));
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
    "deepen-lps",
    "auto-burn",
    "creator-share",
    "fixed-fees",
    "integration",
  ];
  for (const id of required) {
    assert.ok(ids.includes(id), `missing ${id}`);
  }
  const blob = JSON.stringify(sections);
  assert.match(blob, /BackedFloorNotAllowedInMulti/);
  assert.match(blob, /swapExactInComposite/);
  assert.match(blob, /Why we built on Quotrons/);
  assert.match(blob, /canonical hop/);
  assert.match(blob, /"type":"diagram","id":"quotrons-flywheel"/);
  assert.match(blob, /https:\/\/www\.quotrons\.cash\/docs/);
  assert.match(blob, /hardwired terminals/);
  assert.match(blob, /Do not mix their \$QUOTRON\/WETH 3%/);
  assert.match(blob, /\$250 USDG minimum/);
  assert.match(blob, /fee on the USDG leg/);
  assert.equal(blob.includes("Public LP deposits"), false);
  assert.match(blob, /V4ClaimsRedeemer/);
  assert.equal(blob.includes("supplies the holder set from the indexer"), false);
  assert.match(blob, /holderTracker/);
  assert.match(blob, /LpDeepened/);
  assert.match(blob, /already airdropped/);
  assert.match(blob, /quote accrued into BuybackVault/);
  assert.equal(blob.includes("Master (Launch Studio)"), false);
  assert.match(blob, /384 programmable hook combinations/);
  assert.match(blob, /Hookit is the first Uniswap v4 launchpad/);
  assert.equal(blob.includes("hookit is the first"), false);
  assert.match(blob, /Hold 1 \$HKT and you are exposed to every token launched/);
  assert.equal(blob.includes("hookit is a permissionless Uniswap v4 launchpad"), false);
  assert.equal(blob.includes("Master start FDV is about"), false);
  assert.equal(blob.includes("Creator flow"), false);
  assert.match(blob, /not financial advice/);
  assert.match(blob, /"href":"\/terms"/);
  assert.equal(blob.includes("Portfolio. Tokens you created"), false);
  assert.equal(blob.includes("What you can do"), false);
  assert.equal(blob.includes("What is immutable"), false);
  assert.equal(blob.includes("What the site adds"), false);
  assert.equal(blob.includes("What the site does not have"), false);
  assert.equal(blob.includes("What's what"), false);
  assert.equal(blob.includes("Custom Solidity hooks vs Builder"), false);
  assert.equal(blob.includes("Limit and stop"), false);
  assert.equal(blob.includes("Pro-mode"), false);
  assert.equal(ids.includes("support"), false);
  assert.equal(sections.filter((section) => section.id === "floor").length, 1);
});

test("hook figures use real diagrams plus worked examples, not 01-04 cards", () => {
  const visuals = readFileSync(new URL("../components/docs/DocsVisuals.tsx", import.meta.url), "utf8");
  assert.match(visuals, /#f97316/);
  assert.match(visuals, /theme="ember"/);
  assert.match(visuals, /50 such buys/);
  assert.match(visuals, /After burns/);
  assert.equal(visuals.includes("supply after burns"), false);
  assert.match(visuals, /docs-deepen-logo--deep/);
  assert.match(visuals, /Until FDV/);
  assert.match(visuals, /Retail 0\.2 ETH/);
  assert.match(visuals, /case "arb-keeper"/);
  assert.match(visuals, /<rect x="128" y="28"/);
  assert.equal(visuals.includes('<rect x="128" y="44"'), false);
  assert.match(visuals, /parts: \["t=0", "98%"\]/);
  assert.match(visuals, /parts: \["t=5s", "0%"\]/);
  assert.equal(visuals.includes("τ0 98%"), false);
  assert.equal(visuals.includes("T = 5s → 0"), false);
  assert.equal(visuals.includes("y: 104, text: \"T = 5s"), false);
  assert.match(visuals, /docs-wizard-shot/);
  assert.match(visuals, /Create a hooked token/);
  assert.match(visuals, /DocsLaunchSteps/);
  assert.match(visuals, /classic-quotes/);
  assert.match(visuals, /DocsBranchGraph/);
  const diagrams = readFileSync(new URL("../components/docs/DocsDiagrams.tsx", import.meta.url), "utf8");
  assert.match(diagrams, /docs-hkt-schema/);
  assert.match(diagrams, /docs-hkt-schema-join/);
  assert.match(diagrams, /DocsBranchGraph/);
  assert.match(diagrams, /docs-qfly/);
  assert.match(diagrams, /Hookit × Quotrons flywheel/);
  assert.match(diagrams, /hookit-owl-favicon/);
  assert.match(diagrams, /Launch your programmable hooks with our modules: floor, burn, vesting/);
  assert.equal(diagrams.includes("Owl totem"), false);
  const launchSteps = readFileSync(new URL("../components/docs/DocsLaunchSteps.tsx", import.meta.url), "utf8");
  assert.match(launchSteps, /Deepen LPs 20%/);
  assert.match(launchSteps, /hookId="auto-burn"/);
  assert.match(launchSteps, /hookId="deepen-lps"/);
  const page = readFileSync(new URL("../components/docs/DocsPage.tsx", import.meta.url), "utf8");
  assert.match(page, /docs-section-group/);
  assert.match(visuals, /docs-pipe/);
  assert.match(visuals, /docs-quotrons-stock/);
  assert.match(visuals, /case "router"/);
  assert.match(visuals, /case "creator-flow"/);
  assert.equal(visuals.includes('className="docs-wizard"'), false);
  const deepenBlock = visuals.split('case "deepen-lps"')[1]?.split("case \"")[0] ?? "";
  assert.equal(deepenBlock.includes("docs-visual-hook-row"), false);
  assert.equal(visuals.includes("pendingDeepenLps"), false);
  assert.equal(visuals.includes("Holders of $TICKER"), false);
});

test("docs copy has no em dashes or spaced hyphens", () => {
  const sections = JSON.stringify(buildDocsSections());
  assert.equal(sections.includes("\u2014"), false);
  assert.equal(sections.includes(" - "), false);
  const visuals = readFileSync(new URL("../components/docs/DocsVisuals.tsx", import.meta.url), "utf8");
  const diagrams = readFileSync(new URL("../components/docs/DocsDiagrams.tsx", import.meta.url), "utf8");
  assert.equal(visuals.includes("\u2014"), false);
  assert.equal(diagrams.includes("\u2014"), false);
  assert.equal(visuals.includes(" - "), false);
  assert.equal(diagrams.includes(" - "), false);
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

test("docs read as live and drop Analytics / testnet language", () => {
  const blob = JSON.stringify(buildDocsSections());
  const ids = buildDocsSections().map((section) => section.id);
  assert.equal(ids.includes("analytics"), false);
  assert.equal(blob.includes("Not live yet"), false);
  assert.equal(blob.includes("Base Sepolia"), false);
  assert.equal(blob.includes("HOOKTEST"), false);
  assert.equal(blob.includes("HTST"), false);
  assert.equal(blob.includes("Owl totem"), false);
  assert.equal(blob.toLowerCase().includes("paused"), false);
  assert.equal(blob.toLowerCase().includes("coming soon"), false);
  assert.equal(blob.toLowerCase().includes("testnet"), false);
  assert.match(blob, /Live on Ink/);
});
