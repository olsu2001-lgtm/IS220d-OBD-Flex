import test from "node:test";
import assert from "node:assert/strict";
import {
  TECHSTREAM_REFERENCE_STORAGE_KEY,
  buildTechstreamReferenceTemplate,
  clearTechstreamReference,
  compareTechstreamReference,
  loadTechstreamReference,
  parseTechstreamReference,
  saveTechstreamReference
} from "../src/techstream-reference.js";
import { buildTechstreamReferenceTextReport } from "../src/techstream-reference-report.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function reference(overrides = {}) {
  return {
    schemaVersion: 1,
    source: "techstream-health-check",
    referenceId: "TS-2026-09-06",
    capturedAt: "2026-09-06T12:00:00+03:00",
    note: "Health Check reference reconstructed into Flex neutral evidence schema",
    systems: [
      { name: "Engine system", dtcs: [] },
      { name: "Skid control system", dtcs: ["C0215", "U0073", "U0126"] },
      { name: "Airbag system", dtcs: ["B1861"] }
    ],
    mappings: [
      {
        requestHeader: "7E0",
        responseHeader: "7E8",
        systemName: "Engine system",
        evidenceLevel: "verified",
        evidenceNote: "Current IS220d profile plus repeated 7E0/7E8 survey and Mode 09 engine evidence"
      }
    ],
    ...overrides
  };
}

function survey(response = "7E8", extraResponder = false) {
  const nodes = [];
  for (let index = 0; index < 8; index++) {
    const requestHeader = `7E${index.toString(16).toUpperCase()}`;
    const engine = index === 0;
    const extra = extraResponder && index === 3;
    nodes.push({
      requestHeader,
      knownEcuId: engine ? "engine" : "",
      responding: engine || extra,
      observedResponseHeaders: engine ? [response] : extra ? ["7EB"] : []
    });
  }
  return { mode: "read-only", nodes };
}

test("neutral Techstream reference normalizes systems and DTCs without inventing mappings", () => {
  const parsed = parseTechstreamReference({
    ...reference(),
    mappings: []
  });
  assert.equal(parsed.source, "techstream-health-check");
  assert.equal(parsed.systems.length, 3);
  assert.deepEqual(parsed.systems[1].dtcs, ["C0215", "U0073", "U0126"]);
  assert.deepEqual(parsed.mappings, []);
  assert.equal(parsed.writable, false);

  const comparison = compareTechstreamReference(parsed, survey());
  assert.equal(comparison.status, "manual-review");
  assert.equal(comparison.verifiedMappings, 0);
  assert.equal(comparison.unmappedFlexResponders.length, 1);
  assert.equal(comparison.unmappedFlexResponders[0].requestHeader, "7E0");
  assert.equal(comparison.unmappedTechstreamSystems.length, 3);
});

test("verified explicit 7E0 to 7E8 mapping is observed only when survey evidence matches", () => {
  const comparison = compareTechstreamReference(reference(), survey());
  assert.equal(comparison.status, "verified-mappings-observed");
  assert.equal(comparison.verifiedMappings, 1);
  assert.equal(comparison.verifiedObserved, 1);
  assert.equal(comparison.verifiedDiscrepancies, 0);
  assert.equal(comparison.mappings[0].status, "observed");
  assert.equal(comparison.mappings[0].systemName, "Engine system");
});

test("verified mapping discrepancy remains an evidence flag when response header differs", () => {
  const comparison = compareTechstreamReference(reference(), survey("7E9"));
  assert.equal(comparison.status, "verified-mapping-discrepancy");
  assert.equal(comparison.verifiedObserved, 0);
  assert.equal(comparison.verifiedDiscrepancies, 1);
  assert.equal(comparison.mappings[0].status, "different-response");
  assert.deepEqual(comparison.mappings[0].observedResponseHeaders, ["7E9"]);
});

test("candidate mappings never count as verified mappings", () => {
  const candidate = reference({
    mappings: [{
      requestHeader: "7E0",
      responseHeader: "7E8",
      systemName: "Engine system",
      evidenceLevel: "candidate",
      evidenceNote: "Research candidate only"
    }]
  });
  const comparison = compareTechstreamReference(candidate, survey());
  assert.equal(comparison.status, "manual-review");
  assert.equal(comparison.candidateMappings, 1);
  assert.equal(comparison.verifiedMappings, 0);
  assert.equal(comparison.mappings[0].status, "observed");
});

test("mapping must reference an existing system and include an evidence note", () => {
  assert.throws(() => parseTechstreamReference(reference({
    mappings: [{
      requestHeader: "7E0",
      responseHeader: "7E8",
      systemName: "Invented system",
      evidenceLevel: "verified",
      evidenceNote: "note"
    }]
  })), /unknown Techstream system/);
  assert.throws(() => parseTechstreamReference(reference({
    mappings: [{
      requestHeader: "7E0",
      responseHeader: "7E8",
      systemName: "Engine system",
      evidenceLevel: "verified",
      evidenceNote: ""
    }]
  })), /requires a concise evidenceNote/);
});

test("Techstream reference storage is separate and fails closed on corrupt JSON", () => {
  const storage = memoryStorage();
  const saved = saveTechstreamReference(reference(), storage);
  assert.equal(saved.saved, true);
  assert.equal(loadTechstreamReference(storage).referenceId, "TS-2026-09-06");
  storage.setItem(TECHSTREAM_REFERENCE_STORAGE_KEY, "{broken-json");
  assert.equal(loadTechstreamReference(storage), null);
  storage.setItem(TECHSTREAM_REFERENCE_STORAGE_KEY, JSON.stringify(reference()));
  assert.equal(clearTechstreamReference(storage), true);
  assert.equal(loadTechstreamReference(storage), null);
});

test("template is neutral and contains no pre-filled ECU mapping", () => {
  const template = JSON.parse(buildTechstreamReferenceTemplate());
  assert.equal(template.source, "techstream-health-check");
  assert.deepEqual(template.systems, []);
  assert.deepEqual(template.mappings, []);
  assert.equal("vin" in template, false);
});

test("Techstream comparison text report preserves evidence boundary and no raw transport data", () => {
  const comparison = compareTechstreamReference(reference(), survey());
  const report = buildTechstreamReferenceTextReport(comparison);
  assert.match(report, /Verified mappings observed: 1\/1/);
  assert.match(report, /7E0>7E8 \| system=Engine system/);
  assert.match(report, /System names never create CAN mappings automatically/);
  assert.doesNotMatch(report, /ATSH|ATSP|217E|0902|raw=/i);
});
