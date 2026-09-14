export const TECHSTREAM_REFERENCE_SCHEMA_VERSION = 1;
export const TECHSTREAM_REFERENCE_SOURCE = "techstream-health-check";
export const TECHSTREAM_REFERENCE_STORAGE_KEY = "is220d-obd:techstream-reference:v1";

const REQUEST_HEADER = /^7E[0-7]$/;
const RESPONSE_HEADER = /^[0-9A-F]{3}$/;
const DTC_CODE = /^[PBCU][0-9A-F]{4}(?:-[0-9A-F]{2,4})?$/;
const MAPPING_LEVELS = new Set(["candidate", "verified"]);

const clean = value => String(value ?? "").replace(/[\r\n\t]+/g, " ").trim();
const upper = value => clean(value).toUpperCase();

function freezeArray(values) {
  return Object.freeze(values.map(value => Object.freeze(value)));
}

function normalizeDtc(value) {
  const code = upper(value);
  if (!DTC_CODE.test(code)) throw new Error(`Invalid DTC code: ${clean(value) || "empty"}`);
  return code;
}

function normalizeSystem(system, index) {
  if (!system || typeof system !== "object" || Array.isArray(system)) {
    throw new Error(`System ${index + 1} must be an object`);
  }
  const name = clean(system.name);
  if (!name || name.length > 120) throw new Error(`System ${index + 1} has an invalid name`);
  const dtcs = [...new Set((Array.isArray(system.dtcs) ? system.dtcs : []).map(normalizeDtc))].sort();
  const note = clean(system.note);
  if (note.length > 300) throw new Error(`System ${name} note is too long`);
  return {
    name,
    status: "present",
    dtcs: Object.freeze(dtcs),
    note
  };
}

function normalizeMapping(mapping, index, systemNames) {
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
    throw new Error(`Mapping ${index + 1} must be an object`);
  }
  const requestHeader = upper(mapping.requestHeader);
  const responseHeader = upper(mapping.responseHeader);
  const systemName = clean(mapping.systemName);
  const evidenceLevel = clean(mapping.evidenceLevel).toLowerCase();
  const evidenceNote = clean(mapping.evidenceNote);
  if (!REQUEST_HEADER.test(requestHeader)) throw new Error(`Mapping ${index + 1} request header is outside 7E0-7E7`);
  if (!RESPONSE_HEADER.test(responseHeader)) throw new Error(`Mapping ${index + 1} has an invalid response header`);
  if (!systemNames.has(systemName)) throw new Error(`Mapping ${index + 1} references an unknown Techstream system`);
  if (!MAPPING_LEVELS.has(evidenceLevel)) throw new Error(`Mapping ${index + 1} evidenceLevel must be candidate or verified`);
  if (!evidenceNote || evidenceNote.length > 300) throw new Error(`Mapping ${index + 1} requires a concise evidenceNote`);
  return {
    requestHeader,
    responseHeader,
    systemName,
    evidenceLevel,
    evidenceNote
  };
}

function normalizeTimestamp(value) {
  if (value === null || value === undefined || value === "") return "";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("capturedAt must be a valid date/time");
  return parsed.toISOString();
}

export function normalizeTechstreamReference(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Techstream reference must be an object");
  if (Number(value.schemaVersion) !== TECHSTREAM_REFERENCE_SCHEMA_VERSION) throw new Error("Unsupported Techstream reference schemaVersion");
  if (clean(value.source) !== TECHSTREAM_REFERENCE_SOURCE) throw new Error(`source must be ${TECHSTREAM_REFERENCE_SOURCE}`);

  const rawSystems = Array.isArray(value.systems) ? value.systems : [];
  if (rawSystems.length > 64) throw new Error("Techstream reference contains too many systems");
  const systems = rawSystems.map(normalizeSystem);
  const systemNames = new Set();
  for (const system of systems) {
    if (systemNames.has(system.name)) throw new Error(`Duplicate Techstream system: ${system.name}`);
    systemNames.add(system.name);
  }

  const rawMappings = Array.isArray(value.mappings) ? value.mappings : [];
  if (rawMappings.length > 16) throw new Error("Techstream reference contains too many mappings");
  const mappings = rawMappings.map((mapping, index) => normalizeMapping(mapping, index, systemNames));
  const mappingKeys = new Set();
  for (const mapping of mappings) {
    const key = `${mapping.requestHeader}>${mapping.responseHeader}`;
    if (mappingKeys.has(key)) throw new Error(`Duplicate CAN mapping: ${key}`);
    mappingKeys.add(key);
  }

  const referenceId = clean(value.referenceId);
  const note = clean(value.note);
  if (referenceId.length > 80) throw new Error("referenceId is too long");
  if (note.length > 500) throw new Error("reference note is too long");

  return Object.freeze({
    schemaVersion: TECHSTREAM_REFERENCE_SCHEMA_VERSION,
    source: TECHSTREAM_REFERENCE_SOURCE,
    referenceId,
    capturedAt: normalizeTimestamp(value.capturedAt),
    note,
    systems: freezeArray(systems),
    mappings: freezeArray(mappings),
    writable: false
  });
}

export function parseTechstreamReference(textOrValue) {
  if (typeof textOrValue === "string") {
    const text = textOrValue.trim();
    if (!text) throw new Error("Techstream reference JSON is empty");
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Techstream reference is not valid JSON");
    }
    return normalizeTechstreamReference(parsed);
  }
  return normalizeTechstreamReference(textOrValue);
}

export function buildTechstreamReferenceTemplate() {
  return JSON.stringify({
    schemaVersion: TECHSTREAM_REFERENCE_SCHEMA_VERSION,
    source: TECHSTREAM_REFERENCE_SOURCE,
    referenceId: "",
    capturedAt: "",
    note: "",
    systems: [],
    mappings: []
  }, null, 2);
}

function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export function loadTechstreamReference(storage = undefined) {
  try {
    const target = resolveStorage(storage);
    if (!target?.getItem) return null;
    const raw = target.getItem(TECHSTREAM_REFERENCE_STORAGE_KEY);
    if (!raw) return null;
    return parseTechstreamReference(raw);
  } catch {
    return null;
  }
}

export function saveTechstreamReference(reference, storage = undefined) {
  const normalized = parseTechstreamReference(reference);
  const target = resolveStorage(storage);
  try {
    if (!target?.setItem) throw new Error("localStorage unavailable");
    target.setItem(TECHSTREAM_REFERENCE_STORAGE_KEY, JSON.stringify(normalized));
    return Object.freeze({ saved: true, error: "", reference: normalized });
  } catch (error) {
    return Object.freeze({ saved: false, error: error?.message || String(error), reference: normalized });
  }
}

export function clearTechstreamReference(storage = undefined) {
  try {
    const target = resolveStorage(storage);
    if (!target?.removeItem) return false;
    target.removeItem(TECHSTREAM_REFERENCE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function observedResponses(node) {
  return new Set([...(node?.observedResponseHeaders || [])].map(upper));
}

export function compareTechstreamReference(referenceValue, surveySnapshot) {
  const reference = referenceValue ? parseTechstreamReference(referenceValue) : null;
  if (!reference) return Object.freeze({ loaded: false, status: "not-loaded" });
  if (!surveySnapshot || surveySnapshot.mode !== "read-only" || !Array.isArray(surveySnapshot.nodes)) {
    return Object.freeze({
      loaded: true,
      status: reference.systems.length ? "reference-only" : "incomplete-reference",
      reference,
      systemCount: reference.systems.length,
      dtcCount: reference.systems.reduce((sum, system) => sum + system.dtcs.length, 0),
      mappings: Object.freeze([]),
      verifiedMappings: 0,
      candidateMappings: 0,
      verifiedObserved: 0,
      verifiedDiscrepancies: 0,
      unmappedFlexResponders: Object.freeze([]),
      unmappedTechstreamSystems: Object.freeze(reference.systems.map(system => system.name)),
      manualReviewRequired: true
    });
  }

  const nodesByRequest = new Map(surveySnapshot.nodes.map(node => [upper(node?.requestHeader), node]));
  const mappingResults = reference.mappings.map(mapping => {
    const node = nodesByRequest.get(mapping.requestHeader) || null;
    const responses = observedResponses(node);
    let status = "not-observed";
    if (!node) status = "outside-survey-plan";
    else if (node.responding === true && responses.has(mapping.responseHeader)) status = "observed";
    else if (node.responding === true && responses.size) status = "different-response";
    return {
      ...mapping,
      status,
      responding: node?.responding === true,
      observedResponseHeaders: Object.freeze([...responses].sort())
    };
  });

  const mappedRequests = new Set(reference.mappings.map(mapping => mapping.requestHeader));
  const mappedSystems = new Set(reference.mappings.map(mapping => mapping.systemName));
  const unmappedFlexResponders = surveySnapshot.nodes
    .filter(node => node?.responding === true && !mappedRequests.has(upper(node?.requestHeader)))
    .map(node => ({
      requestHeader: upper(node?.requestHeader),
      responseHeaders: Object.freeze([...observedResponses(node)].sort()),
      knownEcuId: clean(node?.knownEcuId)
    }));
  const unmappedTechstreamSystems = reference.systems
    .filter(system => !mappedSystems.has(system.name))
    .map(system => system.name);

  const verified = mappingResults.filter(mapping => mapping.evidenceLevel === "verified");
  const verifiedObserved = verified.filter(mapping => mapping.status === "observed").length;
  const verifiedDiscrepancies = verified.filter(mapping => mapping.status !== "observed").length;
  let status = "manual-review";
  if (!reference.systems.length) status = "incomplete-reference";
  else if (verifiedDiscrepancies) status = "verified-mapping-discrepancy";
  else if (verified.length && verifiedObserved === verified.length) status = "verified-mappings-observed";

  return Object.freeze({
    loaded: true,
    status,
    reference,
    systemCount: reference.systems.length,
    dtcCount: reference.systems.reduce((sum, system) => sum + system.dtcs.length, 0),
    systemsWithDtcs: reference.systems.filter(system => system.dtcs.length).length,
    mappings: freezeArray(mappingResults),
    verifiedMappings: verified.length,
    candidateMappings: mappingResults.filter(mapping => mapping.evidenceLevel === "candidate").length,
    verifiedObserved,
    verifiedDiscrepancies,
    unmappedFlexResponders: freezeArray(unmappedFlexResponders),
    unmappedTechstreamSystems: Object.freeze(unmappedTechstreamSystems),
    manualReviewRequired: true
  });
}


