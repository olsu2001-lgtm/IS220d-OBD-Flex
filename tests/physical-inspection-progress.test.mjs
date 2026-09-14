import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PHYSICAL_INSPECTION_PROGRESS_STORAGE_KEY,
  clearPhysicalInspectionProgress,
  readPhysicalInspectionProgress,
  summarizePhysicalInspectionProgress,
  writePhysicalInspectionChecked
} from "../src/physical-inspection-progress.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key)
  };
}

test("physical inspection progress persists only checked component ids and timestamps", () => {
  const storage = memoryStorage();
  writePhysicalInspectionChecked("engine.map_sensor", true, { storage, now: 1234 });
  writePhysicalInspectionChecked("engine.egr_valve", true, { storage, now: 5678 });
  let progress = readPhysicalInspectionProgress(storage);
  assert.deepEqual(progress.items["engine.map_sensor"], { checked: true, updatedAt: 1234 });
  assert.deepEqual(progress.items["engine.egr_valve"], { checked: true, updatedAt: 5678 });
  writePhysicalInspectionChecked("engine.map_sensor", false, { storage, now: 9999 });
  progress = readPhysicalInspectionProgress(storage);
  assert.equal(progress.items["engine.map_sensor"], undefined);
  assert.equal(progress.items["engine.egr_valve"].checked, true);
});

test("corrupt or unrelated local data fails closed to an empty checklist progress", () => {
  const storage = memoryStorage();
  storage.setItem(PHYSICAL_INSPECTION_PROGRESS_STORAGE_KEY, "{broken");
  assert.deepEqual(readPhysicalInspectionProgress(storage).items, {});
  storage.setItem(PHYSICAL_INSPECTION_PROGRESS_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, items: { nope: { checked: true }, "engine.map_sensor": { checked: false } } }));
  assert.deepEqual(readPhysicalInspectionProgress(storage).items, {});
});

test("group progress summary counts only items belonging to that physical group", () => {
  const group = { items: [{ id: "engine.map_sensor" }, { id: "engine.egr_valve" }, { id: "engine.turbocharger" }] };
  const progress = { schemaVersion: 1, items: { "engine.map_sensor": { checked: true }, "engine.turbocharger": { checked: true }, "engine.starter": { checked: true } } };
  assert.deepEqual(summarizePhysicalInspectionProgress(group, progress), {
    total: 3,
    checked: 2,
    complete: false,
    checkedIds: ["engine.map_sensor", "engine.turbocharger"]
  });
});

test("progress can be cleared without touching any diagnostic evidence", () => {
  const storage = memoryStorage();
  writePhysicalInspectionChecked("engine.map_sensor", true, { storage, now: 1 });
  clearPhysicalInspectionProgress(storage);
  assert.deepEqual(readPhysicalInspectionProgress(storage).items, {});
});

test("physical progress module contains no vehicle transport, network or diagnostic payload handling", () => {
  const source = fs.readFileSync(new URL("../src/physical-inspection-progress.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.send\s*\(|fetch\s*\(|XMLHttpRequest|WebSocket|NativeElm|transport\.send/i);
  assert.doesNotMatch(source, /raw|requestHeader|responseHeader|command/i);
});
