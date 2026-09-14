import test from "node:test";
import assert from "node:assert/strict";

import { buildIs220dDiagnosticGroupPlan } from "../src/is220d-diagnostic-plan.js";

const result = (command, validResponse = true) => ({
  command,
  requestHeader: "7E0",
  validResponse,
  raw: validResponse ? `positive:${command}` : "NO DATA"
});

test("air/turbo/EGR plan deduplicates shared signals across components", () => {
  const plan = buildIs220dDiagnosticGroupPlan("air-intake-turbo-egr");
  assert.equal(plan.summary.componentCount, 9);
  assert.ok(plan.summary.selectedSignalCount < plan.components.reduce((sum, component) => sum + component.groupPlans.length, 0));

  const egr = plan.signals.find(signal => signal.signalKey === "engine.egr_position_toyota");
  assert.ok(egr);
  assert.deepEqual(egr.commands, ["212C"]);
  assert.equal(egr.planState, "available-in-current-wide-diagnostic");
  assert.ok(egr.usedBy.includes("engine.egr_valve"));
  assert.ok(egr.usedBy.includes("engine.turbocharger"));
  assert.ok(egr.usedBy.includes("engine.intake_manifold"));
});

test("plan prefers current vehicle-verified wide-diagnostic evidence over alternatives", () => {
  const air = buildIs220dDiagnosticGroupPlan("air-intake-turbo-egr");
  const egrComponent = air.components.find(component => component.componentId === "engine.egr_valve");
  assert.equal(egrComponent.groupPlans[0].selectedSignalKey, "engine.egr_position_toyota");

  const fuel = buildIs220dDiagnosticGroupPlan("fuel-rail-injection");
  const rail = fuel.components.find(component => component.componentId === "engine.common_rail_pressure_sensor");
  assert.equal(rail.groupPlans[0].selectedSignalKey, "engine.rail_pressure_obd");
});

test("already collected signal satisfies every component group that shares it", () => {
  const plan = buildIs220dDiagnosticGroupPlan("air-intake-turbo-egr", {
    results: [result("010B"), result("0110"), result("0133"), result("212C")]
  });
  assert.equal(plan.signals.find(signal => signal.signalKey === "engine.map")?.planState, "already-observed");
  assert.equal(plan.signals.find(signal => signal.signalKey === "engine.maf")?.planState, "already-observed");
  assert.equal(plan.signals.find(signal => signal.signalKey === "engine.egr_position_toyota")?.planState, "already-observed");
  assert.equal(plan.components.find(component => component.componentId === "engine.turbocharger")?.coverageSatisfied, true);
  assert.equal(plan.components.find(component => component.componentId === "engine.intake_manifold")?.coverageSatisfied, true);
});

test("Techstream-derived missing evidence is visible but never promoted to a transport action", () => {
  const plan = buildIs220dDiagnosticGroupPlan("fuel-rail-injection");
  const fuelTemperature = plan.signals.find(signal => signal.signalKey === "engine.fuel_temperature_screening");
  assert.ok(fuelTemperature);
  assert.equal(fuelTemperature.planState, "not-authorized");
  assert.equal(fuelTemperature.productionAuthorized, false);
  assert.equal(plan.transportBoundary, "metadata-only; execution remains in the existing profile-authorized wide diagnostic");
});

test("field-rejected 219C cannot enter any physical-group selected plan", () => {
  for (const groupId of ["air-intake-turbo-egr", "fuel-rail-injection", "dpnr-exhaust", "starting-charging-position", "engine-thermal-baseline"]) {
    const plan = buildIs220dDiagnosticGroupPlan(groupId);
    assert.equal(plan.signals.some(signal => signal.commands.includes("219C")), false, groupId);
    assert.equal(plan.summary.fieldRejected, 0, groupId);
  }
});
