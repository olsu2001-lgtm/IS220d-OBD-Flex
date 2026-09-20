import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = relativePath => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("Flex UI skill and design system are durable repository contracts", async () => {
  const [agents, docsIndex, skill, design] = await Promise.all([
    read("AGENTS.md"),
    read("docs/README.md"),
    read("skills/flex-ui/SKILL.md"),
    read("docs/FLEX_UI_DESIGN_SYSTEM.md")
  ]);

  assert.match(agents, /skills\/flex-ui\/SKILL\.md/);
  assert.match(agents, /docs\/FLEX_UI_DESIGN_SYSTEM\.md/);
  assert.match(docsIndex, /FLEX_UI_DESIGN_SYSTEM\.md/);
  assert.match(docsIndex, /skills\/flex-ui\/SKILL\.md/);

  for (const required of [
    /one primary action/i,
    /progressive disclosure/i,
    /44 × 44 CSS px/i,
    /colour alone/i,
    /safe-area/i,
    /measurement availability/i,
    /assessment/i,
    /theme variables/i
  ]) {
    assert.match(skill, required);
  }

  assert.match(design, /Immediate layer/);
  assert.match(design, /Detail layer/);
  assert.match(design, /Technical layer/);
  assert.match(design, /DATA SAATU/);
  assert.match(design, /OK/);
  assert.match(design, /HUOMIO/);
  assert.match(design, /TARKISTA/);
  assert.match(design, /never overrides.*AGENTS\.md/is);
});

test("simplified shell keeps advanced connection and developer tools out of the primary path", async () => {
  const source = await read("src/simple-ui.js");

  assert.match(source, /Yhdistä autoon/);
  assert.match(source, /Yhteyden lisäasetukset/);
  assert.match(source, /Kehittäjä- ja tutkimustyökalut/);
  assert.match(source, /simple-secondary-nav/);
  assert.match(source, /Lisää toimintoja/);
  assert.match(source, /env\(safe-area-inset-bottom\)/);
  assert.match(source, /simple-inline-advanced > summary \{ min-height:44px/);
  assert.match(source, /simple-advanced > summary \{ display:flex; min-height:58px/);
  assert.match(source, /simple-more-action \{ min-height:52px/);
});

test("Health Check follows summary-first progressive disclosure with accessible touch targets", async () => {
  const source = await read("src/component-diagnostics-page.js");

  assert.match(source, /Aloita OBD Health Check/);
  assert.match(source, />OK<\/span>/);
  assert.match(source, />HUOMIO<\/span>/);
  assert.match(source, />TARKISTA<\/span>/);
  assert.match(source, /<details class="health-group">/);
  assert.match(source, /<details class="health-component/);
  assert.match(source, /<summary>Tekninen evidenssi<\/summary>/);
  assert.match(source, /health-summary>button\{appearance:none;min-height:52px/);
  assert.match(source, /health-filter-toggle\{min-height:44px/);
  assert.match(source, /health-group>summary\{display:flex;min-height:52px/);
  assert.match(source, /health-component>summary\{display:flex;min-height:48px/);
  assert.match(source, /bomDiagnosticRunState" class="inline-message hidden" role="status" aria-live="polite"/);
});

test("feature UI styles use shared theme tokens instead of hard-coded colours", async () => {
  const [simple, health] = await Promise.all([
    read("src/simple-ui.js"),
    read("src/component-diagnostics-page.js")
  ]);

  assert.doesNotMatch(simple, /#[0-9a-f]{6}\b/i);
  assert.doesNotMatch(health, /#[0-9a-f]{6}\b/i);
  assert.match(simple, /var\(--surface\)/);
  assert.match(simple, /var\(--muted\)/);
  assert.match(health, /var\(--surface\)/);
  assert.match(health, /var\(--warning\)/);
});

test("Health Check keeps data availability distinct from diagnostic assessment", async () => {
  const source = await read("src/component-diagnostics-page.js");

  assert.match(source, /DATA SAATU/);
  assert.match(source, /OSITTAIN/);
  assert.match(source, /EI VASTAUSTA/);
  assert.match(source, /EI TESTATTU/);
  assert.match(source, /ARVO USKOTTAVA/);
  assert.match(source, /POIKKEAMA/);
  assert.match(source, /VAHVA POIKKEAMA/);
  assert.match(source, /HEALTH_ASSESSMENT_LABEL/);
  assert.match(source, /Ei käytetä evidenssinä/);
});
