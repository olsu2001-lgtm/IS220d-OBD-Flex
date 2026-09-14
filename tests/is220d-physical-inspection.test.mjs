import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildIs220dPhysicalInspectionChecklist } from "../src/is220d-physical-inspection.js";
import { IS220D_COMPONENT_DIAGNOSTICS } from "../src/is220d-component-diagnostics.js";

const snapshot = JSON.parse(fs.readFileSync(new URL("../data/is220d-bom-diagnostics.json", import.meta.url), "utf8"));

function coverage(overrides = {}) {
  return {
    applicable: true,
    components: IS220D_COMPONENT_DIAGNOSTICS.map(component => ({
      ...component,
      status: "not-tested",
      assessment: { status: "not-evaluated" },
      ...(overrides[component.id] || {})
    }))
  };
}

test("physical checklist contains all 23 reviewed BOM targets in five physical groups", () => {
  const checklist = buildIs220dPhysicalInspectionChecklist(coverage());
  assert.equal(checklist.applicable, true);
  assert.equal(checklist.total, 23);
  assert.equal(checklist.groups.length, 5);
  assert.deepEqual(checklist.groups.map(group => group.itemCount), [9, 6, 4, 3, 1]);
});

test("every physical instruction is copied exactly from the reviewed BOM snapshot", () => {
  const checklist = buildIs220dPhysicalInspectionChecklist(coverage());
  const items = checklist.groups.flatMap(group => group.items);
  const byId = new Map(items.map(item => [item.id, item]));
  assert.equal(byId.size, snapshot.components.length);
  for (const source of snapshot.components) {
    const item = byId.get(source.id);
    assert.ok(item, `missing ${source.id}`);
    assert.equal(item.instruction, source.physicalConfirmation);
    assert.equal(item.symptom, source.symptom);
    assert.equal(item.pnc, source.pnc);
    assert.deepEqual(item.oe, source.oe);
  }
});

test("runtime evidence changes only checklist priority, not the reviewed instruction", () => {
  const source = snapshot.components.find(component => component.id === "engine.map_sensor");
  const checklist = buildIs220dPhysicalInspectionChecklist(coverage({
    "engine.map_sensor": { status: "observed", assessment: { status: "strong-deviation" } },
    "engine.egr_valve": { status: "partial", assessment: { status: "inconclusive" } }
  }));
  const intake = checklist.groups.find(group => group.id === "air-intake-turbo-egr");
  assert.equal(intake.items[0].id, "engine.map_sensor");
  assert.equal(intake.items[0].priorityKey, "deviation");
  assert.equal(intake.items[0].instruction, source.physicalConfirmation);
  assert.equal(intake.items[1].id, "engine.egr_valve");
  assert.equal(intake.items[1].priorityKey, "gap");
});

test("physical checklist source contains no vehicle transport or network path", () => {
  const source = fs.readFileSync(new URL("../src/is220d-physical-inspection.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.send\s*\(/);
  assert.doesNotMatch(source, /\.(?:queryPid|queryToyotaReadData|queryRealtime|probeResearchIdentifier|probeSupportBitmap)\s*\(/i);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest|WebSocket|NativeElm|transport\.send/i);
});
