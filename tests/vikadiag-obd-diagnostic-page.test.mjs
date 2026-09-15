import test from "node:test";
import assert from "node:assert/strict";
import {
  getCurrentObdDiagnosticCandidates,
  buildVikadiagObdDiagnosticCatalogHtml
} from "../src/vikadiag-obd-diagnostic-page.js";
import { isProductionAuthorizedIs220dSignal } from "../src/is220d-diagnostic-signals.js";
import { getIs220dObdDiagnosticVisuals } from "../src/is220d-obd-diagnostic-visuals.js";

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

test("OBD cards use already packaged original RM0150 figures when a mapping exists", () => {
  const candidates = getCurrentObdDiagnosticCandidates();
  const mapped = candidates.filter(item => getIs220dObdDiagnosticVisuals(item.componentId).length > 0);
  assert.ok(mapped.length >= 8, "expected core current OBD rows to have packaged manual images");
  for (const item of mapped) {
    for (const visual of getIs220dObdDiagnosticVisuals(item.componentId)) {
      assert.equal(visual.status, "available");
      assert.equal(visual.figureReviewed, true);
      assert.match(visual.assetPath, /^assets\/repair-manual\//);
      assert.match(visual.sha256, /^[a-f0-9]{64}$/);
    }
  }
});

test("OBD catalog is read-only and clearly separates missing visual coverage", () => {
  const html = buildVikadiagObdDiagnosticCatalogHtml();
  assert.match(html, /OBD-diagnostiikkakohteet/);
  assert.match(html, /RM0150/);
  assert.match(html, /vain lukutoiminnot/);
  assert.doesNotMatch(html, /219C/);
  assert.doesNotMatch(html, /Active Testiä[^<]*käytetään/i);
});
