import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  getCurrentObdDiagnosticCandidates,
  buildVikadiagObdDiagnosticCatalogHtml
} from "../src/vikadiag-obd-diagnostic-page.js";
import { isProductionAuthorizedIs220dSignal } from "../src/is220d-diagnostic-signals.js";
import { IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES } from "../src/is220d-repair-manual-visual-candidates.js";
import { getIs220dObdDiagnosticVisuals } from "../src/is220d-obd-diagnostic-visuals.js";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

async function sha256(path) {
  const bytes = await readFile(path);
  return createHash("sha256").update(bytes).digest("hex");
}

test("OBD diagnostics page exposes only currently readable direct/indirect rows", () => {
  const candidates = getCurrentObdDiagnosticCandidates();
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every(item => item.obdRole === "direct" || item.obdRole === "indirect"));
  assert.ok(candidates.every(item => !["needs-signal-verification", "physical-only", "blocked"].includes(item.readiness)));
  for (const item of candidates) {
    assert.ok(item.signalKeys.length > 0, `row ${item.sourceRow} must have readable signals`);
    assert.ok(item.signalKeys.every(isProductionAuthorizedIs220dSignal), `row ${item.sourceRow} cannot expose an unauthorized signal`);
    assert.ok(!item.signalKeys.includes("engine.injection_feedback_rejected"));
  }
});

test("reviewed 2AD-FHV candidate figures are actually packaged byte-for-byte", async () => {
  const unique = new Map(IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES.map(item => [item.targetAssetPath, item.sourceImageSha256]));
  for (const [assetPath, expected] of unique) {
    assert.equal(await sha256(`${repoRoot}${assetPath}`), expected, assetPath);
  }
});

test("OBD cards use reviewed manual visuals when a mapping exists", () => {
  const candidates = getCurrentObdDiagnosticCandidates();
  const mapped = candidates.filter(item => getIs220dObdDiagnosticVisuals(item.componentId).length > 0);
  assert.ok(mapped.length >= 20, "expected most current OBD rows to have a reviewed manual image");
  const html = buildVikadiagObdDiagnosticCatalogHtml();
  assert.match(html, /OBD-diagnostiikkakohteet/);
  assert.match(html, /RM0150/);
  assert.doesNotMatch(html, /219C/);
  assert.doesNotMatch(html, /Active Testiä[^<]*käytetään/i);
});
