import test from "node:test";
import assert from "node:assert/strict";

import {
  IS220D_VIKADIAG_OBD_TEST_CATALOG,
  IS220D_VIKADIAG_OBD_TEST_SOURCE,
  VIKADIAG_TEST_READINESS,
  getVikadiagObdTestCandidateByRow,
  summarizeVikadiagObdTestCatalog
} from "../src/is220d-vikadiag-obd-test-catalog.js";
import {
  getIs220dDiagnosticSignal,
  isProductionAuthorizedIs220dSignal
} from "../src/is220d-diagnostic-signals.js";

const READY_WITHOUT_NEW_SIGNAL = new Set([
  VIKADIAG_TEST_READINESS.IMPLEMENTED_DEDICATED,
  VIKADIAG_TEST_READINESS.READY_EXISTING_SIGNALS,
  VIKADIAG_TEST_READINESS.INDIRECT_EXISTING_SIGNALS
]);

function walk(value, visit) {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    visit(key, nested);
    if (nested && typeof nested === "object") walk(nested, visit);
  }
}

test("first Vikadiag batch maps Drive rows 2-10 exactly once", () => {
  assert.equal(IS220D_VIKADIAG_OBD_TEST_SOURCE, "Bom-kaapija / Vikadiag_kohteet");
  assert.deepEqual(
    IS220D_VIKADIAG_OBD_TEST_CATALOG.map(item => item.sourceRow),
    [2, 3, 4, 5, 6, 7, 8, 9, 10]
  );
  assert.equal(new Set(IS220D_VIKADIAG_OBD_TEST_CATALOG.map(item => item.sourceRow)).size, 9);
});

test("ready candidates only reference production-authorized existing signals", () => {
  for (const candidate of IS220D_VIKADIAG_OBD_TEST_CATALOG) {
    for (const signalKey of candidate.signalKeys) {
      assert.ok(getIs220dDiagnosticSignal(signalKey), `${candidate.sourceRow}: ${signalKey} must exist`);
      if (READY_WITHOUT_NEW_SIGNAL.has(candidate.readiness)) {
        assert.equal(
          isProductionAuthorizedIs220dSignal(signalKey),
          true,
          `${candidate.sourceRow}: ${signalKey} cannot make a test ready before authorization`
        );
      }
    }
  }
});

test("catalog is transport-free and cannot smuggle raw vehicle commands", () => {
  const forbiddenKeys = new Set(["command", "commands", "rawCommand", "service", "requestHeader", "responseHeader"]);
  for (const candidate of IS220D_VIKADIAG_OBD_TEST_CATALOG) {
    walk(candidate, key => {
      assert.equal(forbiddenKeys.has(key), false, `row ${candidate.sourceRow} contains forbidden transport field ${key}`);
    });
  }
});

test("Drive active-test and forced-regeneration suggestions remain explicit exclusions", () => {
  assert.ok(getVikadiagObdTestCandidateByRow(2).excludedActions.includes("active-test"));
  assert.ok(getVikadiagObdTestCandidateByRow(3).excludedActions.includes("active-test"));
  assert.ok(getVikadiagObdTestCandidateByRow(9).excludedActions.includes("active-test"));
  assert.ok(getVikadiagObdTestCandidateByRow(9).excludedActions.includes("forced-regeneration"));
});

test("field-rejected injector feedback never becomes test evidence", () => {
  const injectors = getVikadiagObdTestCandidateByRow(8);
  assert.ok(injectors.blockedSignalKeys.includes("engine.injection_feedback_rejected"));
  assert.equal(injectors.signalKeys.includes("engine.injection_feedback_rejected"), false);
  assert.equal(getIs220dDiagnosticSignal("engine.injection_feedback_rejected").authorization, "field-rejected");
});

test("every reviewed diagnostic row has a repair-manual visual extraction plan", () => {
  for (const candidate of IS220D_VIKADIAG_OBD_TEST_CATALOG) {
    assert.equal(candidate.manualVisual.required, true, `row ${candidate.sourceRow} must require a manual visual`);
    assert.equal(candidate.manualVisual.source, "Lexus IS250/220D repair manual");
    assert.ok(candidate.manualVisual.searchTerms.length > 0, `row ${candidate.sourceRow} needs manual search terms`);
    assert.equal(candidate.manualVisual.assetPath, null, `row ${candidate.sourceRow} must not pretend an image has already been extracted`);
  }
});

test("DPNR row is linked to the already delivered dedicated test, not duplicated", () => {
  const dpnr = getVikadiagObdTestCandidateByRow(5);
  assert.equal(dpnr.readiness, VIKADIAG_TEST_READINESS.IMPLEMENTED_DEDICATED);
  assert.match(dpnr.existingImplementation, /0\.9\.4.*DPNR/i);
  assert.deepEqual(dpnr.signalKeys, ["engine.dpnr_differential_pressure", "engine.rpm"]);
});

test("EGR No.2 stays pending until a component-specific signal is verified", () => {
  const egr2 = getVikadiagObdTestCandidateByRow(3);
  assert.equal(egr2.readiness, VIKADIAG_TEST_READINESS.NEEDS_SIGNAL_VERIFICATION);
  assert.match(egr2.note, /ei ole vielä ajoneuvovarmennettua/i);
});

test("catalog summary distinguishes implemented, ready, indirect and pending rows", () => {
  assert.deepEqual(summarizeVikadiagObdTestCatalog(), {
    total: 9,
    implementedDedicated: 1,
    readyExistingSignals: 4,
    indirectExistingSignals: 3,
    needsSignalVerification: 1,
    blocked: 0,
    manualVisualPending: 9
  });
});
