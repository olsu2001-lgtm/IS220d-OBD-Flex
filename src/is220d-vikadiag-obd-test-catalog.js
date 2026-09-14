import {
  getIs220dDiagnosticSignal,
  isProductionAuthorizedIs220dSignal
} from "./is220d-diagnostic-signals.js";

/**
 * Source-only roadmap from the current Drive sheet:
 * Bom-kaapija / Vikadiag_kohteet.
 *
 * This module never sends vehicle commands. It records which reviewed Drive rows
 * can be implemented using signals that already exist in Flex, which rows still
 * need evidence, and which repair-manual visual should later be extracted for the
 * guided test UI.
 */

export const IS220D_VIKADIAG_OBD_TEST_CATALOG_SCHEMA_VERSION = 1;
export const IS220D_VIKADIAG_OBD_TEST_SOURCE = "Bom-kaapija / Vikadiag_kohteet";
export const IS220D_VIKADIAG_OBD_TEST_SOURCE_BATCH = "Drive rows 2-10 reviewed 2026-09-14";

export const VIKADIAG_TEST_READINESS = Object.freeze({
  IMPLEMENTED_DEDICATED: "implemented-dedicated",
  READY_EXISTING_SIGNALS: "ready-existing-signals",
  INDIRECT_EXISTING_SIGNALS: "indirect-existing-signals",
  NEEDS_SIGNAL_VERIFICATION: "needs-signal-verification",
  BLOCKED: "blocked"
});

const READY_WITHOUT_NEW_SIGNAL = new Set([
  VIKADIAG_TEST_READINESS.IMPLEMENTED_DEDICATED,
  VIKADIAG_TEST_READINESS.READY_EXISTING_SIGNALS,
  VIKADIAG_TEST_READINESS.INDIRECT_EXISTING_SIGNALS
]);

const ALLOWED_OBD_ROLES = new Set(["direct", "indirect"]);
const ALLOWED_VISUAL_STATES = new Set(["pending-extract", "source-identified", "available"]);
const ALLOWED_EXCLUSIONS = new Set([
  "active-test",
  "forced-regeneration",
  "dtc-clear",
  "ecu-write"
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function manualVisual(searchTerms, extra = {}) {
  return {
    required: true,
    status: "pending-extract",
    source: "Lexus IS250/220D repair manual",
    searchTerms,
    assetPath: null,
    manualReference: null,
    ...extra
  };
}

function validateCandidate(candidate) {
  if (!Number.isInteger(candidate?.sourceRow) || candidate.sourceRow < 2) {
    throw new Error(`Invalid Vikadiag source row: ${candidate?.sourceRow}`);
  }
  if (!ALLOWED_OBD_ROLES.has(candidate.obdRole)) {
    throw new Error(`Invalid OBD role at Vikadiag row ${candidate.sourceRow}: ${candidate.obdRole}`);
  }
  if (!Object.values(VIKADIAG_TEST_READINESS).includes(candidate.readiness)) {
    throw new Error(`Invalid readiness at Vikadiag row ${candidate.sourceRow}: ${candidate.readiness}`);
  }
  if (!Array.isArray(candidate.signalKeys)) {
    throw new Error(`Missing signalKeys at Vikadiag row ${candidate.sourceRow}`);
  }
  for (const signalKey of candidate.signalKeys) {
    const signal = getIs220dDiagnosticSignal(signalKey);
    if (!signal) throw new Error(`Unknown signal ${signalKey} at Vikadiag row ${candidate.sourceRow}`);
    if (signal.authorization === "field-rejected") {
      throw new Error(`Field-rejected signal ${signalKey} cannot be used at Vikadiag row ${candidate.sourceRow}`);
    }
    if (READY_WITHOUT_NEW_SIGNAL.has(candidate.readiness) && !isProductionAuthorizedIs220dSignal(signalKey)) {
      throw new Error(`Unverified signal ${signalKey} cannot mark Vikadiag row ${candidate.sourceRow} ready`);
    }
  }
  for (const signalKey of candidate.blockedSignalKeys || []) {
    if (!getIs220dDiagnosticSignal(signalKey)) {
      throw new Error(`Unknown blocked signal ${signalKey} at Vikadiag row ${candidate.sourceRow}`);
    }
  }
  if (candidate.readiness === VIKADIAG_TEST_READINESS.IMPLEMENTED_DEDICATED && !candidate.existingImplementation) {
    throw new Error(`Implemented Vikadiag row ${candidate.sourceRow} needs existingImplementation metadata`);
  }
  if (!candidate.manualVisual?.required || !ALLOWED_VISUAL_STATES.has(candidate.manualVisual?.status)) {
    throw new Error(`Repair-manual visual metadata missing at Vikadiag row ${candidate.sourceRow}`);
  }
  if (!Array.isArray(candidate.manualVisual.searchTerms) || candidate.manualVisual.searchTerms.length === 0) {
    throw new Error(`Repair-manual search terms missing at Vikadiag row ${candidate.sourceRow}`);
  }
  for (const exclusion of candidate.excludedActions || []) {
    if (!ALLOWED_EXCLUSIONS.has(exclusion)) {
      throw new Error(`Unknown excluded action ${exclusion} at Vikadiag row ${candidate.sourceRow}`);
    }
  }
  return candidate;
}

const firstBatch = [
  {
    sourceRow: 2,
    diagnosticGroup: "3. Ilma, alipaine, EGR ja pakokaasu",
    componentId: "engine.egr_valve",
    pnc: "25620",
    oe: "25620-26101",
    label: "EGR-venttiili",
    obdRole: "direct",
    readiness: VIKADIAG_TEST_READINESS.READY_EXISTING_SIGNALS,
    signalKeys: ["engine.egr_position_toyota", "engine.maf", "engine.map"],
    excludedActions: ["active-test"],
    manualVisual: manualVisual(["EGR valve", "25620-26101", "2AD-FHV EGR"]),
    note: "Drive-rivin active test -maininta on vain lähde-evidenssiä; Flexin testiin tulee pelkkä luku ja järjestelmävasteen vertailu."
  },
  {
    sourceRow: 3,
    diagnosticGroup: "3. Ilma, alipaine, EGR ja pakokaasu",
    componentId: "engine.egr_no2_exhaust_gas_door",
    pnc: "25630",
    oe: "25630-26010",
    label: "EGR No.2 / pakokaasuläppä",
    obdRole: "indirect",
    readiness: VIKADIAG_TEST_READINESS.NEEDS_SIGNAL_VERIFICATION,
    signalKeys: ["engine.egr_position_toyota", "engine.maf", "engine.dpnr_differential_pressure", "engine.egt_inlet", "engine.egt_outlet"],
    excludedActions: ["active-test"],
    manualVisual: manualVisual(["EGR No.2", "exhaust gas door", "25630-26010"]),
    note: "Nykyiset signaalit voivat antaa järjestelmäkontekstin, mutta erilliselle läpälle ei ole vielä ajoneuvovarmennettua omaa asento-/komentosignaalia."
  },
  {
    sourceRow: 4,
    diagnosticGroup: "3. Ilma, alipaine, EGR ja pakokaasu",
    componentId: "engine.maf_sensor",
    pnc: "22204",
    oe: "22204-30010",
    label: "MAF / ilmamäärämittari",
    obdRole: "direct",
    readiness: VIKADIAG_TEST_READINESS.READY_EXISTING_SIGNALS,
    signalKeys: ["engine.maf", "engine.map", "engine.egr_position_toyota"],
    manualVisual: manualVisual(["mass air flow meter", "22204-30010", "air cleaner MAF"]),
    note: "Ensimmäinen toteutus voi käyttää nykyistä MAF-vastetta ja MAP/EGR-ristivertailua ilman uusia ECU-pyyntöjä."
  },
  {
    sourceRow: 5,
    diagnosticGroup: "3. Ilma, alipaine, EGR ja pakokaasu",
    componentId: "engine.dpnr_differential_pressure_sensor",
    pnc: "89480A",
    oe: "89480-53010",
    label: "DPF/DPNR paine-eroanturi",
    obdRole: "direct",
    readiness: VIKADIAG_TEST_READINESS.IMPLEMENTED_DEDICATED,
    signalKeys: ["engine.dpnr_differential_pressure", "engine.rpm"],
    existingImplementation: "Flex 0.9.4 DPNR differential-pressure sensor guided test",
    manualVisual: manualVisual(["differential pressure sensor", "89480-53010", "P1426", "DPNR pressure transmitting hose"], {
      status: "source-identified",
      manualReference: "Korjaamo-oppaasta poimittava anturi/paineletkujen kuva; Driveen on jo tallennettu DPNR-paineletkujen kuvallinen ohje vertailuksi."
    }),
    note: "Tämä rivi toimii mallina muiden Vikadiag-rivien ohjatuille testeille kenttävalidoinnin jälkeen."
  },
  {
    sourceRow: 6,
    diagnosticGroup: "3. Ilma, alipaine, EGR ja pakokaasu",
    componentId: "engine.exhaust_gas_temperature_sensor_1",
    pnc: "89425",
    oe: "89425-53010",
    label: "Pakokaasun lämpötila-anturi 1",
    obdRole: "direct",
    readiness: VIKADIAG_TEST_READINESS.READY_EXISTING_SIGNALS,
    signalKeys: ["engine.egt_inlet", "engine.coolant_temperature", "engine.rpm"],
    manualVisual: manualVisual(["exhaust gas temperature sensor", "89425-53010", "DPNR inlet temperature sensor"]),
    note: "Ohjattu testi voidaan tehdä kylmävertailuna ja lämpenemisvasteena nykyisestä varmennetusta 217F-datasta."
  },
  {
    sourceRow: 7,
    diagnosticGroup: "3. Ilma, alipaine, EGR ja pakokaasu",
    componentId: "engine.exhaust_gas_temperature_sensor_2",
    pnc: "89425A",
    oe: "89425-53020",
    label: "Pakokaasun lämpötila-anturi 2",
    obdRole: "direct",
    readiness: VIKADIAG_TEST_READINESS.READY_EXISTING_SIGNALS,
    signalKeys: ["engine.egt_outlet", "engine.egt_inlet", "engine.coolant_temperature", "engine.rpm"],
    manualVisual: manualVisual(["exhaust gas temperature sensor no.2", "89425-53020", "DPNR outlet temperature sensor"]),
    note: "Toteutus vertaa antureita keskenään ja kuormituksen muutokseen eikä päättele vikaa yhdestä lämpötilasta."
  },
  {
    sourceRow: 8,
    diagnosticGroup: "4. Polttoainejärjestelmä",
    componentId: "engine.main_injectors",
    pnc: "23670",
    oe: "23670-29105",
    label: "Common rail -pääsuuttimet",
    obdRole: "indirect",
    readiness: VIKADIAG_TEST_READINESS.INDIRECT_EXISTING_SIGNALS,
    signalKeys: ["engine.rail_pressure_obd", "engine.rpm"],
    blockedSignalKeys: ["engine.injection_feedback_rejected"],
    manualVisual: manualVisual(["injector assy", "23670-29105", "injection nozzle", "leak-off"]),
    note: "Flex voi tehdä nyt vain epäsuoran rail/RPM-seulonnan. 219C-suutinkorjaus on kentässä hylätty eikä sitä saa käyttää ennen uuden Techstream-transaktion varmennusta."
  },
  {
    sourceRow: 9,
    diagnosticGroup: "4. Polttoainejärjestelmä",
    componentId: "engine.exhaust_fuel_addition_injector",
    pnc: "23710B",
    oe: "23710-26011",
    label: "DPF/DPNR lisäpolttoainesuutin",
    obdRole: "indirect",
    readiness: VIKADIAG_TEST_READINESS.INDIRECT_EXISTING_SIGNALS,
    signalKeys: ["engine.dpnr_differential_pressure", "engine.egt_inlet", "engine.egt_outlet", "engine.rail_pressure_obd"],
    excludedActions: ["active-test", "forced-regeneration"],
    manualVisual: manualVisual(["exhaust fuel addition injector", "23710-26011", "5th injector", "DPNR"]),
    note: "Flexin alustava testi voi seurata paine- ja lämpöketjua, mutta ei komentaa lisäsuutinta eikä käynnistää regenerointia."
  },
  {
    sourceRow: 10,
    diagnosticGroup: "4. Polttoainejärjestelmä",
    componentId: "engine.scv",
    pnc: "04226",
    oe: "04226-0L040",
    label: "SCV / imuohjausventtiili korkeapainepumpulla",
    obdRole: "indirect",
    readiness: VIKADIAG_TEST_READINESS.INDIRECT_EXISTING_SIGNALS,
    signalKeys: ["engine.rail_pressure_obd", "engine.rpm"],
    manualVisual: manualVisual(["suction control valve", "04226-0L040", "supply pump", "SCV"]),
    note: "Nykyinen turvallinen toteutus voi näyttää rail-paineen käyttäytymisen. Täysi target-vs-actual/SCV-duty-testi odottaa ajoneuvovarmennettua signaalipolkua."
  }
];

const seenRows = new Set();
for (const candidate of firstBatch) {
  validateCandidate(candidate);
  if (seenRows.has(candidate.sourceRow)) throw new Error(`Duplicate Vikadiag source row ${candidate.sourceRow}`);
  seenRows.add(candidate.sourceRow);
}

export const IS220D_VIKADIAG_OBD_TEST_CATALOG = deepFreeze(firstBatch);

export function getVikadiagObdTestCandidateByRow(sourceRow) {
  return IS220D_VIKADIAG_OBD_TEST_CATALOG.find(candidate => candidate.sourceRow === Number(sourceRow)) || null;
}

export function summarizeVikadiagObdTestCatalog(catalog = IS220D_VIKADIAG_OBD_TEST_CATALOG) {
  const summary = {
    total: catalog.length,
    implementedDedicated: 0,
    readyExistingSignals: 0,
    indirectExistingSignals: 0,
    needsSignalVerification: 0,
    blocked: 0,
    manualVisualPending: 0
  };
  for (const candidate of catalog) {
    if (candidate.readiness === VIKADIAG_TEST_READINESS.IMPLEMENTED_DEDICATED) summary.implementedDedicated += 1;
    if (candidate.readiness === VIKADIAG_TEST_READINESS.READY_EXISTING_SIGNALS) summary.readyExistingSignals += 1;
    if (candidate.readiness === VIKADIAG_TEST_READINESS.INDIRECT_EXISTING_SIGNALS) summary.indirectExistingSignals += 1;
    if (candidate.readiness === VIKADIAG_TEST_READINESS.NEEDS_SIGNAL_VERIFICATION) summary.needsSignalVerification += 1;
    if (candidate.readiness === VIKADIAG_TEST_READINESS.BLOCKED) summary.blocked += 1;
    if (candidate.manualVisual?.status !== "available") summary.manualVisualPending += 1;
  }
  return Object.freeze(summary);
}
