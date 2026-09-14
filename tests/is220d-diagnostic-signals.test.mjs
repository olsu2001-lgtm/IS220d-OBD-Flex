import test from "node:test";
import assert from "node:assert/strict";

import {
  IS220D_DIAGNOSTIC_SIGNALS,
  getIs220dDiagnosticSignal,
  commandsForIs220dDiagnosticSignal,
  isProductionAuthorizedIs220dSignal
} from "../src/is220d-diagnostic-signals.js";
import { IS220D_COMPONENT_DIAGNOSTICS, buildIs220dComponentDiagnosticCoverage } from "../src/is220d-component-diagnostics.js";

const flattenRecipeSignalKeys = () => IS220D_COMPONENT_DIAGNOSTICS.flatMap(component => component.signalGroups.flat());

test("signal registry has stable unique keys and every BOM recipe reference resolves", () => {
  const keys = IS220D_DIAGNOSTIC_SIGNALS.map(signal => signal.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const key of flattenRecipeSignalKeys()) {
    assert.ok(getIs220dDiagnosticSignal(key), `missing signal registry entry for ${key}`);
    assert.ok(commandsForIs220dDiagnosticSignal(key).length > 0, `${key} must resolve to an existing command identity`);
  }
});

test("Toyota production authorization remains limited to the verified 212C/217E/217F reads", () => {
  const authorizedToyotaCommands = IS220D_DIAGNOSTIC_SIGNALS
    .filter(signal => signal.authorization === "vehicle-profile" && signal.productionAuthorized)
    .flatMap(signal => signal.commands);
  assert.deepEqual(new Set(authorizedToyotaCommands), new Set(["212C", "217E", "217F"]));
});

test("Techstream-derived screening signals remain non-production and 219C remains field-rejected", () => {
  for (const key of ["engine.fuel_temperature_screening", "engine.rail_pressure_screening", "engine.injection_timing_screening"]) {
    const signal = getIs220dDiagnosticSignal(key);
    assert.equal(signal.evidence, "techstream-derived");
    assert.equal(signal.productionAuthorized, false);
    assert.equal(signal.authorization, "not-authorized");
  }
  const rejected = getIs220dDiagnosticSignal("engine.injection_feedback_rejected");
  assert.deepEqual(rejected.commands, ["219C"]);
  assert.equal(rejected.authorization, "field-rejected");
  assert.equal(isProductionAuthorizedIs220dSignal(rejected.key), false);
  assert.equal(flattenRecipeSignalKeys().includes(rejected.key), false);
});

test("named-signal migration preserves existing command-based coverage semantics", () => {
  const result = command => ({ command, requestHeader: "7E0", validResponse: true });
  const coverage = buildIs220dComponentDiagnosticCoverage({
    meta: { vehicleKey: "is220d" },
    results: [result("010B"), result("0110"), result("0133"), result("217F")]
  });
  const turbo = coverage.components.find(component => component.id === "engine.turbocharger");
  assert.equal(turbo.status, "observed");
  assert.equal(turbo.observedGroups, 3);
  assert.deepEqual(turbo.groupEvidence[0].signalKeys, ["engine.map"]);
  assert.deepEqual(turbo.groupEvidence[0].commands, ["010B"]);

  const egt1 = coverage.components.find(component => component.id === "engine.exhaust_gas_temperature_sensor_1");
  const egt2 = coverage.components.find(component => component.id === "engine.exhaust_gas_temperature_sensor_2");
  assert.equal(egt1.status, "observed");
  assert.equal(egt2.status, "observed");
  assert.equal(egt1.groupEvidence[0].signals[0].signalKey, "engine.egt_inlet");
  assert.equal(egt2.groupEvidence[0].signals[0].signalKey, "engine.egt_outlet");
});

test("219C result can never satisfy a recipe through the named registry", () => {
  const coverage = buildIs220dComponentDiagnosticCoverage({
    meta: { vehicleKey: "is220d" },
    results: [{ command: "219C", requestHeader: "7E0", validResponse: true }]
  });
  const injectors = coverage.components.find(component => component.id === "engine.main_injectors");
  assert.equal(injectors.status, "not-tested");
  assert.equal(injectors.observedGroups, 0);
  assert.deepEqual(injectors.excludedSignalKeys, ["engine.injection_feedback_rejected"]);
});
