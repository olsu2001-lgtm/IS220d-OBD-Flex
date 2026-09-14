import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { IS220D_COMPONENT_DIAGNOSTICS } from "../src/is220d-component-diagnostics.js";
import {
  buildPhysicalInspectionReportModel,
  buildPhysicalInspectionTextReport
} from "../src/physical-inspection-report.js";

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

test("workshop report preserves all 23 physical targets and compact status counts", () => {
  const model = buildPhysicalInspectionReportModel(coverage({
    "engine.map_sensor": { status: "observed", assessment: { status: "strong-deviation" } },
    "engine.egr_valve": { status: "partial", assessment: { status: "inconclusive" } }
  }), { items: { "engine.map_sensor": { checked: true } } }, { buildSha: "abc123", runId: "run-1", generatedAt: 1000 });
  assert.equal(model.queue.total, 23);
  assert.equal(model.queue.checked, 1);
  assert.equal(model.groups.reduce((sum, group) => sum + group.items.length, 0), 23);
  const intake = model.groups.find(group => group.id === "air-intake-turbo-egr");
  assert.equal(intake.coverage.observed, 1);
  assert.equal(intake.coverage.partial, 1);
  assert.equal(intake.completion.checked, 1);
});

test("text report includes physical progress and reviewed instructions without raw transport payload", () => {
  const model = buildPhysicalInspectionReportModel(coverage({
    "engine.map_sensor": { status: "observed", assessment: { status: "strong-deviation" } }
  }), { items: {} }, { buildSha: "abc123", runId: "run-1", generatedAt: 1000 });
  const report = buildPhysicalInspectionTextReport(model);
  assert.match(report, /BEGIN LEXUS IS220D BOM WORKSHOP REPORT/);
  assert.match(report, /Fyysiset tarkastukset: 0\/23 tehty/);
  assert.match(report, /Ahtopaineanturi \/ MAP/);
  assert.match(report, /Tarkista anturin liitin, johdotus, painekanava ja likaantuminen/);
  assert.doesNotMatch(report, /7E8|0100|212C|217E|217F|219C|requestHeader|responseHeader|raw=/);
});

test("report source contains no vehicle transport or network path", () => {
  const source = fs.readFileSync(new URL("../src/physical-inspection-report.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.send\s*\(|fetch\s*\(|XMLHttpRequest|WebSocket|NativeElm|transport\.send/i);
  assert.doesNotMatch(source, /queryPid|queryToyotaReadData|queryRealtime|probeResearchIdentifier|probeSupportBitmap/i);
});
