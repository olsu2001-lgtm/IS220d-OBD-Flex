import test from "node:test";
import assert from "node:assert/strict";

import { IS220D_COMPONENT_DIAGNOSTICS } from "../src/is220d-component-diagnostics.js";
import {
  IS220D_DIAGNOSTIC_GROUPS,
  getIs220dDiagnosticGroup,
  getIs220dDiagnosticGroupForComponent,
  is220dDiagnosticComponentsForGroup
} from "../src/is220d-diagnostic-groups.js";

test("all 23 BOM diagnostic components belong to exactly one physical group", () => {
  const grouped = IS220D_DIAGNOSTIC_GROUPS.flatMap(group => group.componentIds);
  assert.equal(grouped.length, 23);
  assert.equal(new Set(grouped).size, 23);
  assert.deepEqual(new Set(grouped), new Set(IS220D_COMPONENT_DIAGNOSTICS.map(component => component.id)));
});

test("air/turbo/EGR group contains the physically related intake and vacuum targets", () => {
  const group = getIs220dDiagnosticGroup("air-intake-turbo-egr");
  assert.ok(group);
  for (const id of [
    "engine.maf_sensor",
    "engine.map_sensor",
    "engine.egr_valve",
    "engine.turbocharger",
    "engine.intercooler",
    "engine.intake_manifold",
    "engine.vacuum_regulating_valve",
    "engine.vacuum_switching_valve",
    "engine.air_cleaner_hose"
  ]) assert.ok(group.componentIds.includes(id), `${id} missing from intake group`);
});

test("fuel and DPNR groups keep the exhaust addition injector with aftertreatment", () => {
  assert.equal(getIs220dDiagnosticGroupForComponent("engine.main_injectors")?.id, "fuel-rail-injection");
  assert.equal(getIs220dDiagnosticGroupForComponent("engine.exhaust_fuel_addition_injector")?.id, "dpnr-exhaust");
  assert.equal(is220dDiagnosticComponentsForGroup("dpnr-exhaust").length, 4);
});

test("starting group combines voltage/RPM evidence without moving coolant into it", () => {
  assert.equal(getIs220dDiagnosticGroupForComponent("engine.starter")?.id, "starting-charging-position");
  assert.equal(getIs220dDiagnosticGroupForComponent("engine.alternator")?.id, "starting-charging-position");
  assert.equal(getIs220dDiagnosticGroupForComponent("engine.crank_position_sensor")?.id, "starting-charging-position");
  assert.equal(getIs220dDiagnosticGroupForComponent("engine.coolant_temperature_sensor")?.id, "engine-thermal-baseline");
});
