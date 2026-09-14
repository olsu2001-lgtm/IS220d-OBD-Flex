import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { IS220D_COMPONENT_DIAGNOSTICS } from "../src/is220d-component-diagnostics.js";
import {
  buildPhysicalInspectionNextTaskHtml,
  buildPhysicalInspectionNextTaskModel,
  publishPhysicalInspectionNextTask
} from "../src/physical-inspection-next-task.js";

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

test("next task prefers an unchecked electronic deviation before baseline inspections", () => {
  const model = buildPhysicalInspectionNextTaskModel(coverage({
    "engine.map_sensor": { status: "observed", assessment: { status: "strong-deviation" } },
    "engine.egr_valve": { status: "partial", assessment: { status: "inconclusive" } }
  }), { items: {} });
  assert.equal(model.queue.total, 23);
  assert.equal(model.queue.next.id, "engine.map_sensor");
  assert.equal(model.queue.next.priorityKey, "deviation");
  assert.equal(model.queue.next.groupId, "air-intake-turbo-egr");
});

test("completed high-priority task advances to the next unchecked item", () => {
  const model = buildPhysicalInspectionNextTaskModel(coverage({
    "engine.map_sensor": { status: "observed", assessment: { status: "strong-deviation" } },
    "engine.egr_valve": { status: "partial", assessment: { status: "inconclusive" } }
  }), { items: { "engine.map_sensor": { checked: true } } });
  assert.equal(model.queue.checked, 1);
  assert.equal(model.queue.next.id, "engine.egr_valve");
  assert.equal(model.queue.next.priorityKey, "gap");
});

test("next-task HTML contains the reviewed instruction and no diagnostic command metadata", () => {
  const model = buildPhysicalInspectionNextTaskModel(coverage({
    "engine.map_sensor": { status: "observed", assessment: { status: "strong-deviation" } }
  }), { items: {} });
  const html = buildPhysicalInspectionNextTaskHtml(model);
  assert.match(html, /SEURAAVA TARKASTUS/);
  assert.match(html, /Ahtopaineanturi \/ MAP/);
  assert.match(html, /Tarkista anturin liitin, johdotus, painekanava ja likaantuminen/);
  assert.match(html, /data-bom-jump-inspection="engine.map_sensor"/);
  assert.doesNotMatch(html, /0100|212C|217E|217F|219C|requestHeader|responseHeader/);
});

test("publisher remains usable without a browser DOM", () => {
  assert.equal(publishPhysicalInspectionNextTask(coverage()), null);
});

test("next-task UI module contains no vehicle transport or network path", () => {
  const source = fs.readFileSync(new URL("../src/physical-inspection-next-task.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.send\s*\(|fetch\s*\(|XMLHttpRequest|WebSocket|NativeElm|transport\.send/i);
  assert.doesNotMatch(source, /queryPid|queryToyotaReadData|queryRealtime|probeResearchIdentifier|probeSupportBitmap/i);
});
