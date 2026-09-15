import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  activateComponentDiagnosticsPage,
  bindComponentDiagnosticsNavigation,
  syncComponentDiagnosticsNavigationVisibility
} from "../src/component-diagnostics-publisher.js";

const componentPageSource = await readFile(new URL("../src/component-diagnostics-page.js", import.meta.url), "utf8");
const publisherSource = await readFile(new URL("../src/component-diagnostics-publisher.js", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../src/main.js", import.meta.url), "utf8");

class FakeClassList {
  constructor(...initial) {
    this.values = new Set(initial);
  }
  contains(name) {
    return this.values.has(name);
  }
  remove(name) {
    this.values.delete(name);
  }
  toggle(name, force) {
    if (force === true) this.values.add(name);
    else if (force === false) this.values.delete(name);
    else if (this.values.has(name)) this.values.delete(name);
    else this.values.add(name);
    return this.values.has(name);
  }
}

function fakeElement(id, classes = []) {
  const listeners = new Map();
  return {
    id,
    dataset: {},
    classList: new FakeClassList(...classes),
    addEventListener(type, listener) {
      const list = listeners.get(type) || [];
      list.push(listener);
      listeners.set(type, list);
    },
    click() {
      for (const listener of listeners.get("click") || []) listener({ type: "click", currentTarget: this });
    },
    listenerCount(type) {
      return (listeners.get(type) || []).length;
    }
  };
}

function fakeNavigationDom() {
  const connectionPage = fakeElement("page-connection", ["page", "active"]);
  const bomPage = fakeElement("page-component-diagnostics", ["page", "hidden"]);
  const connectionNav = fakeElement("nav-connection", ["nav-item", "active"]);
  const dpnrNav = fakeElement("nav-dpnr", ["nav-item"]);
  const bomNav = fakeElement("nav-component-diagnostics", ["nav-item", "hidden"]);
  const selectorMap = new Map([
    ["#nav-component-diagnostics", bomNav],
    ["#page-component-diagnostics", bomPage],
    ["#nav-dpnr", dpnrNav]
  ]);
  const documentObject = {
    querySelector(selector) {
      return selectorMap.get(selector) || null;
    },
    querySelectorAll(selector) {
      if (selector === ".page") return [connectionPage, bomPage];
      if (selector === ".nav-item") return [connectionNav, dpnrNav, bomNav];
      return [];
    }
  };
  return { documentObject, connectionPage, bomPage, connectionNav, dpnrNav, bomNav };
}

test("BOM navigation is created dynamically after main navigation binding", () => {
  assert.match(componentPageSource, /button\.id\s*=\s*["']nav-component-diagnostics["']/);
  assert.match(componentPageSource, /button\.dataset\.page\s*=\s*["']component-diagnostics["']/);
  assert.match(mainSource, /\$\$\(["']\.nav-item["']\)\.forEach\(button => button\.addEventListener\(["']click["']/);
});

test("dynamically injected BOM navigation gets its own post-install click binding", () => {
  assert.match(publisherSource, /function installComponentDiagnosticsNavigation\(\)/);
  assert.match(publisherSource, /#nav-component-diagnostics/);
  assert.match(publisherSource, /dynamicNavigationBound/);
  assert.match(publisherSource, /button\.addEventListener\(["']click["']/);
  assert.match(publisherSource, /bindComponentDiagnosticsNavigation\(button\)/);
  assert.match(publisherSource, /installComponentDiagnosticsNavigation\(\);/);
});

test("late-injected BOM navigation inherits the already-active IS220d visibility state", () => {
  const { documentObject, bomNav, dpnrNav } = fakeNavigationDom();

  assert.equal(syncComponentDiagnosticsNavigationVisibility(documentObject), true);
  assert.equal(bomNav.classList.contains("hidden"), false);

  dpnrNav.classList.toggle("hidden", true);
  assert.equal(syncComponentDiagnosticsNavigationVisibility(documentObject), false);
  assert.equal(bomNav.classList.contains("hidden"), true);
});

test("BOM activation opens the dynamically injected page and deactivates the previous page", () => {
  const { documentObject, connectionPage, bomPage, connectionNav, bomNav } = fakeNavigationDom();
  bomNav.classList.remove("hidden");
  let scrollRequest = null;
  const opened = activateComponentDiagnosticsPage(documentObject, {
    scrollTo(value) { scrollRequest = value; }
  });

  assert.equal(opened, true);
  assert.equal(connectionPage.classList.contains("active"), false);
  assert.equal(bomPage.classList.contains("active"), true);
  assert.equal(bomPage.classList.contains("hidden"), false);
  assert.equal(connectionNav.classList.contains("active"), false);
  assert.equal(bomNav.classList.contains("active"), true);
  assert.deepEqual(scrollRequest, { top: 0, behavior: "instant" });
});

test("actual late-bound BOM click opens the page exactly once", () => {
  const { documentObject, connectionPage, bomPage, connectionNav, bomNav } = fakeNavigationDom();
  assert.equal(syncComponentDiagnosticsNavigationVisibility(documentObject), true);
  let scrollCount = 0;
  const windowObject = { scrollTo() { scrollCount += 1; } };

  assert.equal(bindComponentDiagnosticsNavigation(bomNav, documentObject, windowObject), true);
  assert.equal(bindComponentDiagnosticsNavigation(bomNav, documentObject, windowObject), true);
  assert.equal(bomNav.listenerCount("click"), 1, "duplicate install must not add a second handler");

  bomNav.click();

  assert.equal(connectionPage.classList.contains("active"), false);
  assert.equal(bomPage.classList.contains("active"), true);
  assert.equal(bomPage.classList.contains("hidden"), false);
  assert.equal(connectionNav.classList.contains("active"), false);
  assert.equal(bomNav.classList.contains("active"), true);
  assert.equal(scrollCount, 1);
});

test("hidden vehicle-specific BOM navigation cannot force the IS220d page open", () => {
  const { documentObject, bomPage, bomNav } = fakeNavigationDom();
  assert.equal(activateComponentDiagnosticsPage(documentObject, { scrollTo() {} }), false);
  assert.equal(bomPage.classList.contains("hidden"), true);
  assert.equal(bomPage.classList.contains("active"), false);
  assert.equal(bomNav.classList.contains("hidden"), true);
});
