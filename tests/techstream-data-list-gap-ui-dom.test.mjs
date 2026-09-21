import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

test("passive Techstream DPF/EGR panel mounts on the dedicated offline research page", async () => {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>
    <main>
      <section id="page-connection" class="page"></section>
      <section id="page-dpf-egr-research" class="page active">
        <div id="dpfEgrResearchMount"></div>
      </section>
    </main>
  </body></html>`, { url: "https://example.test/" });

  const previous = { window: globalThis.window, document: globalThis.document };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  try {
    await import(`../src/techstream-data-list-gap-ui.js?offline-dom=${Date.now()}`);
    await Promise.resolve();
    await Promise.resolve();

    const mount = dom.window.document.querySelector("#dpfEgrResearchMount");
    const panel = dom.window.document.querySelector("#techstreamDataListGap");
    assert.ok(panel);
    assert.equal(panel.tagName, "SECTION");
    assert.equal(panel.parentElement, mount);
    assert.match(panel.querySelector(".techstream-gap-head")?.textContent || "", /Techstream \+ J2534/);
    assert.match(panel.textContent, /Tuo ensin Techstreamin vertailuarvot/);
    assert.equal(panel.querySelectorAll(":scope > details").length, 3);
    assert.match(panel.querySelector(":scope > details[open] summary")?.textContent || "", /1 · Tuo Techstream-arvot/);
    assert.ok(panel.querySelector('input[accept*=".json"]'));
    assert.ok(panel.querySelector('input[accept*=".csv"]'));
  } finally {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    dom.window.close();
  }
});
