import test from "node:test";
import assert from "node:assert/strict";
import {
  IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES,
  getIs220dRepairManualVisualCandidate
} from "../src/is220d-repair-manual-visual-candidates.js";
import { getIs220dRepairManualVisuals } from "../src/is220d-repair-manual-visuals.js";

test("manual-image candidate review keeps exact 2AD-FHV sources for fourteen diagnostic components", () => {
  assert.equal(IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES.length, 14);
  assert.deepEqual(
    [...IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES].map(x => x.sourceRow).sort((a,b) => a-b),
    [11, 12, 18, 20, 21, 24, 25, 26, 29, 61, 65, 66, 67, 68]
  );
  for (const item of IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES) {
    assert.equal(item.engineFamily, "2AD-FHV");
    assert.equal(item.status, "source-identified");
    assert.match(item.sourceImagePath, /^rm0150\/repair2\/img\/[a-z0-9]+\.png$/);
    assert.match(item.manualReference, /^rm0150\/repair2\/html\/contents\/rm[a-z0-9]+\.html$/);
    assert.match(item.sourceImageSha256, /^[a-f0-9]{64}$/);
    assert.match(item.sourceHtmlSha256, /^[a-f0-9]{64}$/);
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

test("shared figures are mapped only where the figure explicitly shows the reviewed component", () => {
  assert.equal(getIs220dRepairManualVisualCandidate("engine.air_cleaner_housing")?.sourceImagePath, "rm0150/repair2/img/a133283e01.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.air_cleaner_hose")?.sourceImagePath, "rm0150/repair2/img/a133283e01.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.exhaust_manifold_gasket")?.sourceImagePath, "rm0150/repair2/img/a122201e01.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.turbo_oil_pipes")?.sourceImagePath, "rm0150/repair2/img/a122209e03.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.cooling_fans")?.sourceImagePath, "rm0150/repair2/img/a134875e01.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.expansion_tank_cap")?.sourceImagePath, "rm0150/repair2/img/a134875e01.png");
  assert.equal(getIs220dRepairManualVisualCandidate("engine.belt_tensioner"), null, "belt image does not label the tensioner");
});
