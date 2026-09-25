import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import { buildAppDiagnosticsReport, createTrafficRecorder, configureAppDiagnostics, buildAppDiagnosticsPage } from '../src/app-diagnostics.js';

const rpm = { id: 'rpm', name: 'Kierrosluku', pid: 12, unit: 'rpm' };
const base = { definitions: [rpm], connected: true, liveActive: true, values: { rpm: 0 }, updatedAt: { rpm: 10000 },
  ui: { rpm: { present: true, text: '0', matches: true } } };
test('zero is data, absence is not zero, stale data and UI gaps stay distinct', () => {
  assert.equal(buildAppDiagnosticsReport(base, 10001).values[0].status, 'displayed');
  assert.equal(buildAppDiagnosticsReport({ ...base, values: {} }, 10001).values[0].value, null);
  assert.equal(buildAppDiagnosticsReport(base, 20000).values[0].status, 'cached');
  assert.equal(buildAppDiagnosticsReport({ ...base, connected: false }, 10001).values[0].status, 'cached');
  assert.equal(buildAppDiagnosticsReport({ ...base, liveActive: false }, 10001).values[0].status, 'cached');
  assert.match(buildAppDiagnosticsReport({ ...base, liveActive: false }, 10001).values[0].reason, /Live-luku on pysäytetty/);
  assert.equal(buildAppDiagnosticsReport({ ...base, ui: {} }, 10001).values[0].status, 'ui-gap');
});
test('all definitions retained; unavailable queries never become invented commands', () => {
  const report = buildAppDiagnosticsReport({ definitions: [rpm,
    { id: 'injector', toyotaReadData: true }, { id: 'dpnr', toyotaCommand: '217E', toyotaValueKey: 'dpnrDifferentialPressureKpa', vehicleKey: 'is220d', toyotaReadData: true }], binary: true }, 10000);
  assert.equal(report.values.length, 3);
  assert.equal(report.values[1].command, null);
  assert.equal(report.values[2].status, 'unavailable');
  assert.match(report.values[2].reason, /Quicklynks/);
});
test('traffic is bounded, keeps measured bytes, removes identity and adapter payloads', () => {
  const recorder = createTrafficRecorder(2);
  recorder.record({ command: '0902', direction: 'rx', raw: '49 02 01 4A 54 48' });
  assert.doesNotMatch(recorder.snapshot().entries[0].raw, /49 02/);
  recorder.record({ command: 'AT PIN 1234', raw: '1234' });
  assert.doesNotMatch(JSON.stringify(recorder.snapshot()), /1234/);
  recorder.record({ command: '010C', direction: 'rx', raw: '41 0C 00 00', timestamp: 10000 });
  assert.equal(recorder.snapshot().dropped, 1);
  assert.equal(recorder.snapshot().entries[1].raw, '41 0C 00 00');
  const report = buildAppDiagnosticsReport({ definitions: [rpm], traffic: recorder.snapshot() }, 10001);
  assert.equal(report.values[0].status, 'decode-or-state-gap');
  recorder.reset();
  assert.equal(recorder.snapshot().entries.length, 0);
});
test('NO DATA remains failure; a sent request is not a decoded value', () => {
  const recorder = createTrafficRecorder();
  recorder.record({ command: '010C', direction: 'tx', timestamp: 1 });
  assert.equal(buildAppDiagnosticsReport({ definitions: [rpm], traffic: recorder.snapshot() }, 10).values[0].status, 'awaiting-response');
  recorder.record({ command: '010C', direction: 'rx', raw: 'NO DATA', timestamp: 2 });
  assert.equal(recorder.snapshot().entries[1].durationMs, 1);
  assert.equal(buildAppDiagnosticsReport({ definitions: [rpm], traffic: recorder.snapshot() }, 10).values[0].status, 'failed');
  assert.equal(buildAppDiagnosticsReport({ ...base, traffic: recorder.snapshot() }, 10001).values[0].status, 'cached');
});
test('runtime connects passive traffic and actual values/UI to the report', () => {
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /function logTraffic\(entry\) \{\s*appTraffic.record\(entry\)/);
  assert.match(main, /configureAppDiagnostics\(\(\) =>/);
  assert.match(main, /definitions: activeMetricDefinitions\(\)/);
  assert.match(main, /text === formatValue\(def, state.values\[def.id\]\)/);
  const diagnostics = fs.readFileSync(new URL('../src/app-diagnostics.js', import.meta.url), 'utf8');
  assert.doesNotMatch(diagnostics, /\.send\(|\.command\(|setInterval\(/);
});
test('page generates a passive report, retains every row and offers manual copying', async () => {
  const dom = new JSDOM('<main></main>');
  const previous = globalThis.document;
  globalThis.document = dom.window.document;
  try {
    configureAppDiagnostics(() => ({ ...base, updatedAt: { rpm: Date.now() } }));
    const page = buildAppDiagnosticsPage();
    document.body.append(page);
    assert.equal(page.querySelector('details').open, false);
    const buttons = page.querySelectorAll('button');
    buttons[0].click();
    const report = JSON.parse(page.querySelector('textarea').value);
    assert.equal(report.summary.total, 1);
    assert.equal(report.summary.displayed, 1);
    assert.equal(buttons[1].disabled, false);
    buttons[1].click();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.match(page.querySelector('[role="status"]').textContent, /käsin/);
  } finally { globalThis.document = previous; dom.window.close(); }
});


test('Toyota discovery NO DATA is field evidence, not a Mode 01 support-bitmap result', () => {
  const dpnr = { id: 'dpnrDifferentialPressure', name: 'DPNR paine-ero', unit: 'kPa',
    toyotaCommand: '217E', toyotaValueKey: 'dpnrDifferentialPressureKpa', vehicleKey: 'is220d', toyotaReadData: true };
  const derived = { id: 'boostPressure', name: 'Ahtopaine', unit: 'kPa', derived: true };
  const report = buildAppDiagnosticsReport({
    definitions: [dpnr, derived],
    connected: true,
    liveActive: true,
    supportedPids: new Set(),
    discovery: [{ command: '217E', error: 'Ohjainlaite ei palauttanut tietoa (217E)' }]
  }, 10000);
  assert.equal(report.schemaVersion, 2);
  assert.equal(report.values[0].status, 'field-no-response');
  assert.equal(report.values[0].supported, false);
  assert.match(report.values[0].reason, /217E/);
  assert.notEqual(report.values[0].status, 'not-advertised');
  assert.equal(report.values[1].supported, null);
  assert.equal(report.summary.fieldNoResponse, 1);
  assert.equal(report.summary.missingByStatus['field-no-response'], 1);
});
