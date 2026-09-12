import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildImReadinessSnapshot } from "../src/im-readiness.js";
import {
  buildImReadinessUiModel,
  buildImReadinessUiHtml,
  publishImReadinessToDtcUi
} from "../src/im-readiness-ui.js";

function dieselSnapshot() {
  return buildImReadinessSnapshot({
    sinceClearRaw: "41 01 00 0F EB 40",
    driveCycleRaw: "41 41 00 0F EB 00",
    warmupsRaw: "41 30 09",
    distanceRaw: "41 31 01 90"
  });
}

test("DTC-page readiness model exposes only supported diesel monitors", () => {
  const model = buildImReadinessUiModel(dieselSnapshot());
  assert.equal(model.applicable, true);
  assert.equal(model.overall, "not-ready");
  assert.equal(model.ignitionLabel, "Diesel / puristussytytys");
  assert.equal(model.warmupsSinceClear, 9);
  assert.equal(model.distanceSinceClearKm, 400);
  assert.equal(model.scopes.length, 2);
  assert.equal(model.scopes[0].monitors.some(item => item.id === "pm_filter"), true);
  assert.equal(model.scopes[0].monitors.some(item => item.id === "catalyst"), false);
});

test("DTC-page readiness HTML clearly separates ready and incomplete monitors", () => {
  const html = buildImReadinessUiHtml(buildImReadinessUiModel(dieselSnapshot()));
  assert.match(html, /I\/M READINESS/);
  assert.match(html, /DTC-poiston jälkeen/);
  assert.match(html, /Tämä ajosykli/);
  assert.match(html, /PM-\/hiukkassuodatin/);
  assert.match(html, /EI VALMIS/);
  assert.match(html, /Matka 400 km/);
  assert.doesNotMatch(html, /7E8|0101|0141|raw/i);
});

test("readiness publisher remains usable without browser DOM", () => {
  const model = publishImReadinessToDtcUi(dieselSnapshot());
  assert.equal(model.applicable, true);
});

test("readiness UI has no vehicle transmit or network path", () => {
  const source = fs.readFileSync(new URL("../src/im-readiness-ui.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.send\s*\(|safeCommand|queryPid|queryToyota|transport\.send/i);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket/i);
});
