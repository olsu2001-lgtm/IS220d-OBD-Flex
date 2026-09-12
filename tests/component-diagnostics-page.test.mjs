import test from "node:test";
import assert from "node:assert/strict";
import {
  componentDiagnosticStatusLabel,
  componentAssessmentStatusLabel,
  observedComponentSignals,
  attemptedComponentSignals,
  filterComponentDiagnostics,
  buildComponentDiagnosticCardHtml,
  buildComponentDiagnosticSummary,
  publishIs220dComponentDiagnosticCoverage
} from "../src/component-diagnostics-page.js";
import { buildIs220dComponentDiagnosticCoverage } from "../src/is220d-component-diagnostics.js";

const result = (command, validResponse = true, requestHeader = "7E0", raw = null) => ({
  phase: "Laaja luku-OBD",
  command,
  requestHeader,
  validResponse,
  raw: raw ?? (validResponse ? `positive:${command}` : "NO DATA"),
  error: validResponse ? "" : "NO DATA"
});

function coverageWith(results) {
  return buildIs220dComponentDiagnosticCoverage({ meta: { vehicleKey: "is220d" }, results });
}

test("BOM-sivun kattavuus- ja arviotilat ovat erillisiä ja selkokielisiä", () => {
  assert.equal(componentDiagnosticStatusLabel("observed"), "DATA SAATU");
  assert.equal(componentDiagnosticStatusLabel("partial"), "OSITTAIN");
  assert.equal(componentDiagnosticStatusLabel("unavailable"), "EI VASTAUSTA");
  assert.equal(componentDiagnosticStatusLabel("not-tested"), "EI TESTATTU");
  assert.equal(componentAssessmentStatusLabel("normal-pattern"), "ARVO USKOTTAVA");
  assert.equal(componentAssessmentStatusLabel("inconclusive"), "EI RATKAISUA");
  assert.equal(componentAssessmentStatusLabel("strong-deviation"), "VAHVA POIKKEAMA");
  assert.equal(componentAssessmentStatusLabel("not-evaluated"), "EI ARVIOITU");
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

test("komponenttikortti näyttää kattavuuden ja DIRECT-arvion erillään", () => {
  const coverage = coverageWith([result("0110", true, "7E0", "41 10 03 E8")]);
  const maf = coverage.components.find(item => item.id === "engine.maf_sensor");
  const html = buildComponentDiagnosticCardHtml(maf);
  assert.match(html, /DIRECT/);
  assert.match(html, /DATA SAATU/);
  assert.match(html, /ARVO USKOTTAVA/);
  assert.match(html, /engine\.maf: 10\.0 g\/s/);
  assert.match(html, /PNC 22204/);
  assert.match(html, /OE 22204-30010/);
  assert.match(html, /Saatu: 0110/);
  assert.match(html, /ei todista komponenttia ehjäksi/i);
});

test("219C näkyy suutinkortissa vain poissuljettuna eikä diagnostisena evidenssinä", () => {
  const coverage = coverageWith([result("219C")]);
  const injectors = coverage.components.find(item => item.id === "engine.main_injectors");
  const html = buildComponentDiagnosticCardHtml(injectors);
  assert.equal(injectors.status, "not-tested");
  assert.deepEqual(observedComponentSignals(injectors), []);
  assert.match(html, /EI ARVIOITU/);
  assert.match(html, /Ei käytetä evidenssinä/);
  assert.match(html, /219C/);
  assert.doesNotMatch(html, /Saatu: 219C/);
});

test("BOM-yhteenveto säilyttää 23 kohteen ja laskee arvioidut DIRECT-kohteet erikseen", () => {
  const summary = buildComponentDiagnosticSummary(coverageWith([
    result("0110", true, "7E0", "41 10 03 E8"),
    result("010B", true, "7E0", "41 0B 64")
  ]));
  assert.equal(summary.total, 23);
  assert.equal(summary.direct, 9);
  assert.equal(summary.indirect, 14);
  assert.equal(summary.normalPattern, 2);
  assert.equal(summary.deviation, 0);
});

test("julkaisu toimii myös testiajossa ilman selaimen DOMia ja localStoragea", () => {
  const coverage = coverageWith([result("0110")]);
  const payload = publishIs220dComponentDiagnosticCoverage(coverage, { runId: "ELM-BOM-UI-1", startedAt: 1000, endedAt: 2000 });
  assert.equal(payload.runId, "ELM-BOM-UI-1");
  assert.equal(payload.coverage.summary.total, 23);
  assert.equal(payload.endedAt, 2000);
});
