import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync(new URL("../src/ui-shell.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../ios-health-ui.css", import.meta.url), "utf8");
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("diagnosis-first shell exposes the four primary destinations", () => {
  for (const label of ["Tila", "Live", "Testit", "Lisää"]) {
    assert.match(shell, new RegExp(`\\"${label}\\"`));
  }
  assert.match(shell, /page-status/);
  assert.match(shell, /page-tests/);
  assert.match(shell, /page-more/);
});

test("Health Check keeps availability separate from diagnostic findings", () => {
  for (const id of ["engine", "air", "fuel", "dpnr", "electrical", "coverage"]) {
    assert.match(shell, new RegExp(`healthRow\\(\\"${id}\\"`));
  }
  assert.match(shell, /healthFindingSummary/);
  assert.match(shell, /healthCoverageSummary/);
  assert.match(shell, /ei tuettu\|no data/i);
  assert.match(shell, /uniqueDtcs/);
});

test("Live dashboard prioritizes core metrics and hides raw unsupported data by default", () => {
  for (const id of ["rpm", "coolant", "maf", "boostPressure", "railPressure", "voltage"]) {
    assert.match(shell, new RegExp(`\\[\\"${id}\\"`));
  }
  assert.match(shell, /Näytä kaikki mittarit/);
  assert.match(shell, /Näytä ei-tuetut/);
  assert.match(shell, /iosMetricSearch/);
  assert.match(css, /ios-metrics-collapsed/);
  assert.match(css, /ios-filter-hidden/);
});

test("mobile shell follows safe-area, touch target and reduced-motion rules", () => {
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /backdrop-filter:blur/);
});

test("UI work does not advance the application version", () => {
  assert.equal(pkg.version, "0.9.6");
});
