import {
  IS220D_VIKADIAG_OBD_TEST_CATALOG,
  VIKADIAG_TEST_READINESS
} from "./is220d-vikadiag-obd-test-catalog.js";
import {
  getIs220dDiagnosticSignal,
  isProductionAuthorizedIs220dSignal
} from "./is220d-diagnostic-signals.js";

/**
 * Visual diagnostic Test Lab model.
 *
 * This module never transmits vehicle commands. It combines the reviewed Drive
 * Vikadiag catalog with diagnostic coverage that Flex has already collected so
 * the UI can show where an OBD evidence chain is complete or where it stopped.
 */

export const DIAGNOSTIC_TEST_LAB_SCHEMA_VERSION = 1;

export const TEST_LAB_STAGE_STATUS = Object.freeze({
  OK: "ok",
  WARNING: "warning",
  FAILED: "failed",
  IDLE: "idle",
  BLOCKED: "blocked"
});

const RUNNABLE_READINESS = new Set([
  VIKADIAG_TEST_READINESS.IMPLEMENTED_DEDICATED,
  VIKADIAG_TEST_READINESS.READY_EXISTING_SIGNALS,
  VIKADIAG_TEST_READINESS.INDIRECT_EXISTING_SIGNALS
]);

const READINESS_LABELS = Object.freeze({
  [VIKADIAG_TEST_READINESS.IMPLEMENTED_DEDICATED]: "Ohjattu testi",
  [VIKADIAG_TEST_READINESS.READY_EXISTING_SIGNALS]: "OBD-testi valmis",
  [VIKADIAG_TEST_READINESS.INDIRECT_EXISTING_SIGNALS]: "Epäsuora OBD-seulonta",
  [VIKADIAG_TEST_READINESS.NEEDS_SIGNAL_VERIFICATION]: "Signaalivarmennus puuttuu",
  [VIKADIAG_TEST_READINESS.BLOCKED]: "Estetty",
  [VIKADIAG_TEST_READINESS.PHYSICAL_ONLY]: "Fyysinen tarkastus"
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function flattenCoverageSignals(component) {
  const byKey = new Map();
  for (const group of component?.groupEvidence || []) {
    for (const signal of group?.signals || []) {
      const key = String(signal?.signalKey || "");
      if (!key) continue;
      const previous = byKey.get(key) || { attempted: false, observed: false, attempts: 0, command: "" };
      byKey.set(key, {
        attempted: previous.attempted || signal?.attempted === true,
        observed: previous.observed || signal?.observed === true,
        attempts: previous.attempts + Math.max(0, Number(signal?.attempts || 0)),
        command: signal?.command || previous.command || ""
      });
    }
  }
  return byKey;
}

function coverageByComponentId(coverage) {
  const map = new Map();
  for (const component of coverage?.components || []) {
    if (component?.id) map.set(component.id, component);
  }
  return map;
}

export function isDiagnosticTestLabCandidate(candidate) {
  return Boolean(candidate && candidate.obdRole !== "physical-only" && candidate.readiness !== VIKADIAG_TEST_READINESS.PHYSICAL_ONLY);
}

function buildSignalModel(signalKey, coverageSignal = null) {
  const definition = getIs220dDiagnosticSignal(signalKey);
  if (!definition) {
    return deepFreeze({
      key: signalKey,
      label: signalKey,
      unit: "",
      commands: [],
      expectedResponsePrefix: "",
      decoder: "",
      evidence: "unknown",
      authorization: "not-authorized",
      productionAuthorized: false,
      attempted: false,
      observed: false,
      attempts: 0,
      commandUsed: ""
    });
  }
  return deepFreeze({
    key: definition.key,
    label: definition.label,
    unit: definition.unit || "",
    commands: [...definition.commands],
    expectedResponsePrefix: definition.expectedResponsePrefix || "",
    decoder: definition.decoder || "",
    evidence: definition.evidence,
    authorization: definition.authorization,
    productionAuthorized: isProductionAuthorizedIs220dSignal(signalKey),
    attempted: coverageSignal?.attempted === true,
    observed: coverageSignal?.observed === true,
    attempts: Math.max(0, Number(coverageSignal?.attempts || 0)),
    commandUsed: coverageSignal?.command || ""
  });
}

function stage(id, label, status, detail) {
  return deepFreeze({ id, label, status, detail });
}

function buildPipeline(candidate, componentCoverage, signals, runnable) {
  const anyAttempted = signals.some(signal => signal.attempted);
  const anyObserved = signals.some(signal => signal.observed);
  const allConfigured = signals.length > 0 && signals.every(signal => signal.commands.length && signal.expectedResponsePrefix && signal.decoder);
  const coverageStatus = componentCoverage?.status || "not-tested";

  const evidenceStatus = candidate.readiness === VIKADIAG_TEST_READINESS.BLOCKED
    ? TEST_LAB_STAGE_STATUS.BLOCKED
    : candidate.readiness === VIKADIAG_TEST_READINESS.NEEDS_SIGNAL_VERIFICATION
      ? TEST_LAB_STAGE_STATUS.WARNING
      : runnable
        ? TEST_LAB_STAGE_STATUS.OK
        : TEST_LAB_STAGE_STATUS.BLOCKED;

  const evidenceDetail = candidate.readiness === VIKADIAG_TEST_READINESS.NEEDS_SIGNAL_VERIFICATION
    ? (candidate.missingSignals || []).join(" · ") || "Tarvittavaa signaalia ei ole vielä ajoneuvovarmennettu."
    : candidate.readiness === VIKADIAG_TEST_READINESS.BLOCKED
      ? "Kohde on tarkoituksella estetty tuotantotestauksesta."
      : runnable
        ? "Kaikki tämän testin käyttämät signaalit ovat tuotantokäyttöön hyväksyttyjä."
        : "Testi ei täytä tuotantotestauksen ehtoja.";

  const requestStatus = anyAttempted ? TEST_LAB_STAGE_STATUS.OK : TEST_LAB_STAGE_STATUS.IDLE;
  const requestDetail = anyAttempted
    ? `${signals.reduce((sum, signal) => sum + signal.attempts, 0)} kirjattua lukuyritystä nykyisessä diagnoosievidenssissä.`
    : "Tämän kohteen signaaleja ei ole vielä yritetty nykyisessä diagnoosievidenssissä.";

  const responseStatus = anyObserved
    ? TEST_LAB_STAGE_STATUS.OK
    : anyAttempted
      ? TEST_LAB_STAGE_STATUS.FAILED
      : TEST_LAB_STAGE_STATUS.IDLE;
  const responseDetail = anyObserved
    ? `${signals.filter(signal => signal.observed).length}/${signals.length} signaalia on tuottanut kelvollisen positiivisen vastauksen.`
    : anyAttempted
      ? "Lukupyyntöjä on yritetty, mutta yhtään tämän kohteen signaalia ei ole merkitty kelvolliseksi positiiviseksi vastaukseksi."
      : "Positiivista vastausta ei voida arvioida ennen lukuyritystä.";

  const decoderStatus = !allConfigured
    ? TEST_LAB_STAGE_STATUS.WARNING
    : anyObserved
      ? TEST_LAB_STAGE_STATUS.OK
      : TEST_LAB_STAGE_STATUS.IDLE;
  const decoderDetail = !allConfigured
    ? "Yhdeltä tai useammalta signaalilta puuttuu määritelty vastaustunniste tai dekooderi."
    : anyObserved
      ? "Havaituille signaaleille on määritelty tuotannon käyttämä dekooderi."
      : "Dekooderi on määritelty, mutta tässä näkymässä ei väitetä sen onnistuneen ilman havaittua vastausta.";

  const componentStatus = coverageStatus === "observed"
    ? TEST_LAB_STAGE_STATUS.OK
    : coverageStatus === "partial"
      ? TEST_LAB_STAGE_STATUS.WARNING
      : coverageStatus === "unavailable"
        ? TEST_LAB_STAGE_STATUS.FAILED
        : TEST_LAB_STAGE_STATUS.IDLE;
  const componentDetail = coverageStatus === "observed"
    ? "Komponentin vaatima OBD-evidenssi on havaittu. Tämä ei yksin ole kuntotuomio."
    : coverageStatus === "partial"
      ? "Osa komponentin vaatimasta OBD-evidenssistä on havaittu."
      : coverageStatus === "unavailable"
        ? "Komponentin signaaleja yritettiin, mutta vaadittua evidenssiä ei saatu."
        : "Komponentille ei ole vielä tämän ajon kattavuustulosta.";

  return deepFreeze([
    stage("catalog", "Drive / testimääritys", TEST_LAB_STAGE_STATUS.OK, `Vikadiag_kohteet rivi ${candidate.sourceRow}.`),
    stage("authorization", "Evidenssi ja sallinta", evidenceStatus, evidenceDetail),
    stage("request", "Lukupyyntö", runnable ? requestStatus : TEST_LAB_STAGE_STATUS.BLOCKED, runnable ? requestDetail : evidenceDetail),
    stage("response", "ECU-vastaus", runnable ? responseStatus : TEST_LAB_STAGE_STATUS.BLOCKED, runnable ? responseDetail : evidenceDetail),
    stage("decoder", "Dekooderi", runnable ? decoderStatus : TEST_LAB_STAGE_STATUS.BLOCKED, runnable ? decoderDetail : evidenceDetail),
    stage("component", "Komponenttievidenssi", runnable ? componentStatus : TEST_LAB_STAGE_STATUS.BLOCKED, runnable ? componentDetail : evidenceDetail)
  ]);
}

function diagnosisFor(candidate, componentCoverage, signals, runnable) {
  if (candidate.readiness === VIKADIAG_TEST_READINESS.BLOCKED) {
    return { code: "blocked", label: "Testi estetty", detail: "Kohde on merkitty blocked-tilaan eikä Test Lab lähetä sille pyyntöjä." };
  }
  if (candidate.readiness === VIKADIAG_TEST_READINESS.NEEDS_SIGNAL_VERIFICATION || !runnable) {
    return {
      code: "evidence-gap",
      label: "Evidenssiaukko",
      detail: (candidate.missingSignals || []).join(" · ") || "Tuotantokäyttöön hyväksytty signaali puuttuu."
    };
  }
  if (!componentCoverage) {
    return { code: "not-run", label: "Ei vielä ajettu", detail: "Nykyisestä BOM-diagnostiikan kattavuudesta ei löydy tälle komponentille ajotulosta." };
  }
  const anyAttempted = signals.some(signal => signal.attempted);
  const anyObserved = signals.some(signal => signal.observed);
  if (!anyAttempted) {
    return { code: "not-run", label: "Ei vielä ajettu", detail: "Tarvittavia signaaleja ei ole vielä kysytty tässä diagnoosissa." };
  }
  if (!anyObserved) {
    return { code: "request-response", label: "Pyyntö / vastaus katkeaa", detail: "Pyyntöjä on lähetetty, mutta hyväksyttyä positiivista vastausta ei ole kirjattu." };
  }
  if (componentCoverage.status === "partial") {
    return { code: "partial", label: "Dataketju osittainen", detail: "Vähintään yksi signaali toimii, mutta komponentin kaikki tarvittavat evidenssiryhmät eivät täyty." };
  }
  if (componentCoverage.status === "observed") {
    return { code: "observed", label: "Dataketju havaittu", detail: "Tarvittava OBD-evidenssi on saatu. Test Lab ei tulkitse tätä automaattisesti osan kuntoarvioksi." };
  }
  return { code: componentCoverage.status || "inconclusive", label: "Ei ratkaisua", detail: "Nykyinen evidenssi ei paikanna katkeamiskohtaa tarkemmin." };
}

export function buildDiagnosticTestLabModel({
  catalog = IS220D_VIKADIAG_OBD_TEST_CATALOG,
  coverage = null
} = {}) {
  const coverageMap = coverageByComponentId(coverage);
  const items = catalog.filter(isDiagnosticTestLabCandidate).map(candidate => {
    const componentCoverage = coverageMap.get(candidate.componentId) || null;
    const coverageSignals = flattenCoverageSignals(componentCoverage);
    const signals = candidate.signalKeys.map(key => buildSignalModel(key, coverageSignals.get(key)));
    const runnable = RUNNABLE_READINESS.has(candidate.readiness) && signals.length > 0 &&
      signals.every(signal => signal.productionAuthorized && signal.authorization !== "field-rejected");
    const pipeline = buildPipeline(candidate, componentCoverage, signals, runnable);
    const diagnosis = diagnosisFor(candidate, componentCoverage, signals, runnable);
    return deepFreeze({
      sourceRow: candidate.sourceRow,
      componentId: candidate.componentId,
      label: candidate.label,
      diagnosticGroup: candidate.diagnosticGroup || "Muut",
      pnc: candidate.pnc || "",
      oe: candidate.oe || "",
      obdRole: candidate.obdRole,
      readiness: candidate.readiness,
      readinessLabel: READINESS_LABELS[candidate.readiness] || candidate.readiness,
      runnable,
      testMethod: candidate.testMethod || "",
      expectedPattern: candidate.expectedPattern || "",
      physicalFollowUp: candidate.physicalFollowUp || "",
      operatingStates: [...(candidate.operatingStates || [])],
      limitations: [...(candidate.limitations || [])],
      missingSignals: [...(candidate.missingSignals || [])],
      recipes: (candidate.recipes || []).map(recipe => deepFreeze({ ...recipe, signalKeys: [...(recipe.signalKeys || [])], operatingStates: [...(recipe.operatingStates || [])] })),
      manualVisual: candidate.manualVisual || null,
      signals,
      coverageStatus: componentCoverage?.status || "not-tested",
      assessmentStatus: componentCoverage?.assessment?.status || "not-evaluated",
      pipeline,
      diagnosis: deepFreeze(diagnosis)
    });
  });

  const count = predicate => items.filter(predicate).length;
  return deepFreeze({
    schemaVersion: DIAGNOSTIC_TEST_LAB_SCHEMA_VERSION,
    source: "Bom-kaapija / Vikadiag_kohteet + Flex diagnostic coverage",
    coverageAvailable: Boolean(coverage?.applicable),
    items,
    summary: {
      total: items.length,
      runnable: count(item => item.runnable),
      direct: count(item => item.obdRole === "direct"),
      indirect: count(item => item.obdRole === "indirect"),
      evidenceGap: count(item => item.diagnosis.code === "evidence-gap"),
      blocked: count(item => item.diagnosis.code === "blocked"),
      observed: count(item => item.coverageStatus === "observed"),
      partial: count(item => item.coverageStatus === "partial"),
      unavailable: count(item => item.coverageStatus === "unavailable"),
      notRun: count(item => item.diagnosis.code === "not-run")
    }
  });
}
