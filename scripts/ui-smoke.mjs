import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const [htmlPath, bundlePath] = process.argv.slice(2);
if (!htmlPath || !bundlePath) throw new Error("Usage: node scripts/ui-smoke.mjs <index.html> <app.bundle.js>");

const html = await readFile(htmlPath, "utf8");
const bundle = await readFile(bundlePath, "utf8");

class ClassList {
  constructor(value = "") { this.values = new Set(String(value).split(/\s+/).filter(Boolean)); }
  add(...names) { names.forEach(name => this.values.add(name)); }
  remove(...names) { names.forEach(name => this.values.delete(name)); }
  contains(name) { return this.values.has(name); }
  toggle(name, force) {
    const enabled = force === undefined ? !this.values.has(name) : Boolean(force);
    if (enabled) this.values.add(name); else this.values.delete(name);
    return enabled;
  }
  toString() { return [...this.values].join(" "); }
}

class FakeElement {
  constructor(tagName = "div", attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.id = attributes.id || "";
    this.dataset = Object.fromEntries(Object.entries(attributes)
      .filter(([key]) => key.startsWith("data-"))
      .map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value]));
    this.classList = new ClassList(attributes.class || "");
    this.style = {};
    this.attributes = { ...attributes };
    this.listeners = new Map();
    this.children = [];
    this.options = [];
    this.value = attributes.value || "";
    this.textContent = "";
    this.disabled = Object.hasOwn(attributes, "disabled");
    this.checked = Object.hasOwn(attributes, "checked");
    this.files = [];
  }
  get className() { return this.classList.toString(); }
  set className(value) { this.classList = new ClassList(value); }
  get innerHTML() { return this._innerHTML || ""; }
  set innerHTML(value) {
    this._innerHTML = String(value);
    if (!value) { this.children = []; this.options = []; }
  }
  get selectedOptions() {
    if (this.tagName !== "SELECT") return [];
    return [this.options.find(option => option.value === this.value) || this.options[0]].filter(Boolean);
  }
  addEventListener(type, listener, options = {}) {
    const entries = this.listeners.get(type) || [];
    entries.push({ listener, once: Boolean(options?.once) });
    this.listeners.set(type, entries);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter(entry => entry.listener !== listener));
  }
  dispatch(type, extra = {}) {
    const event = { type, target: this, currentTarget: this, key: "", preventDefault() {}, ...extra };
    const entries = [...(this.listeners.get(type) || [])];
    for (const entry of entries) entry.listener(event);
    this.listeners.set(type, (this.listeners.get(type) || []).filter(entry => !entry.once));
  }
  click() { this.dispatch("click"); }
  append(...children) {
    for (const child of children) {
      this.children.push(child);
      if (child?.tagName === "OPTION") this.options.push(child);
    }
  }
  appendChild(child) { this.append(child); return child; }
  remove() {}
  focus() {}
  showModal() { this.open = true; }
  setAttribute(name, value) { this.attributes[name] = String(value); if (name === "content") this.content = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  getBoundingClientRect() { return { width: 360, height: 210, top: 0, left: 0, right: 360, bottom: 210 }; }
  getContext() {
    const gradient = { addColorStop() {} };
    return new Proxy({ createLinearGradient: () => gradient, measureText: text => ({ width: String(text).length * 7 }) }, {
      get(target, key) { return key in target ? target[key] : () => {}; },
      set(target, key, value) { target[key] = value; return true; }
    });
  }
}

const elements = [];
for (const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
  const [, tagName, source] = match;
  const attributes = {};
  for (const attribute of source.matchAll(/([:\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    attributes[attribute[1]] = attribute[2] ?? attribute[3] ?? attribute[4] ?? "";
  }
  if (attributes.id || attributes.class || Object.keys(attributes).some(key => key.startsWith("data-"))) {
    elements.push(new FakeElement(tagName, attributes));
  }
}

const byId = new Map(elements.filter(element => element.id).map(element => [element.id, element]));
const root = new FakeElement("html", { id: "documentElement" });
const metaTheme = new FakeElement("meta", { id: "themeColor", name: "theme-color", content: "#0b0f14" });
const documentListeners = new Map();
const document = {
  documentElement: root,
  head: new FakeElement("head"),
  body: new FakeElement("body"),
  readyState: "complete",
  visibilityState: "visible",
  getElementById(id) { return byId.get(String(id)) || null; },
  querySelector(selector) {
    if (selector === 'meta[name="theme-color"]') return metaTheme;
    if (selector.startsWith("#")) return byId.get(selector.slice(1)) || null;
    return this.querySelectorAll(selector)[0] || null;
  },
  querySelectorAll(selector) {
    if (selector.startsWith(".")) return elements.filter(element => element.classList.contains(selector.slice(1)));
    const dataMatch = selector.match(/^\[data-([\w-]+)\]$/);
    if (dataMatch) {
      const key = dataMatch[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return elements.filter(element => Object.hasOwn(element.dataset, key));
    }
    return [];
  },
  createElement(tagName) { return new FakeElement(tagName); },
  addEventListener(type, listener) {
    const listeners = documentListeners.get(type) || [];
    listeners.push(listener);
    documentListeners.set(type, listeners);
  }
};

const stored = new Map();
const localStorage = {
  getItem: key => stored.has(key) ? stored.get(key) : null,
  setItem: (key, value) => stored.set(key, String(value)),
  removeItem: key => stored.delete(key)
};

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
const indexedDB = {
  open() {
    const request = { result: fakeDb };
    queueMicrotask(() => request.onsuccess?.());
    return request;
  }
};

Object.defineProperty(globalThis, "navigator", {
  value: { clipboard: { writeText: async () => {} }, wakeLock: null },
  configurable: true
});
Object.assign(globalThis, {
  document,
  window: globalThis,
  localStorage,
  indexedDB,
  matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  requestAnimationFrame: callback => setTimeout(callback, 0),
  getComputedStyle: () => ({ getPropertyValue: () => "#ffffff" }),
  scrollTo() {},
  obd: {
    pairedDevices: () => JSON.stringify([{ name: "Smoke OBD", address: "00:11:22:33:44:55" }]),
    connect: () => JSON.stringify({ ok: true }),
    send: () => "OK>",
    disconnect() {},
    isConnected: () => false
  }
});

vm.runInThisContext(bundle, { filename: bundlePath });
await new Promise(resolve => setTimeout(resolve, 60));

const startupDetails = `connectionError=${byId.get("connectionError")?.textContent || ""}; terminal=${byId.get("terminalLog")?.textContent || ""}`;
assert.ok((byId.get("themeSelect")?.listeners.get("change") || []).length, `theme handler was not attached; ${startupDetails}`);
assert.ok((byId.get("nav-live")?.listeners.get("click") || []).length, "navigation handler was not attached");
assert.ok((byId.get("refreshDevices")?.listeners.get("click") || []).length, "Bluetooth refresh handler was not attached");
assert.ok((byId.get("startInjectorTest")?.listeners.get("click") || []).length, "injector test handler was not attached");

const themeSelect = byId.get("themeSelect");
themeSelect.value = "pearl-light";
themeSelect.dispatch("change");
await new Promise(resolve => setTimeout(resolve, 10));
assert.equal(root.dataset.theme, "pearl-light", "theme did not change immediately");

byId.get("nav-live").click();
assert.ok(byId.get("page-live").classList.contains("active"), "live page did not open");
assert.ok(!byId.get("page-connection").classList.contains("active"), "home page stayed active");

byId.get("refreshDevices").click();
await new Promise(resolve => setTimeout(resolve, 20));
assert.ok(byId.get("deviceSelect").options.some(option => option.dataset.address === "00:11:22:33:44:55"), "Bluetooth device list was not populated");

process.stdout.write("UI smoke PASS: theme, navigation, Bluetooth list, injector test\n");
