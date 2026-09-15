import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  activateComponentDiagnosticsPage,
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
  return { id, classList: new FakeClassList(...classes) };
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
  assert.match(publisherSource, /activateComponentDiagnosticsPage\(\)/);
  assert.match(publisherSource, /installComponentDiagnosticsNavigation\(\);/);
});

test("late-injected BOM navigation inherits the already-active IS220d visibility state", () => {
  const bomNav = fakeElement("nav-component-diagnostics", ["nav-item", "hidden"]);
  const dpnrNav = fakeElement("nav-dpnr", ["nav-item"]);
  const documentObject = {
    querySelector(selector) {
      if (selector === "#nav-component-diagnostics") return bomNav;
      if (selector === "#nav-dpnr") return dpnrNav;
      return null;
    }
  };

  assert.equal(syncComponentDiagnosticsNavigationVisibility(documentObject), true);
  assert.equal(bomNav.classList.contains("hidden"), false);

  dpnrNav.classList.toggle("hidden", true);
  assert.equal(syncComponentDiagnosticsNavigationVisibility(documentObject), false);
  assert.equal(bomNav.classList.contains("hidden"), true);
});

test("BOM activation opens the dynamically injected page and deactivates the previous page", () => {
  const connectionPage = fakeElement("page-connection", ["page", "active"]);
  const bomPage = fakeElement("page-component-diagnostics", ["page", "hidden"]);
  const connectionNav = fakeElement("nav-connection", ["nav-item", "active"]);
  const bomNav = fakeElement("nav-component-diagnostics", ["nav-item"]);
  const selectorMap = new Map([
    ["#nav-component-diagnostics", bomNav],
    ["#page-component-diagnostics", bomPage]
  ]);
  const documentObject = {
    querySelector(selector) {
      return selectorMap.get(selector) || null;
    },
    querySelectorAll(selector) {
      if (selector === ".page") return [connectionPage, bomPage];
      if (selector === ".nav-item") return [connectionNav, bomNav];
      return [];
    }
  };
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

test("hidden vehicle-specific BOM navigation cannot force the IS220d page open", () => {
  const bomPage = fakeElement("page-component-diagnostics", ["page", "hidden"]);
  const bomNav = fakeElement("nav-component-diagnostics", ["nav-item", "hidden"]);
  const documentObject = {
    querySelector(selector) {
      if (selector === "#nav-component-diagnostics") return bomNav;
      if (selector === "#page-component-diagnostics") return bomPage;
      return null;
    },
    querySelectorAll() { return [bomPage, bomNav]; }
  };
  assert.equal(activateComponentDiagnosticsPage(documentObject, { scrollTo() {} }), false);
  assert.equal(bomPage.classList.contains("hidden"), true);
  assert.equal(bomPage.classList.contains("active"), false);
});
