import {
  TECHSTREAM_REFERENCE_SCHEMA_VERSION,
  TECHSTREAM_REFERENCE_SOURCE,
  normalizeTechstreamReference
} from "./techstream-reference.js";

const clean = value => String(value ?? "").replace(/[\r\n\t]+/g, " ").trim();

function nonEmptyLines(value) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function splitPipeLine(line) {
  return String(line).split("|").map(part => part.trim());
}

function dtcTokens(value) {
  const text = clean(value);
  if (!text) return [];
  return text
    .split(/[\s,;]+/)
    .map(token => token.trim())
    .filter(Boolean);
}

export function parseGuidedTechstreamSystems(text) {
  return nonEmptyLines(text).map((line, index) => {
    const parts = splitPipeLine(line);
    if (parts.length > 3) throw new Error(`Järjestelmärivillä ${index + 1} on liikaa | -kenttiä`);
    const [name = "", dtcs = "", note = ""] = parts;
    if (!name) throw new Error(`Järjestelmäriviltä ${index + 1} puuttuu nimi`);
    return Object.freeze({
      name,
      dtcs: Object.freeze(dtcTokens(dtcs)),
      note
    });
  });
}

export function parseGuidedTechstreamMappings(text) {
  return nonEmptyLines(text).map((line, index) => {
    const parts = splitPipeLine(line);
    if (parts.length < 4 || parts.length > 5) {
      throw new Error(`Mapping-rivi ${index + 1}: käytä muotoa request | response | järjestelmä | candidate/verified | evidenssiperuste`);
    }
    const [requestHeader = "", responseHeader = "", systemName = "", rawLevel = "", evidenceNote = ""] = parts;
    if (!requestHeader || !responseHeader || !systemName) throw new Error(`Mapping-riviltä ${index + 1} puuttuu osoite tai järjestelmänimi`);
    const evidenceLevel = clean(rawLevel).toLowerCase() || "candidate";
    if (!evidenceNote) throw new Error(`Mapping-riviltä ${index + 1} puuttuu evidenssiperuste`);
    return Object.freeze({
      requestHeader,
      responseHeader,
      systemName,
      evidenceLevel,
      evidenceNote
    });
  });
}

export function buildGuidedTechstreamReference({
  referenceId = "",
  capturedAt = "",
  note = "",
  systemsText = "",
  mappingsText = ""
} = {}) {
  const candidate = {
    schemaVersion: TECHSTREAM_REFERENCE_SCHEMA_VERSION,
    source: TECHSTREAM_REFERENCE_SOURCE,
    referenceId: clean(referenceId),
    capturedAt: clean(capturedAt),
    note: clean(note),
    systems: parseGuidedTechstreamSystems(systemsText),
    mappings: parseGuidedTechstreamMappings(mappingsText)
  };
  return normalizeTechstreamReference(candidate);
}

function joinDtcs(values) {
  return Array.isArray(values) ? values.join(", ") : "";
}

export function techstreamReferenceToGuidedDraft(reference) {
  const value = reference && typeof reference === "object" ? reference : null;
  return Object.freeze({
    referenceId: clean(value?.referenceId),
    capturedAt: clean(value?.capturedAt),
    note: clean(value?.note),
    systemsText: (value?.systems || []).map(system =>
      [clean(system?.name), joinDtcs(system?.dtcs), clean(system?.note)].join(" | ").replace(/\s+\|\s+$/, "")
    ).join("\n"),
    mappingsText: (value?.mappings || []).map(mapping =>
      [
        clean(mapping?.requestHeader),
        clean(mapping?.responseHeader),
        clean(mapping?.systemName),
        clean(mapping?.evidenceLevel) || "candidate",
        clean(mapping?.evidenceNote)
      ].join(" | ")
    ).join("\n")
  });
}

export function buildGuidedTechstreamExamples() {
  return Object.freeze({
    systems: "Engine system | | Health Checkissä näkyvä järjestelmänimi\nABS/VSC/TRC | C0215, U0073 | Esimerkkimuoto — käytä vain oman raportin koodeja",
    mappings: "7E0 | 7E8 | Engine system | candidate | Lisää tähän riippumaton peruste tälle CAN-mappaukselle"
  });
}
