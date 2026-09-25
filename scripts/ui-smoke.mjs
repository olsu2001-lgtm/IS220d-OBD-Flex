import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";
import { WEB_STYLE_FILES } from "./web-assets.mjs";

const [htmlPath, bundlePath, expectedVersion] = process.argv.slice(2);
if (!htmlPath || !bundlePath) throw new Error("Usage: node scripts/ui-smoke.mjs <index.html> <app.bundle.js> [version]");
const html = await readFile(htmlPath, "utf8");
const bundle = await readFile(bundlePath, "utf8");

// Exercise the real DOM used by the new mobile shell. Only device APIs are
// simulated; selector/routing/dynamic-page behavior must not be stubbed out.
const dom = new JSDOM(html, { url: "https://flex.invalid/", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window, d = w.document;
const errors = [];
const listeners = new WeakMap();
const addEventListener = w.EventTarget.prototype.addEventListener;
w.EventTarget.prototype.addEventListener = function(type, ...args) {
  const types = listeners.get(this) || new Set();
  types.add(type);
  listeners.set(this, types);
  return addEventListener.call(this, type, ...args);
};
w.addEventListener("error", event => errors.push(event.error || event.message));
w.localStorage.setItem("lexusVehicleProfile", "is220d");
w.scrollTo = () => {};
w.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
w.navigator.clipboard = { writeText: async () => {} };
w.HTMLCanvasElement.prototype.getContext = () => new Proxy({
  createLinearGradient: () => ({ addColorStop() {} }), measureText: text => ({ width: String(text).length * 7 })
}, { get: (target, key) => target[key] || (() => {}) });
const fakeDb = {
  objectStoreNames: { contains: () => true },
  transaction() {
    const transaction = {
      objectStore: () => ({ getAll: () => ({ result: [] }), put: value => ({ result: value }), get: () => ({ result: null }), delete: () => ({}), clear: () => ({}) })
    };
    queueMicrotask(() => transaction.oncomplete?.());
    return transaction;
  }
};
w.indexedDB = { open() {
  const request = { result: fakeDb };
  queueMicrotask(() => request.onsuccess?.());
  return request;
} };
w.obd = {
  pairedDevices: () => JSON.stringify([{ name: "Smoke OBD", address: "00:11:22:33:44:55" }]),
  connect: () => JSON.stringify({ ok: true }), send: () => "OK>", disconnect() {}, isConnected: () => false
};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  for (const name of WEB_STYLE_FILES) {
    const style = d.createElement("style");
    style.textContent = await readFile(path.join(path.dirname(htmlPath), name), "utf8");
    d.head.append(style);
  }
  w.eval(bundle);
  await wait(150);
  const byId = id => d.getElementById(id);
  if (expectedVersion) assert.equal(byId("appVersionLabel")?.textContent, `Versio ${expectedVersion}`, "visible version must match APK version");
  for (const [id, event] of [["themeSelect", "change"], ["nav-live", "click"], ["refreshDevices", "click"], ["startInjectorTest", "click"]]) {
    assert.ok(listeners.get(byId(id))?.has(event), `${id} handler missing; ${byId("connectionError")?.textContent || ""}`);
  }
  assert.doesNotMatch(byId("terminalLog").textContent, /Käynnistysvirhe/);
  assert.equal(d.querySelectorAll(".ios-tab").length, 4);
  assert.equal(w.getComputedStyle(d.querySelector(".ios-tabbar")).position, "fixed", "packaged mobile navigation CSS must apply");

  byId("themeSelect").value = "pearl-light";
  byId("themeSelect").dispatchEvent(new w.Event("change"));
  assert.equal(d.documentElement.dataset.theme, "pearl-light", "theme did not change immediately");
  d.querySelector('[data-ios-page="live"]').click();
  assert.ok(byId("page-live").classList.contains("active"), "visible Live tab did not open");
  assert.equal(d.querySelectorAll(".page.active").length, 1);
  d.querySelector('[data-ios-page="more"]').click();
  d.querySelector('#page-more [data-go="component-diagnostics"]').click();
  assert.ok(d.querySelector("#page-component-diagnostics.active:not(.hidden)"), "visible More/BOM link did not open");
  d.querySelector('[data-ios-page="tests"]').click();
  d.querySelector('#page-tests [data-go="dpnr"]').click();
  assert.ok(d.querySelector("#page-dpnr.active"));
  assert.ok(d.querySelector('[data-dpnr-sensor-capture="koeo"]'), "guided pressure sensor test must be bundled");

  byId("refreshDevices").click();
  await wait(100);
  assert.ok([...byId("deviceSelect").options].some(option => option.dataset.address === "00:11:22:33:44:55"), "Bluetooth device list was not populated");
  assert.equal(byId("startInjectorTest").disabled, true, "unverified injector test must remain unavailable");
  assert.deepEqual(errors, [], "bundled app emitted browser errors");
  process.stdout.write("UI smoke PASS: version, packaged CSS, theme, visible navigation, BOM, DPNR, Bluetooth list, injector guard\n");
} finally { dom.window.close(); }
