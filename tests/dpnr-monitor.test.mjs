import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("0.9.0 muodostaa uuden versionoidun lähtötason 0.8.1:n jälkeen", async () => {
  const [app, pkg] = await Promise.all([read("app.js"), read("package.json")]);
  assert.match(app, /version:\s*"0\.9\.0"/);
  assert.equal(JSON.parse(pkg).version, "0.9.0");
});

test("DPNR-näkymä näyttää tulkitut arvot, raakavasteet ja lokituksen", async () => {
  const [html, main] = await Promise.all([read("index.html"), read("src/main.js")]);
  for (const id of ["page-dpnr", "dpnrMetricGrid", "dpnrRaw217e", "dpnrRaw217f", "dpnrChart", "dpnrRecordButton"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(main, /DPNR_MONITOR_METRIC_IDS/);
  assert.match(main, /rawLatest:\s*\{ \.\.\.state\.rawValues \}/);
  assert.match(main, /inlet === 750/);
  assert.match(main, /setRecordingButtonState/);
});

test("varmentamattomia Techstream-tilalippuja ei väitetä mitatuiksi", async () => {
  const html = await read("index.html");
  assert.match(html, /Thermal Deteriorate/);
  assert.match(html, /PM Block/);
  assert.match(html, /ei väitä mittaavansa niitä ennen kuin/);
});
