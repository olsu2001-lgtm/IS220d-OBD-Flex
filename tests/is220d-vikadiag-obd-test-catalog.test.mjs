import test from "node:test";
import assert from "node:assert/strict";

import {
  IS220D_VIKADIAG_OBD_TEST_CATALOG,
  IS220D_VIKADIAG_OBD_TEST_SOURCE,
  VIKADIAG_TEST_READINESS,
  getVikadiagObdTestCandidateByRow,
  validateVikadiagObdTestCandidate,
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
    IS220D_VIKADIAG_OBD_TEST_CATALOG.filter(item => item.sourceRow <= 10).map(item => item.sourceRow),
    [2, 3, 4, 5, 6, 7, 8, 9, 10]
  );
  assert.equal(new Set(IS220D_VIKADIAG_OBD_TEST_CATALOG.map(item => item.sourceRow)).size, IS220D_VIKADIAG_OBD_TEST_CATALOG.length);
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
  assert.deepEqual(summarizeVikadiagObdTestCatalog(IS220D_VIKADIAG_OBD_TEST_CATALOG.filter(item => item.sourceRow <= 10)), {
    total: 9,
    implementedDedicated: 1,
    readyExistingSignals: 4,
    indirectExistingSignals: 3,
    needsSignalVerification: 1,
    blocked: 0,
    physicalOnly: 0,
    manualVisualPending: 9
  });
});



test("continuation covers each Drive row through 25 without restarting the first batch", () => {
  assert.deepEqual(IS220D_VIKADIAG_OBD_TEST_CATALOG.map(x => x.sourceRow), Array.from({ length: 24 }, (_, i) => i + 2));
});

test("physical rows cannot acquire OBD evidence, pending cam row cannot prove synchronization", () => {
  for (const row of [13, 14, 15]) {
    const item = getVikadiagObdTestCandidateByRow(row);
    assert.equal(item.obdRole, "physical-only");
    assert.deepEqual(item.signalKeys, []);
    assert.equal(item.readiness, VIKADIAG_TEST_READINESS.PHYSICAL_ONLY);
  }
  const cam = getVikadiagObdTestCandidateByRow(16);
  assert.equal(cam.readiness, VIKADIAG_TEST_READINESS.NEEDS_SIGNAL_VERIFICATION);
  assert.equal(cam.oe, "90919-05029");
  assert.match(cam.expectedPattern, /myös nokkasignaalin puuttuessa/);
  assert.equal(getVikadiagObdTestCandidateByRow(17).oe, "90919-05069");
});

test("continuation has traceable evidence, source rows and unclaimed manual visuals", () => {
  for (const item of IS220D_VIKADIAG_OBD_TEST_CATALOG.filter(x => x.sourceRow >= 11)) {
    assert.equal(validateVikadiagObdTestCandidate(item), item);
    assert.equal(item.source.spreadsheetId, "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8");
    assert.equal(item.source.sheet, "Vikadiag_kohteet");
    assert.equal(item.manualVisual.status, "pending-extract");
    assert.equal(item.manualVisual.manualReference, null);
    assert.ok(item.manualVisual.targetViews.includes("inspection diagram"));
    assert.deepEqual(item.signalEvidence.map(x => x.key), item.signalKeys);
    for (const evidence of item.signalEvidence) {
      assert.equal(evidence.evidence, getIs220dDiagnosticSignal(evidence.key).evidence);
      assert.equal(evidence.evidence, "vehicle-verified");
    }
    assert.ok(Object.isFrozen(item));
    assert.ok(Object.isFrozen(item.recipes));
  }
});

test("review validator fails closed on unsafe or misleading metadata", () => {
  const copy = row => structuredClone(getVikadiagObdTestCandidateByRow(row));
  let bad = copy(13); bad.signalKeys = ["engine.rpm"];
  assert.throws(() => validateVikadiagObdTestCandidate(bad), /Physical-only/);
  bad = copy(16); bad.missingSignals = [];
  assert.throws(() => validateVikadiagObdTestCandidate(bad), /evidence gap/);
  bad = copy(18); bad.source.row = 19;
  assert.throws(() => validateVikadiagObdTestCandidate(bad), /provenance/);
  bad = copy(18); bad.recipes[1].signalKeys.push("engine.injection_feedback_rejected");
  assert.throws(() => validateVikadiagObdTestCandidate(bad), /outside reviewed evidence/);
  bad = copy(18); bad.recipes[1].rawCommand = "219C";
  assert.throws(() => validateVikadiagObdTestCandidate(bad), /Forbidden catalog field/);
  bad = copy(18); bad.recipes[1].passThreshold = 1;
  assert.throws(() => validateVikadiagObdTestCandidate(bad), /Forbidden catalog field/);
});
