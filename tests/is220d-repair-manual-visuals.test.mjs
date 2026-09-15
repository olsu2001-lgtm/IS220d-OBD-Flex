import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { IS220D_REPAIR_MANUAL_VISUALS, getIs220dRepairManualVisuals, buildIs220dRepairManualVisualsHtml } from "../src/is220d-repair-manual-visuals.js";
import { IS220D_VIKADIAG_OBD_TEST_CATALOG } from "../src/is220d-vikadiag-obd-test-catalog.js";
import { buildComponentDiagnosticCardHtml } from "../src/component-diagnostics-page.js";

test("new image mappings keep injector, pump and sensor identities separate", () => {
  const ids = component => getIs220dRepairManualVisuals(component).map(v => v.id);
  assert.deepEqual(ids("engine.main_injectors"), ["main-injectors-layout"]);
  assert.deepEqual(ids("engine.exhaust_fuel_addition_injector"), ["exhaust-injector-location"]);
  assert.deepEqual(ids("engine.cam_position_sensor"), ["cam-location"]);
  assert.deepEqual(ids("engine.crank_position_sensor"), ["crank-location"]);
  assert.deepEqual(ids("engine.scv"), []);
  assert.deepEqual(ids("engine.injection_pump"), ["supply-pump-layout"]);
  assert.deepEqual(ids("engine.supply_pump_drive_coupling"), ["supply-pump-layout"]);
  assert.deepEqual(ids("engine.coolant_temperature_sensor"), ["coolant-sensor-location"]);
  assert.equal(IS220D_VIKADIAG_OBD_TEST_CATALOG.find(x => x.sourceRow === 16).readiness, "needs-signal-verification");
  assert.equal(IS220D_VIKADIAG_OBD_TEST_CATALOG.find(x => x.sourceRow === 38).obdRole, "physical-only");
});

test("fuel, air-exhaust and starting inspection views render their component images", async () => {
  const fuel = await import("../src/is220d-fuel-inspection-points.js");
  const air = await import("../src/is220d-air-exhaust-inspection-points.js");
  const start = await import("../src/is220d-starting-charging-inspection-points.js");
  const fuelHtml = fuel.buildIs220dFuelInspectionScopeHtml(fuel.buildIs220dFuelInspectionScope("all"));
  const airHtml = air.buildIs220dAirExhaustInspectionScopeHtml(air.buildIs220dAirExhaustInspectionScope("all"));
  const startHtml = start.buildIs220dStartingChargingInspectionScopeHtml(start.buildIs220dStartingChargingInspectionScope("all"));
  assert.match(fuelHtml, /a133848e02.png/);
  assert.match(fuelHtml, /a130378e01.png/);
  assert.match(airHtml, /a122207e01.png/);
  assert.match(airHtml, /a122199e01.png/);
  assert.match(startHtml, /a122191e01.png/);
});


test("manual assets are exact reviewed PNG bytes with source provenance", () => {
  assert.equal(IS220D_REPAIR_MANUAL_VISUALS.length, 13);
  for (const visual of IS220D_REPAIR_MANUAL_VISUALS) {
    const bytes = readFileSync(new URL("../" + visual.assetPath, import.meta.url));
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(createHash("sha256").update(bytes).digest("hex"), visual.sha256);
    assert.match(visual.manualReference, /^rm0150\/repair2\/html\/contents\/rm[a-z0-9]+\.html$/);
    assert.equal(visual.figureReviewed, true);
    assert.equal(visual.status, "available");
    assert.ok(Object.isFrozen(visual));
  }
});

test("catalog and manual mappings agree without promoting unrelated components", () => {
  const available = IS220D_VIKADIAG_OBD_TEST_CATALOG.filter(x => x.manualVisual.status === "available");
  assert.deepEqual(available.map(x => x.sourceRow), [2, 4, 5, 6, 7, 8, 9, 16, 17, 34, 38, 40, 45, 46]);
  for (const item of available) {
    const visuals = getIs220dRepairManualVisuals(item.componentId);
    assert.deepEqual(item.manualVisual.visualIds, visuals.map(x => x.id));
    assert.ok(visuals.every(x => x.sourceRows.includes(item.sourceRow)));
  }
  assert.deepEqual(getIs220dRepairManualVisuals("engine.egr_no2_exhaust_gas_door"), []);
});

test("existing component cards render local images and leave unknown components empty", () => {
  const html = buildComponentDiagnosticCardHtml({ id: "engine.maf_sensor", label: "MAF" });
  assert.match(html, /assets\/repair-manual\/a122189e01.png/);
  assert.match(html, /alt="MAF-anturin sijainti"/);
  assert.match(html, /loading="lazy"/);
  assert.doesNotMatch(html, /src="https?:/);
  assert.equal(buildIs220dRepairManualVisualsHtml('"><script>'), "");
  assert.match(buildIs220dRepairManualVisualsHtml("brakes.rear_calipers"), /Ei satulan korjausohje/);
});

test("both DPNR tests and existing inspection points reuse the reviewed visual renderer", () => {
  for (const name of ["dpnr-cleaning-test.js", "dpnr-pressure-sensor-test.js"]) {
    const text = readFileSync(new URL("../src/" + name, import.meta.url), "utf8");
    assert.match(text, /panel.innerHTML \+= buildIs220dRepairManualVisualsHtml\("engine.dpnr_differential_pressure_sensor"\)/);
  }
  const points = readFileSync(new URL("../src/is220d-component-inspection-points.js", import.meta.url), "utf8");
  assert.match(points, /buildIs220dRepairManualVisualsHtml\(point.componentId\)/);
});
