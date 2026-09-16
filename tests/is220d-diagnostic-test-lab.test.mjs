import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDiagnosticTestLabModel,
  isDiagnosticTestLabCandidate
} from "../src/is220d-diagnostic-test-lab.js";
import {
  IS220D_VIKADIAG_OBD_TEST_CATALOG,
  VIKADIAG_TEST_READINESS
} from "../src/is220d-vikadiag-obd-test-catalog.js";

test("Test Lab includes OBD-relevant Drive rows but excludes physical-only rows", () => {
  const model = buildDiagnosticTestLabModel();
  assert.ok(model.items.length > 0);
  assert.ok(model.items.every(item => item.obdRole !== "physical-only"));
  assert.ok(model.items.every(item => item.readiness !== VIKADIAG_TEST_READINESS.PHYSICAL_ONLY));
  assert.ok(IS220D_VIKADIAG_OBD_TEST_CATALOG.some(candidate => !isDiagnosticTestLabCandidate(candidate)));
  assert.ok(model.items.some(item => item.readiness === VIKADIAG_TEST_READINESS.NEEDS_SIGNAL_VERIFICATION));
});

test("DPNR Drive row 5 exposes only the verified 217E to 617E signal identity", () => {
  const model = buildDiagnosticTestLabModel();
  const dpnr = model.items.find(item => item.sourceRow === 5);
  assert.ok(dpnr);
  assert.equal(dpnr.componentId, "engine.dpnr_differential_pressure_sensor");
  assert.equal(dpnr.runnable, true);
  const pressure = dpnr.signals.find(signal => signal.key === "engine.dpnr_differential_pressure");
  assert.ok(pressure);
  assert.deepEqual(pressure.commands, ["217E"]);
  assert.equal(pressure.expectedResponsePrefix, "617E");
  assert.equal(pressure.decoder, "toyota-2ad-fhv-217e-v1");
  assert.equal(pressure.productionAuthorized, true);
});

test("an attempted DPNR read without positive response is localized to request/response", () => {
  const coverage = {
    applicable: true,
    components: [{
      id: "engine.dpnr_differential_pressure_sensor",
      status: "unavailable",
      assessment: { status: "not-evaluated" },
      groupEvidence: [{
        signals: [{
          signalKey: "engine.dpnr_differential_pressure",
          command: "217E",
          attempted: true,
          observed: false,
          attempts: 3
        }]
      }]
    }]
  };
  const dpnr = buildDiagnosticTestLabModel({ coverage }).items.find(item => item.sourceRow === 5);
  assert.equal(dpnr.diagnosis.code, "request-response");
  assert.equal(dpnr.pipeline.find(stage => stage.id === "request").status, "ok");
  assert.equal(dpnr.pipeline.find(stage => stage.id === "response").status, "failed");
  assert.equal(dpnr.signals.find(signal => signal.key === "engine.dpnr_differential_pressure").attempts, 3);
});

test("observed DPNR evidence advances the visual chain without declaring component health", () => {
  const coverage = {
    applicable: true,
    components: [{
      id: "engine.dpnr_differential_pressure_sensor",
      status: "observed",
      assessment: { status: "normal-pattern" },
      groupEvidence: [{
        signals: [{
          signalKey: "engine.dpnr_differential_pressure",
          command: "217E",
          attempted: true,
          observed: true,
          attempts: 2
        }]
      }]
    }]
  };
  const dpnr = buildDiagnosticTestLabModel({ coverage }).items.find(item => item.sourceRow === 5);
  assert.equal(dpnr.diagnosis.code, "observed");
  assert.equal(dpnr.pipeline.find(stage => stage.id === "response").status, "ok");
  assert.match(dpnr.pipeline.find(stage => stage.id === "component").detail, /ei yksin ole kuntotuomio/i);
});

test("pending and blocked candidates cannot become runnable through signal metadata", () => {
  const model = buildDiagnosticTestLabModel();
  for (const item of model.items) {
    if ([VIKADIAG_TEST_READINESS.NEEDS_SIGNAL_VERIFICATION, VIKADIAG_TEST_READINESS.BLOCKED].includes(item.readiness)) {
      assert.equal(item.runnable, false, `Drive row ${item.sourceRow} must remain non-runnable`);
    }
    if (item.runnable) {
      assert.ok(item.signals.length > 0);
      assert.ok(item.signals.every(signal => signal.productionAuthorized));
      assert.ok(item.signals.every(signal => signal.authorization !== "field-rejected"));
      assert.ok(item.signals.every(signal => !signal.commands.includes("219C")));
    }
  }
});
