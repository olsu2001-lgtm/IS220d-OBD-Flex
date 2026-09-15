import test from "node:test";
import assert from "node:assert/strict";
import {
  IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES,
  getIs220dRepairManualVisualCandidate
} from "../src/is220d-repair-manual-visual-candidates.js";
import { getIs220dRepairManualVisuals } from "../src/is220d-repair-manual-visuals.js";

const EXPECTED_ROWS = [11, 12, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 32, 33, 35, 36, 37, 61, 63, 64, 65, 66, 67, 68];

test("manual-image candidate review keeps exact 2AD-FHV sources for twenty-six diagnostic components", () => {
  assert.equal(IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES.length, 26);
  assert.deepEqual(
    [...IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES].map(x => x.sourceRow).sort((a,b) => a-b),
    EXPECTED_ROWS
  );
  assert.equal(new Set(IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES.map(x => x.componentId)).size, 26);
  for (const item of IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES) {
    assert.equal(item.engineFamily, "2AD-FHV");
    assert.equal(item.status, "source-identified");
    assert.match(item.sourceImagePath, /^rm0150\/repair2\/img\/[a-z0-9]+\.png$/);
    assert.match(item.manualReference, /^rm0150\/repair2\/html\/contents\/rm[a-z0-9]+\.html$/);
    assert.match(item.sourceImageSha256, /^[a-f0-9]{64}$/);
    assert.match(item.sourceHtmlSha256, /^[a-f0-9]{64}$/);
    assert.equal(item.targetAssetPath, `assets/repair-manual/${item.sourceImagePath.split("/").at(-1)}`);
    assert.equal(Object.isFrozen(item), true);
  }
});

test("source-identified candidates do not pretend that PNG assets are already packaged", () => {
  for (const item of IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES) {
    assert.deepEqual(getIs220dRepairManualVisuals(item.componentId), []);
  }
  assert.equal(getIs220dRepairManualVisualCandidate("engine.turbocharger")?.sourceImagePath, "rm0150/repair2/img/a122209e03.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.intercooler")?.sourceImagePath, "rm0150/repair2/img/a132945e01.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.water_pump")?.sourceImagePath, "rm0150/repair2/img/a132388e01.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.radiator")?.sourceImagePath, "rm0150/repair2/img/a134875e01.png");
});

test("cooling candidates reject the visually similar 4GR-FSE component pages", () => {
  const refs = IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES.map(item => item.manualReference);
  assert.ok(!refs.some(ref => ref.includes("rm000001bjy006x")), "4GR-FSE WATER PUMP page must not be mapped to IS220d");
  assert.ok(!refs.some(ref => ref.includes("rm000001bjv006x")), "4GR-FSE RADIATOR page must not be mapped to IS220d");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.water_pump")?.manualReference, "rm0150/repair2/html/contents/rm000000v1h00ix.html");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.radiator")?.manualReference, "rm0150/repair2/html/contents/rm000000v1x00jx.html");
});

test("shared figures are mapped only where the figure or source step supports the reviewed component", () => {
  assert.equal(getIs220dRepairManualVisualCandidate("engine.air_cleaner_housing")?.sourceImagePath, "rm0150/repair2/img/a133283e01.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.air_cleaner_hose")?.sourceImagePath, "rm0150/repair2/img/a133283e01.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.intake_manifold")?.sourceImagePath, "rm0150/repair2/img/a131695.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.intake_manifold_gasket")?.sourceImagePath, "rm0150/repair2/img/a131695.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.exhaust_manifold_gasket")?.sourceImagePath, "rm0150/repair2/img/a122201e01.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.turbo_exhaust_gaskets")?.sourceImagePath, "rm0150/repair2/img/a122201e01.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.turbo_oil_pipes")?.sourceImagePath, "rm0150/repair2/img/a122209e03.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.vacuum_hoses")?.sourceImagePath, "rm0150/repair2/img/a122208e01.png");
  assert.match(getIs220dRepairManualVisualCandidate("engine.vacuum_hoses")?.caption || "", /paikallinen esimerkki/i);
  assert.equal(getIs220dRepairManualVisualCandidate("engine.cooling_fans")?.sourceImagePath, "rm0150/repair2/img/a134875e01.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.expansion_tank_cap")?.sourceImagePath, "rm0150/repair2/img/a134875e01.png");
});

test("reviewed fuel and belt-drive figures keep exact component identities", () => {
  assert.equal(getIs220dRepairManualVisualCandidate("engine.fuel_filter")?.sourceImagePath, "rm0150/repair2/img/a135220e01.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.fuel_sedimenter")?.sourceImagePath, "rm0150/repair2/img/a133199e01.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.injection_high_pressure_pipes")?.sourceImagePath, "rm0150/repair2/img/a130379e01.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.low_pressure_fuel_hoses")?.sourceImagePath, "rm0150/repair2/img/a134252.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.low_pressure_fuel_hoses")?.manualReference, "rm0150/repair2/html/contents/rm0000024nj000x.html");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.fuel_check_valve")?.sourceImagePath, "rm0150/repair2/img/a133848e02.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.idler_pulleys")?.sourceImagePath, "rm0150/repair2/img/a131681.png");
  const tensioner = getIs220dRepairManualVisualCandidate("engine.belt_tensioner");
  assert.equal(tensioner?.id, "belt-tensioner-removal");
  assert.equal(tensioner?.sourceImagePath, "rm0150/repair2/img/a111243.png");
  assert.equal(tensioner?.section, "REMOVAL");
  assert.match(tensioner?.caption || "", /V-RIBBED BELT TENSIONER ASSEMBLY/);
});

test("candidate registry does not infer an SCV, air filter image or uncertain gas filter from nearby drawings", () => {
  assert.equal(getIs220dRepairManualVisualCandidate("engine.scv"), null);
  assert.equal(getIs220dRepairManualVisualCandidate("engine.air_filter"), null);
  assert.equal(getIs220dRepairManualVisualCandidate("engine.vacuum_gas_filter"), null);
  assert.equal(getIs220dRepairManualVisualCandidate("not.a.real.component"), null);
});
