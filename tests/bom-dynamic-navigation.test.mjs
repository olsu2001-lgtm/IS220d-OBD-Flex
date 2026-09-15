import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const componentPageSource = await readFile(new URL("../src/component-diagnostics-page.js", import.meta.url), "utf8");
const publisherSource = await readFile(new URL("../src/component-diagnostics-publisher.js", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../src/main.js", import.meta.url), "utf8");

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
  assert.match(publisherSource, /candidate\.id === ["']page-component-diagnostics["']/);
  assert.match(publisherSource, /candidate === button/);
  assert.match(publisherSource, /installComponentDiagnosticsNavigation\(\);/);
});
