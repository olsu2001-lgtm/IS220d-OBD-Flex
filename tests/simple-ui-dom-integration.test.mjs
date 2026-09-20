import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test("simplified mobile shell works in a real DOM and keeps More vehicle-aware", async () => {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>
    <main id="main">
      <section id="page-connection" class="page active">
        <div class="hero-card"><div><h2>Vanha otsikko</h2><p>Vanha teksti</p></div></div>
        <div class="card" id="connectCard">
          <label for="deviceSelect">Lukija</label>
          <select id="deviceSelect"></select>
          <p id="deviceHelp" class="hint">Ohje</p>
          <div id="bleDiagnostic"></div>
          <button id="copyBleDiagnostics">BLE</button>
          <label for="vehicleSelect">Ajoneuvo</label><select id="vehicleSelect"></select>
          <div id="vehicleDetection"></div><button id="detectVehicleButton">Tunnista</button>
          <label for="protocolSelect">Protokolla</label><select id="protocolSelect"></select>
          <button id="connectButton">Yhdistä</button>
          <div id="connectionStages"></div>
        </div>
        <details class="card theme-card"><summary>Teema</summary></details>
        <div class="card"><div id="adapterIdentity"></div></div>
        <div class="checklist">Lista</div>
        <div id="elmDiagnosticCard" class="card">ELM</div>
        <div id="quicklynksDiagnosticCard" class="card">Quick</div>
        <div id="obdPlusTraceCard" class="card">Trace</div>
      </section>
    </main>
    <nav class="bottom-nav">
      <button id="nav-connection" class="nav-item" data-page="connection"><span>C</span>Yhteys</button>
      <button id="nav-injector-test" class="nav-item hidden" data-page="injector-test"><span>I</span>Suuttimet</button>
      <button id="nav-dtc" class="nav-item" data-page="dtc"><span>!</span>Koodit</button>
      <button id="nav-live" class="nav-item" data-page="live"><span>L</span>Live</button>
      <button id="nav-dpnr" class="nav-item hidden" data-page="dpnr"><span>D</span>DPNR</button>
      <button id="nav-drive" class="nav-item" data-page="drive"><span>K</span>Koeajo</button>
      <button id="nav-power" class="nav-item" data-page="power"><span>P</span>Teho</button>
      <button id="nav-sessions" class="nav-item" data-page="sessions"><span>A</span>Ajot</button>
      <button id="nav-terminal" class="nav-item" data-page="terminal"><span>T</span>Term.</button>
    </nav>
  </body></html>`, { url: "https://flex.invalid/" });

  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    MutationObserver: globalThis.MutationObserver
  };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.MutationObserver = dom.window.MutationObserver;

  try {
    const moduleUrl = new URL("../src/simple-ui.js", import.meta.url);
    const imported = await import(`${moduleUrl.href}?dom-test=${Date.now()}`);
    imported.installSimpleUi();
    await tick();

    assert.equal(document.querySelector(".hero-card h2").textContent, "Yhdistä autoon");
    assert.equal(document.querySelector("#connectButton").textContent, "Yhdistä autoon");
    assert.ok(document.querySelector(".simple-inline-advanced"));
    assert.equal(document.querySelectorAll("details.simple-advanced").length, 2);

    for (const id of ["nav-injector-test", "nav-dpnr", "nav-drive", "nav-power", "nav-sessions", "nav-terminal"]) {
      assert.equal(document.querySelector(`#${id}`).classList.contains("simple-secondary-nav"), true, id);
    }

    const more = document.querySelector("#nav-more");
    const sheet = document.querySelector("#simpleMoreSheet");
    assert.ok(more);
    assert.ok(sheet);
    assert.equal(more.getAttribute("aria-expanded"), "false");

    more.click();
    assert.equal(sheet.classList.contains("hidden"), false);
    assert.equal(more.getAttribute("aria-expanded"), "true");

    const dpnrAction = document.querySelector('[data-target-nav="nav-dpnr"]');
    const driveAction = document.querySelector('[data-target-nav="nav-drive"]');
    assert.equal(dpnrAction.classList.contains("hidden"), true);
    assert.equal(dpnrAction.disabled, true);
    assert.equal(driveAction.classList.contains("hidden"), false);
    assert.equal(driveAction.disabled, false);

    let dpnrClicks = 0;
    document.querySelector("#nav-dpnr").addEventListener("click", () => { dpnrClicks += 1; });
    document.querySelector("#nav-dpnr").classList.remove("hidden");
    await tick();
    assert.equal(dpnrAction.classList.contains("hidden"), false);
    assert.equal(dpnrAction.disabled, false);

    more.click();
    dpnrAction.click();
    assert.equal(dpnrClicks, 1);
    assert.equal(sheet.classList.contains("hidden"), true);
    assert.equal(more.getAttribute("aria-expanded"), "false");

    more.click();
    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert.equal(sheet.classList.contains("hidden"), true);
    assert.equal(more.getAttribute("aria-expanded"), "false");

    document.querySelector("#nav-dpnr").classList.add("hidden");
    await tick();
    assert.equal(dpnrAction.classList.contains("hidden"), true);
    assert.equal(dpnrAction.disabled, true);
  } finally {
    dom.window.close();
    if (previous.window === undefined) delete globalThis.window; else globalThis.window = previous.window;
    if (previous.document === undefined) delete globalThis.document; else globalThis.document = previous.document;
    if (previous.MutationObserver === undefined) delete globalThis.MutationObserver; else globalThis.MutationObserver = previous.MutationObserver;
  }
});
