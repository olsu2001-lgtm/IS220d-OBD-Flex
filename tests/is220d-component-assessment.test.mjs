import test from "node:test";
import assert from "node:assert/strict";

import {
  decodeIs220dDiagnosticSignalResult,
  assessIs220dComponentEvidence
} from "../src/is220d-component-assessment.js";
import { buildIs220dComponentDiagnosticCoverage } from "../src/is220d-component-diagnostics.js";

const diagnosticResult = (command, raw, validResponse = true) => ({
  command,
  raw,
  validResponse,
  requestHeader: "7E0",
  error: validResponse ? "" : "NO DATA"
});

test("standard OBD signal decoder reuses existing Flex decoders", () => {
  const maf = decodeIs220dDiagnosticSignalResult("engine.maf", diagnosticResult("0110", "41 10 03 E8"));
  assert.equal(maf.signalKey, "engine.maf");
  assert.equal(maf.value, 10);
  assert.equal(maf.unit, "g/s");
  assert.equal(maf.evidence, "vehicle-verified");
  assert.equal(maf.inPlausibleRange, true);

  const coolant = decodeIs220dDiagnosticSignalResult("engine.coolant_temperature", diagnosticResult("0105", "41 05 82"));
  assert.equal(coolant.value, 90);
});

test("Toyota direct signals decode from already-collected 61xx responses", () => {
  const egr = decodeIs220dDiagnosticSignalResult("engine.egr_position_toyota", diagnosticResult("212C", "61 2C 80"));
  assert.ok(Math.abs(egr.value - 50.196) < 0.01);

  const inlet = decodeIs220dDiagnosticSignalResult("engine.egt_inlet", diagnosticResult("217F", "61 7F 01 00 01 10"));
  const outlet = decodeIs220dDiagnosticSignalResult("engine.egt_outlet", diagnosticResult("217F", "61 7F 01 00 01 10"));
  assert.equal(inlet.value, 160);
  assert.equal(outlet.value, 170);
});

test("DIRECT component reports normal-pattern only for vehicle-verified plausible numeric evidence", () => {
  const coverage = buildIs220dComponentDiagnosticCoverage({
    meta: { vehicleKey: "is220d" },
    results: [diagnosticResult("0110", "41 10 03 E8")]
  });
  const maf = coverage.components.find(component => component.id === "engine.maf_sensor");
  assert.equal(maf.status, "observed");
  assert.equal(maf.assessment.status, "normal-pattern");
  assert.equal(maf.assessment.values[0].signalKey, "engine.maf");
  assert.match(maf.assessment.limitations.join(" "), /ei todista komponenttia ehjäksi/i);
});

test("vehicle-verified direct value outside structural plausibility range becomes strong-deviation", () => {
  const coverage = buildIs220dComponentDiagnosticCoverage({
    meta: { vehicleKey: "is220d" },
    results: [diagnosticResult("217E", "61 7E FF FF 00 00")]
  });
  const pressure = coverage.components.find(component => component.id === "engine.dpnr_differential_pressure_sensor");
  assert.equal(pressure.status, "observed");
  assert.equal(pressure.assessment.status, "strong-deviation");
  assert.equal(pressure.assessment.values[0].inPlausibleRange, false);
  assert.match(pressure.assessment.limitations.join(" "), /ei yksin todista fyysisen osan vikasyytä/i);
});

test("Techstream-derived DIRECT value remains inconclusive until vehicle verification", () => {
  const coverage = buildIs220dComponentDiagnosticCoverage({
    meta: { vehicleKey: "is220d" },
    results: [diagnosticResult("2193", "61 93 50")]
  });
  const fuelTemperature = coverage.components.find(component => component.id === "engine.fuel_temperature_sensor");
  assert.equal(fuelTemperature.status, "observed");
  assert.equal(fuelTemperature.assessment.status, "inconclusive");
  assert.equal(fuelTemperature.assessment.values[0].evidence, "techstream-derived");
});

test("INDIRECT component stays not-evaluated even when signal coverage is complete", () => {
  const coverage = buildIs220dComponentDiagnosticCoverage({
    meta: { vehicleKey: "is220d" },
    results: [
      diagnosticResult("010B", "41 0B 64"),
      diagnosticResult("0110", "41 10 03 E8"),
      diagnosticResult("0133", "41 33 65")
    ]
  });
  const turbo = coverage.components.find(component => component.id === "engine.turbocharger");
  assert.equal(turbo.status, "observed");
  assert.equal(turbo.assessment.status, "not-evaluated");
  assert.match(turbo.assessment.reason, /korrelaatio/i);
});

test("positive response with undecodable raw payload is inconclusive rather than normal", () => {
  const component = {
    diagnosticClass: "direct",
    status: "observed",
    groupEvidence: [{ signals: [{ signalKey: "engine.maf", observed: true }] }]
  };
  const assessment = assessIs220dComponentEvidence(component, [diagnosticResult("0110", "41 10")]);
  assert.equal(assessment.status, "inconclusive");
});
