import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

import { enhanceIs220dDiagnosticTestLab } from "../src/diagnostic-test-lab-controller.js";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function itemHtml({ label, runnable = true, dpnr = false } = {}) {
  return `<article class="test-lab-item" data-test-lab-item data-runnable="${runnable ? "1" : "0"}">
    <h3>${label}</h3>
    <div class="test-lab-diagnosis">state</div>
    <footer class="test-lab-actions">
      ${dpnr ? '<button type="button" data-test-lab-open-dpnr>DPNR</button>' : ""}
      <span>info</span>
    </footer>
  </article>`;
}

function labHtml() {
  return `<section id="is220dDiagnosticTestLab">
    <form data-test-lab-filters></form>
    <button type="button" data-test-lab-refresh>Refresh</button>
    ${itemHtml({ label: "MAF / ilmamäärämittari" })}
    ${itemHtml({ label: "DPF/DPNR paine-eroanturi", dpnr: true })}
    ${itemHtml({ label: "Estetty tutkimuskohde", runnable: false })}
  </section>`;
}

function makeDom() {
  return new JSDOM(`<!doctype html><html><head></head><body>
    <section id="page-component-diagnostics">
      <button id="bomDiagnosticRun" type="button">Run</button>
      <span id="bomDiagnosticBadge">0/10 DATA</span>
      ${labHtml()}
    </section>
  </body></html>`, { url: "https://flex.invalid", pretendToBeVisual: true });
}

test("Test Lab run button delegates to the existing BOM component diagnostic", () => {
  const dom = makeDom();
  try {
    const { document } = dom.window;
    let runs = 0;
    document.querySelector("#bomDiagnosticRun").addEventListener("click", () => { runs += 1; });
    assert.equal(enhanceIs220dDiagnosticTestLab(document), true);
    const button = document.querySelector("[data-test-lab-run-all]");
    assert.ok(button);
    button.click();
    assert.equal(runs, 1);
    assert.match(document.querySelector("[data-test-lab-run-state]").textContent, /käynnistetty/i);
    assert.ok(document.querySelector("#diagnosticTestLabControllerStyles"));
  } finally {
    dom.window.close();
  }
});

test("runnable generic item gets a per-item action that still delegates to the shared production runner", () => {
  const dom = makeDom();
  try {
    const { document } = dom.window;
    let runs = 0;
    document.querySelector("#bomDiagnosticRun").addEventListener("click", () => { runs += 1; });
    enhanceIs220dDiagnosticTestLab(document);

    const items = [...document.querySelectorAll("[data-test-lab-item]")];
    const maf = items.find(item => /MAF/.test(item.querySelector("h3").textContent));
    const dpnr = items.find(item => /DPNR/.test(item.querySelector("h3").textContent));
    const blocked = items.find(item => /Estetty/.test(item.querySelector("h3").textContent));
    assert.ok(maf.querySelector("[data-test-lab-run-item]"));
    assert.equal(dpnr.querySelector("[data-test-lab-run-item]"), null, "DPNR keeps its dedicated runner");
    assert.equal(blocked.querySelector("[data-test-lab-run-item]"), null, "non-runnable rows stay fail-closed");

    maf.querySelector("[data-test-lab-run-item]").click();
    assert.equal(runs, 1);
    assert.match(maf.querySelector("[data-test-lab-item-state]").textContent, /yhteinen read-only BOM-kattavuusajo/i);
  } finally {
    dom.window.close();
  }
});

test("per-item action refuses to start when shared BOM runner is disabled", () => {
  const dom = makeDom();
  try {
    const { document } = dom.window;
    const source = document.querySelector("#bomDiagnosticRun");
    source.disabled = true;
    let runs = 0;
    source.addEventListener("click", () => { runs += 1; });
    enhanceIs220dDiagnosticTestLab(document);
    const itemButton = document.querySelector("[data-test-lab-run-item]");
    itemButton.click();
    assert.equal(runs, 0);
    assert.match(document.querySelector("[data-test-lab-item-state]").textContent, /ei ole nyt ajettavissa/i);
  } finally {
    dom.window.close();
  }
});

test("Test Lab refuses to start shared run when the existing BOM diagnostic is unavailable", () => {
  const dom = makeDom();
  try {
    const { document } = dom.window;
    const source = document.querySelector("#bomDiagnosticRun");
    source.disabled = true;
    let runs = 0;
    source.addEventListener("click", () => { runs += 1; });
    enhanceIs220dDiagnosticTestLab(document);
    document.querySelector("[data-test-lab-run-all]").click();
    assert.equal(runs, 0);
    assert.match(document.querySelector("[data-test-lab-run-state]").textContent, /ei ole nyt ajettavissa/i);
  } finally {
    dom.window.close();
  }
});

test("coverage badge change requests a Test Lab refresh", async () => {
  const dom = makeDom();
  try {
    const { document } = dom.window;
    let refreshes = 0;
    document.querySelector("[data-test-lab-refresh]").addEventListener("click", () => { refreshes += 1; });
    enhanceIs220dDiagnosticTestLab(document);
    document.querySelector("#bomDiagnosticBadge").textContent = "5/10 DATA";
    await tick();
    assert.equal(refreshes, 1);
  } finally {
    dom.window.close();
  }
});

test("pending per-item run focuses the same card after Test Lab is rebuilt", async () => {
  const dom = makeDom();
  try {
    const { document } = dom.window;
    enhanceIs220dDiagnosticTestLab(document);
    const maf = [...document.querySelectorAll("[data-test-lab-item]")].find(item => /MAF/.test(item.querySelector("h3").textContent));
    maf.querySelector("[data-test-lab-run-item]").click();

    const page = document.querySelector("#page-component-diagnostics");
    document.querySelector("#is220dDiagnosticTestLab").remove();
    const host = document.createElement("div");
    host.innerHTML = labHtml();
    page.appendChild(host.firstElementChild);
    await tick();

    const replacement = document.querySelector("#is220dDiagnosticTestLab");
    const focused = replacement.querySelector('[data-test-lab-focused="1"]');
    assert.ok(focused);
    assert.equal(focused.querySelector("h3").textContent, "MAF / ilmamäärämittari");
    assert.match(focused.querySelector("[data-test-lab-item-state]").textContent, /valmistui/i);
    assert.ok(replacement.querySelector("[data-test-lab-run-toolbar]"));
  } finally {
    dom.window.close();
  }
});

test("repeated enhancement does not duplicate per-item controls or shared-run clicks", () => {
  const dom = makeDom();
  try {
    const { document } = dom.window;
    let runs = 0;
    document.querySelector("#bomDiagnosticRun").addEventListener("click", () => { runs += 1; });
    enhanceIs220dDiagnosticTestLab(document);
    enhanceIs220dDiagnosticTestLab(document);
    assert.equal(document.querySelectorAll("[data-test-lab-run-item]").length, 1);
    document.querySelector("[data-test-lab-run-item]").click();
    assert.equal(runs, 1);
  } finally {
    dom.window.close();
  }
});

test("Test Lab controller contains no direct native OBD transport", () => {
  const source = fs.readFileSync(new URL("../src/diagnostic-test-lab-controller.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\bobd\.send\b|\bwindow\.obd\b|JavascriptInterface|sendCommand/i);
  assert.match(source, /#bomDiagnosticRun/);
});
