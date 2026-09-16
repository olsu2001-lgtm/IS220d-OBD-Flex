import test from "node:test";
import assert from "node:assert/strict";

import { PID_BY_ID } from "../src/core.js";
import { IS220D_DIAGNOSTIC_SIGNALS } from "../src/is220d-diagnostic-signals.js";
import {
  buildAllIs220dSelectiveDiagnosticPlans,
  buildIs220dSelectiveDiagnosticPlan
} from "../src/is220d-selective-diagnostic-plan.js";

function standardCommandForMetric(definition) {
  if (!Number.isInteger(definition?.pid)) return "";
  return `01${definition.pid.toString(16).padStart(2, "0").toUpperCase()}`;
}

test("every production-authorized diagnostic signal resolves to an existing Flex metric with matching command identity", () => {
  for (const signal of IS220D_DIAGNOSTIC_SIGNALS.filter(item => item.productionAuthorized)) {
    assert.ok(signal.metricIds?.length, `${signal.key} needs metricIds`);
    for (const metricId of signal.metricIds) {
      const metric = PID_BY_ID[metricId];
      assert.ok(metric, `${signal.key} references missing metric ${metricId}`);
      const command = metric.toyotaCommand || standardCommandForMetric(metric);
      assert.ok(command, `${metricId} has no production read identity`);
      assert.ok(signal.commands.includes(command), `${signal.key}/${metricId} command ${command} not declared in diagnostic signal`);
    }
  }
});

test("DPNR plan resolves only the verified 217E pressure metric and keeps dedicated runner identity", () => {
  const plan = buildIs220dSelectiveDiagnosticPlan("engine.dpnr_differential_pressure_sensor");
  assert.equal(plan.runnable, true);
  assert.equal(plan.dedicatedRunner, "dpnr-guided-217e");
  assert.deepEqual(plan.signalKeys, ["engine.dpnr_differential_pressure"]);
  assert.deepEqual(plan.metricIds, ["dpnrDifferentialPressure"]);
  assert.deepEqual(plan.commands, ["217E"]);
});

test("EGR direct plan prefers vehicle-verified Toyota 212C over research-candidate standard fallbacks", () => {
  const plan = buildIs220dSelectiveDiagnosticPlan("engine.egr_valve");
  assert.equal(plan.runnable, true);
  assert.deepEqual(plan.signalKeys, ["engine.egr_position_toyota"]);
  assert.deepEqual(plan.metricIds, ["toyotaEgrPosition"]);
  assert.deepEqual(plan.commands, ["212C"]);
});

test("indirect injector plan selects the minimum strongest authorized evidence groups and excludes screening IDs", () => {
  const plan = buildIs220dSelectiveDiagnosticPlan("engine.main_injectors");
  assert.equal(plan.runnable, true);
  assert.equal(plan.requiredGroups, 2);
  assert.deepEqual(plan.signalKeys, ["engine.rail_pressure_obd", "engine.rpm"]);
  assert.deepEqual(plan.metricIds, ["railPressure", "rpm"]);
  assert.deepEqual(plan.commands, ["0123", "010C"]);
  assert.equal(plan.commands.includes("2196"), false);
  assert.equal(plan.commands.includes("21AF"), false);
  assert.equal(plan.commands.includes("2193"), false);
  assert.equal(plan.commands.includes("219C"), false);
});

test("fuel-temperature sensor stays non-runnable because its only current signal is not production-authorized", () => {
  const plan = buildIs220dSelectiveDiagnosticPlan("engine.fuel_temperature_sensor");
  assert.equal(plan.runnable, false);
  assert.equal(plan.availableGroups, 0);
  assert.deepEqual(plan.signalKeys, []);
  assert.deepEqual(plan.metricIds, []);
  assert.deepEqual(plan.commands, []);
  assert.match(plan.reason, /0\/1/);
});

test("all component plans fail closed: no selected signal is unauthorized or unbound", () => {
  const plans = buildAllIs220dSelectiveDiagnosticPlans();
  assert.ok(plans.length > 0);
  for (const plan of plans) {
    for (const selected of plan.selectedSignals) {
      const signal = IS220D_DIAGNOSTIC_SIGNALS.find(item => item.key === selected.key);
      assert.equal(signal?.productionAuthorized, true, `${plan.componentId}/${selected.key}`);
      assert.ok(selected.metricIds.length > 0, `${plan.componentId}/${selected.key}`);
      assert.notEqual(signal?.authorization, "field-rejected");
      assert.notEqual(signal?.authorization, "not-authorized");
    }
    assert.equal(plan.commands.includes("219C"), false, `${plan.componentId} must never select field-rejected 219C`);
  }
});

test("unknown component has no plan instead of guessing a recipe", () => {
  assert.equal(buildIs220dSelectiveDiagnosticPlan("engine.unknown_future_part"), null);
});
