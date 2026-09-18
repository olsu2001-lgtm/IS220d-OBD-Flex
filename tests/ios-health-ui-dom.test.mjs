import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

function metric(id, value, unit = "") {
  return `<div id="metric-${id}" class="metric-card"><span class="metric-name">${id}</span><strong class="metric-value">${value}</strong><span class="metric-unit">${unit}</span><span class="metric-time">Päivitetty 14:12:08</span></div>`;
}

test("iOS Health Check shell mounts, relocates secondary tools and summarizes evidence", async () => {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>
    <header class="topbar"><div></div><button id="connectionBadge" class="status-badge online"></button></header>
    <main>
      <section id="page-connection" class="page active">
        <details class="card theme-card"><summary>Teema</summary></details>
        <div id="obdPlusTraceCard" class="card">Trace</div>
        <div id="stageEcu" class="connection-stage connected"></div>
        <strong id="vehicleIdentity">Lexus IS220d · XE20 · 2AD-FHV</strong>
      </section>
      <section id="page-dtc" class="page"><div id="storedDtc">Ei vikakoodeja</div><div id="pendingDtc">Ei vikakoodeja</div><div id="permanentDtc">Ei vikakoodeja</div></section>
      <section id="page-live" class="page">
        <div class="section-title"><h2>Live-data</h2><button id="toggleLiveButton">Lopeta</button></div>
        <div id="supportNotice"></div>
        <div id="metricGrid">
          ${metric("rpm", "1720", "rpm")}
          ${metric("coolant", "88", "°C")}
          ${metric("maf", "12.4", "g/s")}
          ${metric("boostPressure", "18", "kPa")}
          ${metric("railPressure", "60500", "kPa")}
          ${metric("voltage", "13.95", "V")}
          ${metric("dpnrDifferentialPressure", "1.2", "kPa")}
          <div id="metric-unsupported" class="metric-card unsupported"><span class="metric-name">Ei tuettu</span><strong class="metric-value">–</strong><span class="metric-unit"></span><span class="metric-time">Ei tuettu</span></div>
        </div>
        <div class="card chart-card"><select id="liveChartMetric"></select><canvas id="liveChart"></canvas></div>
      </section>
      <section id="page-injector-test" class="page"></section>
      <section id="page-dpnr" class="page"></section>
      <section id="page-drive" class="page"></section>
      <section id="page-power" class="page"></section>
      <section id="page-ct-test" class="page"></section>
      <section id="page-sessions" class="page"></section>
      <section id="page-component-diagnostics" class="page"></section>
      <section id="page-terminal" class="page"></section>
    </main>
    <nav class="bottom-nav"></nav>
  </body></html>`, { url: "https://example.test/", pretendToBeVisual: true });

  dom.window.scrollTo = () => {};
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    MutationObserver: globalThis.MutationObserver,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    setInterval: globalThis.setInterval
  };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.requestAnimationFrame = callback => setTimeout(callback, 0);
  globalThis.setInterval = () => 0;

  try {
    await import(`../src/ui-shell.js?dom-smoke=${Date.now()}`);
    await new Promise(resolve => setTimeout(resolve, 25));

    assert.equal(dom.window.document.querySelectorAll(".ios-tab").length, 4);
    assert.ok(dom.window.document.querySelector("#page-status.active"));
    assert.ok(dom.window.document.querySelector("#page-appearance .theme-card"));
    assert.ok(dom.window.document.querySelector("#page-trace-tools #obdPlusTraceCard"));
    assert.ok(dom.window.document.querySelector("#page-live #iosLiveCore"));
    assert.ok(dom.window.document.querySelector("#metricGrid.ios-metrics-collapsed"));
    assert.equal(dom.window.document.querySelector("#healthFindingSummary").textContent, "0");
    assert.equal(dom.window.document.querySelector("#healthCoverageSummary").textContent, "5/5");
    assert.equal(dom.window.document.querySelector("#healthHeadline").textContent, "Health Check valmis");
    assert.match(dom.window.document.querySelector("#iosLiveDetail").textContent, /^6\/6/);
    assert.equal(dom.window.document.querySelector('[data-health-id="engine"]').dataset.state, "ok");
    assert.equal(dom.window.document.querySelector('[data-health-id="air"]').dataset.state, "available");

    dom.window.document.querySelector('[data-ios-page="tests"]').click();
    assert.ok(dom.window.document.querySelector("#page-tests.active"));
    assert.ok(dom.window.document.querySelector('#page-tests [data-go="injector-test"]:not(.hidden)'));
    assert.ok(dom.window.document.querySelector('#page-tests [data-go="ct-test"].hidden'));
  } finally {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.MutationObserver = previous.MutationObserver;
    globalThis.requestAnimationFrame = previous.requestAnimationFrame;
    globalThis.setInterval = previous.setInterval;
    dom.window.close();
  }
});
