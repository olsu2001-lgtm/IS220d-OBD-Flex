import test from "node:test";
import assert from "node:assert/strict";
import {
  componentDiagnosticStatusLabel,
  observedComponentSignals,
  attemptedComponentSignals,
  filterComponentDiagnostics,
  buildComponentDiagnosticCardHtml,
  buildComponentDiagnosticSummary,
  publishIs220dComponentDiagnosticCoverage
} from "../src/component-diagnostics-page.js";
import { buildIs220dComponentDiagnosticCoverage } from "../src/is220d-component-diagnostics.js";

const result = (command, validResponse = true, requestHeader = "7E0") => ({
  phase: "Laaja luku-OBD",
  command,
  requestHeader,
  validResponse,
  raw: validResponse ? `positive:${command}` : "NO DATA",
  error: validResponse ? "" : "NO DATA"
});

function coverageWith(results) {
  return buildIs220dComponentDiagnosticCoverage({ meta: { vehicleKey: "is220d" }, results });
}

test("BOM-sivun tilat ovat käyttäjälle selkokielisiä", () => {
  assert.equal(componentDiagnosticStatusLabel("observed"), "DATA SAATU");
  assert.equal(componentDiagnosticStatusLabel("partial"), "OSITTAIN");
  assert.equal(componentDiagnosticStatusLabel("unavailable"), "EI VASTAUSTA");
  assert.equal(componentDiagnosticStatusLabel("not-tested"), "EI TESTATTU");
});

test("BOM-sivu näyttää erikseen saadut ja vain yritetyt signaalit", () => {
  const coverage = coverageWith([result("010B"), result("0110", false)]);
  const turbo = coverage.components.find(item => item.id === "engine.turbocharger");
  assert.deepEqual(observedComponentSignals(turbo), ["010B"]);
  assert.deepEqual(attemptedComponentSignals(turbo), ["010B", "0110"]);
});

test("komponentteja voi suodattaa luokan, tilan ja osanumeron perusteella", () => {
  const coverage = coverageWith([result("010B"), result("0110"), result("0105")]);
  const directObserved = filterComponentDiagnostics(coverage, { diagnosticClass: "direct", status: "observed" });
  assert.ok(directObserved.length >= 3);
  assert.ok(directObserved.every(item => item.diagnosticClass === "direct" && item.status === "observed"));

  const byOe = filterComponentDiagnostics(coverage, { query: "89421-20200" });
  assert.equal(byOe.length, 1);
  assert.equal(byOe[0].id, "engine.map_sensor");

  const byName = filterComponentDiagnostics(coverage, { query: "SCV" });
  assert.equal(byName.length, 1);
  assert.equal(byName[0].id, "engine.scv");
});

test("komponenttikortti näyttää DIRECT/INDIRECT-luokan, OE/PNC:n ja evidenssin", () => {
  const coverage = coverageWith([result("0110")]);
  const maf = coverage.components.find(item => item.id === "engine.maf_sensor");
  const html = buildComponentDiagnosticCardHtml(maf);
  assert.match(html, /DIRECT/);
  assert.match(html, /DATA SAATU/);
  assert.match(html, /PNC 22204/);
  assert.match(html, /OE 22204-30010/);
  assert.match(html, /Saatu: 0110/);
});

test("219C näkyy suutinkortissa vain poissuljettuna eikä diagnostisena evidenssinä", () => {
  const coverage = coverageWith([result("219C")]);
  const injectors = coverage.components.find(item => item.id === "engine.main_injectors");
  const html = buildComponentDiagnosticCardHtml(injectors);
  assert.equal(injectors.status, "not-tested");
  assert.deepEqual(observedComponentSignals(injectors), []);
  assert.match(html, /Ei käytetä evidenssinä/);
  assert.match(html, /219C/);
  assert.doesNotMatch(html, /Saatu: 219C/);
});

test("BOM-yhteenveto säilyttää 23 kohteen 9 DIRECT + 14 INDIRECT -jaon", () => {
  const summary = buildComponentDiagnosticSummary(coverageWith([result("0110"), result("010B")]));
  assert.equal(summary.total, 23);
  assert.equal(summary.direct, 9);
  assert.equal(summary.indirect, 14);
});

test("julkaisu toimii myös testiajossa ilman selaimen DOMia ja localStoragea", () => {
  const coverage = coverageWith([result("0110")]);
  const payload = publishIs220dComponentDiagnosticCoverage(coverage, { runId: "ELM-BOM-UI-1", startedAt: 1000, endedAt: 2000 });
  assert.equal(payload.runId, "ELM-BOM-UI-1");
  assert.equal(payload.coverage.summary.total, 23);
  assert.equal(payload.endedAt, 2000);
});
