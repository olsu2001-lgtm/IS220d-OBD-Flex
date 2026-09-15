import test from "node:test";
import assert from "node:assert/strict";
import {
  IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES,
  getIs220dRepairManualVisualCandidate
} from "../src/is220d-repair-manual-visual-candidates.js";
import { getIs220dRepairManualVisuals } from "../src/is220d-repair-manual-visuals.js";

test("third manual-image batch identifies exact RM0150 sources for seven diagnostic components", () => {
  assert.equal(IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES.length, 7);
  assert.deepEqual(
    [...IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES].map(x => x.sourceRow).sort((a,b) => a-b),
    [11, 12, 21, 25, 29, 61, 66]
  );
  for (const item of IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES) {
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
  assert.equal(getIs220dRepairManualVisualCandidate("engine.water_pump")?.sourceImagePath, "rm0150/repair2/img/a125620e02.png");
});
