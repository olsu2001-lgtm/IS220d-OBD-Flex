import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
  indexIs220dBomDiagnosticSnapshot,
  validateIs220dBomDiagnosticSnapshot
} from "../src/is220d-bom-source.js";
import { IS220D_COMPONENT_DIAGNOSTICS } from "../src/is220d-component-diagnostics.js";

const snapshot = JSON.parse(await fs.readFile(new URL("../data/is220d-bom-diagnostics.json", import.meta.url), "utf8"));

function splitOe(value) {
  return String(value || "")
    .split(";")
    .map(item => item.trim())
    .filter(Boolean);
}

test("reviewed BOM snapshot validates and preserves the 23-component DIRECT/INDIRECT baseline", () => {
  const summary = validateIs220dBomDiagnosticSnapshot(snapshot);
  assert.deepEqual(summary, {
    total: 23,
    direct: 9,
    indirect: 14,
    sourceSheets: { Vikadiag_kohteet: 19, BOM: 4 }
  });
});

test("every executable component recipe traces to exactly one reviewed BOM source record", () => {
  const sourceById = indexIs220dBomDiagnosticSnapshot(snapshot);
  assert.equal(sourceById.size, IS220D_COMPONENT_DIAGNOSTICS.length);

  const runtimeIds = new Set(IS220D_COMPONENT_DIAGNOSTICS.map(component => component.id));
  assert.deepEqual(new Set(sourceById.keys()), runtimeIds);

  for (const component of IS220D_COMPONENT_DIAGNOSTICS) {
    const source = sourceById.get(component.id);
    assert.ok(source, `missing BOM source record for ${component.id}`);
    assert.equal(source.diagnosticClass, component.diagnosticClass, `${component.id}: diagnostic class drift`);
    assert.equal(source.pnc, component.pnc, `${component.id}: PNC drift`);
    assert.deepEqual(source.oe, splitOe(component.oe), `${component.id}: OE drift`);
    assert.ok(source.source.row > 0, `${component.id}: source row missing`);
    assert.ok(source.source.locator.length > 0, `${component.id}: source locator missing`);
  }
});

test("BOM source data cannot authorize or describe vehicle transport commands", () => {
  const polluted = structuredClone(snapshot);
  polluted.components[0].command = "0110";
  assert.throws(
    () => validateIs220dBomDiagnosticSnapshot(polluted),
    /transport\/authorization field/
  );
});

test("physical-only diagnostic classes stay outside the electronic BOM snapshot", () => {
  assert.equal(snapshot.components.some(component => component.diagnosticClass === "physical-only"), false);
  assert.equal(snapshot.components.every(component => ["direct", "indirect"].includes(component.diagnosticClass)), true);
});

test("field-rejected 219C is not present as BOM source authorization", () => {
  const serialized = JSON.stringify(snapshot).toUpperCase();
  assert.equal(serialized.includes('"COMMAND":"219C"'), false);
  assert.equal(serialized.includes('"PID":"219C"'), false);
  assert.equal(serialized.includes('"REQUEST":"219C"'), false);
});
