import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildIs220dGuidedDiagnosticSession,
  buildIs220dGuidedDiagnosticSessionHtml,
  publishIs220dGuidedDiagnosticSession
} from "../src/component-diagnostic-guided-session.js";
import { buildIs220dComponentDiagnosticCoverage } from "../src/is220d-component-diagnostics.js";

const result = (command, validResponse = true, requestHeader = "7E0", raw = null) => ({
  phase: "Laaja luku-OBD",
  command,
  requestHeader,
  validResponse,
  raw: raw ?? (validResponse ? `positive:${command}` : "NO DATA"),
  error: validResponse ? "" : "NO DATA"
});

function coverageWith(results = []) {
  return buildIs220dComponentDiagnosticCoverage({ meta: { vehicleKey: "is220d" }, results });
}

test("guided all-session covers all five physical groups and all 23 component targets", () => {
  const session = buildIs220dGuidedDiagnosticSession("all", { coverage: coverageWith() });
  assert.equal(session.id, "all");
  assert.equal(session.groupCount, 5);
  assert.equal(session.componentCount, 23);
  assert.deepEqual(session.groups.map(group => group.componentCount), [9, 6, 4, 3, 1]);
  assert.equal(session.groups.reduce((sum, group) => sum + group.componentCount, 0), 23);
});

test("guided air-session exposes workshop scope and sanitized evidence preflight", () => {
  const coverage = coverageWith([
    result("010B", true, "7E0", "41 0B 64"),
    result("0110", true, "7E0", "41 10 03 E8"),
    result("212C", true, "7E0", "61 2C 80")
  ]);
  const session = buildIs220dGuidedDiagnosticSession("air-intake-turbo-egr", { coverage });
  assert.equal(session.componentCount, 9);
  assert.match(session.physicalFocus, /Ilmansuodattimelta turbolle/);
  assert.ok(session.planSummary.selectedSignalCount > 0);
  assert.ok(session.components.some(component => component.id === "engine.turbocharger"));
  assert.equal("commands" in session, false);
  assert.doesNotMatch(JSON.stringify(session), /positive:010B|41 0B 64/);
});

test("guided fuel-session names verification gaps without turning them into runnable commands", () => {
  const session = buildIs220dGuidedDiagnosticSession("fuel-rail-injection");
  assert.equal(session.componentCount, 6);
  assert.ok(session.planSummary.notAuthorized >= 1);
  assert.ok(session.gaps.some(gap => gap.signalKey === "engine.fuel_temperature_screening" && gap.state === "not-authorized"));
  assert.ok(session.gaps.some(gap => gap.state === "not-in-current-wide-diagnostic"));
  assert.doesNotMatch(JSON.stringify(session), /2193|2196|21AF|219C/);
  assert.ok(session.gaps.every(gap => !("commands" in gap)));
});

test("latest sanitized plan summary can update guided-session preflight counts", () => {
  const session = buildIs220dGuidedDiagnosticSession("starting-charging-position", {
    planSummaries: [{
      id: "starting-charging-position",
      summary: {
        componentCount: 3,
        coveredComponents: 2,
        selectedSignalCount: 2,
        alreadyObserved: 2,
        availableInCurrentWideDiagnostic: 0,
        notInCurrentWideDiagnostic: 0,
        notAuthorized: 0,
        fieldRejected: 0
      },
      raw: "7E8 SHOULD NOT LEAK"
    }]
  });
  assert.equal(session.planSummary.alreadyObserved, 2);
  assert.equal(session.planSummary.coveredComponents, 2);
  assert.doesNotMatch(JSON.stringify(session), /7E8 SHOULD NOT LEAK/);
});

test("guided-session HTML explains that group scope does not change vehicle commands", () => {
  const html = buildIs220dGuidedDiagnosticSessionHtml(buildIs220dGuidedDiagnosticSession("dpnr-exhaust"));
  assert.match(html, /DPNR/);
  assert.match(html, /read-only-lukusarjaa/i);
  assert.match(html, /ei ECU-komentoja/i);
});

test("unknown guided group fails closed", () => {
  assert.throws(() => buildIs220dGuidedDiagnosticSession("unknown-group"), /Unknown IS220d guided diagnostic group/);
});

test("guided-session publisher remains usable without browser DOM", () => {
  const model = publishIs220dGuidedDiagnosticSession(coverageWith([result("010C")]), {
    diagnosticGroupPlans: []
  });
  assert.equal(model.id, "all");
  assert.equal(model.componentCount, 23);
});

test("guided-session layer contains no vehicle transmit or network path", () => {
  const source = fs.readFileSync(new URL("../src/component-diagnostic-guided-session.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.send\s*\(/);
  assert.doesNotMatch(source, /\.(?:queryPid|queryToyotaReadData|queryRealtime|probeResearchIdentifier|probeSupportBitmap)\s*\(/i);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest|WebSocket|NativeElm|transport\.send/i);
});
