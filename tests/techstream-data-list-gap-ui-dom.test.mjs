import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

test("passive Techstream DPF/EGR panel mounts outside hidden ELM diagnostics and stays collapsed", async () => {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>
    <main>
      <section id="page-connection" class="page active">
        <div class="card">Connection</div>
        <div id="elmDiagnosticCard" class="card hidden">
          <div id="diagnosticSummary" class="inline-message hidden"></div>
        </div>
      </section>
    </main>
  </body></html>`, { url: "https://example.test/" });

  const previous = {
    window: globalThis.window,
    document: globalThis.document
  };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  try {
    await import(`../src/techstream-data-list-gap-ui.js?offline-dom=${Date.now()}`);
    await Promise.resolve();
    await Promise.resolve();

    const page = dom.window.document.querySelector("#page-connection");
    const panel = dom.window.document.querySelector("#techstreamDataListGap");
    const hiddenDiagnostic = dom.window.document.querySelector("#elmDiagnosticCard");

    assert.ok(panel);
    assert.equal(panel.tagName, "DETAILS");
    assert.equal(panel.open, false);
    assert.equal(panel.parentElement, page);
    assert.equal(panel.nextElementSibling, hiddenDiagnostic);
    assert.ok(hiddenDiagnostic.classList.contains("hidden"));
    assert.match(panel.querySelector("summary")?.textContent || "", /Techstream/);
    assert.match(panel.textContent, /Offline-tutkimustyökalu/);
    assert.ok(panel.querySelector('input[accept*=".json"]'));
    assert.ok(panel.querySelector('input[accept*=".csv"]'));
  } finally {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    dom.window.close();
  }
});
