import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { enhanceIs220dDiagnosticTestLab } from "../src/diagnostic-test-lab-controller.js";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function makeDom() {
  return new JSDOM(`<!doctype html><html><head></head><body>
    <section id="page-component-diagnostics">
      <button id="bomDiagnosticRun" type="button">Run</button>
      <span id="bomDiagnosticBadge">0/10 DATA</span>
      <section id="is220dDiagnosticTestLab">
        <form data-test-lab-filters></form>
        <button type="button" data-test-lab-refresh>Refresh</button>
      </section>
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

test("Test Lab refuses to start when the existing BOM diagnostic is unavailable", () => {
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

test("controller reattaches the run toolbar when Test Lab root is replaced", async () => {
  const dom = makeDom();
  try {
    const { document } = dom.window;
    enhanceIs220dDiagnosticTestLab(document);
    const page = document.querySelector("#page-component-diagnostics");
    document.querySelector("#is220dDiagnosticTestLab").remove();
    const replacement = document.createElement("section");
    replacement.id = "is220dDiagnosticTestLab";
    replacement.innerHTML = '<form data-test-lab-filters></form><button type="button" data-test-lab-refresh>Refresh</button>';
    page.appendChild(replacement);
    await tick();
    assert.ok(replacement.querySelector("[data-test-lab-run-toolbar]"));
  } finally {
    dom.window.close();
  }
});
