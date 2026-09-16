import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import {
  buildDiagnosticTestLabHtml,
  parseCoverageFromStorage,
  publishIs220dDiagnosticTestLab
} from "../src/diagnostic-test-lab-ui.js";

const STORAGE_KEY = "lexusIs220dBomComponentDiagnosticsV2";

function dpnrCoverage(status = "unavailable", observed = false) {
  return {
    applicable: true,
    components: [{
      id: "engine.dpnr_differential_pressure_sensor",
      status,
      assessment: { status: "not-evaluated" },
      groupEvidence: [{ signals: [{ signalKey: "engine.dpnr_differential_pressure", command: "217E", attempted: true, observed, attempts: 2 }] }]
    }]
  };
}

test("Test Lab HTML exposes filters, visual pipeline and verified DPNR identity", () => {
  const html = buildDiagnosticTestLabHtml({ coverage: dpnrCoverage() });
  assert.match(html, /Diagnostic Test Lab/);
  assert.match(html, /data-test-lab-search/);
  assert.match(html, /data-test-lab-group/);
  assert.match(html, /data-test-lab-readiness/);
  assert.match(html, /Drive-rivi 5/);
  assert.match(html, /217E/);
  assert.match(html, /617E/);
  assert.match(html, /toyota-2ad-fhv-217e-v1/);
  assert.match(html, /Pyyntö \/ vastaus katkeaa/);
  assert.doesNotMatch(html, />219C</);
  assert.doesNotMatch(html, /Active Test[^<]*button/i);
});

test("stored BOM coverage is parsed fail-closed", () => {
  const good = new Map([[STORAGE_KEY, JSON.stringify({ coverage: dpnrCoverage("observed", true) })]]);
  const storage = { getItem: key => good.get(key) || null };
  assert.equal(parseCoverageFromStorage(storage)?.components?.[0]?.status, "observed");
  assert.equal(parseCoverageFromStorage({ getItem: () => "{bad json" }), null);
  assert.equal(parseCoverageFromStorage({ getItem: () => JSON.stringify({ coverage: { applicable: false } }) }), null);
});

test("published Test Lab filters cards and opens the existing DPNR page through its nav button", () => {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>
    <main id="main">
      <button id="nav-dpnr" type="button">DPNR</button>
      <section id="page-component-diagnostics"><section id="vikadiagObdDiagnostics"></section></section>
    </main>
  </body></html>`, { url: "https://flex.invalid" });
  try {
    const { document } = dom.window;
    dom.window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ coverage: dpnrCoverage() }));
    let dpnrClicks = 0;
    document.querySelector("#nav-dpnr").addEventListener("click", () => { dpnrClicks += 1; });

    assert.equal(publishIs220dDiagnosticTestLab({ documentObject: document, storage: dom.window.localStorage }), true);
    const root = document.querySelector("#is220dDiagnosticTestLab");
    assert.ok(root);
    assert.ok(document.querySelector("#is220dDiagnosticTestLabStyles"));
    assert.equal(document.querySelector("#vikadiagObdDiagnostics").nextElementSibling, root);

    const search = root.querySelector("[data-test-lab-search]");
    search.value = "89480-53010";
    search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    const visible = [...root.querySelectorAll("[data-test-lab-item]")].filter(item => !item.hidden);
    assert.equal(visible.length, 1);
    assert.equal(visible[0].querySelector("h3").textContent, "DPF/DPNR paine-eroanturi");
    assert.match(root.querySelector("[data-test-lab-count]").textContent, /^1 kohdetta/);

    visible[0].querySelector("[data-test-lab-open-dpnr]").click();
    assert.equal(dpnrClicks, 1);
  } finally {
    dom.window.close();
  }
});
