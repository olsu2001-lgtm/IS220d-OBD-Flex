import { ecuSurveyTopologySignature } from "./ecu-survey.js";

export const FIELD_VALIDATION_REQUIRED_RUNS = 3;
export const FIELD_VALIDATION_TOYOTA_PROBES = Object.freeze([
  Object.freeze({ command: "217E", identifier: 0x7e }),
  Object.freeze({ command: "217F", identifier: 0x7f }),
  Object.freeze({ command: "212C", identifier: 0x2c })
]);

const normalizeHex = value => String(value || "").replace(/\s+/g, "").toUpperCase();

function responseHeadersFromRaw(raw) {
  const headers = new Set();
  for (const line of String(raw || "").toUpperCase().split(/[\r\n]+/)) {
    const match = line.trim().match(/^([0-9A-F]{3})(?:\s+|(?=[0-9A-F]{2}))/);
    if (match) headers.add(match[1]);
  }
  return Object.freeze([...headers]);
}

function engineStateFromRun(run) {
  const declared = run?.meta?.engineRunningDeclared;
  if (declared === true) return "running";
  if (declared === false) return "stopped";
  return "auto";
}

function firstResult(results, predicate) {
  return (Array.isArray(results) ? results : []).find(predicate) || null;
}

function lastResult(results, predicate) {
  return [...(Array.isArray(results) ? results : [])].reverse().find(predicate) || null;
}

function toyotaResultState(results, probe) {
  const matching = (Array.isArray(results) ? results : []).filter(result =>
    Number(result?.toyotaIdentifier) === probe.identifier
  );
  const attempted = matching.some(result => result?.status !== "SKIP");
  const positive = matching.find(result => result?.validResponse === true) || null;
  const timeout = matching.some(result => result?.timeout === true);
  const rawText = matching.map(result => String(result?.raw || "")).join("\n").toUpperCase();
  const negative = matching.some(result => /(?:^|\s)7F\s*21(?:\s|$)/.test(String(result?.cleaned || result?.raw || "").toUpperCase()));
  const noData = /NO\s*DATA/.test(rawText);
  let status = "not-attempted";
  if (positive) status = "positive";
  else if (attempted && negative) status = "negative-response";
  else if (attempted && noData) status = "no-data";
  else if (attempted && timeout) status = "timeout";
  else if (attempted) status = "no-positive-response";
  return Object.freeze({
    command: probe.command,
    identifier: probe.identifier,
    attempted,
    positive: Boolean(positive),
    status,
    queryForm: String(positive?.queryForm || ""),
    responseHeaders: responseHeadersFromRaw(positive?.raw || ""),
    attempts: matching.length,
    writable: false
  });
}

export function extractFieldValidationEvidenceFromDiagnosticRun(run) {
  const results = Array.isArray(run?.results) ? run.results : [];
  const currentProbe = firstResult(results, result =>
    result?.phase === "Nykytila ennen nollausta" && normalizeHex(result?.command) === "0100"
  );
  const restorationProbe = lastResult(results, result =>
    result?.phase === "Palautus" && normalizeHex(result?.command) === "0100"
  );
  const toyota = Object.freeze(FIELD_VALIDATION_TOYOTA_PROBES.map(probe => toyotaResultState(results, probe)));
  const internalFailure = results.some(result => result?.phase === "Ohjaus" && result?.status === "FAIL");
  return Object.freeze({
    schemaVersion: 1,
    source: "existing-wide-diagnostic-results",
    engineState: engineStateFromRun(run),
    connectionStrategy: String(run?.connectionStrategy || ""),
    currentSettingsProbeObserved: Boolean(currentProbe),
    currentSettingsProbePassed: currentProbe?.validResponse === true,
    restorationProbeObserved: Boolean(restorationProbe),
    restorationPassed: restorationProbe?.validResponse === true,
    cancelled: run?.cancelled === true,
    internalFailure,
    toyota,
    toyotaAttemptedCount: toyota.filter(item => item.attempted).length,
    toyotaPositiveCount: toyota.filter(item => item.positive).length,
    writable: false
  });
}

function sameValidationGroup(snapshot, reference) {
  return snapshot?.mode === "read-only" &&
    Number(snapshot?.schemaVersion) === Number(reference?.schemaVersion) &&
    String(snapshot?.profileVersion || "") === String(reference?.profileVersion || "") &&
    String(snapshot?.safeProbe || "") === String(reference?.safeProbe || "") &&
    String(snapshot?.buildSha || "") === String(reference?.buildSha || "") &&
    String(snapshot?.validation?.engineState || "") === String(reference?.validation?.engineState || "");
}

function engineRelationshipPass(snapshot) {
  const engine = (snapshot?.nodes || []).find(node => String(node?.requestHeader || "") === "7E0");
  return engine?.responding === true && (engine?.observedResponseHeaders || []).map(String).includes("7E8");
}

function toyotaCoveragePass(snapshot) {
  const rows = Array.isArray(snapshot?.validation?.toyota) ? snapshot.validation.toyota : [];
  return FIELD_VALIDATION_TOYOTA_PROBES.every(probe =>
    rows.some(row => String(row?.command || "") === probe.command && row?.attempted === true)
  );
}

function check(code, label, pass, detail) {
  return Object.freeze({ code, label, pass: Boolean(pass), detail: String(detail || "") });
}

export function evaluateFieldValidationSession(snapshots, requiredRuns = FIELD_VALIDATION_REQUIRED_RUNS) {
  const all = Array.isArray(snapshots) ? snapshots.filter(Boolean) : [];
  const required = Math.max(1, Math.trunc(Number(requiredRuns) || FIELD_VALIDATION_REQUIRED_RUNS));
  const latest = all.length ? all[all.length - 1] : null;
  if (!latest) {
    return Object.freeze({
      status: "collecting",
      readyForTechstream: false,
      requiredRuns: required,
      observedRuns: 0,
      buildSha: "",
      engineState: "",
      runs: Object.freeze([]),
      checks: Object.freeze([]),
      pendingExternal: Object.freeze(["Techstream Health Check / system inventory"])
    });
  }

  const group = all.filter(item => sameValidationGroup(item, latest)).slice(-required);
  const enoughRuns = group.length >= required;
  const signatures = group.map(item => ecuSurveyTopologySignature(item) || "none");
  const stableTopology = enoughRuns && new Set(signatures).size === 1;
  const buildSha = String(latest.buildSha || "");
  const engineState = String(latest.validation?.engineState || "");
  const buildTraceable = Boolean(buildSha);
  const vehicleStateDeclared = engineState === "running" || engineState === "stopped";
  const engineRelationship = enoughRuns && group.every(engineRelationshipPass);
  const identityMatch = enoughRuns && group.every(item => item?.identity?.overall === "match");
  const restoration = enoughRuns && group.every(item => item?.validation?.restorationPassed === true);
  const cleanRuns = enoughRuns && group.every(item => item?.validation?.cancelled !== true && item?.validation?.internalFailure !== true);
  const currentProbeRecorded = enoughRuns && group.every(item => item?.validation?.currentSettingsProbeObserved === true);
  const toyotaCoverage = enoughRuns && group.every(toyotaCoveragePass);

  const checks = Object.freeze([
    check("run-count", "Kolme yhteensopivaa ajoa", enoughRuns, `${group.length}/${required}`),
    check("build-sha", "Sama jäljitettävä build", buildTraceable, buildSha || "Build SHA puuttuu"),
    check("vehicle-state", "Sama ilmoitettu moottorin tila", vehicleStateDeclared, engineState || "tila puuttuu"),
    check("current-0100", "Nykytilan 0100 kirjattu", currentProbeRecorded, currentProbeRecorded ? "kaikissa ajoissa" : "puuttuu vähintään yhdestä ajosta"),
    check("topology", "Topologia vakaa", stableTopology, stableTopology ? signatures[0] : `${new Set(signatures).size} eri signatuuria`),
    check("engine-7e8", "Moottori 7E0 → 7E8", engineRelationship, engineRelationship ? "toistui kaikissa ajoissa" : "ei toistunut kaikissa ajoissa"),
    check("mode09", "Mode 09 identiteetti täsmää", identityMatch, identityMatch ? "VIN/CALID/CVN match kaikissa ajoissa" : "match puuttuu vähintään yhdestä ajosta"),
    check("toyota", "217E/217F/212C tulokset kerätty", toyotaCoverage, toyotaCoverage ? "kaikki kolme yritettiin jokaisessa ajossa" : "probe-kattavuus puutteellinen"),
    check("restoration", "Palautuksen 0100 onnistui", restoration, restoration ? "kaikissa ajoissa" : "puuttuu tai epäonnistui"),
    check("clean-runs", "Ajot päättyivät hallitusti", cleanRuns, cleanRuns ? "ei keskeytystä tai sisäistä virhettä" : "vähintään yksi ajo keskeytyi tai sisäinen virhe kirjattiin")
  ]);

  const readyForTechstream = checks.every(item => item.pass);
  return Object.freeze({
    status: !enoughRuns ? "collecting" : readyForTechstream ? "ready-for-techstream" : "needs-attention",
    readyForTechstream,
    requiredRuns: required,
    observedRuns: group.length,
    buildSha,
    engineState,
    topologySignature: stableTopology ? signatures[0] : "",
    runs: Object.freeze([...group]),
    checks,
    pendingExternal: Object.freeze(["Techstream Health Check / system inventory"])
  });
}

function formatTimestamp(value) {
  if (!Number.isFinite(value)) return "unknown";
  return new Date(Number(value)).toISOString();
}

export function buildFieldValidationTextReport(session) {
  const value = session || evaluateFieldValidationSession([]);
  const lines = [
    "IS220d OBD FLEX FIELD VALIDATION",
    `Status: ${value.status}`,
    `Ready for Techstream cross-check: ${value.readyForTechstream ? "yes" : "no"}`,
    `Build SHA: ${value.buildSha || "unknown"}`,
    `Engine state: ${value.engineState || "unknown"}`,
    `Runs: ${value.observedRuns}/${value.requiredRuns}`,
    `Stable topology: ${value.topologySignature || "not established"}`,
    "",
    "Checks:"
  ];
  for (const item of value.checks || []) lines.push(`- ${item.pass ? "PASS" : "PENDING"} | ${item.label} | ${item.detail}`);
  lines.push("", "Runs:");
  for (const run of value.runs || []) {
    const toyota = (run?.validation?.toyota || []).map(item => `${item.command}:${item.status}`).join(", ") || "none";
    lines.push(
      `- ${String(run?.runId || "unknown")} | ${formatTimestamp(run?.endedAt ?? run?.startedAt)} | ` +
      `identity=${String(run?.identity?.overall || "not-observed")} | restoration=${run?.validation?.restorationPassed ? "pass" : "fail"} | ` +
      `toyota=${toyota} | topology=${ecuSurveyTopologySignature(run) || "none"}`
    );
  }
  lines.push("", "External evidence still required:");
  for (const item of value.pendingExternal || []) lines.push(`- ${item}`);
  lines.push("- This report is derived from stored read-only diagnostic evidence and sends no vehicle command.");
  return `${lines.join("\n")}\n`;
}


