import test from "node:test";
import assert from "node:assert/strict";
import {
  IS220D_COMPONENT_DIAGNOSTICS,
  buildIs220dComponentDiagnosticCoverage,
  buildIs220dComponentDiagnosticTextReport
} from "../src/is220d-component-diagnostics.js";
import { ecuSurveySnapshotFromDiagnosticRun } from "../src/ecu-survey-diagnostic.js";
import { buildEcuSurveyTextReport } from "../src/ecu-survey-report.js";

const result = (command, validResponse = true, requestHeader = "7E0", phase = "Laaja luku-OBD") => ({
  phase,
  command,
  requestHeader,
  validResponse,
  raw: validResponse ? `positive:${command}` : "NO DATA",
  error: validResponse ? "" : "NO DATA"
});

test("BOM-komponenttilista sisältää vain DIRECT/INDIRECT-kohteita", () => {
  assert.equal(IS220D_COMPONENT_DIAGNOSTICS.length, 23);
  assert.equal(IS220D_COMPONENT_DIAGNOSTICS.filter(item => item.diagnosticClass === "direct").length, 9);
  assert.equal(IS220D_COMPONENT_DIAGNOSTICS.filter(item => item.diagnosticClass === "indirect").length, 14);
  assert.equal(IS220D_COMPONENT_DIAGNOSTICS.some(item => /water pump|vesipumppu/i.test(item.label)), false);
  assert.equal(IS220D_COMPONENT_DIAGNOSTICS.some(item => !["direct", "indirect"].includes(item.diagnosticClass)), false);
});

test("suorat anturikohteet nousevat observed-tilaan vain olemassa olevasta Flex-signaalista", () => {
  const coverage = buildIs220dComponentDiagnosticCoverage({
    meta: { vehicleKey: "is220d" },
    results: [result("0110"), result("010B"), result("0105"), result("212C"), result("217E"), result("217F"), result("2193"), result("2196")]
  });
  const byId = Object.fromEntries(coverage.components.map(item => [item.id, item]));
  assert.equal(byId["engine.maf_sensor"].status, "observed");
  assert.equal(byId["engine.map_sensor"].status, "observed");
  assert.equal(byId["engine.coolant_temperature_sensor"].status, "observed");
  assert.equal(byId["engine.egr_valve"].status, "observed");
  assert.equal(byId["engine.dpnr_differential_pressure_sensor"].status, "observed");
  assert.equal(byId["engine.exhaust_gas_temperature_sensor_1"].status, "observed");
  assert.equal(byId["engine.fuel_temperature_sensor"].status, "observed");
  assert.equal(byId["engine.common_rail_pressure_sensor"].status, "observed");
});

test("INDIRECT-kohde vaatii määritellyn määrän toisistaan riippumattomia signaaliryhmiä", () => {
  const partial = buildIs220dComponentDiagnosticCoverage({
    meta: { vehicleKey: "is220d" },
    results: [result("010B"), result("0110")]
  });
  const turboPartial = partial.components.find(item => item.id === "engine.turbocharger");
  const intercoolerObserved = partial.components.find(item => item.id === "engine.intercooler");
  assert.equal(turboPartial.status, "partial");
  assert.equal(turboPartial.observedGroups, 2);
  assert.equal(turboPartial.requiredGroups, 3);
  assert.equal(intercoolerObserved.status, "observed");

  const full = buildIs220dComponentDiagnosticCoverage({
    meta: { vehicleKey: "is220d" },
    results: [result("010B"), result("0110"), result("0133")]
  });
  assert.equal(full.components.find(item => item.id === "engine.turbocharger").status, "observed");
});

test("kentässä estetty 219C ei koskaan nosta pääsuuttimien komponenttikattavuutta", () => {
  const coverage = buildIs220dComponentDiagnosticCoverage({
    meta: { vehicleKey: "is220d" },
    results: [result("219C")]
  });
  const injectors = coverage.components.find(item => item.id === "engine.main_injectors");
  assert.equal(injectors.status, "not-tested");
  assert.equal(injectors.observedGroups, 0);
  assert.deepEqual(injectors.excludedSignals, ["219C"]);
});

test("muiden ajoneuvojen ajoihin IS220d BOM-komponenttianalyysiä ei sovelleta", () => {
  const coverage = buildIs220dComponentDiagnosticCoverage({ meta: { vehicleKey: "ct200h" }, results: [result("0110")] });
  assert.equal(coverage.applicable, false);
  assert.equal(coverage.components.length, 0);
});

test("BOM-komponenttiraportti kertoo luokan, OE-numeron, signaalit ja tulkintarajan", () => {
  const coverage = buildIs220dComponentDiagnosticCoverage({
    meta: { vehicleKey: "is220d" },
    results: [result("0110"), result("010B"), result("0105")]
  });
  const report = buildIs220dComponentDiagnosticTextReport(coverage);
  assert.match(report, /^BOM COMPONENT DIAGNOSTICS/m);
  assert.match(report, /Policy: DIRECT \/ INDIRECT only/);
  assert.match(report, /class=DIRECT/);
  assert.match(report, /oe=22204-30010/);
  assert.match(report, /observed_signals=0110/);
  assert.match(report, /219C injector feedback never counts/);
  assert.match(report, /sends no additional vehicle command/);
});

test("ECU Survey liittää komponenttianalyysin olemassa olevaan diagnostiikkaraporttiin", () => {
  const run = {
    startedAt: 1000,
    endedAt: 2000,
    meta: { reportId: "ELM-BOM-1", vehicleKey: "is220d" },
    results: [
      { ...result("0100", true, "7E0", "ECU-osoitehaku"), raw: "7E8 06 41 00 BE 3E B8 13" },
      result("0110"),
      result("010B"),
      result("0105"),
      result("212C")
    ]
  };
  const snapshot = ecuSurveySnapshotFromDiagnosticRun(run);
  assert.equal(snapshot.componentDiagnostics.applicable, true);
  assert.equal(snapshot.componentDiagnostics.summary.total, 23);
  const report = buildEcuSurveyTextReport(snapshot);
  assert.match(report, /BOM COMPONENT DIAGNOSTICS/);
  assert.match(report, /MAF \/ ilmamäärämittari/);
  assert.match(report, /BOM component diagnostics map already collected Flex signals/);
});
