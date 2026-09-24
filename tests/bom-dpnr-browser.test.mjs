import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { patchMainForDpnrPressureSensorTest } from "../scripts/dpnr-pressure-sensor-main-transform.mjs";
import { patchMainForImReadiness } from "../scripts/im-readiness-main-transform.mjs";
import { patchMainForResponsiveness } from "../scripts/responsive-ui-transform.mjs";
import { patchMainForVLinkerRecovery } from "../scripts/vlinker-recovery-main-transform.mjs";
import { patchCoreForAsyncNativeBridge } from "../scripts/async-native-core-transform.mjs";

const root = new URL("../", import.meta.url).pathname;
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const flush = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
const settle = async (predicate, description, maxTurns = 4000) => {
  for (let i = 0; i < maxTurns; i++) {
    await Promise.resolve();
    if (predicate()) return;
  }
  throw new Error(`Timed out waiting for ${description}`);
};

async function browser({ controlledFrames = false } = {}) {
  const result = await build({
    absWorkingDir: root, entryPoints: ["src/main.js"], write: false,
    bundle: true, format: "iife", platform: "browser", target: "chrome90",
    plugins: [{ name: "production-transforms-with-test-access", setup(b) {
      b.onLoad({ filter: /src\/core\.js$/ }, args => ({ contents: patchCoreForAsyncNativeBridge(fs.readFileSync(args.path, "utf8")), loader: "js" }));
      b.onLoad({ filter: /src\/main\.js$/ }, args => ({
        contents: patchMainForDpnrPressureSensorTest(patchMainForVLinkerRecovery(patchMainForResponsiveness(patchMainForImReadiness(fs.readFileSync(args.path, "utf8"))))) +
          "\nglobalThis.testApp = { state, goToPage, applyVehicleProfileUi };", loader: "js"
      }));
    } }]
  });
  const dom = new JSDOM(html, { url: "https://flex.invalid", runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  if (controlledFrames) {
    const frames = new Map();
    let nextFrame = 0;
    w.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame; };
    w.cancelAnimationFrame = id => frames.delete(id);
    w.testFrames = frames;
    w.flushTestFrame = async () => {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(0);
      await flush();
    };
  }
  w.localStorage.setItem("lexusVehicleProfile", "is220d");
  w.scrollTo = () => {};
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({
    createLinearGradient: () => ({ addColorStop() {} }), measureText: () => ({ width: 10 })
  }, { get: (o, p) => o[p] || (() => {}) });
  w.eval(result.outputFiles[0].text);
  await flush();
  return dom;
}

test("production-transformed app installs BOM after startup and opens it by real DOM click", async () => {
  const dom = await browser();
  try {
    const w = dom.window, d = w.document;
    const button = d.querySelector("#nav-component-diagnostics");
    assert.ok(button, "dynamic BOM navigation is installed");
    button.click();
    const page = d.querySelector("#page-component-diagnostics");
    assert.ok(page.classList.contains("active"));
    assert.equal(page.classList.contains("hidden"), false);
    assert.equal(d.querySelectorAll(".page.active").length, 1);
    d.querySelector("#nav-dpnr").click();
    assert.ok(d.querySelector("#page-dpnr").classList.contains("active"));
    button.click();
    assert.ok(page.classList.contains("active"));
    w.testApp.state.vehicleKey = "ct200h";
    w.testApp.applyVehicleProfileUi();
    button.click();
    assert.ok(button.classList.contains("hidden"));
    assert.ok(page.classList.contains("hidden"));
    assert.ok(d.querySelector("#page-connection").classList.contains("active"), "vehicle switch must not leave a blank hidden BOM page active");
    w.testApp.state.vehicleKey = "is220d";
    w.testApp.applyVehicleProfileUi();
    button.click();
    assert.ok(page.classList.contains("active"));
    assert.equal(page.classList.contains("hidden"), false);
  } finally { dom.window.close(); }
});

test("mobile navigation runs page lifecycle and opens the dynamically installed BOM", async () => {
  const dom = await browser({ controlledFrames: true });
  try {
    const w = dom.window, d = w.document;
    for (let i = 0; i < 3; i++) await w.flushTestFrame();
    d.querySelector('[data-ios-page="tests"]').click();
    d.querySelector('#page-tests [data-go="dpnr"]').click();
    assert.ok(d.querySelector("#page-dpnr.active"));
    assert.ok(w.testFrames.size > 0, "DPNR navigation schedules its runtime render");
    assert.ok(d.querySelector('[data-ios-page="tests"].active'));
    d.querySelector('[data-ios-page="more"]').click();
    d.querySelector('#page-more [data-go="component-diagnostics"]').click();
    assert.ok(d.querySelector("#page-component-diagnostics.active:not(.hidden)"));
    assert.ok(d.querySelector('#page-component-diagnostics > .ios-back'));
    assert.equal(d.querySelectorAll(".page.active").length, 1);
    w.testApp.goToPage("live");
    assert.ok(d.querySelector('[data-ios-page="live"].active'));
    w.testApp.state.vehicleKey = "ct200h";
    w.testApp.applyVehicleProfileUi();
    d.querySelector('#page-more [data-go="component-diagnostics"]').click();
    assert.equal(d.querySelector("#page-component-diagnostics").classList.contains("active"), false);
  } finally { dom.window.close(); }
});

test("idle Health and Live projections stop scheduling frames and react to later data", async () => {
  const dom = await browser({ controlledFrames: true });
  try {
    const w = dom.window, d = w.document;
    for (let i = 0; i < 4; i++) await w.flushTestFrame();
    assert.equal(w.testFrames.size, 0, "projection must not observe its own DOM writes forever");
    d.querySelector("#connectionBadge").classList.add("online");
    await flush();
    assert.ok(w.testFrames.size > 0, "a new connection state schedules a projection");
    await w.flushTestFrame();
    assert.equal(d.querySelector("#iosLiveState").textContent, "Live pysäytetty");
    assert.equal(w.testFrames.size, 0, "the update settles after external data is projected");
  } finally { dom.window.close(); }
});

test("both real DPNR capture buttons read fresh 217E directly and save all phases without generic live discovery", async () => {
  const dom = await browser();
  try {
    const w = dom.window, d = w.document, { state } = w.testApp;
    w.testApp.goToPage("dpnr");
    let time = 10000, rpm = 0, direct217eReads = 0, rpmReads = 0;
    w.Date.now = () => time;
    w.setTimeout = (callback, ms) => { queueMicrotask(() => { time += ms; callback(); }); return 1; };
    const rpmRaw = () => {
      const word = Math.max(0, Math.round(rpm * 4));
      return `41 0C ${((word >> 8) & 0xff).toString(16).padStart(2, "0")} ${(word & 0xff).toString(16).padStart(2, "0")}`;
    };
    state.connected = state.ecuConnected = true;
    state.liveActive = false;
    state.client = {
      runReadOnlyEcuTransaction: async options => {
        direct217eReads += 1;
        assert.equal(state.liveActive, false, "guided DPNR capture must not depend on generic live discovery");
        assert.equal(options.requestHeader, "7E0");
        assert.equal(options.requests.length, 1);
        assert.equal(options.requests[0].command, "217E");
        return {
          transactionId: `TEST-${direct217eReads}`,
          responses: [{ command: "217E", raw: "61 7E 0A 04 02 00", error: "" }]
        };
      },
      command: async command => {
        if (command === "010C") {
          rpmReads += 1;
          return rpmRaw();
        }
        return "OK";
      }
    };

    for (const phaseId of ["koeo", "idle", "rpm3000"]) {
      rpm = { koeo: 0, idle: 900, rpm3000: 3000 }[phaseId];
      for (const mode of ["before", "after", "sensor"]) {
        d.querySelector("#dpnrCleaningMode").value = mode === "sensor" ? "before" : mode;
        const selector = mode === "sensor" ? `[data-dpnr-sensor-capture="${phaseId}"]` : `[data-dpnr-capture="${phaseId}"]`;
        const key = mode === "sensor" ? "lexusIs220dDpnrPressureSensorTestV1" : "lexusIs220dDpnrCleaningTestV1";
        const phasePath = r => mode === "sensor" ? r.phases[phaseId] : r[mode].phases[phaseId];
        const button = d.querySelector(selector);
        assert.ok(button);
        state.liveActive = false;
        button.click();
        assert.equal(button.disabled, true, "guided capture disables its button while direct ECU reads are running");
        await settle(() => button.disabled === false, `${mode}/${phaseId} guided DPNR capture completion`);
        const rawRecord = w.localStorage.getItem(key);
        const record = rawRecord ? JSON.parse(rawRecord) : null;
        assert.ok(record, d.querySelector("#dpnrCleaningStatus").textContent + d.querySelector("#dpnrPressureSensorStatus").textContent);
        const phase = phasePath(record);
        assert.ok(phase, `saved record must contain ${mode}/${phaseId}`);
        assert.ok(Math.abs(phase.pressureMedianKpa - 5) < 0.001, `217E 0A04 must decode to ~5.00 kPa, got ${phase.pressureMedianKpa}`);
        assert.ok(phase.sampleCount >= 2);
        assert.match(phase.raw217eLast, /61\s*7E/i);
      }
    }
    assert.ok(direct217eReads >= 18, "each guided measurement must obtain multiple fresh direct 217E responses");
    assert.ok(rpmReads >= 18, "running-state evidence is read directly alongside each pressure sample");
  } finally { dom.window.close(); }
});
