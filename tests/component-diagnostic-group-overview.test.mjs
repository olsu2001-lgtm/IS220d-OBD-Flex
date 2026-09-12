import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { IS220D_COMPONENT_DIAGNOSTICS } from "../src/is220d-component-diagnostics.js";
import {
  buildIs220dDiagnosticGroupOverview,
  buildIs220dDiagnosticGroupOverviewHtml,
  publishIs220dDiagnosticGroupOverview
} from "../src/component-diagnostic-group-overview.js";

function coverage(overrides = {}) {
  const components = IS220D_COMPONENT_DIAGNOSTICS.map(component => ({
    ...component,
    status: "not-tested",
    assessment: { status: "not-evaluated", values: [], limitations: [] },
    ...(overrides[component.id] || {})
  }));
  return { applicable: true, components };
}

test("physical overview preserves all 23 BOM targets in five non-overlapping groups", () => {
  const model = buildIs220dDiagnosticGroupOverview(coverage());
  assert.equal(model.applicable, true);
  assert.equal(model.totalComponents, 23);
  assert.equal(model.groups.length, 5);
  assert.deepEqual(model.groups.map(group => group.componentCount), [9, 6, 4, 3, 1]);
  assert.equal(model.groups.reduce((sum, group) => sum + group.componentCount, 0), 23);
});

test("group overview separates signal coverage from component assessment", () => {
  const model = buildIs220dDiagnosticGroupOverview(coverage({
    "engine.maf_sensor": { status: "observed", assessment: { status: "normal-pattern" } },
    "engine.map_sensor": { status: "observed", assessment: { status: "strong-deviation" } },
    "engine.egr_valve": { status: "partial", assessment: { status: "inconclusive" } }
  }));
  const intake = model.groups.find(group => group.id === "air-intake-turbo-egr");
  assert.equal(intake.observed, 2);
  assert.equal(intake.partial, 1);
  assert.equal(intake.assessed, 3);
  assert.equal(intake.strongDeviation, 1);
  assert.equal(intake.attentionCount, 2);
  assert.deepEqual(intake.attentionComponents.map(item => item.id), ["engine.map_sensor", "engine.egr_valve"]);
});

test("overview HTML exposes physical focus and existing BOM group filter targets", () => {
  const html = buildIs220dDiagnosticGroupOverviewHtml(buildIs220dDiagnosticGroupOverview(coverage()));
  assert.match(html, /Fyysinen|bom-group-overview-card/);
  assert.match(html, /data-bom-group-overview="air-intake-turbo-egr"/);
  assert.match(html, /data-bom-group-overview="fuel-rail-injection"/);
  assert.match(html, /Ilmansuodattimelta turbolle/);
  assert.match(html, /DPNR/);
});

test("group overview shows only aggregated evidence-plan counters", () => {
  const plans = [{
    id: "air-intake-turbo-egr",
    summary: {
      selectedSignalCount: 5,
      alreadyObserved: 2,
      availableInCurrentWideDiagnostic: 1,
      notInCurrentWideDiagnostic: 1,
      notAuthorized: 1,
      fieldRejected: 0
    },
    commands: ["SHOULD-NOT-LEAK"]
  }];
  const model = buildIs220dDiagnosticGroupOverview(coverage(), plans);
  const intake = model.groups.find(group => group.id === "air-intake-turbo-egr");
  assert.deepEqual(intake.planSummary, {
    selectedSignalCount: 5,
    alreadyObserved: 2,
    availableInCurrentWideDiagnostic: 1,
    notInCurrentWideDiagnostic: 1,
    notAuthorized: 1,
    fieldRejected: 0
  });
  const html = buildIs220dDiagnosticGroupOverviewHtml(model);
  assert.match(html, /Evidenssi:/);
  assert.match(html, /jo saatu 2/);
  assert.match(html, /nykytesti voi kerätä 1/);
  assert.match(html, /ei tuotantolukuun valtuutettu 1/);
  assert.doesNotMatch(html, /SHOULD-NOT-LEAK/);
});

test("overview publisher remains usable without browser DOM", () => {
  const model = publishIs220dDiagnosticGroupOverview(coverage());
  assert.equal(model.applicable, true);
  assert.equal(model.groups.length, 5);
});

test("physical overview layer contains no vehicle transmit or network path", () => {
  const source = fs.readFileSync(new URL("../src/component-diagnostic-group-overview.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.send\s*\(/);
  assert.doesNotMatch(source, /\.(?:queryPid|queryToyotaReadData|queryRealtime|probeResearchIdentifier|probeSupportBitmap)\s*\(/i);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest|WebSocket|NativeElm|transport\.send/i);
});
