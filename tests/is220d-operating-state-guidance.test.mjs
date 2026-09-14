import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildIs220dOperatingStateGuidance,
  buildIs220dOperatingStateGuidanceHtml,
  publishIs220dOperatingStateGuidance
} from "../src/is220d-operating-state-guidance.js";

test("DPNR group guidance exposes KOEO and running states from current verified signals", () => {
  const guidance = buildIs220dOperatingStateGuidance("dpnr-exhaust");
  assert.ok(guidance.signalCount >= 3);
  assert.ok(guidance.states.some(item => item.state === "key-on"));
  assert.ok(guidance.states.some(item => item.state === "running"));
  assert.equal(guidance.requiresMultipleCaptures, true);
  assert.doesNotMatch(JSON.stringify(guidance), /217E|217F|212C/);
});

test("starting group guidance includes key-on, cranking and running without inventing a command path", () => {
  const guidance = buildIs220dOperatingStateGuidance("starting-charging-position");
  assert.deepEqual(guidance.states.map(item => item.state), ["key-on", "cranking", "running"]);
  assert.ok(guidance.states.find(item => item.state === "cranking").signals.some(signal => signal.key === "engine.rpm"));
  assert.ok(guidance.states.find(item => item.state === "key-on").signals.some(signal => signal.key === "engine.ecu_voltage"));
});

test("all-scope operating guidance deduplicates signals shared by several physical groups", () => {
  const guidance = buildIs220dOperatingStateGuidance("all");
  const keys = guidance.states.flatMap(state => state.signals.map(signal => signal.key));
  assert.ok(guidance.signalCount > 0);
  assert.ok(keys.includes("engine.map"));
  assert.ok(keys.includes("engine.rpm"));
  assert.equal(guidance.states.some(item => item.state === "warm-idle"), false);
});

test("operating-state HTML explains separate captures instead of claiming one state proves the component", () => {
  const html = buildIs220dOperatingStateGuidanceHtml(buildIs220dOperatingStateGuidance("air-intake-turbo-egr"), "running");
  assert.match(html, /Toimintatilat/);
  assert.match(html, /moottori käy/i);
  assert.match(html, /KOEO- ja käyntivertailu/i);
  assert.doesNotMatch(html, /osa on kunnossa/i);
});

test("unknown operating-state group fails closed", () => {
  assert.throws(() => buildIs220dOperatingStateGuidance("unknown-group"), /Unknown IS220d operating-state group/);
});

test("operating-state publisher remains usable without browser DOM", () => {
  const guidance = publishIs220dOperatingStateGuidance();
  assert.equal(guidance.groupId, "all");
  assert.ok(guidance.states.length >= 2);
});

test("operating-state guidance contains no vehicle transmit or network path", () => {
  const source = fs.readFileSync(new URL("../src/is220d-operating-state-guidance.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.send\s*\(/);
  assert.doesNotMatch(source, /\.(?:queryPid|queryToyotaReadData|queryRealtime|probeResearchIdentifier|probeSupportBitmap)\s*\(/i);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest|WebSocket|NativeElm|transport\.send/i);
});
