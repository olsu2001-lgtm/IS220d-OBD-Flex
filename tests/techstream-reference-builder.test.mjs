import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGuidedTechstreamReference,
  parseGuidedTechstreamMappings,
  parseGuidedTechstreamSystems,
  techstreamReferenceToGuidedDraft
} from "../src/techstream-reference-builder.js";

test("guided system rows preserve Techstream names and normalize DTCs through the existing schema", () => {
  const reference = buildGuidedTechstreamReference({
    referenceId: "health-check-a",
    capturedAt: "2026-09-09T12:00:00+03:00",
    systemsText: "Engine system | p0400, u0073 | moottoririvi\nSkid control system | | ei koodeja",
    mappingsText: ""
  });
  assert.equal(reference.referenceId, "health-check-a");
  assert.equal(reference.capturedAt, "2026-09-09T09:00:00.000Z");
  assert.deepEqual(reference.systems.map(system => system.name), ["Engine system", "Skid control system"]);
  assert.deepEqual(reference.systems[0].dtcs, ["P0400", "U0073"]);
  assert.equal(reference.mappings.length, 0);
});

test("four-field mapping is always candidate by default", () => {
  const reference = buildGuidedTechstreamReference({
    systemsText: "Engine system",
    mappingsText: "7e0 | 7e8 | Engine system | riippumaton CAN-peruste"
  });
  assert.equal(reference.mappings.length, 1);
  assert.equal(reference.mappings[0].requestHeader, "7E0");
  assert.equal(reference.mappings[0].responseHeader, "7E8");
  assert.equal(reference.mappings[0].evidenceLevel, "candidate");
  assert.equal(reference.mappings[0].evidenceNote, "riippumaton CAN-peruste");
});

test("verified level requires the explicit five-field form", () => {
  const reference = buildGuidedTechstreamReference({
    systemsText: "Engine system",
    mappingsText: "7E0 | 7E8 | Engine system | verified | Techstream ja erillinen CAN-evidenssi täsmäävät"
  });
  assert.equal(reference.mappings[0].evidenceLevel, "verified");
});

test("guided builder never derives a CAN mapping from a system name", () => {
  const reference = buildGuidedTechstreamReference({
    systemsText: "Engine system\nSkid control system"
  });
  assert.equal(reference.systems.length, 2);
  assert.deepEqual(reference.mappings, []);
});

test("mapping to an unknown system fails closed in the canonical validator", () => {
  assert.throws(() => buildGuidedTechstreamReference({
    systemsText: "Engine system",
    mappingsText: "7E0 | 7E8 | Unknown system | evidence"
  }), /unknown Techstream system/i);
});

test("invalid DTC and request headers fail through the canonical validator", () => {
  assert.throws(() => buildGuidedTechstreamReference({
    systemsText: "Engine system | INVALID"
  }), /Invalid DTC code/);
  assert.throws(() => buildGuidedTechstreamReference({
    systemsText: "Engine system",
    mappingsText: "7DF | 7E8 | Engine system | evidence"
  }), /outside 7E0-7E7/);
});

test("duplicate systems and duplicate CAN mappings remain rejected", () => {
  assert.throws(() => buildGuidedTechstreamReference({
    systemsText: "Engine system\nEngine system"
  }), /Duplicate Techstream system/);
  assert.throws(() => buildGuidedTechstreamReference({
    systemsText: "Engine system",
    mappingsText: "7E0 | 7E8 | Engine system | first\n7E0 | 7E8 | Engine system | second"
  }), /Duplicate CAN mapping/);
});

test("draft round-trip preserves explicit systems and mapping evidence", () => {
  const reference = buildGuidedTechstreamReference({
    referenceId: "hc-roundtrip",
    note: "reference note",
    systemsText: "Engine system | P0400 | system note",
    mappingsText: "7E0 | 7E8 | Engine system | verified | explicit evidence"
  });
  const draft = techstreamReferenceToGuidedDraft(reference);
  const rebuilt = buildGuidedTechstreamReference(draft);
  assert.deepEqual(rebuilt.systems, reference.systems);
  assert.deepEqual(rebuilt.mappings, reference.mappings);
  assert.equal(rebuilt.referenceId, reference.referenceId);
  assert.equal(rebuilt.note, reference.note);
});

test("line parsers require unambiguous pipe-delimited shapes", () => {
  assert.throws(() => parseGuidedTechstreamSystems("Engine | P0400 | note | extra"), /liikaa/);
  assert.throws(() => parseGuidedTechstreamMappings("7E0 | 7E8 | Engine"), /Mapping-rivi 1/);
  assert.throws(() => parseGuidedTechstreamMappings("7E0 | 7E8 | Engine | candidate | evidence | extra"), /Mapping-rivi 1/);
});
