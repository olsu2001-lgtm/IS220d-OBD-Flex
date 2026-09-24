import { configureUiShellNavigation, syncUiShellNavigation } from "./ui-shell.js";
import "./techstream-data-list-gap-ui.js";
import { APP_VERSION } from "./app-version.js";
import "./dpnr-pressure-sensor-test.js";
globalThis.__IS220D_DPNR_PRESSURE_SENSOR_TEST_V3__ = true;
import { configureDpnrTestLive } from "./dpnr-test-live.js";
import {
  NativeElmTransport,
  NativeBleElmTransport,
  FakeElmTransport,
  Elm327Client,
  QuicklynksClient,
  PID_DEFINITIONS,
  PID_BY_ID,
  decodePidResponse,
  parseDtcResponse,
  parseMilStatus,
  decodeToyotaReadDataResponse,
  cleanElmResponse,
  hexLines,
  hasModePidResponse,
  isSafeTerminalCommand,
  sessionToCsv,
  sessionToQuicklynksResearchCsv,
  sessionMetricValue,
  calculateSessionStats,
  buildAiAnalysisPrompt,
  buildQuicklynksResearchAiPrompt,
  createQuicklynksResearchState,
  QUICKLYNKS_RESEARCH_PROBES,
  FULL_DIAGNOSTIC_ENGINE_HEADERS,
  IS220D_INJECTOR_SCREENING_PROBES,
  evaluateFullDiagnosticStep,
  summarizeFullDiagnostic,
  buildFullDiagnosticReport,
  buildFullDiagnosticAnalysisPrompt,
  createDiagnosticReportId,
  QUICKLYNKS_SUPPORT_BITMAP_PROBES,
  QUICKLYNKS_SUPPORT_BITMAP_TIMEOUT_MS,
  QUICKLYNKS_WIDE_DIAGNOSTIC_PROBES,
  QUICKLYNKS_WIDE_DIAGNOSTIC_ROUNDS,
  QUICKLYNKS_WIDE_DIAGNOSTIC_TIMEOUT_MS,
  evaluateQuicklynksSupportBitmapEvent,
  evaluateQuicklynksWideDiagnosticEvent,
  summarizeQuicklynksWideDiagnostic,
  buildQuicklynksWideDiagnosticReport,
  buildQuicklynksWideDiagnosticAnalysisPrompt,
  classifyDiagnosticResponse,
  VEHICLE_KEYS,
  getVehicleProfile,
  getVehicleReadDataProbes,
  isProfileReadOnlyCommand,
  metricSupportsVehicle,
  vehicleDisplayName,
  delay
} from "./core.js";
import {
  extractBtsnoopSource,
  analyzeQuicklynksBtsnoop,
  buildQuicklynksTraceReport,
  buildQuicklynksTraceAnalysisPrompt
} from "./btsnoop.js";
import { SessionStore } from "./storage.js";
import { drawLineChart } from "./charts.js";
import {
  VLINKER_CAPABILITY_PROBES,
  MANAGED_RECONNECT_DELAYS_MS,
  classifyAdapterDevice,
  sortAdapterDevices,
  selectedAdapterHelp,
  formatAdapterCapabilitySummary
} from "./adapter-profile.js";
import { AdaptivePollScheduler } from "./poll-scheduler.js";
import {
  CT_PURCHASE_THRESHOLDS,
  createCtPurchaseInspection,
  createCtPurchaseSample,
  parseCtReadiness,
  decodeCtPurchasePid,
  analyzeCtPurchaseInspection,
  buildCtPurchaseInspectionReport,
  buildCtPurchaseInspectionAnalysisPrompt
} from "./ct-purchase-test.js";
import {
  NativePowerGpsSource,
  buildPowerTestAnalysisPrompt,
  buildPowerTestReport,
  cancelPowerTestRun,
  comparePowerTestRuns,
  createPowerTestRun,
  ingestPowerTestSample,
  powerTestToCsv,
  vehiclePowerDefaults
} from "./power-test.js";
import {
  INJECTOR_TEST_AVAILABILITY,
  INJECTOR_TEST_COMMANDS,
  INJECTOR_TEST_LIMITS,
  analyzeInjectorTest,
  buildInjectorTestReport,
  buildInjectorTestAnalysisPrompt
} from "./injector-test.js";
import { createThemeController } from "./themes.js";
import { classifyConnectedVehicle, parseObdVin } from "./vehicle-detection.js";
import { ecuSurveySnapshotFromDiagnosticRun } from "./ecu-survey-diagnostic.js";
import { buildEcuSurveyTextReport } from "./ecu-survey-report.js";
import { recordEcuSurveySnapshot } from "./ecu-survey-history.js";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
$("#appVersionLabel").textContent = `Versio ${APP_VERSION}`;
const DPNR_MONITOR_METRIC_IDS = Object.freeze([
  "dpnrDifferentialPressure",
  "dpnrInletTemperature",
  "dpnrOutletTemperature",
  "dpnrSulfurRegenerationState",
  "dpnrPmRegenerationState",
  "dpnrRegenerationActive"
]);

const savedVehicleSelection = localStorage.getItem("lexusVehicleProfile");
const initialVehicleSelection = [VEHICLE_KEYS.IS220D, VEHICLE_KEYS.CT200H, VEHICLE_KEYS.AUTO].includes(savedVehicleSelection)
  ? savedVehicleSelection
  : VEHICLE_KEYS.AUTO;

const nativeTransport = new NativeElmTransport(globalThis.obd);
const bleTransport = new NativeBleElmTransport(globalThis.bleObd);
const fakeTransport = new FakeElmTransport();
const powerGpsSource = new NativePowerGpsSource(globalThis.powerGps);

const state = {
  client: null,
  transport: null,
  connected: false,
  connecting: false,
  supportedPids: null,
  liveActive: false,
  liveRunId: 0,
  pollScheduler: null,
  lastPollSnapshot: null,
  values: {},
  updatedAt: {},
  rawValues: {},
  valueSources: {},
  histories: Object.fromEntries(PID_DEFINITIONS.map(def => [def.id, []])),
  recording: null,
  recordingTimer: null,
  terminalEntries: [],
  wakeLock: null,
  selectedSession: null,
  bleDiagnosticsReport: "",
  bleDiagnosticsBase: "",
  bleConnectionLog: [],
  quicklynks: false,
  reconnecting: false,
  reconnectToken: 0,
  adapterProfile: null,
  adapterCapabilities: null,
  transportInfo: null,
  ecuConnected: false,
  connectionStages: {
    bluetooth: { status: "idle", message: "Ei yhteyttä" },
    elm: { status: "idle", message: "Ei testattu" },
    ecu: { status: "idle", message: "Ei testattu" }
  },
  elmDiagnosticLines: [],
  elmDiagnosticStartedAt: 0,
  elmDiagnosticDevice: "",
  toyotaProbeStatus: "ei ajettu",
  diagnosticRun: null,
  diagnosticRunning: false,
  diagnosticAbortRequested: false,
  fullDiagnosticReport: "",
  diagnosticKind: "",
  obdPlusTraceRunning: false,
  obdPlusTraceAnalysis: null,
  obdPlusTraceReport: "",
  ctPurchaseInspection: null,
  ctPurchaseAnalysis: null,
  ctPurchaseReport: "",
  ctPurchaseRoadActive: false,
  ctPurchaseSampleTimer: null,
  ctPurchaseLastBlockUpdatedAt: 0,
  ctPurchaseRoadSegmentStartedAt: 0,
  injectorTestRun: null,
  injectorTestAnalysis: null,
  injectorTestReport: "",
  injectorTestRunning: false,
  injectorTestRestoring: false,
  injectorTestAbortRequested: false,
  powerTestRun: null,
  powerTestReport: "",
  powerTestRuns: [],
  powerLastGpsSample: null,
  powerLiveStartedByTest: false,
  powerGpsSourceInfo: null,
  vehicleSelection: initialVehicleSelection,
  vehicleKey: initialVehicleSelection,
  vehicleDetection: {
    status: initialVehicleSelection === VEHICLE_KEYS.AUTO ? "idle" : "manual",
    message: initialVehicleSelection === VEHICLE_KEYS.AUTO ? "Auto tunnistetaan jokaisella yhteyskerralla" : "Käyttäjän varavalinta; auto tunnistetaan silti yhdistettäessä",
    modelCode: "",
    engineCode: "",
    vin: "",
    confidence: "unknown",
    evidence: []
  }
};

let themeController;

function redrawThemeSensitiveContent() {
  if ($("#liveChart")) updateLiveChart();
  if ($("#powerChart")) renderPowerChart();
  if ($("#savedChart") && state.selectedSession) drawSavedChart();
}

function renderThemeSelection(snapshot = themeController?.getSnapshot()) {
  if (!snapshot) return;
  const select = $("#themeSelect");
  if (select) select.value = snapshot.preference;
  const summary = $("#themeSummaryValue");
  if (summary) summary.textContent = snapshot.label;
  const description = $("#themeDescription");
  if (description) description.textContent = snapshot.description;
  const resolved = $("#themeResolvedState");
  if (resolved) {
    resolved.textContent = snapshot.followsSystem
      ? `Käytössä ${snapshot.resolvedLabel} · Androidin asetuksen mukaan`
      : `Käytössä ${snapshot.resolvedLabel}`;
  }
}

function handleThemeChange(snapshot) {
  renderThemeSelection(snapshot);
  globalThis.requestAnimationFrame?.(redrawThemeSensitiveContent);
}

function activeVehicleProfile() {
  return getVehicleProfile(state.vehicleKey);
}

function activeVehicleName() {
  return activeVehicleProfile()?.vehicle?.displayName || "Yleinen EOBD / tunnistamaton Lexus";
}

function activeVehicleDescription() {
  const profile = activeVehicleProfile();
  if (!profile) return "Ajoneuvo tunnistamatta";
  if (state.vehicleKey === VEHICLE_KEYS.CT200H) return `${profile.vehicle.engine} · ${profile.vehicle.powertrain}`;
  return `${profile.vehicle.engine} · 2,2 D-CAT`;
}

function activeMetricDefinitions() {
  return PID_DEFINITIONS.filter(definition => metricSupportsVehicle(definition, state.vehicleKey));
}

function isCt200h() {
  return state.vehicleKey === VEHICLE_KEYS.CT200H;
}

function declaredEngineRunning(selectId) {
  const value = $(`#${selectId}`)?.value || "auto";
  if (value === "running") return true;
  if (value === "stopped") return false;
  return null;
}

function resetLiveMeasurements() {
  state.values = {};
  state.updatedAt = {};
  state.rawValues = {};
  state.valueSources = {};
  state.pollScheduler = null;
  state.lastPollSnapshot = null;
  state.histories = Object.fromEntries(PID_DEFINITIONS.map(def => [def.id, []]));
}

function setLiveButtonState(active) {
  for (const selector of ["#toggleLiveButton", "#dpnrToggleLiveButton"]) {
    const button = $(selector);
    if (!button) continue;
    button.textContent = active ? "Lopeta" : "Aloita";
    button.className = `${active ? "secondary" : "primary"} compact`;
  }
}

function setRecordingButtonState(active) {
  const driveButton = $("#recordButton");
  if (driveButton) {
    driveButton.textContent = active ? "Lopeta tallennus" : "Aloita tallennus";
    driveButton.className = `${active ? "danger" : "primary"} jumbo`;
  }
  const dpnrButton = $("#dpnrRecordButton");
  if (dpnrButton) {
    dpnrButton.textContent = active ? "Lopeta DPNR-loki" : "Aloita DPNR-loki";
    dpnrButton.className = `${active ? "danger" : "primary"} jumbo`;
  }
}

function applyVehicleProfileUi() {
  const profile = activeVehicleProfile();
  const vehicleName = activeVehicleName();
  const description = activeVehicleDescription();
  const isCt = isCt200h();
  const selectionLabel = state.vehicleDetection.status === "detected" && profile
    ? `${vehicleName} · tunnistettu automaattisesti`
    : profile && state.vehicleDetection.status === "manual-fallback"
      ? `${vehicleName} · käsin valittu varaprofiili`
      : vehicleName;

  if ($("#vehicleSelect")) $("#vehicleSelect").value = state.vehicleSelection;
  if ($("#vehicleIdentity")) $("#vehicleIdentity").textContent = selectionLabel;
  if ($("#powertrainIdentity")) $("#powertrainIdentity").textContent = description;
  if ($("#vehicleDetection")) {
    $("#vehicleDetection").textContent = state.vehicleDetection.message || "";
    const warningStatuses = new Set(["error", "unknown", "conflict", "manual-fallback", "unsupported"]);
    $("#vehicleDetection").className = `inline-message ${warningStatuses.has(state.vehicleDetection.status) ? "warning" : ""}`.trim();
    $("#vehicleDetection").classList.toggle("hidden", !state.vehicleDetection.message);
  }
  if ($("#appEyebrow")) $("#appEyebrow").textContent = isCt ? "LEXUS ZWA10 · HYBRIDI + EOBD" : state.vehicleKey === VEHICLE_KEYS.IS220D ? "LEXUS XE20 · 2AD-FHV + EOBD" : "LEXUS · EOBD";
  if ($("#liveEyebrow")) $("#liveEyebrow").textContent = isCt ? "MODE 01 + CT HYBRID 21 · VAIN LUKU" : "MODE 01 + TECHSTREAM 21 · VAIN LUKU";
  if ($("#driveBannerLabel")) $("#driveBannerLabel").textContent = isCt ? "HV-AKUN TILA" : "DPNR / DPF -POLTON TILA";
  if ($("#hybridDtcGroup")) $("#hybridDtcGroup").classList.toggle("hidden", !isCt);
  if (!isCt) {
    if ($("#page-ct-test")?.classList.contains("active")) goToPage("connection");
    if (state.ctPurchaseRoadActive && state.ctPurchaseRoadSegmentStartedAt && state.ctPurchaseInspection) {
      state.ctPurchaseInspection.roadSegments.push({ startedAt: state.ctPurchaseRoadSegmentStartedAt, endedAt: Date.now() });
    }
    state.ctPurchaseRoadActive = false;
    state.ctPurchaseRoadSegmentStartedAt = 0;
    clearInterval(state.ctPurchaseSampleTimer);
    state.ctPurchaseSampleTimer = null;
  }
  const isIs220d = state.vehicleKey === VEHICLE_KEYS.IS220D;
  if (!isIs220d && $("#page-injector-test")?.classList.contains("active")) goToPage("connection");
  if (!isIs220d && $("#page-dpnr")?.classList.contains("active")) goToPage("connection");
  if (!isIs220d && $("#page-component-diagnostics")?.classList.contains("active")) goToPage("connection");
  if ($("#clearDtcButton")) {
    $("#clearDtcButton").textContent = isCt ? "CT-hybridikoodien poisto ei käytössä" : "Poista vikakoodit…";
    $("#clearDtcButton").disabled = isCt;
  }
  if ($("#dtcClearHint")) $("#dtcClearHint").textContent = isCt
    ? "Flex 0.8.0 lukee CT:n moottori- ja hybridikoodit, mutta ei lähetä hybridiohjaimelle eikä väärän ECU-otsakkeen kautta mitään poistokomentoa."
    : "Poisto nollaa myös freeze frame -tietoja ja päästövalmiusmonitoreita.";
  if ($("#diagnosticProfileHint")) {
    $("#diagnosticProfileHint").innerHTML = isCt
      ? "Testi tarkistaa CAN-yhteyden ja CT 200h:n hybridiohjaimen osoitteen <code>7E2/7EA</code>. Se lukee mallitunnisteen <code>21C1</code>, varaustilan <code>2101</code>, 14 lohkojännitettä <code>2181</code>, lämpötilat <code>2187</code>, sisäiset vastukset <code>2195</code> ja akun virran <code>2198</code>. Vain luku: ei Active Test-, poisto-, kirjoitus- tai pakkolatauskomentoja."
      : "Testi tarkistaa CAN-yhteyden sekä IS220d:n varmennetut Toyota-lukupyynnöt <code>217E</code>, <code>217F</code> ja <code>212C</code>. Vain luku: ei Active Test-, poisto-, kirjoitus- tai regenerointikomentoja.";
  }
  if ($("#injectorProfileState")) {
    $("#injectorProfileState").textContent = isIs220d
      ? "IS220d / 2AD-FHV -profiili aktiivinen · 45 s suutintesti ei ole käytettävissä: 219C palautti NO DATA -vastauksen kolmessa kenttäajossa kalibroinnilla 35360000."
      : "Valitse ja tunnista Lexus IS220d ennen suutintestiä.";
    $("#injectorProfileState").className = "inline-message warning";
  }
  if ($("#terminalProfileWarning")) {
    $("#terminalProfileWarning").textContent = isCt
      ? "Vain AT-komennot, lukevat OBD-moodit ja CT-profiilin vain lukevat 21C1/2101/2181/2187/2195/2198/13B0-komennot sallitaan. Mode 04 toimii vain Vikakoodit-näkymän vahvistuksesta."
      : "Vain AT-komennot, lukevat OBD-moodit 01, 02, 03, 07, 09 ja 0A sekä IS220d-profiilin 217E/217F/212C/2193/2196/21AF-lukukomennot sallitaan. Kentässä vastaamaton 219C on estetty. Mode 04 toimii vain Vikakoodit-näkymän vahvistuksesta.";
  }
  $$("[data-vehicle-only]").forEach(element => {
    element.classList.toggle("hidden", element.dataset.vehicleOnly !== state.vehicleKey);
  });
  applyPowerVehicleDefaults();
  state.client?.setVehicleKey?.(state.vehicleKey);
}

function emptyVehicleDetection(status, message) {
  return {
    status,
    message,
    modelCode: "",
    engineCode: "",
    vin: "",
    confidence: "unknown",
    evidence: []
  };
}

function selectVehicleProfile(selection, { detected = false, detection = null, message = "" } = {}) {
  const normalized = [VEHICLE_KEYS.IS220D, VEHICLE_KEYS.CT200H, VEHICLE_KEYS.AUTO].includes(selection)
    ? selection
    : VEHICLE_KEYS.AUTO;
  if (!detected) {
    state.vehicleSelection = normalized;
    state.vehicleKey = normalized;
    state.vehicleDetection = emptyVehicleDetection(
      normalized === VEHICLE_KEYS.AUTO ? "idle" : "manual",
      normalized === VEHICLE_KEYS.AUTO
        ? "Auto tunnistetaan turvallisilla vain luku -kyselyillä yhdistettäessä"
        : "Ajoneuvoprofiili on varavalinta; auto tunnistetaan silti yhdistettäessä"
    );
    localStorage.setItem("lexusVehicleProfile", normalized);
  } else {
    state.vehicleKey = normalized;
    state.vehicleDetection = {
      status: detection?.status || (getVehicleProfile(normalized) ? "detected" : "error"),
      message: message || detection?.message || (getVehicleProfile(normalized) ? `${vehicleDisplayName(normalized)} tunnistettu` : "Ajoneuvoa ei voitu tunnistaa"),
      modelCode: detection?.modelCode || "",
      engineCode: detection?.engineCode || "",
      vin: detection?.vin || "",
      confidence: detection?.confidence || "unknown",
      evidence: [...(detection?.evidence || [])]
    };
  }
  resetLiveMeasurements();
  applyVehicleProfileUi();
  renderMetrics();
  updateDriveValues();
}

function applyVehicleDetectionFallback(detection, reason = "") {
  const manualProfile = getVehicleProfile(state.vehicleSelection);
  state.vehicleKey = manualProfile ? state.vehicleSelection : VEHICLE_KEYS.AUTO;
  const fallback = manualProfile
    ? ` Käytetään käsin valittua varaprofiilia ${vehicleDisplayName(state.vehicleSelection)}.`
    : " Yleinen EOBD toimii; katkaise yhteys ja valitse profiili käsin ennen Toyota-livearvoja.";
  state.vehicleDetection = {
    status: manualProfile ? "manual-fallback" : detection?.status || "unknown",
    message: `${reason || detection?.message || "Autoa ei voitu tunnistaa."}${fallback}`.trim(),
    modelCode: detection?.modelCode || "",
    engineCode: detection?.engineCode || "",
    vin: detection?.vin || "",
    confidence: detection?.confidence || "unknown",
    evidence: [...(detection?.evidence || [])]
  };
  state.client?.setVehicleKey?.(state.vehicleKey);
  resetLiveMeasurements();
  applyVehicleProfileUi();
  renderMetrics();
  updateDriveValues();
}

function applyUnavailableVehicleDetection(reason, status = "unknown") {
  applyVehicleDetectionFallback({
    status,
    message: reason,
    modelCode: "",
    engineCode: "",
    vin: "",
    confidence: "unknown",
    evidence: []
  }, reason);
}

async function detectVehicleProfile({ userInitiated = false } = {}) {
  if (state.quicklynks) {
    applyUnavailableVehicleDetection(
      "Quicklynks FFF6 -binääripolulta ei ole varmennettu turvallista VIN- tai Toyota-mallitunnisteen lukua.",
      "unsupported"
    );
    return null;
  }
  if (!(state.client instanceof Elm327Client)) return null;
  if (!state.ecuConnected) {
    applyUnavailableVehicleDetection("Moottori-ECU ei vastannut, joten autoa ei voitu tunnistaa.");
    return null;
  }
  if (state.liveActive || state.recording || state.diagnosticRunning || state.injectorTestRunning || powerRunActive()) {
    if (userInitiated) toast("Pysäytä live-luku, tallennus, testi tai diagnostiikka ennen uutta tunnistusta");
    return null;
  }

  state.vehicleDetection = emptyVehicleDetection("testing", "Tunnistetaan Lexus VIN- ja mallikohtaisilla vain luku -kyselyillä…");
  applyVehicleProfileUi();
  updateConnectionButtons();

  let vin = "";
  let ctIdentity = null;
  const isProbeResults = [];

  try {
    const vinRaw = await state.client.readVehicleIdentification({ timeoutMs: 9000 });
    vin = parseObdVin(vinRaw);
    if (!vin) appendTerminal(`${formatClock(Date.now())}  ! VIN-vastauksesta ei löytynyt kelvollista 17-merkkistä tunnistetta`);
  } catch (error) {
    appendTerminal(`${formatClock(Date.now())}  ! VIN-tunnistus: ${error.message}`);
  }

  const ctProbe = getVehicleReadDataProbes(VEHICLE_KEYS.CT200H).find(probe => probe.command === "21C1");
  try {
    const transaction = await state.client.runReadOnlyEcuTransaction({
      requestHeader: ctProbe.requestHeader,
      setupCommands: ["ATSP6", "ATCAF1", "ATCFC1", "ATAL", "ATH0", "ATS0"],
      requests: [{ command: ctProbe.command, service: ctProbe.service, timeoutMs: 6500 }],
      continueOnReadError: true,
      label: "Lexus CT 200h · ZWA10-tunnistus",
      profileKey: VEHICLE_KEYS.CT200H
    });
    const raw = transaction.responses[0]?.raw || "";
    ctIdentity = decodeToyotaReadDataResponse(raw, ctProbe.identifier, VEHICLE_KEYS.CT200H);
  } catch (error) {
    appendTerminal(`${formatClock(Date.now())}  ! CT-tunnistus: ${error.message}`);
  }

  const isProbes = getVehicleReadDataProbes(VEHICLE_KEYS.IS220D);
  try {
    const transaction = await state.client.runReadOnlyEcuTransaction({
      requestHeader: isProbes[0].requestHeader,
      setupCommands: ["ATSP6", "ATCAF1", "ATCFC1", "ATAL", "ATH0", "ATS0"],
      requests: isProbes.map(probe => ({ command: probe.command, service: probe.service, timeoutMs: 6500 })),
      continueOnReadError: true,
      label: "Lexus IS220d · 2AD-FHV-tunnistus",
      profileKey: VEHICLE_KEYS.IS220D
    });
    for (const probe of isProbes) {
      const response = transaction.responses.find(candidate => candidate.command === probe.command);
      isProbeResults.push(decodeToyotaReadDataResponse(response?.raw || "", probe.identifier, VEHICLE_KEYS.IS220D));
    }
  } catch (error) {
    appendTerminal(`${formatClock(Date.now())}  ! IS220d-tunnistus: ${error.message}`);
  }

  const detection = classifyConnectedVehicle({ vin, ctIdentity, isProbeResults });
  if (detection.vehicleKey) {
    selectVehicleProfile(detection.vehicleKey, { detected: true, detection });
    appendTerminal(`${formatClock(Date.now())}  ✓ ${detection.message}`);
    if (userInitiated) toast(`${vehicleDisplayName(detection.vehicleKey)} tunnistettu uudelleen`);
  } else {
    applyVehicleDetectionFallback(detection);
    appendTerminal(`${formatClock(Date.now())}  ! ${detection.message}`);
    if (userInitiated) toast("Autoa ei voitu tunnistaa varmasti");
  }
  updateConnectionButtons();
  return detection;
}

function logTraffic(entry) {
  const time = new Date(entry.timestamp).toLocaleTimeString("fi-FI", { hour12: false });
  if (entry.binary) {
    const category = entry.research
      ? " PID-TUTK"
      : entry.optionalStandard
        ? ` PID-${String(entry.group || "STD").toUpperCase()}`
      : entry.production
        ? ` PID-${String(entry.group || "").toUpperCase()}`
        : "";
    const line = `${time}${category} ${entry.direction === "tx" ? "TX" : "RX"} HEX ${entry.hex || entry.raw || "(tyhjä)"}`;
    appendTerminal(line);
    appendBleDiagnostic({ message: line });
  } else if (entry.direction === "tx") {
    const line = `${time}  > ${entry.command}`;
    appendTerminal(line);
    appendElmDiagnosticLine(`${time} TX ${entry.command}`);
  } else {
    const cleaned = entry.cleaned || "(tyhjä vastaus)";
    const suffix = entry.error ? ` · VIRHE ${entry.error}` : "";
    appendTerminal(`${time}  < ${cleaned}${suffix}`);
    appendElmDiagnosticLine(`${time} RX ${entry.command} · ${String(entry.raw || "(tyhjä)").replace(/\r/g, "\\r").replace(/\n/g, "\\n")}${suffix}`);
  }
}

function appendElmDiagnosticLine(line) {
  state.elmDiagnosticLines.push(String(line));
  if (state.elmDiagnosticLines.length > 500) state.elmDiagnosticLines.splice(0, state.elmDiagnosticLines.length - 500);
  renderElmDiagnostics();
}

function buildElmDiagnosticsReport() {
  if (state.fullDiagnosticReport) return state.fullDiagnosticReport;
  const stage = id => state.connectionStages[id] || { status: "idle", message: "Ei tietoa" };
  return [
    `Lexus OBD Flex ${APP_VERSION} · vLinker/ELM327-diagnostiikka`,
    `Ajoneuvoprofiili: ${activeVehicleName()}`,
    `Ajoneuvotunnistus: ${state.vehicleDetection.status} · ${state.vehicleDetection.message || "ei tietoa"}`,
    `VIN: ${state.vehicleDetection.vin || "ei luettu"}`,
    `Tunnistusvarmuus: ${state.vehicleDetection.confidence || "unknown"}`,
    `Aika: ${new Date(state.elmDiagnosticStartedAt || Date.now()).toLocaleString("fi-FI")}`,
    `Laite: ${state.elmDiagnosticDevice || "ei valittu"}`,
    `Valittu protokolla: ${$("#protocolSelect")?.selectedOptions[0]?.textContent || "ei tietoa"}`,
    `Bluetooth: ${stage("bluetooth").status} · ${stage("bluetooth").message}`,
    `ELM327: ${stage("elm").status} · ${stage("elm").message}`,
    `Moottori-ECU: ${stage("ecu").status} · ${stage("ecu").message}`,
    `Toyota-profiililuvut: ${state.toyotaProbeStatus}`,
    "",
    "Raakaliikenne:",
    ...(state.elmDiagnosticLines.length ? state.elmDiagnosticLines : ["Ei liikennettä."])
  ].join("\n");
}

function renderElmDiagnostics() {
  const element = $("#elmDiagnostic");
  if (!element) return;
  const selected = selectedAdapterProfile();
  const show = (!selected.quicklynks && ["classic", "ble"].includes(selected.transport)) ||
    (state.connected && !state.quicklynks && state.client instanceof Elm327Client);
  $("#elmDiagnosticCard")?.classList.toggle("hidden", !show);
  if (!show) return;
  element.textContent = buildElmDiagnosticsReport();
  element.classList.toggle("hidden", !state.elmDiagnosticLines.length && !state.fullDiagnosticReport);
}

function renderQuicklynksDiagnostics() {
  const card = $("#quicklynksDiagnosticCard");
  if (!card) return;
  const show = state.connected && state.quicklynks && state.client instanceof QuicklynksClient;
  card.classList.toggle("hidden", !show);
  const button = $("#runQuicklynksDiagnostic");
  if (button) button.disabled = !show || state.diagnosticRunning;
  const report = $("#quicklynksDiagnosticReport");
  if (report) {
    const showReport = show && state.diagnosticKind === "quicklynks" && Boolean(state.fullDiagnosticReport);
    report.textContent = showReport ? state.fullDiagnosticReport : "";
    report.classList.toggle("hidden", !showReport);
  }
}

function setConnectionStage(stage, status, message) {
  state.connectionStages[stage] = { status, message: message || "–" };
  const ids = { bluetooth: "stageBluetooth", elm: "stageElm", ecu: "stageEcu" };
  const element = $(`#${ids[stage]}`);
  if (element) {
    element.className = `connection-stage ${status}`;
    element.querySelector("strong").textContent = message || "–";
  }
  renderElmDiagnostics();
}

function resetConnectionStages(transport = selectedDeviceTransport()) {
  setConnectionStage("bluetooth", "idle", "Ei yhteyttä");
  setConnectionStage("elm", transport === "ble" ? "idle" : "idle", "Ei testattu");
  setConnectionStage("ecu", "idle", "Ei testattu");
}

function handleElmState(event) {
  if (!event?.stage) return;
  setConnectionStage(event.stage, event.status || "testing", event.message || "–");
  const raw = event.raw ? ` · RAW ${String(event.raw).replace(/\r/g, "\\r").replace(/\n/g, "\\n")}` : "";
  appendElmDiagnosticLine(`${formatClock(Date.now())} TILA ${event.stage.toUpperCase()} ${event.status || ""} · ${event.message || "–"}${raw}`);
}

function appendTerminal(text) {
  state.terminalEntries.push(text);
  if (state.terminalEntries.length > 600) state.terminalEntries.splice(0, state.terminalEntries.length - 600);
  const terminal = $("#terminalLog");
  terminal.textContent = state.terminalEntries.join("\n");
  terminal.scrollTop = terminal.scrollHeight;
}

function setConnectionStatus(type, text) {
  const badge = $("#connectionBadge");
  badge.className = `status-badge ${type}`;
  badge.querySelector("span:last-child").textContent = text;
}

function showConnectionError(message = "") {
  const element = $("#connectionError");
  element.textContent = message;
  element.classList.toggle("hidden", !message);
}

function updateConnectionButtons() {
  const injectorBusy = state.injectorTestRunning || state.injectorTestRestoring;
  $("#connectButton").disabled = state.connected || state.connecting || state.reconnecting || injectorBusy;
  $("#disconnectButton").disabled = injectorBusy || (!state.connected && !state.connecting && !state.reconnecting);
  $("#deviceSelect").disabled = state.connected || state.connecting || state.reconnecting || injectorBusy;
  $("#protocolSelect").disabled = state.connected || state.connecting || state.reconnecting || injectorBusy;
  $("#vehicleSelect").disabled = state.connected || state.connecting || state.reconnecting || injectorBusy;
  $("#detectVehicleButton").disabled = !state.connected || state.connecting || state.reconnecting || state.quicklynks ||
    !(state.client instanceof Elm327Client) || state.vehicleDetection.status === "testing" || injectorBusy;
  if ($("#startInjectorTest")) {
    $("#startInjectorTest").disabled = injectorBusy || !INJECTOR_TEST_AVAILABILITY.supported || !state.connected || state.quicklynks ||
      !(state.client instanceof Elm327Client) || state.vehicleKey !== VEHICLE_KEYS.IS220D;
    if (!injectorBusy) {
      $("#startInjectorTest").textContent = INJECTOR_TEST_AVAILABILITY.supported
        ? "Aloita uusi 45 s testi"
        : "Ei tuettu tällä ECU-kalibroinnilla";
    }
  }
}

function yesNo(value) {
  if (value === true) return "kyllä";
  if (value === false) return "ei";
  return "ei tietoa";
}

function buildBleDiagnosticsReport(devices, diagnostics, scanAttempted, scanError = "") {
  const bleDevices = devices.filter(device => device.transport === "ble" && !device.knownFallback);
  const directFallbacks = devices.filter(device => device.transport === "ble" && device.knownFallback);
  const lines = [
    `Lexus OBD Flex ${APP_VERSION} · BLE-diagnostiikka`,
    `Ajoneuvoprofiili: ${activeVehicleName()}`,
    `Aika: ${new Date().toLocaleString("fi-FI")}`,
    `Android API: ${diagnostics.sdk ?? "ei tietoa"}`,
    `Bluetooth käytettävissä: ${yesNo(diagnostics.bluetoothAvailable)}`,
    `Bluetooth päällä: ${yesNo(diagnostics.bluetoothEnabled)}`
  ];
  if ("scanPermission" in diagnostics) lines.push(`BLUETOOTH_SCAN-oikeus: ${yesNo(diagnostics.scanPermission)}`);
  if ("connectPermission" in diagnostics) lines.push(`BLUETOOTH_CONNECT-oikeus: ${yesNo(diagnostics.connectPermission)}`);
  if ("locationPermission" in diagnostics) lines.push(`Sijaintioikeus: ${yesNo(diagnostics.locationPermission)}`);
  if (diagnostics.scanApi) lines.push(`Skannaustapa: ${diagnostics.scanApi}`);
  if (diagnostics.scanModeUsed) lines.push(`Viimeinen hakuvaihe: ${diagnostics.scanModeUsed}`);
  if (Number.isFinite(diagnostics.scanDurationMs)) lines.push(`Skannauksen kesto: ${diagnostics.scanDurationMs} ms`);
  if (Number.isFinite(diagnostics.scanCallbackCount)) lines.push(`Androidin scan-callbackit: ${diagnostics.scanCallbackCount}`);
  if (Number.isFinite(diagnostics.scanDefaultCallbacks) && diagnostics.scanDefaultCallbacks >= 0) {
    lines.push(`Vaihe 1, suodattamaton oletushaku: ${diagnostics.scanDefaultCallbacks} callbackia`);
  }
  if (Number.isFinite(diagnostics.scanLowLatencyCallbacks) && diagnostics.scanLowLatencyCallbacks >= 0) {
    lines.push(`Vaihe 2, LOW_LATENCY: ${diagnostics.scanLowLatencyCallbacks} callbackia`);
  }
  if (Number.isFinite(diagnostics.scanObdFilterCallbacks) && diagnostics.scanObdFilterCallbacks >= 0) {
    lines.push(`Vaihe 3, OBD-nimisuodatin: ${diagnostics.scanObdFilterCallbacks} callbackia`);
  }
  if (diagnostics.gattState) lines.push(`GATT-tila: ${diagnostics.gattState}`);
  if (diagnostics.transportProfile) lines.push(`Kuljetusprofiili: ${diagnostics.transportProfile}`);
  if (diagnostics.gattUuids) lines.push(`Löydetyt GATT UUID:t: ${diagnostics.gattUuids}`);
  if (diagnostics.writeUuid) lines.push(`TX-ominaisuus: ${diagnostics.writeUuid}`);
  if (diagnostics.notifyUuid) lines.push(`RX/Notify-ominaisuus: ${diagnostics.notifyUuid}`);
  if ("notificationEnabled" in diagnostics) lines.push(`Notification käytössä: ${yesNo(diagnostics.notificationEnabled)}`);
  if (diagnostics.cccdValue) lines.push(`CCCD-arvo: ${diagnostics.cccdValue}`);
  if (Number.isFinite(diagnostics.payloadSize)) lines.push(`Neuvoteltu BLE-hyötykuorma: ${diagnostics.payloadSize} tavua`);
  if (Number.isFinite(diagnostics.writeType)) lines.push(`GATT-kirjoitustapa: ${diagnostics.writeType === 1 ? "Write Without Response" : diagnostics.writeType === 2 ? "Write" : diagnostics.writeType}`);
  lines.push(`BLE-haku: ${scanAttempted ? `${bleDevices.length} laitetta` : "ei vielä ajettu"}`);
  if (scanError) lines.push(`Hakuvirhe: ${scanError}`);
  else if (diagnostics.lastScanError) lines.push(`Viimeisin natiivivirhe: ${diagnostics.lastScanError}`);
  for (const [index, device] of bleDevices.entries()) {
    const signal = Number.isFinite(device.rssi) ? `${device.rssi} dBm` : "RSSI ei tiedossa";
    const services = device.services ? ` · palvelut ${device.services}` : "";
    lines.push(`${index + 1}. ${device.name || "Nimetön BLE-laite"} · ${device.address} · ${signal}${services}`);
  }
  for (const device of directFallbacks) {
    lines.push(`Suora GATT-varmistus: ${device.name} · ${device.address}`);
  }
  if (scanAttempted && !bleDevices.length && !scanError && diagnostics.scanCallbackCount === 0) {
    lines.push("Android ei palauttanut yhtään BLE-mainosta millään kolmesta hakutavasta. Motonet-lukijaa voi silti kokeilla suoraan sen varmennetulla BLE-osoitteella.");
  } else if (scanAttempted && !bleDevices.length && !scanError) {
    lines.push("Android palautti BLE-mainoksia, mutta niitä ei voitu lisätä laitelistaan. Kopioi tämä diagnostiikka korjausta varten.");
  }
  return lines.join("\n");
}

function renderBleDiagnostics() {
  const connection = state.bleConnectionLog.length
    ? `\n\nGATT-, liikenne- ja kehysloki:\n${state.bleConnectionLog.join("\n")}`
    : "";
  state.bleDiagnosticsReport = `${state.bleDiagnosticsBase || "BLE-hakua ei ole vielä ajettu."}${connection}`;
  const diagnosticElement = $("#bleDiagnostic");
  diagnosticElement.textContent = state.bleDiagnosticsReport;
  const show = selectedDeviceTransport() === "ble" || state.transport === bleTransport;
  diagnosticElement.classList.toggle("hidden", !show || (!state.bleDiagnosticsBase && !state.bleConnectionLog.length));
  $("#copyBleDiagnostics")?.classList.toggle("hidden", !show);
}

function appendBleDiagnostic(event) {
  const time = formatClock(Date.now());
  const message = typeof event === "string" ? event : event?.message || "BLE-tapahtuma";
  const raw = typeof event === "object" && event?.raw ? ` · HEX ${event.raw}` : "";
  state.bleConnectionLog.push(`${time} ${message}${raw}`);
  if (state.bleConnectionLog.length > 240) state.bleConnectionLog.splice(0, state.bleConnectionLog.length - 240);
  if (typeof event === "object" && ["invalid", "timeout", "unknown"].includes(event?.type)) {
    appendTerminal(`${time}  ! ${message}${raw}`);
  }
  renderBleDiagnostics();
}

async function refreshDevices(scanBle = true) {
  const select = $("#deviceSelect");
  const currentOption = select.selectedOptions[0];
  const previous = currentOption?.dataset.address || localStorage.getItem("lastObdDevice") || "";
  const previousTransport = currentOption?.dataset.transport || localStorage.getItem("lastObdTransport") || "";
  const refreshButton = $("#refreshDevices");
  refreshButton.disabled = true;
  refreshButton.textContent = "Haetaan…";
  showConnectionError();
  select.innerHTML = "";
  let devices = [];
  let scanError = "";
  let diagnostics = {};
  if (nativeTransport.available()) {
    try { devices.push(...await nativeTransport.pairedDevices()); }
    catch (error) { showConnectionError(`Classic-laitteita ei voitu lukea: ${error.message}`); }
  }
  if (bleTransport.available() && scanBle) {
    try { devices.push(...await bleTransport.scanDevices(15000)); }
    catch (error) {
      scanError = error.message;
      showConnectionError(`BLE-haku epäonnistui: ${error.message}`);
    }
  }
  if (bleTransport.available()) {
    try { diagnostics = await bleTransport.diagnostics(); }
    catch (error) { diagnostics = { diagnosticError: error.message }; }
  }
  const motonetAddress = "25:28:07:06:00:66";
  const hasMotonet = devices.some(device =>
    device.transport === "ble" &&
    String(device.address || "").toUpperCase() === motonetAddress
  );
  if (scanBle && bleTransport.available() && !hasMotonet) {
    devices.push({
      name: "Motonet OBD (suora GATT-varmistus)",
      address: motonetAddress,
      transport: "ble",
      knownFallback: true
    });
  }
  state.bleDiagnosticsBase = buildBleDiagnosticsReport(devices, diagnostics, scanBle, scanError || diagnostics.diagnosticError || "");
  renderBleDiagnostics();
  if (scanBle) appendTerminal(`${formatClock(Date.now())}  BLE-haku valmis\n${state.bleDiagnosticsBase}`);
  const unique = new Map();
  for (const device of devices) {
    const key = `${device.transport || "classic"}:${device.address}`;
    if (!unique.has(key)) unique.set(key, device);
  }
  devices = sortAdapterDevices([...unique.values()]);
  devices = [...devices.filter(device => device.address !== "FAKE:IS220D"), classifyAdapterDevice({ name: "Simulaattori (ei autoa)", address: "FAKE:IS220D", simulated: true })];
  if (!devices.length) devices.push({ name: "Simulaattori (ei autoa)", address: "FAKE:IS220D", simulated: true });
  for (const device of devices) {
    const option = document.createElement("option");
    const profile = classifyAdapterDevice(device);
    const transport = profile.transport;
    option.value = `${transport}:${device.address}`;
    const type = device.simulated ? "" : profile.channelLabel;
    const signal = device.transport === "ble" && Number.isFinite(device.rssi) ? ` · ${device.rssi} dBm` : "";
    option.textContent = `${profile.adapterLabel}${device.simulated ? "" : ` · ${type}${signal} · ${device.address}`}`;
    option.dataset.simulated = String(Boolean(device.simulated));
    option.dataset.transport = transport;
    option.dataset.address = device.address;
    option.dataset.name = profile.name;
    option.dataset.adapterFamily = profile.adapterFamily;
    option.dataset.profileVersion = profile.profileVersion;
    option.dataset.vlinker = String(profile.vlinker);
    option.dataset.quicklynks = String(profile.quicklynks);
    option.dataset.knownFallback = String(Boolean(device.knownFallback));
    select.append(option);
  }
  const match = devices.find(device => device.address === previous && (!previousTransport || (device.transport || "simulated") === previousTransport));
  const selectedDevice = match || devices[0];
  const selectedTransport = selectedDevice.transport || (selectedDevice.simulated ? "simulated" : "classic");
  select.value = `${selectedTransport}:${selectedDevice.address}`;
  updateDeviceHelp();
  refreshButton.disabled = false;
  refreshButton.textContent = "Päivitä";
}

function selectedDeviceTransport() {
  return $("#deviceSelect").selectedOptions[0]?.dataset.transport || "classic";
}

function selectedAdapterProfile() {
  const option = $("#deviceSelect")?.selectedOptions?.[0];
  return classifyAdapterDevice({
    name: option?.dataset?.name || option?.textContent || "",
    address: option?.dataset?.address || "",
    transport: option?.dataset?.transport || "classic",
    simulated: option?.dataset?.simulated === "true",
    knownFallback: option?.dataset?.knownFallback === "true"
  });
}

function renderAdapterSupport() {
  const profile = state.adapterProfile || selectedAdapterProfile();
  const support = $("#adapterSupportIdentity");
  const firmware = $("#adapterFirmwareIdentity");
  if (support) {
    support.textContent = profile.vlinker
      ? `${profile.adapterLabel} · ${profile.channelLabel}`
      : profile.quicklynks
        ? "Quicklynks FFF0/FFF6 · binääri"
        : `${profile.adapterLabel} · ${profile.channelLabel}`;
  }
  if (firmware) {
    firmware.textContent = state.adapterCapabilities
      ? formatAdapterCapabilitySummary(state.adapterCapabilities)
      : state.connected
        ? `${state.client?.adapterIdentity || "ELM327"} · capability-testi ajamatta`
        : "Tunnistetaan yhdistettäessä";
  }
}

function updateDeviceHelp() {
  const profile = selectedAdapterProfile();
  if (profile.transport === "ble") {
    const directFallback = $("#deviceSelect").selectedOptions[0]?.dataset.knownFallback === "true";
    $("#deviceHelp").textContent = directFallback
      ? "Androidin haku ei palauttanut Motonet-lukijaa, joten Flex yrittää yhteyttä suoraan varmennettuun BLE-osoitteeseen. Lukijaa ei pariteta Androidin asetuksissa."
      : selectedAdapterHelp(profile);
  } else {
    $("#deviceHelp").textContent = selectedAdapterHelp(profile);
  }
  if (!state.connected) state.adapterProfile = profile;
  renderAdapterSupport();
  renderBleDiagnostics();
  renderElmDiagnostics();
  renderQuicklynksDiagnostics();
}

async function connect() {
  if (state.connected || state.connecting) return;
  const selectedOption = $("#deviceSelect").selectedOptions[0];
  const address = selectedOption?.dataset.address || "";
  const simulated = selectedOption?.dataset.simulated === "true";
  const transportType = selectedDeviceTransport();
  const protocol = $("#protocolSelect").value;
  const selectedProfile = selectedAdapterProfile();
  localStorage.setItem("lastObdDevice", address);
  localStorage.setItem("lastObdTransport", transportType);
  localStorage.setItem("obdProtocol", protocol);
  showConnectionError();
  state.connecting = true;
  state.quicklynks = false;
  state.adapterProfile = selectedProfile;
  state.adapterCapabilities = null;
  state.transportInfo = null;
  state.ecuConnected = false;
  state.bleConnectionLog = [];
  state.elmDiagnosticLines = [];
  state.elmDiagnosticStartedAt = Date.now();
  state.elmDiagnosticDevice = selectedOption?.textContent || address;
  state.toyotaProbeStatus = "ei ajettu";
  state.diagnosticRun = null;
  state.fullDiagnosticReport = "";
  state.diagnosticKind = "";
  state.diagnosticAbortRequested = false;
  resetConnectionStages(transportType);
  setConnectionStage("bluetooth", "testing", "Yhdistetään…");
  setNotice("gekoTestResult", "");
  renderBleDiagnostics();
  state.transport = simulated ? fakeTransport : transportType === "ble" ? bleTransport : nativeTransport;
  setConnectionStatus("connecting", "Yhdistetään…");
  updateConnectionButtons();
  try {
    let info;
    if (transportType === "ble" && !simulated) {
      appendBleDiagnostic(`GATT-yhteys käynnistetään: ${selectedOption?.textContent || address}`);
      const transportInfo = await state.transport.connect(address);
      state.transportInfo = transportInfo;
      setConnectionStage("bluetooth", "connected", "Bluetooth LE / GATT yhdistetty");
      if (transportInfo.binaryProtocol) {
        state.client = new QuicklynksClient(state.transport, logTraffic, appendBleDiagnostic);
        info = state.client.adoptConnection(transportInfo);
        state.quicklynks = true;
        setConnectionStage("elm", "not-applicable", "Quicklynks-binääriprotokolla");
        setConnectionStage("ecu", "connected", "Quicklynks-mittarikanava käytettävissä");
      } else {
        state.client = new Elm327Client(state.transport, logTraffic, handleElmState, { vehicleKey: state.vehicleKey });
        info = await state.client.initializeConnected(transportInfo, protocol);
      }
      appendBleDiagnostic(`GATT valmis · profiili ${info.transportProfile || "tuntematon"}`);
      if (info.gattUuids) appendBleDiagnostic(`Löydetyt UUID:t ${info.gattUuids}`);
      if (info.writeUuid || info.notifyUuid) appendBleDiagnostic(`TX ${info.writeUuid || "–"} · RX ${info.notifyUuid || "–"}`);
      if (info.notificationEnabled) appendBleDiagnostic(`Notification/CCCD käytössä · arvo ${info.cccdValue || "0100"}`);
      if (Number.isFinite(info.payloadSize)) appendBleDiagnostic(`BLE-hyötykuorma ${info.payloadSize} tavua · kirjoitustapa ${info.writeType === 1 ? "ilman vastausta" : "vastauksella"}`);
    } else {
      state.client = new Elm327Client(state.transport, logTraffic, handleElmState, { vehicleKey: state.vehicleKey });
      info = await state.client.connect(address, protocol);
    }
    state.transportInfo = info;
    state.adapterProfile = classifyAdapterDevice({
      name: selectedProfile.name || info.name || info.adapter,
      address,
      transport: transportType,
      simulated
    });
    state.connected = true;
    state.client?.setVehicleKey?.(state.vehicleKey);
    state.ecuConnected = state.quicklynks || Boolean(info.ecuConnected);
    await detectVehicleProfile();
    state.supportedPids = info.supportedPids instanceof Set && info.supportedPids.size ? new Set(info.supportedPids) : null;
    resetLiveMeasurements();
    $("#adapterIdentity").textContent = info.adapter || "ELM327";
    $("#protocolIdentity").textContent = info.protocol || "Tuntematon";
    $("#transportIdentity").textContent = simulated ? "Simulaattori" : transportType === "ble" ? `Bluetooth LE${info.transportProfile ? ` · ${info.transportProfile}` : ""}` : "Bluetooth Classic / SPP";
    renderAdapterSupport();
    $("#quicklynksRawRow").classList.toggle("hidden", !state.quicklynks);
    $("#quicklynksRaw").textContent = "Odottaa ensimmäistä kehystä";
    if (state.ecuConnected) {
      setConnectionStatus("online", simulated ? "Simulaattori" : state.quicklynks ? "Quicklynks yhdistetty" : "ECU yhdistetty");
      toast(simulated ? "Simulaattori yhdistetty" : state.quicklynks ? "Quicklynks FFF6 yhdistetty" : `ELM327 ja ${activeVehicleName()} yhdistetty`);
    } else {
      setConnectionStatus("connecting", "ELM yhdistetty · ECU ei vastaa");
      showConnectionError(`Bluetooth ja ELM327 toimivat, mutta moottori-ECU ei vastannut: ${info.ecuError || "0100-vastaus puuttui"}. Kopioi ELM/ECU-loki tai aja GEKO-testi.`);
      toast("ELM327 vastaa, mutta moottori-ECU ei vielä vastaa");
    }
    $("#runGekoTest").disabled = simulated || state.quicklynks;
    $("#runQuicklynksDiagnostic").disabled = simulated || !state.quicklynks;
    renderElmDiagnostics();
    renderQuicklynksDiagnostics();
  } catch (error) {
    if (transportType === "ble") appendBleDiagnostic({ type: "invalid", message: `Yhteys epäonnistui: ${error.message}` });
    state.connected = false;
    state.ecuConnected = false;
    state.client = null;
    state.transport = null;
    $("#adapterIdentity").textContent = "–";
    $("#protocolIdentity").textContent = "–";
    $("#transportIdentity").textContent = "–";
    state.adapterCapabilities = null;
    renderAdapterSupport();
    $("#quicklynksRawRow").classList.add("hidden");
    setConnectionStatus("error", "Yhteysvirhe");
    if (state.connectionStages.bluetooth.status === "testing") setConnectionStage("bluetooth", "error", error.message);
    showConnectionError(connectionAdvice(error));
  } finally {
    state.connecting = false;
    updateConnectionButtons();
    renderQuicklynksDiagnostics();
  }
}

async function disconnect(options = {}) {
  const preserveReconnect = options?.preserveReconnect === true;
  if (!preserveReconnect) {
    state.reconnecting = false;
    state.reconnectToken += 1;
  }
  state.diagnosticAbortRequested = true;
  state.injectorTestAbortRequested = true;
  state.connecting = false;
  if (state.ctPurchaseRoadActive) await stopCtPurchaseRoadTest({ stopLiveRead: false });
  await stopLive();
  if (state.recording) await stopRecording("Yhteys katkaistiin");
  try { await state.client?.disconnect(); } catch {}
  if (state.quicklynks || state.transport === bleTransport) appendBleDiagnostic("GATT-yhteys suljettu");
  state.connected = false;
  state.ecuConnected = false;
  state.client = null;
  state.transport = null;
  state.supportedPids = null;
  state.quicklynks = false;
  state.adapterCapabilities = null;
  state.transportInfo = null;
  state.vehicleKey = state.vehicleSelection;
  state.vehicleDetection = emptyVehicleDetection(
    state.vehicleSelection === VEHICLE_KEYS.AUTO ? "idle" : "manual",
    state.vehicleSelection === VEHICLE_KEYS.AUTO
      ? "Auto tunnistetaan uudelleen seuraavalla yhteydellä"
      : "Käsin valittu varaprofiili; auto tunnistetaan uudelleen seuraavalla yhteydellä"
  );
  applyVehicleProfileUi();
  resetLiveMeasurements();
  $("#adapterIdentity").textContent = "–";
  $("#protocolIdentity").textContent = "–";
  $("#transportIdentity").textContent = "–";
  renderAdapterSupport();
  $("#quicklynksRawRow").classList.add("hidden");
  $("#runGekoTest").disabled = true;
  $("#runQuicklynksDiagnostic").disabled = true;
  $("#cancelGekoTest").disabled = true;
  $("#cancelQuicklynksDiagnostic").disabled = true;
  setNotice("gekoTestResult", "");
  resetConnectionStages();
  setConnectionStatus("offline", "Ei yhteyttä");
  updateConnectionButtons();
  renderMetrics();
  renderQuicklynksDiagnostics();
}

function scheduleManagedReconnect(reason) {
  if (state.reconnecting || state.diagnosticRunning || state.injectorTestRunning || state.transport === fakeTransport || !state.transport) return;
  const transportType = selectedDeviceTransport();
  const token = ++state.reconnectToken;
  state.reconnecting = true;
  const announce = message => {
    appendTerminal(`${formatClock(Date.now())}  ! ${message}`);
    if (transportType === "ble") appendBleDiagnostic(message);
  };
  announce(`Yhteyskatko havaittu: ${reason}. Hallittu uudelleenyhdistäminen käynnistyy; kesken jäänyttä kyselyä tai live-ajoa ei lähetetä uudelleen.`);
  updateConnectionButtons();
  setTimeout(async () => {
    try {
      await disconnect({ preserveReconnect: true });
      for (let index = 0; index < MANAGED_RECONNECT_DELAYS_MS.length; index++) {
        if (token !== state.reconnectToken) return;
        const waitMs = MANAGED_RECONNECT_DELAYS_MS[index];
        announce(`Uudelleenyhdistämisyritys ${index + 1}/${MANAGED_RECONNECT_DELAYS_MS.length} alkaa ${waitMs} ms kuluttua.`);
        await delay(waitMs);
        if (token !== state.reconnectToken) return;
        await connect();
        if (state.connected) {
          announce("Hallittu uudelleenyhdistäminen onnistui. Live-luku pysyy pysäytettynä, kunnes käyttäjä käynnistää sen.");
          return;
        }
      }
      announce("Uudelleenyhdistäminen ei onnistunut kolmella yrityksellä. Tarkista adapteri ja yhdistä käsin.");
    } catch (error) {
      announce(`Uudelleenyhdistäminen epäonnistui: ${error.message}`);
    } finally {
      if (token === state.reconnectToken) state.reconnecting = false;
      updateConnectionButtons();
    }
  }, 0);
}

function connectionAdvice(error) {
  const message = error?.message || String(error);
  if (/permission|BLUETOOTH_CONNECT|turvallisuus|Security/i.test(message)) return "Bluetooth-oikeus puuttuu. Salli Lähellä olevat laitteet Androidin sovellusasetuksista ja yritä uudelleen.";
  if (/BLE.*(scan|haku)|location|sijainti/i.test(message)) return `${message}. Salli Lähellä olevat laitteet ja vanhemmassa Androidissa myös sijaintioikeus.`;
  if (/GATT|characteristic|ominaisuutta|sarjapalvelua/i.test(message)) return `${message}. Irrota lukija 10 sekunniksi, kytke se uudelleen ja sulje OBD Plus sekä muut OBD-sovellukset.`;
  if (/socket|connect|yhteys|closed/i.test(message)) return `${message}. Tarkista, että adapterissa palaa valo, auton virrat ovat päällä eikä toinen OBD-sovellus käytä adapteria.`;
  return message;
}

function requireConnection(requireEcu = true) {
  if (state.connected && state.client && (!requireEcu || state.ecuConnected)) return true;
  if (state.connected && state.client && requireEcu && !state.ecuConnected) {
    toast("ELM327 vastaa, mutta moottori-ECU ei ole vielä yhdistetty");
    goToPage("connection");
    return false;
  }
  toast("Yhdistä ensin adapteriin tai simulaattoriin");
  goToPage("connection");
  return false;
}

async function readDtc() {
  if (state.injectorTestRunning) return toast("Viimeistele suutintesti ennen vikakoodien lukua");
  if (!requireConnection()) return;
  if (state.client?.binaryQuicklynks) {
    setNotice("dtcNotice", "Quicklynksin binääriprotokollasta on varmennettu mittarikehys, mutta ei vikakoodikomentoa. Vikakoodikyselyä ei lähetetty.", "warning");
    return;
  }
  const button = $("#scanDtcButton");
  button.disabled = true;
  button.textContent = "Luetaan…";
  setNotice("dtcNotice", "Luetaan moottorin ECU:n yleiset EOBD-tiedot…");
  try {
    const milRaw = await safeCommand("0101");
    const storedRaw = await safeCommand("03");
    const pendingRaw = await safeCommand("07");
    const permanentRaw = await safeCommand("0A");
    const mil = milRaw ? parseMilStatus(milRaw) : null;
    $("#milState").textContent = mil ? (mil.milOn ? "Päällä" : "Sammuksissa") : "Ei saatavilla";
    $("#milCount").textContent = mil ? String(mil.count) : "–";
    $("#milCard").className = `card mil-card ${mil?.milOn ? "bad" : mil ? "good" : "neutral"}`;
    renderDtcList("storedDtc", storedRaw ? parseDtcResponse(storedRaw, 0x43) : []);
    renderDtcList("pendingDtc", pendingRaw ? parseDtcResponse(pendingRaw, 0x47) : []);
    renderDtcList("permanentDtc", permanentRaw ? parseDtcResponse(permanentRaw, 0x4a) : []);
    let hybridNote = "";
    if (isCt200h()) {
      try {
        const hybrid = await state.client.readVehicleSpecificDtcs();
        const hybridCodes = hybrid.groups.flatMap(group => group.codes.map(code => ({ ...code, source: group.label })));
        renderDtcList("hybridDtc", hybridCodes);
        hybridNote = hybrid.notes.length
          ? ` Hybridiohjain luettiin osittain: ${hybrid.notes.join(" · ")}`
          : ` Hybridiohjain 7E2/7EA luettu (${hybridCodes.length} koodia).`;
      } catch (error) {
        renderDtcList("hybridDtc", []);
        hybridNote = ` Hybridiohjaimen luku epäonnistui: ${error.message}`;
      }
    }
    setNotice("dtcNotice", `Luettu. Selitteet ovat yleisiä kuvauksia; tarkista Lexus-korjausohje ja CT:n INF-lisäkoodi ennen korjauspäätöstä.${hybridNote}`, hybridNote.includes("epäonnistui") ? "warning" : "");
  } catch (error) {
    setNotice("dtcNotice", error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Lue koodit";
  }
}

async function safeCommand(command) {
  try { return await state.client.command(command, 3500); }
  catch (error) {
    if (/ei palauttanut tietoa|NO DATA/i.test(error.message)) return null;
    throw error;
  }
}

function renderDtcList(id, codes) {
  const root = $(`#${id}`);
  root.innerHTML = "";
  root.className = codes.length ? "dtc-list" : "dtc-list empty-state";
  if (!codes.length) { root.textContent = "Ei koodeja"; return; }
  for (const item of codes) {
    const card = document.createElement("div");
    card.className = "dtc-item";
    card.innerHTML = `<div class="dtc-code">${escapeHtml(item.code)}</div><div><strong>${escapeHtml(item.description)}</strong><p>${item.source ? `${escapeHtml(item.source)} · ` : ""}Tarkista oireet ja mittausdata ennen osien vaihtamista.</p></div>`;
    root.append(card);
  }
}

function ctCandidateFromForm() {
  return {
    modelYear: $("#ctModelYear")?.value?.trim() || "",
    odometerKm: $("#ctOdometer")?.value?.replace(/\D/g, "") || "",
    vinOrRegistration: $("#ctVinRegistration")?.value?.trim().toUpperCase() || "",
    note: $("#ctCandidateNote")?.value?.trim() || ""
  };
}

function ctManualFromForm() {
  return {
    coldStart: $("#ctColdStart")?.value || "not_checked",
    warningLamps: $("#ctWarningLamps")?.value || "not_checked",
    brakePump: $("#ctBrakePump")?.value || "not_checked",
    serviceHistory: $("#ctServiceHistory")?.value || "not_checked"
  };
}

function rawHasPositiveService(raw, responseService) {
  const prefix = Number(responseService).toString(16).padStart(2, "0").toUpperCase();
  return hexLines(cleanElmResponse(raw)).some(line => line.includes(prefix));
}

async function readCtInspectionCommand(command, timeoutMs = 5000) {
  try {
    return { command, raw: await state.client.command(command, timeoutMs), error: "" };
  } catch (error) {
    return { command, raw: error.raw || error.partialRaw || "", error: error.message || String(error) };
  }
}

function ctSnapshotValuesFromResponses(probes, responses) {
  const values = {};
  const decoded = {};
  for (const [index, probe] of probes.entries()) {
    const response = responses[index];
    const packet = response && !response.error
      ? decodeToyotaReadDataResponse(response.raw, probe.identifier, VEHICLE_KEYS.CT200H)
      : null;
    decoded[probe.command] = packet;
    if (!packet?.complete) continue;
    for (const definition of PID_DEFINITIONS) {
      if (definition.vehicleKey !== VEHICLE_KEYS.CT200H || definition.toyotaCommand !== probe.command || !definition.toyotaValueKey) continue;
      const value = packet.values?.[definition.toyotaValueKey];
      if (Number.isFinite(Number(value))) values[definition.id] = Number(value);
    }
  }
  return { values, decoded };
}

async function runCtPurchasePreflight() {
  if (!isCt200h()) return toast("Valitse ajoneuvoksi Lexus CT 200h");
  if (!requireConnection()) return;
  if (state.quicklynks || state.client?.binaryQuicklynks) return toast("CT-ostotarkastus vaatii vLinker MC+:n tai muun ASCII-ELM327:n");
  if (state.diagnosticRunning) return toast("Odota laajan diagnostiikan päättymistä");
  if (state.ctPurchaseRoadActive) await stopCtPurchaseRoadTest();
  if (state.liveActive) await stopLive();

  const button = $("#ctRunPreflight");
  button.disabled = true;
  button.textContent = "Luetaan…";
  $("#ctToggleRoadTest").disabled = true;
  $("#ctFinalizeTest").disabled = true;
  setNotice("ctPreflightResult", "Aloitetaan vain lukevat EOBD-, hybridi- ja kattavuuskyselyt…");
  try {
    const inspection = createCtPurchaseInspection({
      appVersion: APP_VERSION,
      candidate: ctCandidateFromForm(),
      manual: ctManualFromForm(),
      adapter: {
        identity: state.client.adapterIdentity || $("#adapterIdentity")?.textContent || "",
        protocol: state.client.protocolIdentity || $("#protocolIdentity")?.textContent || "",
        transport: $("#transportIdentity")?.textContent || ""
      }
    });
    state.ctPurchaseInspection = inspection;
    state.ctPurchaseAnalysis = null;
    state.ctPurchaseReport = "";
    state.ctPurchaseLastBlockUpdatedAt = 0;
    state.ctPurchaseRoadSegmentStartedAt = 0;
    $("#ctReportActions").classList.add("hidden");
    $("#ctReportPreview").classList.add("hidden");
    $("#ctFinalSummary").classList.add("hidden");
    $("#ctTestStatusBadge").className = "ct-test-badge neutral";
    $("#ctTestStatusBadge").textContent = "TESTI KÄYNNISSÄ";

    await state.client.command("ATSH7E0", 4500);
    const standardCommands = ["0101", "0105", "0106", "0107", "010C", "012C", "012D", "0130", "0131", "0142", "014D", "014E", "03", "07", "0A"];
    const standardEvents = {};
    for (const [index, command] of standardCommands.entries()) {
      setNotice("ctPreflightResult", `EOBD-luku ${index + 1}/${standardCommands.length}: ${command}`);
      standardEvents[command] = await readCtInspectionCommand(command, 6000);
    }

    setNotice("ctPreflightResult", "Luetaan CT 200h:n ZWA10-tunniste ja HV-akun kaikki viisi mittausryhmää…");
    const probes = getVehicleReadDataProbes(VEHICLE_KEYS.CT200H);
    const hybridTransaction = await state.client.runReadOnlyEcuTransaction({
      requestHeader: "7E2",
      responseHeader: "7EA",
      setupCommands: ["ATSP6", "ATCAF1", "ATCFC1", "ATAL", "ATH0", "ATS0"],
      requests: probes.map(probe => ({ command: probe.command, service: probe.service, timeoutMs: 7500 })),
      continueOnReadError: true,
      label: "CT 200h ostotarkastus · hybridin esitarkastus",
      profileKey: VEHICLE_KEYS.CT200H
    });
    const snapshot = ctSnapshotValuesFromResponses(probes, hybridTransaction.responses);
    const identificationPacket = snapshot.decoded["21C1"];

    setNotice("ctPreflightResult", "Luetaan hybridiohjaimen koodit ja kokeillaan jarru-ECU:n vain lukevaa kattavuuskyselyä…");
    const vehicleDtcs = await state.client.readVehicleSpecificDtcs({ includeResearchCandidates: true });
    const readiness = parseCtReadiness(standardEvents["0101"].raw);
    const standardPids = {
      coolantC: decodeCtPurchasePid(standardEvents["0105"].raw, 0x05),
      shortFuelTrimPercent: decodeCtPurchasePid(standardEvents["0106"].raw, 0x06),
      longFuelTrimPercent: decodeCtPurchasePid(standardEvents["0107"].raw, 0x07),
      rpm: decodeCtPurchasePid(standardEvents["010C"].raw, 0x0c),
      commandedEgrPercent: decodeCtPurchasePid(standardEvents["012C"].raw, 0x2c),
      egrErrorPercent: decodeCtPurchasePid(standardEvents["012D"].raw, 0x2d),
      warmupsSinceClear: decodeCtPurchasePid(standardEvents["0130"].raw, 0x30),
      distanceClearKm: decodeCtPurchasePid(standardEvents["0131"].raw, 0x31),
      controlModuleVoltageV: decodeCtPurchasePid(standardEvents["0142"].raw, 0x42),
      minutesMilOn: decodeCtPurchasePid(standardEvents["014D"].raw, 0x4d),
      minutesSinceClear: decodeCtPurchasePid(standardEvents["014E"].raw, 0x4e)
    };
    const standardDtcs = {
      stored: parseDtcResponse(standardEvents["03"].raw, 0x43),
      pending: parseDtcResponse(standardEvents["07"].raw, 0x47),
      permanent: parseDtcResponse(standardEvents["0A"].raw, 0x4a)
    };
    const standardDtcValid = rawHasPositiveService(standardEvents["03"].raw, 0x43) &&
      rawHasPositiveService(standardEvents["07"].raw, 0x47) &&
      rawHasPositiveService(standardEvents["0A"].raw, 0x4a);
    inspection.preflight = {
      completedAt: Date.now(),
      identification: {
        confirmed: identificationPacket?.complete === true && identificationPacket?.values?.zwa10Confirmed === true,
        modelCode: identificationPacket?.values?.modelCode || "",
        engineCode: identificationPacket?.values?.engineCode || "",
        raw: hybridTransaction.responses[0]?.raw || "",
        error: hybridTransaction.responses[0]?.error || ""
      },
      readiness,
      standardPids,
      standardDtcs,
      standardDtcValid,
      hybridSnapshot: snapshot.values,
      vehicleDtcs,
      raw: {
        standard: Object.fromEntries(Object.entries(standardEvents).map(([command, event]) => [command, { raw: event.raw, error: event.error }])),
        hybrid: Object.fromEntries(hybridTransaction.responses.map(response => [response.command, { raw: response.raw, error: response.error, transactionId: response.transactionId }])),
        vehicleDtcs: {
          groups: vehicleDtcs.groups.map(group => ({ id: group.id, requestHeader: group.requestHeader, responseHeader: group.responseHeader, raw: group.raw, validResponse: group.validResponse })),
          notes: [...vehicleDtcs.notes],
          transactionIds: [...vehicleDtcs.transactionIds]
        }
      }
    };
    const hybridGroups = vehicleDtcs.groups.filter(group => group.id.startsWith("hybrid."));
    const brakeGroup = vehicleDtcs.groups.find(group => group.id.startsWith("brake."));
    const allCodes = [...Object.values(standardDtcs).flat(), ...vehicleDtcs.groups.flatMap(group => group.codes)];
    const preflightOkay = inspection.preflight.identification.confirmed && standardDtcValid && hybridGroups.length === 2;
    const readinessText = readiness ? `${readiness.incompleteCount}/${readiness.supportedCount} monitoria kesken` : "readiness ei vastannut";
    setNotice(
      "ctPreflightResult",
      `Esitarkastus valmis · ${inspection.preflight.identification.confirmed ? "ZWA10 vahvistettu" : "ZWA10 ei vahvistunut"} · ${allCodes.length} tulkittua koodia · ${readinessText} · jarru-ECU ${brakeGroup ? "vastasi" : "ei varmistunut (Techstream tarvitaan)"}.`,
      preflightOkay ? (brakeGroup ? "" : "warning") : "warning"
    );
    $("#ctToggleRoadTest").disabled = false;
    $("#ctFinalizeTest").disabled = false;
    renderCtPurchaseProgress();
  } catch (error) {
    setNotice("ctPreflightResult", `Esitarkastus keskeytyi: ${error.message}`, "error");
    $("#ctTestStatusBadge").className = "ct-test-badge incomplete";
    $("#ctTestStatusBadge").textContent = "ESITARKASTUS KESKEN";
  } finally {
    button.disabled = false;
    button.textContent = "Aja CT-esitarkastus uudelleen";
  }
}

async function runCtPurchasePostflight(inspection) {
  if (!state.connected || !state.client || state.quicklynks || !isCt200h()) {
    return {
      completedAt: Date.now(),
      standardDtcValid: false,
      standardDtcs: { stored: [], pending: [], permanent: [] },
      readiness: null,
      vehicleDtcs: { groups: [], notes: ["Yhteys puuttui koeajon jälkeisestä uusintaluvusta"], transactionIds: [] },
      raw: { error: "Yhteys puuttui koeajon jälkeisestä uusintaluvusta" }
    };
  }
  await state.client.command("ATSH7E0", 4500);
  const events = {};
  for (const command of ["0101", "03", "07", "0A"]) events[command] = await readCtInspectionCommand(command, 6500);
  const vehicleDtcs = await state.client.readVehicleSpecificDtcs({ includeResearchCandidates: true });
  return {
    completedAt: Date.now(),
    readiness: parseCtReadiness(events["0101"].raw),
    standardDtcs: {
      stored: parseDtcResponse(events["03"].raw, 0x43),
      pending: parseDtcResponse(events["07"].raw, 0x47),
      permanent: parseDtcResponse(events["0A"].raw, 0x4a)
    },
    standardDtcValid: rawHasPositiveService(events["03"].raw, 0x43) &&
      rawHasPositiveService(events["07"].raw, 0x47) &&
      rawHasPositiveService(events["0A"].raw, 0x4a),
    vehicleDtcs,
    raw: {
      standard: Object.fromEntries(Object.entries(events).map(([command, event]) => [command, { raw: event.raw, error: event.error }])),
      vehicleDtcs: {
        groups: vehicleDtcs.groups.map(group => ({ id: group.id, requestHeader: group.requestHeader, responseHeader: group.responseHeader, raw: group.raw, validResponse: group.validResponse })),
        notes: [...vehicleDtcs.notes],
        transactionIds: [...vehicleDtcs.transactionIds]
      }
    }
  };
}

function currentCtRoadDurationMs(inspection = state.ctPurchaseInspection) {
  const completed = (inspection?.roadSegments || []).reduce((total, segment) =>
    total + Math.max(0, Number(segment.endedAt || segment.startedAt) - Number(segment.startedAt || 0)), 0
  );
  return completed + (state.ctPurchaseRoadActive && state.ctPurchaseRoadSegmentStartedAt
    ? Math.max(0, Date.now() - state.ctPurchaseRoadSegmentStartedAt)
    : 0);
}

function captureCtPurchaseSample() {
  const inspection = state.ctPurchaseInspection;
  if (!state.ctPurchaseRoadActive || !inspection || !state.liveActive) return;
  const blockUpdatedAt = Number(state.updatedAt.ctHvBlockVoltage01 || 0);
  if (!blockUpdatedAt || blockUpdatedAt <= state.ctPurchaseLastBlockUpdatedAt) {
    renderCtPurchaseProgress();
    return;
  }
  state.ctPurchaseLastBlockUpdatedAt = blockUpdatedAt;
  const timestamp = Date.now();
  const valueAgesMs = Object.fromEntries(Object.entries(state.updatedAt)
    .filter(([, updatedAt]) => Number.isFinite(updatedAt))
    .map(([id, updatedAt]) => [id, Math.max(0, timestamp - updatedAt)]));
  const sample = createCtPurchaseSample({
    timestamp,
    values: { ...state.values },
    valueAgesMs,
    raw: {
      blockVoltages: state.rawValues.ctHvBlockVoltage01 || "",
      currentAndLimits: state.rawValues.ctHvCurrent || "",
      temperatures: state.rawValues.ctHvTemperature1 || "",
      resistance: state.rawValues.ctHvResistanceDelta || ""
    }
  });
  if (sample.phase === "invalid") {
    if (inspection.rawEvents.length < 30) inspection.rawEvents.push({ timestamp, type: "rejected-sample", reason: sample.rejectedBecause });
    return;
  }
  inspection.samples.push(sample);
  renderCtPurchaseProgress();
}

function renderCtPurchaseProgress() {
  const inspection = state.ctPurchaseInspection;
  const counts = { baseline: 0, discharge: 0, charge: 0 };
  for (const sample of inspection?.samples || []) if (sample.phase in counts) counts[sample.phase] += 1;
  $("#ctBaselineSamples").textContent = `${counts.baseline} / ${CT_PURCHASE_THRESHOLDS.minimumSamples.baseline}`;
  $("#ctDischargeSamples").textContent = `${counts.discharge} / ${CT_PURCHASE_THRESHOLDS.minimumSamples.discharge}`;
  $("#ctChargeSamples").textContent = `${counts.charge} / ${CT_PURCHASE_THRESHOLDS.minimumSamples.charge}`;
  const durationMs = currentCtRoadDurationMs(inspection);
  $("#ctRoadDuration").textContent = `${formatElapsed(durationMs)} / 10:00`;
  if (!inspection?.preflight) return setNotice("ctRoadTestHint", "Aja esitarkastus ensin.");
  if (state.ctPurchaseRoadActive) {
    const latest = inspection.samples.at(-1);
    const phase = latest?.phase === "baseline" ? "paikallaan" : latest?.phase === "discharge" ? "purku" : latest?.phase === "charge" ? "regenerointi" : "siirtymä";
    setNotice("ctRoadTestHint", `Näytteenotto käynnissä · viimeisin vaihe ${phase} · ${inspection.samples.length} hyväksyttyä näytettä.`, "warning");
  } else {
    const complete = counts.baseline >= 3 && counts.discharge >= 5 && counts.charge >= 5;
    setNotice("ctRoadTestHint", complete ? "Kaikki kolme mittausvaihetta on katettu. Voit muodostaa raportin." : "Näytteenotto pysäytetty. Puuttuvat vaiheet näkyvät laskureissa.", complete ? "" : "warning");
  }
}

async function toggleCtPurchaseRoadTest() {
  if (state.ctPurchaseRoadActive) return stopCtPurchaseRoadTest();
  if (!state.ctPurchaseInspection?.preflight) return toast("Aja CT-esitarkastus ensin");
  if (!isCt200h() || state.quicklynks || !requireConnection()) return;
  if (state.liveActive) await stopLive();
  resetLiveMeasurements();
  renderMetrics();
  state.ctPurchaseRoadActive = true;
  state.ctPurchaseRoadSegmentStartedAt = Date.now();
  state.ctPurchaseLastBlockUpdatedAt = 0;
  $("#ctToggleRoadTest").textContent = "Pysäytä näytteenotto";
  $("#ctToggleRoadTest").className = "danger full";
  state.ctPurchaseSampleTimer = setInterval(captureCtPurchaseSample, 300);
  renderCtPurchaseProgress();
  startLive();
  await setKeepAwake(true);
}

async function stopCtPurchaseRoadTest({ stopLiveRead = true } = {}) {
  if (state.ctPurchaseRoadActive && state.ctPurchaseRoadSegmentStartedAt && state.ctPurchaseInspection) {
    state.ctPurchaseInspection.roadSegments.push({
      startedAt: state.ctPurchaseRoadSegmentStartedAt,
      endedAt: Date.now()
    });
  }
  state.ctPurchaseRoadActive = false;
  state.ctPurchaseRoadSegmentStartedAt = 0;
  clearInterval(state.ctPurchaseSampleTimer);
  state.ctPurchaseSampleTimer = null;
  $("#ctToggleRoadTest").textContent = "Jatka automaattista näytteenottoa";
  $("#ctToggleRoadTest").className = "primary full";
  if (stopLiveRead && state.liveActive) await stopLive();
  await setKeepAwake(false);
  renderCtPurchaseProgress();
}

async function finalizeCtPurchaseTest() {
  const inspection = state.ctPurchaseInspection;
  if (!inspection?.preflight) return toast("Aja CT-esitarkastus ensin");
  if (state.ctPurchaseRoadActive) await stopCtPurchaseRoadTest();
  const button = $("#ctFinalizeTest");
  button.disabled = true;
  button.textContent = "Luetaan loppukoodit…";
  setNotice("ctFinalSummary", "Luetaan moottorin ja hybridiohjaimen vikakoodit uudelleen koeajon jälkeen…");
  try {
    inspection.candidate = ctCandidateFromForm();
    inspection.manual = ctManualFromForm();
    inspection.postflight = await runCtPurchasePostflight(inspection);
  } catch (error) {
    inspection.postflight = {
      completedAt: Date.now(),
      standardDtcValid: false,
      standardDtcs: { stored: [], pending: [], permanent: [] },
      readiness: null,
      vehicleDtcs: { groups: [], notes: [error.message], transactionIds: [] },
      raw: { error: error.message }
    };
  } finally {
    inspection.endedAt = Date.now();
    state.ctPurchaseAnalysis = analyzeCtPurchaseInspection(inspection);
    state.ctPurchaseReport = buildCtPurchaseInspectionReport(inspection, state.ctPurchaseAnalysis);
    const analysis = state.ctPurchaseAnalysis;
    const actionFindings = analysis.findings.filter(finding => ["stop", "attention"].includes(finding.severity));
    $("#ctTestStatusBadge").className = `ct-test-badge ${analysis.status}`;
    $("#ctTestStatusBadge").textContent = analysis.statusText;
    setNotice(
      "ctFinalSummary",
      `${analysis.statusText}. Kattavuudesta puuttuu ${analysis.missingCoverage.length} kohtaa; stop/huomio-havaintoja ${actionFindings.length}. Tämä tulos ei ole HV-akun kapasiteetti- tai SOH-arvio.`,
      analysis.status === "stop" ? "error" : analysis.status === "ready" ? "" : "warning"
    );
    $("#ctReportActions").classList.remove("hidden");
    $("#ctReportPreview").textContent = state.ctPurchaseReport;
    $("#ctReportPreview").classList.remove("hidden");
    button.disabled = false;
    button.textContent = "Muodosta raportti ja lue loppukoodit uudelleen";
  }
}

function ctPurchaseReportFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `Lexus_CT200h_ostotarkastus_Flex-${APP_VERSION}_${timestamp}.txt`;
}

async function copyCtPurchaseReport() {
  if (!state.ctPurchaseReport) return toast("Muodosta raportti ensin");
  try {
    await navigator.clipboard.writeText(state.ctPurchaseReport);
    toast("CT-ostotarkastusraportti kopioitu");
  } catch {
    toast("Raportin kopiointi ei onnistunut");
  }
}

async function saveOrShareCtPurchaseReport(share = false) {
  if (!state.ctPurchaseReport || !state.ctPurchaseInspection || !state.ctPurchaseAnalysis) return toast("Muodosta raportti ensin");
  const filename = ctPurchaseReportFilename();
  const prompt = buildCtPurchaseInspectionAnalysisPrompt(state.ctPurchaseInspection, state.ctPurchaseAnalysis);
  const title = "Lexus OBD Flex · CT 200h ostotarkastus";
  try {
    if (nativeTransport.available() && globalThis.obd?.exportCsv) {
      const uri = await nativeTransport.exportCsv(filename, state.ctPurchaseReport, "text/plain");
      if (!(uri?.startsWith("content:"))) throw new Error("Android ei palauttanut tiedoston osoitetta");
      if (share) {
        await nativeTransport.shareCsv(uri, prompt, title, "text/plain");
        toast("Valitse ChatGPT jakovalikosta");
      } else {
        toast("Raportti tallennettu Lataukset/Lexus OBD -kansioon");
      }
      return;
    }
    const file = new File([state.ctPurchaseReport], filename, { type: "text/plain;charset=utf-8" });
    if (share && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ title, text: prompt, files: [file] });
      return;
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    if (share) await navigator.clipboard?.writeText(prompt);
    toast(share ? "Raportti tallennettu ja analyysipyyntö kopioitu" : "Raportti tallennettu");
  } catch (error) {
    if (error?.name !== "AbortError") toast(`Raporttitoiminto epäonnistui: ${error.message}`);
  }
}

const INJECTOR_TEST_TARGET_MS = 45000;
const INJECTOR_TEST_SAMPLE_INTERVAL_MS = 2500;
const INJECTOR_TEST_MAX_SAMPLES = 18;
const INJECTOR_TEST_STANDARD_TIMEOUT_MS = 3500;
const INJECTOR_TEST_TOYOTA_TIMEOUT_MS = 7000;
const INJECTOR_TEST_MAX_CONSECUTIVE_MISSES = 2;

async function injectorCommand(command, timeoutMs = 5500) {
  try {
    return { raw: await state.client.command(command, timeoutMs), error: "" };
  } catch (error) {
    return {
      raw: error?.raw || error?.partialRaw || "",
      error: error?.message || String(error)
    };
  }
}

function renderInjectorSample(sample = null) {
  const feedback = sample?.values?.feedbackMm3 || [];
  for (let index = 0; index < 4; index++) {
    const element = $(`#injectorLive${index + 1}`);
    const value = feedback[index];
    element.textContent = Number.isFinite(value) ? value.toFixed(2) : "–";
    element.classList.toggle("attention", Number.isFinite(value) && Math.abs(value) > INJECTOR_TEST_LIMITS.typicalAbsoluteMm3);
    element.classList.toggle("abnormal", Number.isFinite(value) && Math.abs(value) > INJECTOR_TEST_LIMITS.serviceAbsoluteMm3);
  }
  $("#injectorConditionsLive").textContent = sample
    ? `RPM ${Number.isFinite(sample.values.rpm) ? sample.values.rpm.toFixed(0) : "–"} · jäähdytysneste ${Number.isFinite(sample.values.coolantC) ? `${sample.values.coolantC.toFixed(0)} °C` : "–"} · rail ${Number.isFinite(sample.values.railPressureMpa) ? `${sample.values.railPressureMpa.toFixed(0)} MPa` : "–"}`
    : "RPM – · jäähdytysneste – · rail –";
}

function renderInjectorProgress(message = "") {
  const run = state.injectorTestRun;
  const elapsedMs = run ? Math.max(0, Number(run.endedAt || Date.now()) - Number(run.startedAt || Date.now())) : 0;
  const percent = run?.endedAt ? 100 : Math.min(99, Math.round(elapsedMs / INJECTOR_TEST_TARGET_MS * 100));
  const valid = (run?.samples || []).filter(sample => sample?.values?.feedbackMm3?.length === 4 && sample.values.feedbackMm3.every(Number.isFinite)).length;
  $("#injectorProgressBar").style.width = `${percent}%`;
  $("#injectorProgressText").textContent = message || (run ? `${formatElapsed(elapsedMs)} / 00:45` : "Ei ajettu");
  $("#injectorSampleCount").textContent = `${valid} kelvollista näytettä`;
}

function finishInjectorTestUi() {
  const run = state.injectorTestRun;
  if (!run) return;
  state.injectorTestAnalysis = analyzeInjectorTest(run);
  state.injectorTestReport = buildInjectorTestReport(run, state.injectorTestAnalysis);
  const analysis = state.injectorTestAnalysis;
  const badgeClass = ({ normal: "ready", attention: "attention", abnormal: "stop", incomplete: "incomplete" })[analysis.status] || "neutral";
  $("#injectorStatusBadge").className = `ct-test-badge ${badgeClass}`;
  $("#injectorStatusBadge").textContent = analysis.statusText;
  const headline = analysis.findings.slice(0, 3).join(" ");
  setNotice("injectorFinalSummary", `${analysis.statusText}. ${headline}`, analysis.status === "abnormal" ? "error" : analysis.status === "normal" ? "" : "warning");
  $("#injectorReportActions").classList.remove("hidden");
  $("#injectorReportDetails").classList.remove("hidden");
  $("#injectorReportPreview").textContent = state.injectorTestReport;
  renderInjectorProgress(run.cancelled ? "Keskeytetty hallitusti · raportti valmis" : "Valmis · tekoälyraportti muodostettu");
}

const INJECTOR_RESTORE_COMMAND_TIMEOUT_MS = 900;
const INJECTOR_RESTORE_PROBE_TIMEOUT_MS = 1800;

async function restoreAfterInjectorTest(client = state.client) {
  if (!state.connected || !client) return;
  for (const command of INJECTOR_TEST_COMMANDS.restore) {
    try { await client.command(command, INJECTOR_RESTORE_COMMAND_TIMEOUT_MS); } catch {}
  }
  try {
    const raw = await client.command("0100", INJECTOR_RESTORE_PROBE_TIMEOUT_MS);
    state.ecuConnected = hasModePidResponse(raw, 0x41, 0x00);
    client.ecuConnected = state.ecuConnected;
  } catch {}
}

async function runInjectorTest() {
  if (!requireConnection()) return;
  if (state.vehicleKey !== VEHICLE_KEYS.IS220D) {
    setNotice("injectorTestNotice", "Valitse ja tunnista Lexus IS220d ennen testiä.", "warning");
    return;
  }
  if (state.quicklynks || !(state.client instanceof Elm327Client)) {
    setNotice("injectorTestNotice", "Suutintesti vaatii vLinker- tai muun ASCII-ELM327-adapterin. Quicklynksin binääripolku ei voi lähettää Toyota 219C -lukupyyntöä.", "warning");
    return;
  }
  if (!INJECTOR_TEST_AVAILABILITY.supported) {
    $("#injectorStatusBadge").className = "ct-test-badge incomplete";
    $("#injectorStatusBadge").textContent = "EI TUETTU";
    setNotice(
      "injectorTestNotice",
      `Suutintestiä ei käynnistetty eikä ${INJECTOR_TEST_AVAILABILITY.blockedCommand}-komentoa lähetetty. ${INJECTOR_TEST_AVAILABILITY.reason} Tarvitaan Techstreamillä varmennettu oikea Data List -tunniste.`,
      "warning"
    );
    updateConnectionButtons();
    return;
  }
  if (!$("#injectorConditionsConfirmed").checked) {
    setNotice("injectorTestNotice", "Vahvista turvalliset mittausolosuhteet ja lisälaitteiden poiskytkentä.", "warning");
    return;
  }
  if (state.injectorTestRunning) return;
  if (state.diagnosticRunning || state.recording || state.ctPurchaseRoadActive || powerRunActive()) {
    setNotice("injectorTestNotice", "Lopeta muu testi, tallennus tai diagnostiikka ennen suutintestiä.", "warning");
    return;
  }
  if (!INJECTOR_TEST_COMMANDS.read.every(command => isSafeTerminalCommand(command))) {
    setNotice("injectorTestNotice", "Sisäinen turvallisuussallintalista esti suutintestin lukukomennon.", "error");
    return;
  }
  if (state.liveActive) await stopLive();

  state.injectorTestRunning = true;
  state.injectorTestAbortRequested = false;
  state.injectorTestAnalysis = null;
  state.injectorTestReport = "";
  const device = selectedDiagnosticDeviceMeta();
  state.injectorTestRun = {
    schemaVersion: 1,
    startedAt: Date.now(),
    endedAt: null,
    cancelled: false,
    samples: [],
    setup: [],
    meta: {
      appVersion: APP_VERSION,
      reportId: createDiagnosticReportId("INJECTOR", Date.now()),
      vehicle: activeVehicleName(),
      vehicleKey: state.vehicleKey,
      odometer: $("#injectorOdometer").value.trim(),
      note: $("#injectorNote").value.trim(),
      userAgent: navigator.userAgent,
      ...device
    }
  };
  $("#startInjectorTest").disabled = true;
  $("#startInjectorTest").textContent = "Mittaus käynnissä…";
  $("#cancelInjectorTest").disabled = false;
  $("#injectorReportActions").classList.add("hidden");
  $("#injectorReportDetails").classList.add("hidden");
  $("#injectorStatusBadge").className = "ct-test-badge attention";
  $("#injectorStatusBadge").textContent = "MITATAAN";
  renderInjectorSample();
  renderInjectorProgress("Valmistellaan vain lukevaa CAN-yhteyttä…");
  setNotice("injectorTestNotice", "Pidä moottori vakaalla tyhjäkäynnillä. Älä koske kaasuun mittauksen aikana.");
  updateConnectionButtons();
  setKeepAwake(true);

  try {
    for (const command of INJECTOR_TEST_COMMANDS.setup) {
      if (state.injectorTestAbortRequested) break;
      renderInjectorProgress(`Valmistellaan yhteyttä · ${command}`);
      const result = await injectorCommand(command, 5500);
      state.injectorTestRun.setup.push({ command, raw: result.raw, error: result.error, timestamp: Date.now() });
      if (result.error && ["ATSP6", "ATSH7E0"].includes(command)) throw new Error(`${command} epäonnistui: ${result.error}`);
    }
    if (state.injectorTestAbortRequested) throw new Error("Testi keskeytettiin valmistelun aikana");

    renderInjectorProgress("Tarkistetaan ensin Toyota 219C -suutinkorjausarvon tuki…");
    const preflightFeedbackResult = await injectorCommand("219C", INJECTOR_TEST_TOYOTA_TIMEOUT_MS);
    const preflightFeedbackDecoded = decodeToyotaReadDataResponse(preflightFeedbackResult.raw, 0x9c, VEHICLE_KEYS.IS220D);
    const preflightFeedback = preflightFeedbackDecoded?.complete
      ? [1, 2, 3, 4].map(index => preflightFeedbackDecoded.values[`injectionFeedback${index}Mm3`])
      : [];
    if (preflightFeedbackResult.error || preflightFeedback.length !== 4 || !preflightFeedback.every(Number.isFinite)) {
      throw new Error(`Toyota 219C ei palauttanut kelvollisia neljän sylinterin arvoja 7 sekunnissa${preflightFeedbackResult.error ? `: ${preflightFeedbackResult.error}` : ""}`);
    }

    renderInjectorProgress("Luetaan mittausolosuhteet · jäähdytysneste 0105");
    const coolantBaseline = await injectorCommand("0105", INJECTOR_TEST_STANDARD_TIMEOUT_MS);
    renderInjectorProgress("Luetaan mittausolosuhteet · rail-paine 2196");
    const railBaseline = await injectorCommand("2196", INJECTOR_TEST_TOYOTA_TIMEOUT_MS);
    renderInjectorProgress("Luetaan mittausolosuhteet · polttoainelämpö 2193");
    const fuelTemperatureBaseline = await injectorCommand("2193", INJECTOR_TEST_TOYOTA_TIMEOUT_MS);
    const coolantBaselineValue = decodePidResponse("coolant", coolantBaseline.raw);
    const railBaselineDecoded = decodeToyotaReadDataResponse(railBaseline.raw, 0x96, VEHICLE_KEYS.IS220D);
    const fuelTemperatureBaselineDecoded = decodeToyotaReadDataResponse(fuelTemperatureBaseline.raw, 0x93, VEHICLE_KEYS.IS220D);
    const railBaselineValue = railBaselineDecoded?.complete ? railBaselineDecoded.values.railPressureMpa : null;
    const fuelTemperatureBaselineValue = fuelTemperatureBaselineDecoded?.complete ? fuelTemperatureBaselineDecoded.values.fuelTemperatureC : null;

    const measurementStartedAt = Date.now();
    let consecutiveFeedbackMisses = 0;
    while (!state.injectorTestAbortRequested && state.injectorTestRun.samples.length < INJECTOR_TEST_MAX_SAMPLES) {
      const sequence = state.injectorTestRun.samples.length + 1;
      const roundStartedAt = Date.now();
      renderInjectorProgress(`Näyte ${sequence}/${INJECTOR_TEST_MAX_SAMPLES} · kierrosluku`);
      const rpmResult = await injectorCommand("010C", INJECTOR_TEST_STANDARD_TIMEOUT_MS);
      if (state.injectorTestAbortRequested) break;
      renderInjectorProgress(`Näyte ${sequence}/${INJECTOR_TEST_MAX_SAMPLES} · suutinkorjaukset`);
      const feedbackResult = sequence === 1
        ? preflightFeedbackResult
        : await injectorCommand("219C", INJECTOR_TEST_TOYOTA_TIMEOUT_MS);
      const feedback = decodeToyotaReadDataResponse(feedbackResult.raw, 0x9c, VEHICLE_KEYS.IS220D);
      const feedbackMm3 = feedback?.complete ? [1, 2, 3, 4].map(index => feedback.values[`injectionFeedback${index}Mm3`]) : [];
      if (feedbackResult.error || feedbackMm3.length !== 4 || !feedbackMm3.every(Number.isFinite)) consecutiveFeedbackMisses++;
      else consecutiveFeedbackMisses = 0;
      const sample = {
        sequence,
        timestamp: Date.now(),
        elapsedMs: Date.now() - state.injectorTestRun.startedAt,
        values: {
          rpm: decodePidResponse("rpm", rpmResult.raw),
          coolantC: coolantBaselineValue,
          fuelTemperatureC: fuelTemperatureBaselineValue,
          railPressureMpa: railBaselineValue,
          feedbackMm3
        },
        raw: {
          rpm: rpmResult.raw,
          coolant: sequence === 1 ? coolantBaseline.raw : "",
          fuelTemperature: sequence === 1 ? fuelTemperatureBaseline.raw : "",
          railPressure: sequence === 1 ? railBaseline.raw : "",
          feedback: feedbackResult.raw
        },
        errors: Object.fromEntries([
          ["010C", rpmResult.error],
          ["0105", sequence === 1 ? coolantBaseline.error : ""],
          ["2193", sequence === 1 ? fuelTemperatureBaseline.error : ""],
          ["2196", sequence === 1 ? railBaseline.error : ""],
          ["219C", feedbackResult.error || (feedbackMm3.length === 4 ? "" : "vajaa tai puuttuva vastaus")]
        ].filter(([, error]) => error))
      };
      state.injectorTestRun.samples.push(sample);
      renderInjectorSample(sample);
      renderInjectorProgress();
      if (consecutiveFeedbackMisses >= INJECTOR_TEST_MAX_CONSECUTIVE_MISSES) {
        throw new Error(`Toyota 219C jäi vastaamatta ${consecutiveFeedbackMisses} peräkkäisessä näytteessä`);
      }
      if (Date.now() - measurementStartedAt >= INJECTOR_TEST_TARGET_MS && state.injectorTestRun.samples.length >= INJECTOR_TEST_LIMITS.minimumValidSamples) break;
      const remainingDelay = INJECTOR_TEST_SAMPLE_INTERVAL_MS - (Date.now() - roundStartedAt);
      if (remainingDelay > 0) await delay(remainingDelay);
    }
  } catch (error) {
    state.injectorTestRun.internalError = error?.message || String(error);
    setNotice("injectorTestNotice", `Testi keskeytyi: ${state.injectorTestRun.internalError}. Jo saaduista tiedoista muodostetaan raportti.`, "error");
  } finally {
    const restoreClient = state.client;
    state.injectorTestRun.cancelled = state.injectorTestAbortRequested;
    state.injectorTestRun.endedAt = Date.now();
    state.injectorTestRunning = false;
    state.injectorTestRestoring = true;
    state.injectorTestAbortRequested = false;
    finishInjectorTestUi();
    renderInjectorProgress("Raportti valmis · palautetaan normaali ELM/CAN-yhteys…");
    $("#startInjectorTest").textContent = "Palautetaan yhteyttä…";
    $("#cancelInjectorTest").disabled = true;
    updateConnectionButtons();
    setKeepAwake(false);
    await delay(0);
    await restoreAfterInjectorTest(restoreClient);
    state.injectorTestRestoring = false;
    updateConnectionButtons();
  }
}

function injectorTestFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `Lexus_IS220d_suutintesti_Flex-${APP_VERSION}_${timestamp}.txt`;
}

async function copyInjectorTestReport() {
  if (!state.injectorTestReport) return toast("Aja suutintesti ensin");
  try {
    await navigator.clipboard.writeText(state.injectorTestReport);
    toast("Suutintestiraportti kopioitu");
  } catch {
    toast("Raportin kopiointi ei onnistunut");
  }
}

async function saveOrShareInjectorTestReport(share = false) {
  if (!state.injectorTestReport || !state.injectorTestRun || !state.injectorTestAnalysis) return toast("Aja suutintesti ensin");
  const filename = injectorTestFilename();
  const prompt = buildInjectorTestAnalysisPrompt(state.injectorTestRun, state.injectorTestAnalysis);
  const title = "Lexus OBD Flex · IS220d suutintesti";
  try {
    if (nativeTransport.available() && globalThis.obd?.exportCsv) {
      const uri = await nativeTransport.exportCsv(filename, state.injectorTestReport, "text/plain");
      if (!(uri?.startsWith("content:"))) throw new Error("Android ei palauttanut tiedoston osoitetta");
      if (share) {
        await nativeTransport.shareCsv(uri, prompt, title, "text/plain");
        toast("Valitse tekoälysovellus jakovalikosta");
      } else {
        toast("Raportti tallennettu Lataukset/Lexus OBD -kansioon");
      }
      return;
    }
    const file = new File([state.injectorTestReport], filename, { type: "text/plain;charset=utf-8" });
    if (share && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ title, text: prompt, files: [file] });
      return;
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    if (share) await navigator.clipboard?.writeText(prompt);
    toast(share ? "Raportti tallennettu ja analyysipyyntö kopioitu" : "Raportti tallennettu");
  } catch (error) {
    if (error?.name !== "AbortError") toast(`Raporttitoiminto epäonnistui: ${error.message}`);
  }
}

async function clearDtc() {
  if (state.injectorTestRunning) return toast("Viimeistele suutintesti ennen vikakoodien poistoa");
  if (!requireConnection()) return;
  if (isCt200h()) {
    setNotice("dtcNotice", "CT 200h -profiili on tässä julkaisussa tarkoituksella vain luku: vikakoodien poistokomentoa ei lähetetty.", "warning");
    return;
  }
  if (state.client?.binaryQuicklynks) {
    setNotice("dtcNotice", "Vikakoodien poistoa ei lähetetty Quicklynksin varmentamattomalla binäärikomennolla.", "warning");
    return;
  }
  const confirmed = await confirmAction(
    "Poista vikakoodit?",
    "Mode 04 poistaa tallennetut koodit ja freeze frame -tiedot sekä nollaa päästövalmiusmonitorit. Ota koodit talteen ennen jatkamista."
  );
  if (!confirmed) return;
  try {
    await state.client.command("04", 4000);
    toast("Poistokomento lähetettiin");
    await delay(500);
    await readDtc();
  } catch (error) { setNotice("dtcNotice", error.message, "error"); }
}

function setNotice(id, text, type = "") {
  const element = $(`#${id}`);
  element.textContent = text || "";
  element.className = `inline-message ${type}`.trim();
  element.classList.toggle("hidden", !text);
}

function renderMetrics() {
  const grid = $("#metricGrid");
  const chartSelect = $("#liveChartMetric");
  const currentChart = chartSelect.value || "rpm";
  grid.innerHTML = "";
  chartSelect.innerHTML = "";
  for (const def of activeMetricDefinitions()) {
    const known = state.supportedPids instanceof Set;
    const supported = !known || state.supportedPids.has(def.pid) || state.supportedPids.has(def.id);
    if (known && def.standardAdvanced && !supported) continue;
    const value = state.values[def.id];
    const updated = state.updatedAt[def.id];
    const card = document.createElement("div");
    card.className = `metric-card${supported ? "" : " unsupported"}`;
    card.id = `metric-${def.id}`;
    card.innerHTML = `<div class="metric-name">${escapeHtml(def.name)}</div><div><span class="metric-value">${supported && Number.isFinite(value) ? formatValue(def, value) : "–"}</span><span class="metric-unit">${escapeHtml(def.unit)}</span></div><div class="metric-time">${supported ? (updated ? `Päivitetty ${formatClock(updated)}` : "Odottaa arvoa") : "Ei tuettu"}</div>`;
    grid.append(card);
    if (supported) {
      const option = document.createElement("option");
      option.value = def.id;
      option.textContent = def.short;
      chartSelect.append(option);
    }
  }
  chartSelect.value = [...chartSelect.options].some(option => option.value === currentChart) ? currentChart : chartSelect.options[0]?.value || "rpm";
  updateLiveChart();
  updateDriveValues();
  renderDpnrMonitor();
}

function dpnrRaw(command) {
  const metricId = command === "217E" ? "dpnrDifferentialPressure" : "dpnrInletTemperature";
  return state.rawValues[metricId] || "–";
}

function renderDpnrMonitor() {
  const grid = $("#dpnrMetricGrid");
  const chartSelect = $("#dpnrChartMetric");
  if (!grid || !chartSelect) return;
  const previous = chartSelect.value || "dpnrDifferentialPressure";
  grid.innerHTML = "";
  chartSelect.innerHTML = "";
  for (const id of DPNR_MONITOR_METRIC_IDS) {
    const def = PID_BY_ID[id];
    const value = state.values[id];
    const updatedAt = state.updatedAt[id];
    const raw = id.includes("Temperature") ? dpnrRaw("217F") : dpnrRaw("217E");
    const card = document.createElement("div");
    card.className = "dpnr-metric";
    card.innerHTML = `<span>${escapeHtml(def.name)}</span><strong>${Number.isFinite(value) ? formatValue(def, value) : "–"}</strong><small>${escapeHtml(def.unit)}</small><em>${updatedAt ? `${Math.max(0, Date.now() - updatedAt)} ms vanha` : "odottaa"}<br>${escapeHtml(raw)}</em>`;
    grid.append(card);
    const option = document.createElement("option");
    option.value = id;
    option.textContent = def.short;
    chartSelect.append(option);
  }
  chartSelect.value = DPNR_MONITOR_METRIC_IDS.includes(previous) ? previous : DPNR_MONITOR_METRIC_IDS[0];
  $("#dpnrRpm").textContent = Number.isFinite(state.values.rpm) ? Math.round(state.values.rpm) : "–";
  $("#dpnrCoolant").textContent = Number.isFinite(state.values.coolant) ? formatValue(PID_BY_ID.coolant, state.values.coolant) : "–";
  $("#dpnrMaf").textContent = Number.isFinite(state.values.maf) ? formatValue(PID_BY_ID.maf, state.values.maf) : "–";
  const voltage = Number.isFinite(state.values.voltage) ? state.values.voltage : state.values.adapterVoltage;
  $("#dpnrVoltage").textContent = Number.isFinite(voltage) ? Number(voltage).toFixed(2) : "–";
  $("#dpnrRaw217e").textContent = dpnrRaw("217E");
  $("#dpnrRaw217f").textContent = dpnrRaw("217F");
  updateDpnrAssessment();
  updateDpnrChart();
}

function updateDpnrAssessment() {
  const inlet = state.values.dpnrInletTemperature;
  const outlet = state.values.dpnrOutletTemperature;
  const pressure = state.values.dpnrDifferentialPressure;
  if (![inlet, outlet, pressure].some(Number.isFinite)) {
    setNotice("dpnrAssessment", state.connected ? "Toyota 217E/217F -vastauksia odotetaan. Jos niitä ei tule, adapteri tai ECU ei tue tätä varmennettua lukupolkua." : "");
    return;
  }
  const identicalTemperatures = Number.isFinite(inlet) && Number.isFinite(outlet) && inlet === outlet;
  const suspicious750 = identicalTemperatures && inlet === 750;
  const message = `Paine-ero ${Number.isFinite(pressure) ? `${pressure.toFixed(2).replace(".", ",")} kPa` : "–"} · tulo ${Number.isFinite(inlet) ? `${inlet.toFixed(1).replace(".", ",")} °C` : "–"} · lähtö ${Number.isFinite(outlet) ? `${outlet.toFixed(1).replace(".", ",")} °C` : "–"}. ` +
    (suspicious750
      ? "Molemmat lämpötilat ovat täsmälleen 750 °C; tarkista alla oleva 217F-raakavaste, koska tämä voi olla anturin raja-arvo tai virheellinen data."
      : identicalTemperatures
        ? "Lämpötilat ovat täsmälleen samat; seuraa muuttuuko 217F-raakavaste kierrosten tai kuorman mukana."
        : "Arvot tulevat suoraan varmennetuista Toyota 217E/217F -vastauksista.");
  setNotice("dpnrAssessment", message, suspicious750 || identicalTemperatures ? "warning" : "");
}

function updateDpnrChart() {
  const select = $("#dpnrChartMetric");
  const canvas = $("#dpnrChart");
  if (!select || !canvas) return;
  const id = select.value || DPNR_MONITOR_METRIC_IDS[0];
  const def = PID_BY_ID[id];
  drawLineChart(canvas, state.histories[id] || [], { unit: def.unit });
}

function applyMetricResult(def, result, cycleRaw) {
  if (!Number.isFinite(result?.value)) return;
  const receivedAt = Date.now();
  const measuredAt = Number.isFinite(result.updatedAt) ? result.updatedAt : receivedAt;
  const previousUpdatedAt = state.updatedAt[def.id];
  state.values[def.id] = result.value;
  state.updatedAt[def.id] = measuredAt;
  state.rawValues[def.id] = Number.isInteger(def.pid)
    ? cleanElmResponse(result.raw, `01${def.pid.toString(16).padStart(2, "0")}`)
    : String(result.raw || "");
  state.valueSources[def.id] = result.source || "";
  if (state.quicklynks && result.unknownHex) $("#quicklynksRaw").textContent = result.unknownHex;
  cycleRaw[def.id] = state.rawValues[def.id];

  const history = state.histories[def.id];
  if (!Number.isFinite(previousUpdatedAt) || measuredAt > previousUpdatedAt || !history.length) {
    history.push({ time: measuredAt, value: result.value });
    if (history.length > 180) history.splice(0, history.length - 180);
  }
  updateMetricCard(def);
  if ($("#liveChartMetric").value === def.id) updateLiveChart();
}

function updateDerivedMetrics(cycleRaw) {
  const publish = (id, value, measuredAt, raw, source) => {
    if (!Number.isFinite(value) || !Number.isFinite(measuredAt)) return;
    const def = PID_BY_ID[id];
    const previousUpdatedAt = state.updatedAt[id];
    state.values[id] = value;
    state.updatedAt[id] = measuredAt;
    state.rawValues[id] = raw;
    state.valueSources[id] = source;
    cycleRaw[id] = raw;
    const history = state.histories[id];
    if (!Number.isFinite(previousUpdatedAt) || measuredAt > previousUpdatedAt || !history.length) {
      history.push({ time: measuredAt, value });
      if (history.length > 180) history.splice(0, history.length - 180);
    }
    updateMetricCard(def);
    if ($("#liveChartMetric").value === id) updateLiveChart();
  };

  const map = state.values.map;
  const barometricPressure = state.values.barometricPressure;
  const mapAt = state.updatedAt.map;
  const barometricAt = state.updatedAt.barometricPressure;
  if ([map, barometricPressure, mapAt, barometricAt].every(Number.isFinite)) {
    publish("boostPressure", map - barometricPressure, Math.min(mapAt, barometricAt), "derived:map-barometricPressure", "Johdettu MAP − ilmanpaine");
  }

  const packVoltage = state.values.ctHvPackVoltage;
  const batteryCurrent = state.values.ctHvCurrent;
  const packVoltageAt = state.updatedAt.ctHvPackVoltage;
  const batteryCurrentAt = state.updatedAt.ctHvCurrent;
  if (isCt200h() && [packVoltage, batteryCurrent, packVoltageAt, batteryCurrentAt].every(Number.isFinite)) {
    publish("ctHvPackPower", packVoltage * batteryCurrent / 1000, Math.min(packVoltageAt, batteryCurrentAt), "derived:ctHvPackVoltage*ctHvCurrent", "Johdettu lohkojännitteiden summasta × akkuvirrasta");
  }
}

function isConnectionLossError(error) {
  return /socket|katke|suljettu|not connected|ei BLE-yhteyttä|replay-yhteys katkesi/i.test(String(error?.message || error || ""));
}

function pollingQualitySnapshot() {
  const snapshot = state.pollScheduler?.snapshot?.() || null;
  if (snapshot) state.lastPollSnapshot = snapshot;
  return snapshot || state.lastPollSnapshot;
}

function renderPollHealth() {
  const element = $("#pollHealth");
  if (!element) return;
  const snapshot = pollingQualitySnapshot();
  if (!snapshot || state.client?.binaryQuicklynks) {
    setNotice("pollHealth", "");
    return;
  }
  const summary = snapshot.summary;
  const latency = Number.isFinite(summary.latencyEwmaMs) ? `${Math.round(summary.latencyEwmaMs)} ms` : "odottaa näytteitä";
  const loss = summary.attempts ? `${summary.lossPercent.toFixed(1).replace(".", ",")} %` : "0 %";
  const type = summary.attempts >= 5 && (summary.lossPercent > 10 || summary.maxMissStreak >= 3) ? "warning" : "";
  setNotice(
    "pollHealth",
    `Mukautuva live-pollaus: ${summary.sourceCount} pyyntölähdettä · onnistuneet ${summary.hits}/${summary.attempts} · välimuisti ${summary.cacheHits || 0} · mittauskato ${loss} · keskimääräinen vaste ${latency}`,
    type
  );
}

async function startLive() {
  if (state.injectorTestRunning) return toast("Viimeistele suutintesti ennen live-lukua");
  if (!requireConnection() || state.liveActive) return;
  const liveClient = state.client;
  state.liveActive = true;
  const runId = ++state.liveRunId;
  setLiveButtonState(true);
  setNotice("supportNotice", "Selvitetään ECU:n tukemia standardoituja PID-arvoja…");
  try {
    const supportedPids = await liveClient.readSupportedPids();
    state.supportedPids = supportedPids;
    const readable = activeMetricDefinitions().filter(def =>
      !def.derived && (supportedPids.has(def.pid) || supportedPids.has(def.id))
    );
    const toyotaLiveCount = readable.filter(def => def.toyotaCommand).length;
    renderMetrics();
    setNotice(
      "supportNotice",
      liveClient.binaryQuicklynks
        ? `${readable.length} varmennettua standardiarvoa luetaan Quicklynksin pääkehyksestä sekä Mode 01 -ryhmistä. Toyota 21 -kyselyitä ei lähetetä Quicklynksin suljetulle binäärikanavalle, joten ${isCt200h() ? "CT:n hybridimittarit vaativat vLinker MC+:n tai muun ASCII-ELM327:n" : "IS220d:n valmistajakohtaiset arvot eivät ole tällä kuljetuksella käytettävissä"}.`
        : toyotaLiveCount
          ? `${readable.length} arvoa on tuettu. Näistä ${toyotaLiveCount} on tässä yhteydessä rakenteellisesti varmennettuja ${isCt200h() ? "CT 200h -hybridimittareita osoitteesta 7E2/7EA" : "IS220d Toyota Read Data -arvoja komennoista 217E, 217F ja 212C"}. Lähdekohtainen prioriteettipollaus lukee saman vastauksen vain kerran ja jakaa sen kaikille ryhmän mittareille.`
          : `${readable.length} tämän näkymän standardoitua PID-arvoa on tuettu. Lähdekohtainen prioriteettipollaus painottaa nopeasti muuttuvia arvoja ja harventaa lämpötila-, jännite- ja tilatietoja.`,
      ""
    );
    state.pollScheduler = liveClient.binaryQuicklynks
      ? null
      : new AdaptivePollScheduler(readable, { supportedPids, maximumBatchSources: 8 });
    state.lastPollSnapshot = null;
    if (state.pollScheduler && !state.pollScheduler.hasSources()) throw new Error("Tuetuista mittareista ei voitu muodostaa turvallista pollausjonoa");
    const liveScheduler = state.pollScheduler;
    renderPollHealth();
    while (state.liveActive && state.connected && runId === state.liveRunId) {
      const cycleRaw = {};
      let cycleError = "";
      if (liveClient.binaryQuicklynks) {
        for (const def of readable) {
          if (!state.liveActive || runId !== state.liveRunId) break;
          try {
            const result = await liveClient.readPid(def);
            applyMetricResult(def, result, cycleRaw);
            if (result.warning) cycleError = result.warning;
          } catch (error) {
            cycleError = error.message;
            appendTerminal(`${formatClock(Date.now())}  ! ${error.message}`);
            if (isConnectionLossError(error)) {
              state.liveActive = false;
              setConnectionStatus("error", "Yhteys katkesi");
              scheduleManagedReconnect(error.message);
              break;
            }
          }
          await delay(35);
        }
        const optional = typeof liveClient.pollOptionalStandardMetrics === "function"
          ? await liveClient.pollOptionalStandardMetrics()
          : null;
        let discovered = false;
        for (const result of optional?.results || []) {
          if (!supportedPids.has(result.definition.id)) {
            supportedPids.add(result.definition.id);
            discovered = true;
          }
          applyMetricResult(result.definition, result, cycleRaw);
        }
        if (discovered) renderMetrics();
      } else {
        const sources = liveScheduler.claimDueBatch();
        if (!sources.length) {
          await delay(liveScheduler.nextDelayMs(Date.now(), 120));
          continue;
        }
        for (const source of sources) {
          if (!state.liveActive || runId !== state.liveRunId) break;
          const startedAt = Date.now();
          try {
            const timeoutMs = liveScheduler.recommendedTimeoutMs(source.key);
            const groupResult = await liveClient.readMetricGroup(source.definitions, timeoutMs);
            for (const result of groupResult.results) applyMetricResult(result.definition, result, cycleRaw);
            if (groupResult.missingMetricIds.length) {
              cycleError = `${source.command}: puuttuvat arvot ${groupResult.missingMetricIds.join(", ")}`;
            }
            if (groupResult.transportAttempted === false) liveScheduler.recordCacheHit(source.key);
            else liveScheduler.recordSuccess(source.key, Date.now() - startedAt);
          } catch (error) {
            cycleError = error.message;
            const raw = error.raw || error.partialRaw || "";
            const outcome = error.code === "IMPLAUSIBLE_VALUE"
              ? { kind: "implausible-value", retryable: false, description: error.message }
              : classifyDiagnosticResponse({
                raw,
                error: error.message,
                expectedService: source.service
              });
            liveScheduler.recordFailure(source.key, {
              responseClass: outcome.kind,
              retryable: outcome.retryable,
              description: outcome.description,
              error: error.message
            }, Date.now() - startedAt);
            appendTerminal(`${formatClock(Date.now())}  ! ${source.command}: ${error.message}`);
            if (isConnectionLossError(error) || outcome.kind === "disconnected") {
              state.liveActive = false;
              setConnectionStatus("error", "Yhteys katkesi");
              scheduleManagedReconnect(error.message);
              break;
            }
          }
          await delay(12);
        }
        renderPollHealth();
      }
      updateDerivedMetrics(cycleRaw);
      updateDriveValues();
      if (state.recording && state.liveActive) {
        await addRecordingSample(cycleRaw, cycleError);
        await maybeRunQuicklynksResearchProbe();
      }
      await delay(liveClient.binaryQuicklynks ? 120 : liveScheduler.nextDelayMs(Date.now(), 120));
    }
  } catch (error) {
    setNotice("supportNotice", error.message, "error");
    state.liveActive = false;
    if (isConnectionLossError(error)) {
      setConnectionStatus("error", "Yhteys katkesi");
      scheduleManagedReconnect(error.message);
    }
  } finally {
    if (runId === state.liveRunId) {
      setLiveButtonState(false);
      state.liveActive = false;
      renderPollHealth();
    }
  }
}

async function stopLive() {
  state.liveActive = false;
  state.liveRunId++;
  state.pollScheduler = null;
  renderPollHealth();
  setLiveButtonState(false);
}

function updateMetricCard(def) {
  const card = $(`#metric-${def.id}`);
  if (!card) return;
  const value = state.values[def.id];
  card.querySelector(".metric-value").textContent = Number.isFinite(value) ? formatValue(def, value) : "–";
  const source = state.valueSources[def.id];
  card.querySelector(".metric-time").textContent = `Päivitetty ${formatClock(state.updatedAt[def.id])}${source ? ` · ${source}` : ""}`;
}

function updateLiveChart() {
  const id = $("#liveChartMetric").value || "rpm";
  const def = PID_BY_ID[id] || PID_BY_ID.rpm;
  drawLineChart($("#liveChart"), state.histories[id] || [], { unit: def.unit });
}

function updateDriveValues() {
  $("#driveRpm").textContent = Number.isFinite(state.values.rpm) ? Math.round(state.values.rpm) : "–";
  $("#driveSpeed").textContent = Number.isFinite(state.values.speed) ? Math.round(state.values.speed) : "–";
  const baseItems = new Set(isCt200h()
    ? ["ctHvSoc", "ctHvCurrent", "ctHvPackPower", "ctHvPackVoltage", "ctHvBlockDelta", "ctHvTemperatureMax"]
    : ["coolant", "load", "adapterVoltage", "voltage", "quicklynksField80", "maf", "map", "boostPressure", "railPressure"]);
  const candidates = isCt200h()
    ? [
        "ctHvSoc", "ctHvCurrent", "ctHvPackPower", "ctHvPackVoltage", "ctHvBlockMin", "ctHvBlockMax",
        "ctHvBlockDelta", "ctHvBlockMinIndex", "ctHvBlockMaxIndex", "ctHvTemperature1", "ctHvTemperature2",
        "ctHvTemperature3", "ctHvTemperatureMax", "ctHvTemperatureDelta", "ctHvResistanceMax", "ctHvResistanceDelta",
        "ctHvChargeLimit", "ctHvDischargeLimit", "ctHvDeltaSoc", "voltage", "coolant"
      ]
    : [
        "coolant", "load", "adapterVoltage", "voltage", "quicklynksField80", "maf", "map",
        "boostPressure", "boostPressureTarget", "boostPressureActual", "railPressure", "railPressureTarget",
        "railPressureActual", "toyotaRailPressure", "egrPositionTarget", "egrPositionActual",
        "dpnrDifferentialPressure", "dpnrSulfurRegenerationState", "dpnrPmRegenerationState",
        "dpnrInletTemperature", "dpnrOutletTemperature", "injectionFeedback1", "injectionFeedback2",
        "injectionFeedback3", "injectionFeedback4", "toyotaFuelTemperature", "toyotaInjectionTiming",
        "dpfRegenerationActive", "dpfDifferentialPressure", "dpfInletTemperature", "dpfOutletTemperature",
        "dieselLambdaB1S1"
      ];
  const items = candidates.filter(id => baseItems.has(id) || Number.isFinite(state.values[id]));
  $("#driveSecondary").innerHTML = items.map(id => {
    const def = PID_BY_ID[id];
    const value = state.values[id];
    return `<div><span>${escapeHtml(def.short)}</span><strong>${Number.isFinite(value) ? `${formatValue(def, value)} ${escapeHtml(def.unit)}` : "–"}</strong></div>`;
  }).join("");
  const banner = $("#dpfRegenBanner");
  const regenState = $("#dpfRegenState");
  if (isCt200h()) {
    const soc = state.values.ctHvSoc;
    const delta = state.values.ctHvBlockDelta;
    const maxTemp = state.values.ctHvTemperatureMax;
    const available = [soc, delta, maxTemp].some(Number.isFinite);
    const attention = Number.isFinite(delta) && delta >= 0.5 || Number.isFinite(maxTemp) && maxTemp >= 55;
    banner.className = `dpf-banner ${available ? (attention ? "active" : "inactive") : "unavailable"}`;
    regenState.textContent = available
      ? [
          Number.isFinite(soc) ? `SOC ${soc.toFixed(1).replace(".", ",")} %` : "",
          Number.isFinite(delta) ? `lohkoero ${delta.toFixed(3).replace(".", ",")} V` : "",
          Number.isFinite(maxTemp) ? `Tmax ${maxTemp.toFixed(1).replace(".", ",")} °C` : ""
        ].filter(Boolean).join(" · ")
      : "Ei hyväksyttyä CT-hybridivastausta";
    return;
  }
  const manufacturerRegeneration = state.values.dpnrRegenerationActive;
  const standardRegeneration = state.values.dpfRegenerationActive;
  const regeneration = Number.isFinite(manufacturerRegeneration) ? manufacturerRegeneration : standardRegeneration;
  const regenerationSource = Number.isFinite(manufacturerRegeneration)
    ? "Techstream 21 7E"
    : Number.isFinite(standardRegeneration)
      ? "standardi PID 8B"
      : "";
  banner.className = `dpf-banner ${Number.isFinite(regeneration) ? (regeneration ? "active" : "inactive") : "unavailable"}`;
  regenState.textContent = Number.isFinite(regeneration)
    ? `${regeneration ? "Käynnissä" : "Ei käynnissä"} · ${regenerationSource}`
    : "Ei hyväksyttyä DPNR/DPF-vastausta";
  renderDpnrMonitor();
}

async function startRecording() {
  if (state.injectorTestRunning) return toast("Viimeistele suutintesti ennen koeajotallennusta");
  if (!requireConnection()) return;
  if (state.recording) { await stopRecording(); return; }
  const now = Date.now();
  state.recording = {
    id: `drive-${now}`,
    schemaVersion: 5,
    appVersion: APP_VERSION,
    startedAt: now,
    endedAt: null,
    vehicle: activeVehicleName(),
    vehicleKey: state.vehicleKey,
    vehicleProfileVersion: activeVehicleProfile()?.profileVersion || "generic-eobd",
    adapter: state.client.adapterIdentity,
    protocol: state.client.protocolIdentity,
    samples: [],
    markers: [],
    note: "",
    quicklynksResearch: state.client.binaryQuicklynks
      ? createQuicklynksResearchState(now)
      : null
  };
  setRecordingButtonState(true);
  $("#markerButton").disabled = false;
  $("#recordingState").textContent = "Käynnissä";
  updateRecordingStatus();
  state.recordingTimer = setInterval(updateRecordingStatus, 1000);
  await setKeepAwake($("#keepAwake").checked || $("#dpnrKeepAwake")?.checked);
  if (!state.liveActive) startLive();
  toast("Koeajoloki käynnistyi");
}

async function addRecordingSample(raw, error = "") {
  if (!state.recording) return;
  const timestamp = Date.now();
  const valueAgesMs = {};
  for (const [id, updatedAt] of Object.entries(state.updatedAt)) {
    if (Number.isFinite(updatedAt)) valueAgesMs[id] = Math.max(0, timestamp - updatedAt);
  }
  state.recording.samples.push({
    timestamp,
    values: { ...state.values },
    valueAgesMs,
    pollQuality: pollingQualitySnapshot()?.summary || null,
    raw: { ...raw },
    rawLatest: { ...state.rawValues },
    connected: state.connected,
    error
  });
  updateRecordingStatus();
  if (state.recording.samples.length % 10 === 0) await SessionStore.save(state.recording);
}

async function maybeRunQuicklynksResearchProbe() {
  const recording = state.recording;
  const research = recording?.quicklynksResearch;
  if (!recording || !research || !state.client?.binaryQuicklynks || !state.connected) return;
  if (research.completedAt || Date.now() < Number(research.nextProbeAt || 0)) return;

  const probeIndex = Number(research.nextProbeIndex || 0);
  const probe = QUICKLYNKS_RESEARCH_PROBES[probeIndex];
  if (!probe) {
    research.completedAt = Date.now();
    research.endedAt = research.completedAt;
    await SessionStore.save(recording);
    return;
  }

  const event = await state.client.probeResearchIdentifier(probe, research.timeoutMs);
  event.sequence = probeIndex + 1;
  event.context = {
    timestamp: Date.now(),
    connected: state.connected,
    values: { ...state.values },
    valueAgesMs: Object.fromEntries(
      Object.entries(state.updatedAt)
        .filter(([, updatedAt]) => Number.isFinite(updatedAt))
        .map(([id, updatedAt]) => [id, Math.max(0, Date.now() - updatedAt)])
    ),
    liveFrameHex: state.client.lastRealtime?.rawHex || ""
  };
  research.events.push(event);
  research.nextProbeIndex = probeIndex + 1;
  research.nextProbeAt = Date.now() + Number(research.intervalMs || 10000);
  if (research.nextProbeIndex >= QUICKLYNKS_RESEARCH_PROBES.length) {
    research.completedAt = Date.now();
    research.endedAt = research.completedAt;
  }
  await SessionStore.save(recording);
}

async function addMarker() {
  if (!state.recording) return;
  const timestamp = Date.now();
  const count = state.recording.markers.length + 1;
  const label = `Tapahtuma ${count}`;
  const valueAgesMs = Object.fromEntries(
    Object.entries(state.updatedAt)
      .filter(([, updatedAt]) => Number.isFinite(updatedAt))
      .map(([id, updatedAt]) => [id, Math.max(0, timestamp - updatedAt)])
  );
  state.recording.markers.push({ timestamp, label });
  state.recording.samples.push({
    timestamp,
    values: { ...state.values },
    valueAgesMs,
    pollQuality: pollingQualitySnapshot()?.summary || null,
    raw: {},
    connected: state.connected,
    marker: label,
    error: ""
  });
  await SessionStore.save(state.recording);
  toast(`${label} merkitty`);
}

async function stopRecording(note = "") {
  if (!state.recording) return;
  clearInterval(state.recordingTimer);
  state.recordingTimer = null;
  state.recording.endedAt = Date.now();
  if (state.recording.quicklynksResearch) {
    state.recording.quicklynksResearch.endedAt = state.recording.endedAt;
  }
  state.recording.pollingSummary = pollingQualitySnapshot()?.summary || null;
  if (note) state.recording.note = note;
  const completed = state.recording;
  state.recording = null;
  await SessionStore.save(completed);
  await setKeepAwake(false);
  setRecordingButtonState(false);
  $("#markerButton").disabled = true;
  $("#recordingState").textContent = "Ei käynnissä";
  $("#recordingDuration").textContent = "00:00";
  $("#recordingSamples").textContent = "0";
  await renderSessionList();
  toast("Koeajoloki tallennettu");
}

function updateRecordingStatus() {
  if (!state.recording) return;
  $("#recordingDuration").textContent = formatElapsed(Date.now() - state.recording.startedAt);
  $("#recordingSamples").textContent = String(state.recording.samples.length);
}

async function setKeepAwake(enabled) {
  try {
    if (globalThis.obd?.setKeepScreenOn) globalThis.obd.setKeepScreenOn(Boolean(enabled));
    if (enabled && navigator.wakeLock?.request) state.wakeLock = await navigator.wakeLock.request("screen");
    if (!enabled && state.wakeLock) { await state.wakeLock.release(); state.wakeLock = null; }
  } catch {}
}

async function renderSessionList() {
  const root = $("#sessionList");
  const sessions = await SessionStore.list();
  root.innerHTML = "";
  root.className = sessions.length ? "session-list" : "session-list empty-state";
  $("#sessionDetail").classList.add("hidden");
  if (!sessions.length) { root.textContent = "Ei tallennettuja ajoja"; return; }
  for (const session of sessions) {
    const item = document.createElement("button");
    item.className = "session-item";
    item.type = "button";
    const duration = (session.endedAt || session.startedAt) - session.startedAt;
    item.innerHTML = `<div><strong>${formatDateTime(session.startedAt)}</strong><p>${formatElapsed(duration)} · ${session.samples?.length || 0} näytettä · ${session.markers?.length || 0} merkintää</p></div><span class="chevron">›</span>`;
    item.addEventListener("click", () => showSession(session.id));
    root.append(item);
  }
}

async function showSession(id) {
  const session = await SessionStore.get(id);
  if (!session) return;
  state.selectedSession = session;
  $("#sessionList").classList.add("hidden");
  const root = $("#sessionDetail");
  root.classList.remove("hidden");
  const stats = calculateSessionStats(session);
  const duration = (session.endedAt || session.startedAt) - session.startedAt;
  const availableDefs = PID_DEFINITIONS.filter(def => stats[def.id]);
  root.innerHTML = `
    <div class="detail-header"><button id="backToSessions" class="secondary compact" type="button">← Takaisin</button><div><h3>${formatDateTime(session.startedAt)}</h3><span class="hint">${formatElapsed(duration)} · ${session.samples?.length || 0} näytettä</span></div></div>
    <div class="stats-grid">
      <div class="stat"><span>RPM max</span><strong>${stats.rpm ? Math.round(stats.rpm.max) : "–"}</strong></div>
      <div class="stat"><span>Nopeus max</span><strong>${stats.speed ? `${Math.round(stats.speed.max)} km/h` : "–"}</strong></div>
      <div class="stat"><span>Neste max</span><strong>${stats.coolant ? `${Math.round(stats.coolant.max)} °C` : "–"}</strong></div>
    </div>
    <div class="card chart-card"><div class="chart-header"><label for="savedChartMetric">Signaali</label><select id="savedChartMetric">${availableDefs.map(def => `<option value="${def.id}">${escapeHtml(def.name)}</option>`).join("")}</select></div><canvas id="savedChart" height="230"></canvas>${session.markers?.length ? `<ol class="marker-list">${session.markers.map(marker => `<li>${formatClock(marker.timestamp)} · ${escapeHtml(marker.label)}</li>`).join("")}</ol>` : ""}</div>
    <div class="card analysis-card">
      <label for="sessionNote">Oire tai havainto tekoälylle</label>
      <textarea id="sessionNote" rows="3" placeholder="Esim. tärinä ylämäessä 6. vaihteella noin 1 300 rpm">${escapeHtml(session.note || "")}</textarea>
      <p class="hint">Kuvaus tallennetaan ajon tietoihin ja liitetään analyysipyyntöön. Älä kirjoita henkilötietoja.</p>
      <button id="shareSessionAi" class="primary full" type="button">Jaa tekoälyanalyysiin</button>
    </div>
    <div class="button-row"><button id="exportSession" class="secondary" type="button">Tallenna CSV</button><button id="deleteSession" class="danger" type="button">Poista…</button></div>`;
  $("#backToSessions").addEventListener("click", () => { root.classList.add("hidden"); $("#sessionList").classList.remove("hidden"); });
  $("#savedChartMetric").addEventListener("change", drawSavedChart);
  $("#sessionNote").addEventListener("change", async event => {
    session.note = event.target.value.trim();
    await SessionStore.save(session);
  });
  $("#shareSessionAi").addEventListener("click", shareSelectedSessionForAi);
  $("#exportSession").addEventListener("click", exportSelectedSession);
  $("#deleteSession").addEventListener("click", deleteSelectedSession);
  drawSavedChart();
}

function drawSavedChart() {
  const session = state.selectedSession;
  const id = $("#savedChartMetric")?.value;
  if (!session || !id) return;
  const def = PID_BY_ID[id];
  const points = (session.samples || []).map(sample => ({
    time: sample.timestamp,
    value: sessionMetricValue(session, sample, id)
  })).filter(point => Number.isFinite(point.value));
  const markers = (session.markers || []).map(marker => ({ time: marker.timestamp }));
  drawLineChart($("#savedChart"), points, { unit: def.unit, markers });
}

async function exportSelectedSession() {
  const session = state.selectedSession;
  if (!session) return;
  session.note = $("#sessionNote")?.value.trim() || session.note || "";
  session.schemaVersion = Math.max(5, Number(session.schemaVersion) || 0);
  session.appVersion ||= APP_VERSION;
  await SessionStore.save(session);
  const csv = sessionToCsv(session);
  const vehiclePrefix = /CT\s*200h|ZWA10/i.test(session.vehicle || "") ? "Lexus_CT200h_OBD" : "Lexus_IS220d_OBD";
  const filename = `${vehiclePrefix}_${new Date(session.startedAt).toISOString().replace(/[:.]/g, "-")}.csv`;
  try {
    if (nativeTransport.available() && globalThis.obd?.exportCsv) {
      const result = await nativeTransport.exportCsv(filename, csv);
      toast(result?.startsWith("content:") ? "CSV tallennettu Lataukset/Lexus OBD -kansioon" : "CSV tallennettu");
    } else {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  } catch (error) { toast(`CSV-vienti epäonnistui: ${error.message}`); }
}

async function shareSelectedSessionForAi() {
  const session = state.selectedSession;
  if (!session) return;
  session.note = $("#sessionNote")?.value.trim() || "";
  session.schemaVersion = Math.max(5, Number(session.schemaVersion) || 0);
  session.appVersion ||= APP_VERSION;
  await SessionStore.save(session);

  const hasResearch = Boolean(session.quicklynksResearch?.events?.length);
  const csv = hasResearch ? sessionToQuicklynksResearchCsv(session) : sessionToCsv(session);
  const prompt = hasResearch ? buildQuicklynksResearchAiPrompt(session) : buildAiAnalysisPrompt(session);
  const modelPrefix = /CT\s*200h|ZWA10/i.test(session.vehicle || "") ? "Lexus_CT200h" : "Lexus_IS220d";
  const prefix = hasResearch ? `${modelPrefix}_OBD_AI_PID` : `${modelPrefix}_OBD_AI`;
  const filename = `${prefix}_${new Date(session.startedAt).toISOString().replace(/[:.]/g, "-")}.csv`;

  try {
    if (nativeTransport.available() && globalThis.obd?.exportCsv && globalThis.obd?.shareCsv) {
      const uri = await nativeTransport.exportCsv(filename, csv);
      if (!uri?.startsWith("content:")) throw new Error("Android ei palauttanut jaettavaa tiedosto-osoitetta");
      await nativeTransport.shareCsv(uri, prompt, `${session.vehicle || "Lexus"} koeajodatan analyysi`, "text/csv");
      toast("Valitse tekoälysovellus jakovalikosta");
      return;
    }

    const file = new File([csv], filename, { type: "text/csv;charset=utf-8" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({
        title: `${session.vehicle || "Lexus"} koeajodatan analyysi`,
        text: prompt,
        files: [file]
      });
      return;
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    await navigator.clipboard?.writeText(prompt);
    toast("CSV tallennettu ja analyysipyyntö kopioitu leikepöydälle");
  } catch (error) {
    if (error?.name !== "AbortError") toast(`Jakaminen epäonnistui: ${error.message}`);
  }
}

async function deleteSelectedSession() {
  const session = state.selectedSession;
  if (!session) return;
  if (!await confirmAction("Poista tallennettu ajo?", "Tätä toimintoa ei voi perua.")) return;
  await SessionStore.remove(session.id);
  state.selectedSession = null;
  await renderSessionList();
}

async function runDiagnosticCommand(command, timeout = 4000) {
  try {
    const raw = await state.client.command(command, timeout);
    return { ok: true, raw, error: "" };
  } catch (error) {
    appendElmDiagnosticLine(`${formatClock(Date.now())} TESTI ${command} EPÄONNISTUI · ${error.message}`);
    return { ok: false, raw: error.raw || error.partialRaw || "", error: error.message };
  }
}

class DiagnosticCancelledError extends Error {
  constructor() {
    super("Diagnostiikka keskeytettiin käyttäjän pyynnöstä");
    this.name = "DiagnosticCancelledError";
  }
}

function selectedDiagnosticDeviceMeta() {
  const option = $("#deviceSelect")?.selectedOptions?.[0];
  const profile = state.adapterProfile || selectedAdapterProfile();
  return {
    device: option?.textContent || state.elmDiagnosticDevice || "ei tietoa",
    name: profile.name || option?.dataset?.name || "ei tietoa",
    address: option?.dataset?.address || "ei tietoa",
    transport: $("#transportIdentity")?.textContent || selectedDeviceTransport(),
    transportKind: profile.transport,
    transportProfile: state.transportInfo?.transportProfile || "",
    adapterFamily: profile.adapterFamily,
    adapterProfileVersion: profile.profileVersion,
    selectedProtocol: $("#protocolSelect")?.selectedOptions?.[0]?.textContent || "ei tietoa",
    adapter: $("#adapterIdentity")?.textContent || state.client?.adapterIdentity || "ei tietoa",
    protocol: $("#protocolIdentity")?.textContent || state.client?.protocolIdentity || "ei tietoa",
    initialConnectionStrategy: state.client?.connectionStrategy || "ei löytynyt"
  };
}

function renderFullDiagnosticProgress(message = "") {
  const run = state.diagnosticRun;
  const count = run?.results?.length || 0;
  const planned = run?.plannedSteps || 100;
  const percent = run?.endedAt ? 100 : Math.min(99, Math.round(count / planned * 100));
  const progress = $("#diagnosticProgressBar");
  if (progress) progress.style.width = `${percent}%`;
  const text = $("#diagnosticProgressText");
  if (text) text.textContent = message || (run ? `${count} vaihetta suoritettu · ${percent} %` : "Ei ajettu");
  const countElement = $("#diagnosticResultCounts");
  if (countElement && run) {
    const summary = summarizeFullDiagnostic(run);
    countElement.textContent = `PASS ${summary.passed} · WARN ${summary.warned} · FAIL ${summary.failed} · SKIP ${summary.skipped}`;
  }
}

function appendDiagnosticResult(step, raw, error, startedAt, evaluationOverride = null) {
  const run = state.diagnosticRun;
  const evaluation = evaluationOverride || evaluateFullDiagnosticStep(step, raw, error);
  const result = {
    sequence: run.results.length + 1,
    phase: step.phase || run.currentPhase || "Muu",
    label: step.label || step.command || "Sisäinen vaihe",
    command: String(step.command || "").replace(/\s+/g, "").toUpperCase(),
    requestHeader: step.requestHeader || "",
    expected: step.expected || "optional",
    connectionStrategy: step.connectionStrategy || "",
    queryForm: step.queryForm || "",
    profileProbeId: step.profileProbeId || "",
    evidence: step.evidence || "",
    decoder: step.decoder || "",
    toyotaIdentifier: Number.isInteger(step.toyotaIdentifier) ? step.toyotaIdentifier : null,
    timeoutMs: step.timeoutMs ?? "",
    startedAt,
    durationMs: Math.max(0, Date.now() - startedAt),
    raw: String(raw || ""),
    error: String(error || ""),
    ...evaluation
  };
  run.results.push(result);
  appendElmDiagnosticLine(`${formatClock(Date.now())} DIAG #${String(result.sequence).padStart(3, "0")} ${result.status} · ${result.phase} · ${result.label} · ${result.durationMs} ms`);
  renderFullDiagnosticProgress(`${result.phase}: ${result.label} · ${result.status}`);
  return result;
}

function appendSkippedDiagnosticStep(step, reason) {
  return appendDiagnosticResult(step, "", reason, Date.now(), {
    status: "SKIP",
    interpretation: reason,
    validResponse: false,
    timeout: false,
    unsupported: false,
    cleaned: ""
  });
}

async function executeFullDiagnosticStep(step, options = {}) {
  if (state.diagnosticAbortRequested && !options.force) throw new DiagnosticCancelledError();
  const timeoutMs = step.timeoutMs ?? 4500;
  const prepared = { ...step, timeoutMs };
  const startedAt = Date.now();
  let raw = "";
  let error = "";
  try {
    raw = await state.client.command(step.command || "", timeoutMs);
  } catch (caught) {
    raw = caught?.raw || caught?.partialRaw || "";
    error = caught?.message || String(caught);
  }
  return appendDiagnosticResult(prepared, raw, error, startedAt);
}

function toyotaDiagnosticStep(probe, queryForm, timeoutMs = 12000) {
  const command = queryForm === "raw-single-frame" ? probe.rawCommand : probe.command;
  if (!isProfileReadOnlyCommand(command, probe.vehicleKey || state.vehicleKey)) {
    throw new Error(`Sisäinen turvallisuussallintalista esti Toyota-komennon ${command}`);
  }
  return {
    command,
    expected: "toyotaReadData",
    requestService: probe.service,
    positivePrefix: probe.expectedResponsePrefix,
    toyotaIdentifier: probe.identifier,
    label: `Toyota ${probe.command} · ${probe.label}`,
    requestHeader: probe.requestHeader,
    responseHeader: probe.responseHeader,
    profileProbeId: probe.id,
    evidence: probe.evidence,
    decoder: probe.decoder,
    vehicleKey: probe.vehicleKey || state.vehicleKey,
    connectionStrategy: `toyota-${queryForm}`,
    queryForm,
    timeoutMs
  };
}

function toyotaProbeResponded(run, identifier) {
  return run.results.some(result =>
    result.expected === "toyotaReadData" &&
    result.toyotaIdentifier === identifier &&
    result.validResponse
  );
}

async function runFullDiagnosticSteps(phase, steps, options = {}) {
  state.diagnosticRun.currentPhase = phase;
  for (const step of steps) {
    await executeFullDiagnosticStep({ phase, ...step }, options);
    if (step.pauseAfterMs) await delay(step.pauseAfterMs);
  }
}

async function runFullDiagnosticDelay(phase, label, waitMs, options = {}) {
  if (state.diagnosticAbortRequested && !options.force) throw new DiagnosticCancelledError();
  state.diagnosticRun.currentPhase = phase;
  const startedAt = Date.now();
  await delay(Math.max(0, Number(waitMs) || 0));
  return appendDiagnosticResult({ phase, label, command: "", expected: "delay", timeoutMs: waitMs }, "", "", startedAt, {
    status: "PASS",
    interpretation: `Pakotettu ${waitMs} ms asettumisviive toteutui`,
    validResponse: true,
    timeout: false,
    unsupported: false,
    cleaned: ""
  });
}

async function runDiagnosticProbeSeries({ phase, strategy, label, attempts, timeoutMs, pauseMs, requestHeader = "" }) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = await executeFullDiagnosticStep({
      phase,
      ...diagnosticModeStep("0100", 0x00, `${label} ${attempt}/${attempts}`, requestHeader, timeoutMs),
      connectionStrategy: strategy
    });
    if (result.validResponse) {
      state.diagnosticRun.connectionStrategy = strategy;
      state.diagnosticRun.searchStoppedOnFirstResponse = true;
      return result;
    }
    if (attempt < attempts) await runFullDiagnosticDelay(phase, `Odotus ennen yritystä ${attempt + 1}/${attempts}`, pauseMs);
  }
  return null;
}

function diagnosticModeStep(command, pid, label, requestHeader, timeoutMs = 6500) {
  return { command, pid, responseMode: 0x41, expected: "modePid", label, requestHeader, timeoutMs };
}

function diagnosticHasValid(run, command, requestHeader = "") {
  return run.results.some(result =>
    result.command === command &&
    result.validResponse &&
    (!requestHeader || result.requestHeader === requestHeader)
  );
}

function finishFullDiagnosticUi(run) {
  run.summary = summarizeFullDiagnostic(run);
  run.ecuSurvey = ecuSurveySnapshotFromDiagnosticRun(run);
  const surveyHistory = recordEcuSurveySnapshot(run.ecuSurvey);
  run.ecuSurveyHistory = {
    persisted: surveyHistory.persisted,
    error: surveyHistory.error,
    storedRuns: surveyHistory.snapshots.length,
    repeatability: surveyHistory.repeatability
  };
  state.adapterCapabilities = run.summary.adapterCapabilities;
  const baseReport = buildFullDiagnosticReport(run);
  state.fullDiagnosticReport = `${baseReport}\n\n${buildEcuSurveyTextReport(run.ecuSurvey, surveyHistory)}`;
  const summary = run.summary;
  const status = $("#diagnosticSummary");
  const diagnosticProbeCount = summary.toyotaProbeSummaries.length;
  if (status) {
    status.textContent = summary.toyotaResponseCount
      ? `Toyota Read Data toimii: ${summary.toyotaResponseCount}/${diagnosticProbeCount} rakenteellisesti varmennettua vastausta. Raportissa ovat raakadata, kyselymuoto ja puretut ajoneuvokohtaiset arvot.`
      : summary.validObdResponseCount
        ? `Tavallista ECU-dataa löytyi, mutta valitun ${activeVehicleName()} -profiilin Toyota-lukupyynnöt eivät vastanneet.`
        : `ELM-taso ${summary.adapterResponded ? "vastasi" : "ei vastannut"}, mutta kelvollista ECU- tai Toyota-vastausta ei löytynyt. Raportti sisältää kaikki vaihtoehtoiset testit.`;
    status.className = `inline-message ${summary.toyotaResponseCount || summary.validObdResponseCount ? "" : "warning"}`.trim();
  }
  $("#diagnosticReportActions")?.classList.remove("hidden");
  renderAdapterSupport();
  renderFullDiagnosticProgress(run.cancelled ? "Keskeytetty hallitusti · raportti valmis" : "Valmis · raportti muodostettu");
  renderElmDiagnostics();
}

async function restoreAfterFullDiagnostic(run) {
  if (!state.connected || !state.client) return;
  const summaryBeforeRestore = summarizeFullDiagnostic(run);
  const header = summaryBeforeRestore.engineHeader || "7DF";
  const restoreSteps = [
    { command: "ATSP6", expected: "ok", label: "Palauta CAN 11/500" },
    { command: "ATCAF1", expected: "ok", label: "Palauta CAN-automaattimuotoilu" },
    { command: "ATCFC1", expected: "ok", label: "Palauta flow control" },
    { command: "ATAL", expected: "ok", label: "Salli pitkät vastaukset" },
    { command: "ATAT1", expected: "ok", label: "Palauta mukautuva ajoitus" },
    { command: "ATST32", expected: "ok", label: "Palauta normaali ELM-aikakatkaisu" },
    { command: "ATH0", expected: "ok", label: "Piilota CAN-otsakkeet live-datalta" },
    { command: "ATS0", expected: "ok", label: "Poista välilyönnit live-datalta" },
    { command: `ATSH${header}`, expected: "ok", label: `Palauta pyyntöosoite ${header}`, requestHeader: header },
    diagnosticModeStep("0100", 0x00, "Varmista ECU-yhteys palautuksen jälkeen", header, 8500)
  ];
  try {
    await runFullDiagnosticSteps("Palautus", restoreSteps, { force: true });
  } catch (error) {
    appendDiagnosticResult({ phase: "Palautus", label: "Palautuksen sisäinen virhe" }, "", error.message, Date.now(), {
      status: "FAIL",
      interpretation: error.message,
      validResponse: false,
      timeout: false,
      unsupported: false,
      cleaned: ""
    });
  }
  const finalProbe = [...run.results].reverse().find(result => result.phase === "Palautus" && result.command === "0100");
  state.ecuConnected = Boolean(finalProbe?.validResponse);
  state.client.ecuConnected = state.ecuConnected;
  if (state.ecuConnected) {
    try { state.supportedPids = new Set(state.client.supportedPids || []); } catch {}
  } else {
    state.supportedPids = null;
  }
  setConnectionStage("ecu", state.ecuConnected ? "connected" : "error", state.ecuConnected
    ? `Moottori-ECU vastasi palautuksen jälkeen osoitteella ${header}`
    : "ECU ei vastannut palautuksen jälkeiseen varmennukseen");
  setConnectionStatus(state.ecuConnected ? "online" : "connecting", state.ecuConnected ? "ECU yhdistetty" : "ELM yhdistetty · ECU ei vastaa");
}

async function runGekoDiagnostic() {
  if (!requireConnection(false)) return;
  if (state.quicklynks || !(state.client instanceof Elm327Client)) {
    setNotice("gekoTestResult", "Laaja testi vaatii ASCII-ELM327-yhteyden. Quicklynksin FFF6-binäärikanavaa se ei muuta.", "warning");
    return;
  }
  if (state.diagnosticRunning) return;
  if (state.injectorTestRunning) {
    setNotice("gekoTestResult", "Keskeytä tai viimeistele suutintesti ennen laajaa diagnostiikkaa.", "warning");
    return;
  }
  if (state.recording) {
    setNotice("gekoTestResult", "Lopeta koeajotallennus ennen laajaa diagnostiikkaa.", "warning");
    return;
  }
  if (state.liveActive) await stopLive();

  const diagnosticVehicleKey = state.vehicleKey;
  const diagnosticProfile = getVehicleProfile(diagnosticVehicleKey);
  const diagnosticProbes = getVehicleReadDataProbes(diagnosticVehicleKey);
  const toyotaRequestHeader = diagnosticProbes[0]?.requestHeader || "7E0";
  const toyotaResponseHeader = diagnosticProbes[0]?.responseHeader || "7E8";

  const button = $("#runGekoTest");
  const cancelButton = $("#cancelGekoTest");
  state.diagnosticRunning = true;
  state.diagnosticAbortRequested = false;
  state.fullDiagnosticReport = "";
  state.diagnosticKind = "elm";
  state.elmDiagnosticLines = [];
  state.elmDiagnosticStartedAt = Date.now();
  const device = selectedDiagnosticDeviceMeta();
  state.diagnosticRun = {
    kind: "elm",
    schemaVersion: 3,
    startedAt: Date.now(),
    endedAt: null,
    cancelled: false,
    plannedSteps: 170,
    currentPhase: "Valmistelu",
    results: [],
    meta: {
      appVersion: APP_VERSION,
      reportId: createDiagnosticReportId("ELM", Date.now()),
      vehicle: activeVehicleName(),
      vehicleKey: diagnosticVehicleKey,
      vehicleProfileVersion: diagnosticProfile?.profileVersion || "generic-eobd",
      engineRunningDeclared: declaredEngineRunning("diagnosticEngineState"),
      note: $("#diagnosticNote")?.value?.trim() || "",
      userAgent: navigator.userAgent,
      ...device
    }
  };
  button.disabled = true;
  button.textContent = "vLinker / ELM + Toyota -testi käynnissä…";
  cancelButton.disabled = false;
  $("#diagnosticReportActions")?.classList.add("hidden");
  $("#diagnosticSummary")?.classList.add("hidden");
  state.toyotaProbeStatus = "odottaa perustestiä";
  appendElmDiagnosticLine(`${formatClock(Date.now())} ===== AUTOMAATTINEN LAAJA ELM/CAN-DIAGNOSTIIKKA ALKAA =====`);
  setNotice("gekoTestResult", "Testi jatkaa automaattisesti myös NO DATA- ja aikakatkaisutilanteissa. Älä käytä toista OBD-sovellusta testin aikana.");
  renderFullDiagnosticProgress("Valmistellaan testisarjaa…");
  setKeepAwake(true);

  try {
    let workingProbe = await executeFullDiagnosticStep({
      phase: "Nykytila ennen nollausta",
      ...diagnosticModeStep("0100", 0x00, "Kokeile nykyisiä ELM- ja protokolla-asetuksia", "", 12000),
      connectionStrategy: "current"
    });
    if (workingProbe.validResponse) {
      state.diagnosticRun.connectionStrategy = "current";
      state.diagnosticRun.searchStoppedOnFirstResponse = true;
    } else {
      workingProbe = null;
    }

    await runFullDiagnosticSteps("Adapteri", [
      ...VLINKER_CAPABILITY_PROBES
    ]);

    if (!workingProbe) {
      await runFullDiagnosticSteps("Hidas klooniturvallinen alustus", [
        { command: "ATZ", expected: "identity", label: "Kylmä ELM-nollaus", timeoutMs: 6500 }
      ]);
      await runFullDiagnosticDelay("Hidas klooniturvallinen alustus", "Odota ATZ-nollauksen valmistumista", 1800);
      await runFullDiagnosticSteps("Hidas klooniturvallinen alustus", [
        { command: "ATE0", expected: "ok", label: "Komentokaiku pois" },
        { command: "ATL0", expected: "ok", label: "Rivinvaihdot pois" },
        { command: "ATS0", expected: "ok", label: "Välilyönnit pois" },
        { command: "ATH0", expected: "ok", label: "Näyttöotsakkeet pois" },
        { command: "ATAL", expected: "ok", label: "Pitkät vastaukset sallitaan" },
        { command: "ATAT2", expected: "ok", label: "Aggressiivinen mukautuva ajoitus" },
        { command: "ATSTFF", expected: "ok", label: "ELM:n pisin vastausodotus" }
      ]);

      await runFullDiagnosticSteps("Pitkä automaattihaku ilman otsaketta", [
        { command: "ATSP0", expected: "ok", label: "Automaattinen protokollahaku ilman ATSH/ATCRA-asetuksia", timeoutMs: 5500 }
      ]);
      await runFullDiagnosticDelay("Pitkä automaattihaku ilman otsaketta", "Odota automaattiprotokollan asettumista", 1500);
      workingProbe = await runDiagnosticProbeSeries({
        phase: "Pitkä automaattihaku ilman otsaketta",
        strategy: "auto-sp0",
        label: "Automaattinen 0100",
        attempts: 4,
        timeoutMs: 20000,
        pauseMs: 5000
      });
    }

    if (!workingProbe) {
      await runFullDiagnosticSteps("Väliaikainen CAN 11/500", [
        { command: "ATTP6", expected: "ok", optional: true, label: "Kokeile protokollaa 6 tallentamatta sitä oletukseksi", timeoutMs: 5500 },
        { command: "ATAT2", expected: "ok", label: "Mukautuva ajoitus ATTP6-haulle" }
      ]);
      await runFullDiagnosticDelay("Väliaikainen CAN 11/500", "Odota ATTP6-protokollan asettumista", 1200);
      workingProbe = await runDiagnosticProbeSeries({
        phase: "Väliaikainen CAN 11/500",
        strategy: "try-can6",
        label: "ATTP6 0100",
        attempts: 2,
        timeoutMs: 15000,
        pauseMs: 2500
      });
    } else {
      appendSkippedDiagnosticStep({ phase: "Väliaikainen CAN 11/500", label: "ATTP6-yhteyspolku", command: "ATTP6", connectionStrategy: "try-can6" }, "Ohitettiin, koska kelvollinen 41 00 -vastaus löytyi jo");
    }

    if (!workingProbe) {
      await runFullDiagnosticSteps("Pakotettu CAN 11/500", [
        { command: "ATSP6", expected: "ok", label: "Aseta ISO 15765-4 CAN 11/500", timeoutMs: 5500 },
        { command: "ATAT1", expected: "ok", label: "Normaali mukautuva ajoitus ATSP6-haulle" }
      ]);
      await runFullDiagnosticDelay("Pakotettu CAN 11/500", "Odota ATSP6-protokollan asettumista", 1200);
      workingProbe = await runDiagnosticProbeSeries({
        phase: "Pakotettu CAN 11/500",
        strategy: "forced-can6",
        label: "ATSP6 0100",
        attempts: 3,
        timeoutMs: 15000,
        pauseMs: 2000
      });
    } else {
      appendSkippedDiagnosticStep({ phase: "Pakotettu CAN 11/500", label: "ATSP6-yhteyspolku", command: "ATSP6", connectionStrategy: "forced-can6" }, "Ohitettiin, koska kelvollinen 41 00 -vastaus löytyi jo");
    }

    await runFullDiagnosticSteps("Yhteystilan varmennus", [
      { command: "ATDP", expected: "optional", optional: true, label: "Toimivan tai viimeisen protokollan kuvaus" },
      { command: "ATDPN", expected: "optional", optional: true, label: "Toimivan tai viimeisen protokollan numero" },
      { command: "ATCS", expected: "optional", optional: true, label: "CAN-ohjaimen raportoima tila" }
    ]);

    await runFullDiagnosticSteps("CAN-lukutilan valmistelu", [
      ...(workingProbe ? [] : [{ command: "ATSP6", expected: "ok", label: "Varmista CAN 11/500 osoitehakua varten" }]),
      { command: "ATCAF1", expected: "ok", label: "Automaattinen CAN-muotoilu" },
      { command: "ATCFC1", expected: "ok", label: "Automaattinen flow control" },
      { command: "ATAL", expected: "ok", label: "Pitkät vastaukset" },
      { command: "ATH1", expected: "ok", label: "CAN-otsakkeet näkyviin" },
      { command: "ATS1", expected: "ok", label: "Välilyönnit näkyviin" },
      { command: "ATAR", expected: "ok", label: "Vastaanota kaikki osoitteet", optional: true },
      { command: "ATCRA", expected: "ok", label: "Poista vastaanottosuodatin", optional: true },
      { command: "ATSH7DF", expected: "ok", label: "Valitse yleisosoite 7DF vasta yhteyshaun jälkeen", requestHeader: "7DF" },
      diagnosticModeStep("0100", 0x00, "7DF tukibittikartta", "7DF", 12000),
      diagnosticModeStep("010C", 0x0c, "7DF kierrosluku", "7DF", 7000),
      diagnosticModeStep("0105", 0x05, "7DF jäähdytysneste", "7DF", 7000),
      diagnosticModeStep("0110", 0x10, "7DF MAF", "7DF", 7000),
      diagnosticModeStep("010B", 0x0b, "7DF MAP", "7DF", 7000)
    ]);

    state.diagnosticRun.currentPhase = "ECU-osoitehaku";
    for (const header of FULL_DIAGNOSTIC_ENGINE_HEADERS) {
      await executeFullDiagnosticStep({ phase: "ECU-osoitehaku", command: `ATSH${header}`, expected: "ok", label: `Valitse pyyntöosoite ${header}`, requestHeader: header, timeoutMs: 4500 });
      const support = await executeFullDiagnosticStep(diagnosticModeStep("0100", 0x00, `${header} tukibittikartta`, header, 7000));
      if (header === "7E0" || support.validResponse) {
        await executeFullDiagnosticStep(diagnosticModeStep("010C", 0x0c, `${header} kierrosluku`, header, 6000));
        await executeFullDiagnosticStep(diagnosticModeStep("0105", 0x05, `${header} jäähdytysneste`, header, 6000));
        await executeFullDiagnosticStep(diagnosticModeStep("0110", 0x10, `${header} MAF`, header, 6000));
      }
    }

    await runFullDiagnosticSteps("Vastaanottosuodatin", [
      { command: "ATSP6", expected: "ok", label: "Varmista CAN 11/500" },
      { command: "ATCAF1", expected: "ok", label: "Automaattinen CAN-muotoilu" },
      { command: "ATH1", expected: "ok", label: "CAN-otsakkeet näkyviin" },
      { command: "ATSH7E0", expected: "ok", label: "Pyyntöosoite 7E0", requestHeader: "7E0" },
      { command: "ATCRA7E8", expected: "ok", optional: true, label: "Rajaa vastausosoitteeseen 7E8", requestHeader: "7E0" },
      diagnosticModeStep("0100", 0x00, "7E0→7E8 suodatettu tukibittikartta", "7E0", 8500),
      { command: "ATCRA", expected: "ok", optional: true, label: "Poista vastaussuodatin" },
      { command: "ATAR", expected: "ok", optional: true, label: "Vastaanota kaikki osoitteet" }
    ]);

    await runFullDiagnosticSteps("Raaka CAN", [
      { command: "ATSP6", expected: "ok", label: "Varmista CAN 11/500" },
      { command: "ATCAF0", expected: "ok", label: "Poista automaattinen CAN-muotoilu" },
      { command: "ATCFC0", expected: "ok", label: "Poista automaattinen flow control" },
      { command: "ATAL", expected: "ok", label: "Pitkät viestit sallitaan" },
      { command: "ATH1", expected: "ok", label: "CAN-otsakkeet näkyviin" },
      { command: "ATSTFF", expected: "ok", label: "Pisin ELM-vastausodotus" },
      { command: "ATSH7DF", expected: "ok", label: "Raaka yleisosoite 7DF", requestHeader: "7DF" },
      { command: "020100", expected: "readOnly", responseMode: 0x41, label: "Raaka lyhyt 01 00 yleisosoitteella", requestHeader: "7DF", timeoutMs: 7000 },
      { command: "0201000000000000", expected: "readOnly", responseMode: 0x41, label: "Raaka täysi 8 tavun 01 00 yleisosoitteella", requestHeader: "7DF", timeoutMs: 7000 },
      { command: "ATSH7E0", expected: "ok", label: "Raaka suora osoite 7E0", requestHeader: "7E0" },
      { command: "020100", expected: "readOnly", responseMode: 0x41, label: "Raaka lyhyt 01 00 osoitteella 7E0", requestHeader: "7E0", timeoutMs: 7000 },
      { command: "0201000000000000", expected: "readOnly", responseMode: 0x41, label: "Raaka täysi 8 tavun 01 00 osoitteella 7E0", requestHeader: "7E0", timeoutMs: 7000 }
    ]);

    await runFullDiagnosticSteps("Passiivinen CAN-kuuntelu", [
      { command: "ATSP6", expected: "ok", label: "Varmista CAN 11/500" },
      { command: "ATCAF0", expected: "ok", label: "Raakakehykset näkyviin" },
      { command: "ATH1", expected: "ok", label: "CAN-otsakkeet näkyviin" },
      { command: "ATCRA", expected: "ok", optional: true, label: "Poista vastaanottosuodatin" },
      { command: "ATAR", expected: "ok", optional: true, label: "Vastaanota kaikki osoitteet" },
      { command: "ATMA", expected: "monitor", label: "Kuuntele kaikkea CAN-liikennettä 20 s", timeoutMs: 20000 },
      { command: "", expected: "stopMonitor", label: "Pysäytä CAN-kuuntelu", timeoutMs: 3000 },
      { command: "ATI", expected: "identity", label: "Varmista paluu komentotilaan", timeoutMs: 4500 }
    ]);

    const interimSummary = summarizeFullDiagnostic(state.diagnosticRun);
    const bestHeader = interimSummary.engineHeader || "7DF";
    await runFullDiagnosticSteps("Laaja luku-OBD", [
      { command: "ATSP6", expected: "ok", label: "Varmista CAN 11/500" },
      { command: "ATCAF1", expected: "ok", label: "Palauta automaattinen CAN-muotoilu" },
      { command: "ATCFC1", expected: "ok", label: "Palauta flow control" },
      { command: "ATH1", expected: "ok", label: "CAN-otsakkeet näkyviin" },
      { command: `ATSH${bestHeader}`, expected: "ok", label: `Käytä löydettyä osoitetta ${bestHeader}`, requestHeader: bestHeader },
      diagnosticModeStep("0100", 0x00, "Tuetut PIDit 01–20", bestHeader, 7000),
      diagnosticModeStep("0101", 0x01, "MIL ja päästömonitorien tila", bestHeader, 6000),
      diagnosticModeStep("0120", 0x20, "Tuetut PIDit 21–40", bestHeader, 6000),
      diagnosticModeStep("0140", 0x40, "Tuetut PIDit 41–60", bestHeader, 6000),
      diagnosticModeStep("0160", 0x60, "Tuetut PIDit 61–80", bestHeader, 6000),
      diagnosticModeStep("0180", 0x80, "Tuetut PIDit 81–A0", bestHeader, 6000),
      diagnosticModeStep("01A0", 0xa0, "Tuetut PIDit A1–C0", bestHeader, 6000),
      diagnosticModeStep("010C", 0x0c, "Kierrosluku", bestHeader, 6000),
      diagnosticModeStep("0105", 0x05, "Jäähdytysneste", bestHeader, 6000),
      diagnosticModeStep("010B", 0x0b, "Imusarjapaine MAP", bestHeader, 6000),
      diagnosticModeStep("010F", 0x0f, "Imuilman lämpötila", bestHeader, 6000),
      diagnosticModeStep("0110", 0x10, "Ilmamassa MAF", bestHeader, 6000),
      diagnosticModeStep("0123", 0x23, "Polttoainekiskon paine", bestHeader, 6000),
      diagnosticModeStep("0133", 0x33, "Ilmanpaine", bestHeader, 6000),
      diagnosticModeStep("0142", 0x42, "ECU-jännite", bestHeader, 6000),
      { command: "03", expected: "readOnly", responseMode: 0x43, label: "Tallennetut vikakoodit", requestHeader: bestHeader, timeoutMs: 8000 },
      { command: "07", expected: "readOnly", responseMode: 0x47, label: "Odottavat vikakoodit", requestHeader: bestHeader, timeoutMs: 8000 },
      { command: "0A", expected: "readOnly", responseMode: 0x4a, label: "Pysyvät vikakoodit", requestHeader: bestHeader, timeoutMs: 8000 },
      { command: "0900", expected: "readOnly", responseMode: 0x49, label: "Mode 09 tukibittikartta", requestHeader: bestHeader, timeoutMs: 7000 },
      { command: "0902", expected: "readOnly", responseMode: 0x49, label: "VIN-tunniste", requestHeader: bestHeader, timeoutMs: 9000 },
      { command: "0904", expected: "readOnly", responseMode: 0x49, label: "Kalibrointitunniste", requestHeader: bestHeader, timeoutMs: 9000 },
      { command: "0906", expected: "readOnly", responseMode: 0x49, label: "Kalibroinnin varmennusnumero", requestHeader: bestHeader, timeoutMs: 9000 },
      { command: "090A", expected: "readOnly", responseMode: 0x49, label: "ECU-nimi", requestHeader: bestHeader, timeoutMs: 9000 }
    ]);

    const preToyotaSummary = summarizeFullDiagnostic(state.diagnosticRun);
    if (preToyotaSummary.adapterResponded && diagnosticProbes.length) {
      state.toyotaProbeStatus = "laajennettu testi käynnissä";
      await runFullDiagnosticSteps("Toyota Read Data · normaali ELM-muoto", [
        { command: "ATSP6", expected: "ok", label: "Varmista CAN 11/500" },
        { command: "ATCAF1", expected: "ok", label: "Automaattinen CAN-muotoilu" },
        { command: "ATCFC1", expected: "ok", label: "Automaattinen flow control" },
        { command: "ATAL", expected: "ok", label: "Pitkät vastaukset" },
        { command: "ATSTFF", expected: "ok", label: "Pisin ELM-vastausodotus" },
        { command: "ATH1", expected: "ok", label: "CAN-otsakkeet näkyviin" },
        { command: "ATS1", expected: "ok", label: "Välilyönnit näkyviin" },
        { command: "ATCRA", expected: "ok", optional: true, label: "Poista aiempi vastaanottosuodatin" },
        { command: `ATSH${toyotaRequestHeader}`, expected: "ok", label: `Toyota-ECU ${toyotaRequestHeader}`, requestHeader: toyotaRequestHeader }
      ]);

      const toyotaSetupResults = state.diagnosticRun.results.filter(result => result.phase === "Toyota Read Data · normaali ELM-muoto");
      const canReady = toyotaSetupResults.some(result => result.command === "ATSP6" && result.validResponse);
      const headerReady = toyotaSetupResults.some(result => result.command === `ATSH${toyotaRequestHeader}` && result.validResponse);

      if (canReady && headerReady) {
        await runFullDiagnosticSteps("Toyota Read Data · normaali ELM-muoto",
          diagnosticProbes.map(probe => ({ ...toyotaDiagnosticStep(probe, "formatted"), pauseAfterMs: 250 }))
        );

        let missing = diagnosticProbes.filter(probe => !toyotaProbeResponded(state.diagnosticRun, probe.identifier));
        if (missing.length) {
          await runFullDiagnosticSteps("Toyota Read Data · 7E8-suodatettu", [
            { command: "ATCAF1", expected: "ok", label: "Pidä automaattinen CAN-muotoilu" },
            { command: "ATCFC1", expected: "ok", label: "Pidä automaattinen flow control" },
            { command: "ATSTFF", expected: "ok", label: "Pisin ELM-vastausodotus" },
            { command: `ATSH${toyotaRequestHeader}`, expected: "ok", label: `Toyota-ECU ${toyotaRequestHeader}`, requestHeader: toyotaRequestHeader },
            { command: `ATCRA${toyotaResponseHeader}`, expected: "ok", optional: true, label: `Rajaa vastaukset ECUun ${toyotaResponseHeader}`, requestHeader: toyotaRequestHeader },
            ...missing.map(probe => ({ ...toyotaDiagnosticStep(probe, "filtered-formatted", 16000), pauseAfterMs: 350 }))
          ]);
        }

        missing = diagnosticProbes.filter(probe => !toyotaProbeResponded(state.diagnosticRun, probe.identifier));
        if (missing.length) {
          await runFullDiagnosticSteps("Toyota Read Data · raaka ISO-TP", [
            { command: "ATSP6", expected: "ok", label: "Varmista CAN 11/500" },
            { command: "ATCAF0", expected: "ok", label: "Käytä raakaa CAN-kehystä" },
            { command: isCt200h() ? "ATCFC1" : "ATCFC0", expected: "ok", label: isCt200h() ? "Säilytä flow control CT:n monikehysvastauksille" : "Poista automaattinen flow control yksikehyskyselyltä" },
            { command: "ATH1", expected: "ok", label: "CAN-otsakkeet näkyviin" },
            { command: "ATS1", expected: "ok", label: "Välilyönnit näkyviin" },
            { command: "ATSTFF", expected: "ok", label: "Pisin ELM-vastausodotus" },
            { command: `ATSH${toyotaRequestHeader}`, expected: "ok", label: `Toyota-ECU ${toyotaRequestHeader}`, requestHeader: toyotaRequestHeader },
            { command: `ATCRA${toyotaResponseHeader}`, expected: "ok", optional: true, label: `Rajaa vastaukset ECUun ${toyotaResponseHeader}`, requestHeader: toyotaRequestHeader },
            ...missing.map(probe => ({ ...toyotaDiagnosticStep(probe, "raw-single-frame", 16000), pauseAfterMs: 350 }))
          ]);
        }

        const toyotaSummary = summarizeFullDiagnostic(state.diagnosticRun);
        state.toyotaProbeStatus = `positiiviset vastaukset ${toyotaSummary.toyotaResponseCount}/${diagnosticProbes.length}`;
      } else {
        state.toyotaProbeStatus = `ei lähetetty: CAN-alustus=${canReady ? "OK" : "FAIL"}, ATSH${toyotaRequestHeader}=${headerReady ? "OK" : "FAIL"}`;
        for (const probe of diagnosticProbes) {
          appendSkippedDiagnosticStep(
            { phase: "Toyota Read Data", ...toyotaDiagnosticStep(probe, "formatted") },
            state.toyotaProbeStatus
          );
        }
      }
    } else {
      state.toyotaProbeStatus = diagnosticProbes.length
        ? "ei lähetetty: ELM-adapteri ei vastannut ATI-kyselyyn"
        : "ei lähetetty: ajoneuvoprofiili tunnistamatta";
      for (const probe of diagnosticProbes) {
        appendSkippedDiagnosticStep(
          { phase: "Toyota Read Data", ...toyotaDiagnosticStep(probe, "formatted") },
          state.toyotaProbeStatus
        );
      }
    }
  } catch (error) {
    if (error instanceof DiagnosticCancelledError) {
      state.diagnosticAbortRequested = true;
      appendSkippedDiagnosticStep({ phase: "Ohjaus", label: "Loppu testisarja", command: "" }, "Käyttäjä keskeytti testin; jo kerätyistä vaiheista muodostetaan raportti");
    } else {
      appendDiagnosticResult({ phase: "Ohjaus", label: "Diagnostiikkamoottorin sisäinen virhe", command: "" }, "", error?.message || String(error), Date.now(), {
        status: "FAIL",
        interpretation: "Diagnostiikkamoottori kohtasi sisäisen virheen; raportti ja palautus muodostetaan silti",
        validResponse: false,
        timeout: false,
        unsupported: false,
        cleaned: ""
      });
    }
  } finally {
    state.diagnosticRun.cancelled = state.diagnosticAbortRequested;
    await restoreAfterFullDiagnostic(state.diagnosticRun);
    state.diagnosticRun.endedAt = Date.now();
    appendElmDiagnosticLine(`${formatClock(Date.now())} ===== AUTOMAATTINEN LAAJA ELM/CAN-DIAGNOSTIIKKA PÄÄTTYY =====`);
    finishFullDiagnosticUi(state.diagnosticRun);
    state.diagnosticRunning = false;
    state.diagnosticAbortRequested = false;
    button.disabled = !state.connected || state.quicklynks;
    button.textContent = "Aja vLinker / ELM + Toyota -testi";
    cancelButton.disabled = true;
    setKeepAwake(false);
  }
}

function renderQuicklynksDiagnosticProgress(message = "") {
  const run = state.diagnosticRun?.kind === "quicklynks" ? state.diagnosticRun : null;
  const count = (run?.supportResults?.length || 0) + (run?.results?.length || 0);
  const planned = run?.plannedSteps || QUICKLYNKS_SUPPORT_BITMAP_PROBES.length + QUICKLYNKS_WIDE_DIAGNOSTIC_PROBES.length * QUICKLYNKS_WIDE_DIAGNOSTIC_ROUNDS;
  const percent = run?.endedAt ? 100 : Math.min(99, Math.round(count / planned * 100));
  const progress = $("#quicklynksDiagnosticProgressBar");
  if (progress) progress.style.width = `${percent}%`;
  const text = $("#quicklynksDiagnosticProgressText");
  if (text) text.textContent = message || (run ? `${count}/${planned} kyselyä · ${percent} %` : "Ei ajettu");
  const counts = $("#quicklynksDiagnosticResultCounts");
  if (counts && run) {
    const summary = summarizeQuicklynksWideDiagnostic(run);
    counts.textContent = `PASS ${summary.passed} · WARN ${summary.warned} · FAIL ${summary.failed}`;
  }
}

function finishQuicklynksDiagnosticUi(run) {
  run.summary = summarizeQuicklynksWideDiagnostic(run);
  state.fullDiagnosticReport = buildQuicklynksWideDiagnosticReport(run);
  const summary = run.summary;
  const status = $("#quicklynksDiagnosticSummary");
  if (status) {
    status.textContent = summary.dpfEgrPids.length
      ? `Standardien DPF/EGR-kandidaattien vastauksia löytyi: ${summary.dpfEgrPids.join(", ")}. Raportti on valmis vertailuun.`
      : `Tukibittikandidaatteja ${summary.validSupportBitmapCount}/${summary.supportAttemptCount}; kelvollisia yksittäisiä 41-vastauksia ${summary.validResponseCount}/${summary.pidAttemptCount}. Raportti on valmis analyysiin.`;
    status.className = `inline-message ${summary.dpfEgrPids.length ? "" : "warning"}`.trim();
  }
  $("#quicklynksDiagnosticReportActions")?.classList.remove("hidden");
  renderQuicklynksDiagnosticProgress(run.cancelled ? "Keskeytetty hallitusti · raportti valmis" : "Valmis · raportti muodostettu");
  renderQuicklynksDiagnostics();
}

async function runQuicklynksWideDiagnostic() {
  if (!requireConnection(false)) return;
  if (!state.quicklynks || !(state.client instanceof QuicklynksClient)) {
    toast("Tämä testi vaatii Quicklynks FFF0/FFF6 -binääriyhteyden");
    return;
  }
  if (state.diagnosticRunning) return;
  if (state.recording) {
    toast("Lopeta koeajotallennus ennen laajaa diagnostiikkaa");
    return;
  }
  if (state.liveActive) await stopLive();

  const startedAt = Date.now();
  const device = selectedDiagnosticDeviceMeta();
  state.diagnosticRunning = true;
  state.diagnosticAbortRequested = false;
  state.fullDiagnosticReport = "";
  state.diagnosticKind = "quicklynks";
  state.diagnosticRun = {
    kind: "quicklynks",
    schemaVersion: 1,
    startedAt,
    endedAt: null,
    cancelled: false,
    plannedSteps: QUICKLYNKS_SUPPORT_BITMAP_PROBES.length + QUICKLYNKS_WIDE_DIAGNOSTIC_PROBES.length * QUICKLYNKS_WIDE_DIAGNOSTIC_ROUNDS,
    supportResults: [],
    results: [],
    meta: {
      appVersion: APP_VERSION,
      reportId: createDiagnosticReportId("QKL", startedAt),
      vehicle: activeVehicleName(),
      vehicleKey: state.vehicleKey,
      vehicleProfileVersion: activeVehicleProfile()?.profileVersion || "generic-eobd",
      engineRunningDeclared: declaredEngineRunning("quicklynksDiagnosticEngineState"),
      note: $("#quicklynksDiagnosticNote")?.value?.trim() || "",
      userAgent: navigator.userAgent,
      ...device,
      baseline: null,
      bleDiagnostics: null
    }
  };

  const run = state.diagnosticRun;
  const button = $("#runQuicklynksDiagnostic");
  const cancelButton = $("#cancelQuicklynksDiagnostic");
  button.disabled = true;
  button.textContent = "Quicklynks-testi käynnissä…";
  cancelButton.disabled = false;
  $("#quicklynksDiagnosticReportActions")?.classList.add("hidden");
  $("#quicklynksDiagnosticSummary")?.classList.add("hidden");
  $("#quicklynksDiagnosticReport")?.classList.add("hidden");
  renderQuicklynksDiagnosticProgress("Varmennetaan GATT-yhteys ja moottorin tila…");
  setKeepAwake(true);

  try {
    try {
      run.meta.bleDiagnostics = await bleTransport.diagnostics();
    } catch (error) {
      run.meta.bleDiagnostics = { diagnosticError: error.message || String(error) };
    }

    const baselineStartedAt = Date.now();
    try {
      const baseline = await state.client.queryRealtime(3500);
      run.meta.baseline = {
        status: "PASS",
        durationMs: Date.now() - baselineStartedAt,
        rpm: baseline.rpm,
        speed: baseline.speed,
        coolant: baseline.coolant,
        adapterVoltage: baseline.adapterVoltage,
        rawHex: baseline.rawHex
      };
      run.meta.observedRpm = Number.isFinite(baseline.rpm) ? baseline.rpm : null;
    } catch (error) {
      run.meta.baseline = {
        status: "WARN",
        durationMs: Date.now() - baselineStartedAt,
        rawHex: error.partialHex || "",
        error: error.message || String(error)
      };
    }

    for (const probe of QUICKLYNKS_SUPPORT_BITMAP_PROBES) {
      if (state.diagnosticAbortRequested) throw new DiagnosticCancelledError();
      renderQuicklynksDiagnosticProgress(`Tukibittikartoitus · PID ${probe.identifierHex} · ${probe.label}`);
      const event = await state.client.probeSupportBitmap(probe, QUICKLYNKS_SUPPORT_BITMAP_TIMEOUT_MS);
      let notificationCount = null;
      let notificationHex = "";
      try {
        const diagnostics = await bleTransport.diagnostics();
        if (Number.isInteger(diagnostics.responseChunkCount)) notificationCount = diagnostics.responseChunkCount;
        notificationHex = diagnostics.responseChunksHex || "";
      } catch {}
      const enriched = { ...event, notificationCount, notificationHex };
      const evaluation = evaluateQuicklynksSupportBitmapEvent(probe, enriched);
      run.supportResults.push({
        sequence: run.supportResults.length + run.results.length + 1,
        testKind: "support-bitmap",
        round: 0,
        category: probe.category,
        label: probe.label,
        ...enriched,
        ...evaluation
      });
      renderQuicklynksDiagnosticProgress();
      await delay(180);
    }

    for (let round = 1; round <= QUICKLYNKS_WIDE_DIAGNOSTIC_ROUNDS; round++) {
      for (const probe of QUICKLYNKS_WIDE_DIAGNOSTIC_PROBES) {
        if (state.diagnosticAbortRequested) throw new DiagnosticCancelledError();
        renderQuicklynksDiagnosticProgress(`Kierros ${round}/${QUICKLYNKS_WIDE_DIAGNOSTIC_ROUNDS} · PID ${probe.identifierHex} · ${probe.label}`);
        const event = await state.client.probeResearchIdentifier(probe, QUICKLYNKS_WIDE_DIAGNOSTIC_TIMEOUT_MS);
        let notificationCount = null;
        let notificationHex = "";
        try {
          const diagnostics = await bleTransport.diagnostics();
          if (Number.isInteger(diagnostics.responseChunkCount)) notificationCount = diagnostics.responseChunkCount;
          notificationHex = diagnostics.responseChunksHex || "";
        } catch {}
        const enriched = { ...event, notificationCount, notificationHex };
        const evaluation = evaluateQuicklynksWideDiagnosticEvent(probe, enriched);
        run.results.push({
          sequence: run.supportResults.length + run.results.length + 1,
          testKind: "pid",
          round,
          category: probe.category,
          label: probe.label,
          ...enriched,
          ...evaluation
        });
        renderQuicklynksDiagnosticProgress();
        await delay(180);
      }
    }
  } catch (error) {
    if (error instanceof DiagnosticCancelledError) {
      run.cancelled = true;
    } else {
      run.meta.internalError = error?.message || String(error);
    }
  } finally {
    run.cancelled = run.cancelled || state.diagnosticAbortRequested;
    run.endedAt = Date.now();
    try { run.meta.bleDiagnostics = await bleTransport.diagnostics(); } catch {}
    finishQuicklynksDiagnosticUi(run);
    state.diagnosticRunning = false;
    state.diagnosticAbortRequested = false;
    button.disabled = !state.connected || !state.quicklynks;
    button.textContent = "Aja Quicklynks-diagnostiikka";
    cancelButton.disabled = true;
    setKeepAwake(false);
  }
}

async function copyFullDiagnosticReport() {
  const report = state.fullDiagnosticReport || buildElmDiagnosticsReport();
  try {
    await navigator.clipboard.writeText(report);
    toast("Diagnostiikkaraportti kopioitu");
  } catch {
    toast("Raportin kopiointi ei onnistunut");
  }
}

function fullDiagnosticFilename() {
  const adapter = state.diagnosticRun?.kind === "quicklynks" ? "Quicklynks" : "GEKO-ELM327";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const nonce = Math.floor(Math.random() * 0x10000).toString(16).toUpperCase().padStart(4, "0");
  const vehicle = isCt200h() ? "Lexus_CT200h" : state.vehicleKey === VEHICLE_KEYS.IS220D ? "Lexus_IS220d" : "Lexus";
  return `${vehicle}_Flex_laaja_diagnostiikka_${adapter}_${timestamp}_${nonce}.txt`;
}

async function saveOrShareFullDiagnostic(share = false) {
  if (!state.fullDiagnosticReport || !state.diagnosticRun) return toast("Aja laaja diagnostiikka ensin");
  const filename = fullDiagnosticFilename();
  const quicklynks = state.diagnosticRun.kind === "quicklynks";
  const prompt = quicklynks
    ? buildQuicklynksWideDiagnosticAnalysisPrompt(state.diagnosticRun)
    : buildFullDiagnosticAnalysisPrompt(state.diagnosticRun);
  const title = quicklynks
    ? "Lexus OBD Flex · laaja Quicklynks BLE -diagnostiikka"
    : `Lexus OBD Flex · ${activeVehicleName()} · laaja ELM/CAN-diagnostiikka`;
  try {
    if (nativeTransport.available() && globalThis.obd?.exportCsv) {
      const uri = await nativeTransport.exportCsv(filename, state.fullDiagnosticReport, "text/plain");
      if (!(uri?.startsWith("content:"))) throw new Error("Android ei palauttanut tiedoston osoitetta");
      if (share) {
        await nativeTransport.shareCsv(uri, prompt, title, "text/plain");
        toast("Valitse ChatGPT jakovalikosta");
      } else {
        toast("Raportti tallennettu Lataukset/Lexus OBD -kansioon");
      }
      return;
    }
    const file = new File([state.fullDiagnosticReport], filename, { type: "text/plain;charset=utf-8" });
    if (share && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ title, text: prompt, files: [file] });
      return;
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    if (share) await navigator.clipboard?.writeText(prompt);
    toast(share ? "Raportti tallennettu ja analyysipyyntö kopioitu" : "Raportti tallennettu");
  } catch (error) {
    if (error?.name !== "AbortError") toast(`Raporttitoiminto epäonnistui: ${error.message}`);
  }
}

function setObdPlusTraceStatus(message = "", error = false) {
  const element = $("#obdPlusTraceStatus");
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("hidden", !message);
  element.classList.toggle("error", Boolean(error));
}

async function analyzeObdPlusTraceFile() {
  if (state.obdPlusTraceRunning) return;
  const input = $("#obdPlusTraceFile");
  const file = input?.files?.[0];
  if (!file) return toast("Valitse bugiraportin ZIP tai btsnoop_hci.log");
  if (file.size > 250 * 1024 * 1024) return toast("Tiedosto on liian suuri; enimmäiskoko on 250 Mt");
  const button = $("#analyzeObdPlusTrace");
  state.obdPlusTraceRunning = true;
  state.obdPlusTraceAnalysis = null;
  state.obdPlusTraceReport = "";
  button.disabled = true;
  button.textContent = "Analysoidaan…";
  $("#obdPlusTraceActions")?.classList.add("hidden");
  $("#obdPlusTraceReport")?.classList.add("hidden");
  setObdPlusTraceStatus(`Luetaan ${file.name} paikallisesti. Mitään ei lähetetä adapterille tai verkkoon.`);
  try {
    const source = await extractBtsnoopSource(await file.arrayBuffer(), file.name);
    const analysis = analyzeQuicklynksBtsnoop(source.bytes, {
      sourceName: file.name,
      sourceEntryName: source.entryName,
      sourceContainer: source.container
    });
    const analyzedAt = Date.now();
    const report = buildQuicklynksTraceReport(analysis, { appVersion: APP_VERSION, analyzedAt });
    state.obdPlusTraceAnalysis = analysis;
    state.obdPlusTraceReport = report;
    const summary = analysis.targetHandle == null
      ? `HCI-loki luettiin (${analysis.recordCount} tietuetta), mutta Quicklynksin 41/61-taulukkokyselyä ei löytynyt. Jaa raportti, jos OBD Plus oli varmasti yhdistettynä lokin aikana.`
      : `Quicklynks-yhteys ${analysis.targetConnectionHandleHex}, ATT-kahva ${analysis.targetHandleHex}: ${analysis.sequences.length} pyyntö-vastausjaksoa, ${analysis.uniqueRequests.length} yksilöllistä pyyntöä ja ${analysis.unknownRequests.length} tuntematonta kuorikandidaattia. Muu Bluetooth-liikenne jätettiin raportista pois.`;
    setObdPlusTraceStatus(summary, analysis.targetHandle == null);
    const reportElement = $("#obdPlusTraceReport");
    reportElement.textContent = report;
    reportElement.classList.remove("hidden");
    $("#obdPlusTraceActions")?.classList.remove("hidden");
  } catch (error) {
    setObdPlusTraceStatus(`Analyysi epäonnistui: ${error.message}`, true);
  } finally {
    state.obdPlusTraceRunning = false;
    button.textContent = "Analysoi BLE-jälki";
    button.disabled = !input?.files?.length;
  }
}

function obdPlusTraceFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const nonce = Math.floor(Math.random() * 0x10000).toString(16).toUpperCase().padStart(4, "0");
  return `Lexus_Flex_OBDPlus_BLE_trace_${timestamp}_${nonce}.txt`;
}

async function copyObdPlusTraceReport() {
  if (!state.obdPlusTraceReport) return toast("Analysoi BLE-jälki ensin");
  try {
    await navigator.clipboard.writeText(state.obdPlusTraceReport);
    toast("BLE-jälkiraportti kopioitu");
  } catch {
    toast("Raportin kopiointi ei onnistunut");
  }
}

async function saveOrShareObdPlusTrace(share = false) {
  if (!state.obdPlusTraceReport || !state.obdPlusTraceAnalysis) return toast("Analysoi BLE-jälki ensin");
  const filename = obdPlusTraceFilename();
  const prompt = buildQuicklynksTraceAnalysisPrompt(state.obdPlusTraceAnalysis);
  const title = "Lexus OBD Flex · OBD Plus / Quicklynks BLE -jälkiraportti";
  try {
    if (nativeTransport.available() && globalThis.obd?.exportCsv) {
      const uri = await nativeTransport.exportCsv(filename, state.obdPlusTraceReport, "text/plain");
      if (!(uri?.startsWith("content:"))) throw new Error("Android ei palauttanut tiedoston osoitetta");
      if (share) {
        await nativeTransport.shareCsv(uri, prompt, title, "text/plain");
        toast("Valitse ChatGPT jakovalikosta");
      } else {
        toast("Raportti tallennettu Lataukset/Lexus OBD -kansioon");
      }
      return;
    }
    const file = new File([state.obdPlusTraceReport], filename, { type: "text/plain;charset=utf-8" });
    if (share && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ title, text: prompt, files: [file] });
      return;
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    if (share) await navigator.clipboard?.writeText(prompt);
    toast(share ? "Raportti tallennettu ja analyysipyyntö kopioitu" : "Raportti tallennettu");
  } catch (error) {
    if (error?.name !== "AbortError") toast(`Raporttitoiminto epäonnistui: ${error.message}`);
  }
}

const POWER_HISTORY_KEY = "lexusPowerTestRunsV1";
const POWER_HISTORY_LIMIT = 12;

function parseFinnishNumber(value) {
  const normalized = String(value ?? "").trim().replace(/\s+/g, "").replace(",", ".");
  return normalized ? Number(normalized) : NaN;
}

function formNumber(id, fallback = NaN) {
  const value = parseFinnishNumber($(`#${id}`)?.value);
  return Number.isFinite(value) ? value : fallback;
}

function formNumberText(value, decimals = 2) {
  const fixed = Number(value).toFixed(decimals);
  const trimmed = decimals > 0 ? fixed.replace(/\.?0+$/, "") : fixed;
  return trimmed.replace(".", ",");
}

function powerVehicleKey() {
  return state.vehicleKey === VEHICLE_KEYS.CT200H ? VEHICLE_KEYS.CT200H : VEHICLE_KEYS.IS220D;
}

function applyPowerVehicleDefaults(force = false) {
  const massInput = $("#powerTotalMass");
  if (!massInput || state.powerTestRun && !["complete", "aborted"].includes(state.powerTestRun.status)) return;
  const vehicleKey = powerVehicleKey();
  const defaults = vehiclePowerDefaults(vehicleKey);
  if (force || massInput.dataset.vehicleKey !== vehicleKey) {
    massInput.value = formNumberText(defaults.totalMassKg, 0);
    massInput.dataset.vehicleKey = vehicleKey;
    $("#powerCd").value = formNumberText(defaults.dragCoefficient, 2);
    $("#powerFrontalArea").value = formNumberText(defaults.frontalAreaM2, 2);
    $("#powerCrr").value = formNumberText(defaults.rollingResistanceCoefficient, 3);
    $("#powerDrivetrainLoss").value = formNumberText((1 - defaults.drivetrainEfficiency) * 100, 0);
  }
  $("#powerVehicleReference").textContent = vehicleKey === VEHICLE_KEYS.CT200H
    ? `CT 200h -vertailu: 100 kW / 136 DIN hv järjestelmäteho ja 0–100 km/h 10,3 s. Massaoletus ${defaults.totalMassKg} kg sisältää auton, kuljettajan ja kevyen kuorman — korjaa kenttään testin todellinen kokonaismassa.`
    : `IS220d-vertailu: 130 kW / 177 DIN hv ja 0–100 km/h 8,9 s. Massaoletus ${defaults.totalMassKg} kg sisältää auton, kuljettajan ja kevyen kuorman — korjaa kenttään testin todellinen kokonaismassa.`;
  renderPowerHistory();
}

function powerSettingsFromForm() {
  const presetId = $("#powerPreset").value;
  const custom = presetId === "custom";
  const totalMassKg = formNumber("powerTotalMass");
  const startKmh = formNumber("powerStartKmh");
  const endKmh = formNumber("powerEndKmh");
  if (!Number.isFinite(totalMassKg) || totalMassKg < 500 || totalMassKg > 3500) {
    throw new Error("Anna auton, henkilöiden, polttoaineen ja kuorman todellinen kokonaismassa väliltä 500–3500 kg");
  }
  if (custom && (!Number.isFinite(startKmh) || !Number.isFinite(endKmh) || startKmh < 0 || endKmh - startKmh < 10 || endKmh > 180)) {
    throw new Error("Mukautetun testin alku- ja loppunopeuden eron pitää olla vähintään 10 km/h ja loppunopeuden enintään 180 km/h");
  }
  return {
    presetId,
    vehicleKey: powerVehicleKey(),
    vehicleName: activeVehicleName(),
    totalMassKg,
    startKmh,
    endKmh,
    roadGradePercent: formNumber("powerRoadGrade", 0),
    ambientTemperatureC: formNumber("powerTemperature", 15),
    ambientPressureKpa: formNumber("powerPressure", 101.3),
    dragCoefficient: formNumber("powerCd"),
    frontalAreaM2: formNumber("powerFrontalArea"),
    rollingResistanceCoefficient: formNumber("powerCrr"),
    drivetrainLossPercent: formNumber("powerDrivetrainLoss")
  };
}

function loadPowerHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(POWER_HISTORY_KEY) || "[]");
    state.powerTestRuns = Array.isArray(parsed)
      ? parsed.filter(run => run?.schemaVersion === "lexus-power-test-v1" && run?.status === "complete" && run?.result).slice(0, POWER_HISTORY_LIMIT)
      : [];
  } catch {
    state.powerTestRuns = [];
  }
}

function persistPowerHistory() {
  const compact = state.powerTestRuns.slice(0, POWER_HISTORY_LIMIT);
  try {
    localStorage.setItem(POWER_HISTORY_KEY, JSON.stringify(compact));
  } catch {
    state.powerTestRuns = compact.slice(0, 6);
    try { localStorage.setItem(POWER_HISTORY_KEY, JSON.stringify(state.powerTestRuns)); } catch {}
  }
}

function storeCompletedPowerRun(run) {
  const stored = JSON.parse(JSON.stringify(run));
  state.powerTestRuns = [stored, ...state.powerTestRuns.filter(item => item.id !== stored.id)].slice(0, POWER_HISTORY_LIMIT);
  persistPowerHistory();
}

function powerObdSnapshot() {
  const now = Date.now();
  const keys = [
    "speed", "rpm", "load", "pedal", "pedalE", "maf", "map", "boostPressure", "barometricPressure",
    "ctHvSoc", "ctHvCurrent", "ctHvPackPower", "ctHvPackVoltage", "ctHvBlockDelta", "ctHvTemperatureMax"
  ];
  return Object.fromEntries(keys.flatMap(id => {
    const value = state.values[id];
    const updatedAt = state.updatedAt[id];
    const maximumAge = id.startsWith("ctHv") ? 5500 : 2500;
    return Number.isFinite(value) && Number.isFinite(updatedAt) && now - updatedAt <= maximumAge ? [[id, value]] : [];
  }));
}

function powerRunActive() {
  return Boolean(state.powerTestRun && !["complete", "aborted"].includes(state.powerTestRun.status));
}

function livePowerGpsRate(run) {
  const samples = run?.samples || [];
  if (samples.length < 2) return null;
  const lastTime = samples.at(-1).monotonicMs;
  const recent = samples.filter(sample => sample.monotonicMs >= lastTime - 5000);
  if (recent.length < 2) return null;
  const seconds = (recent.at(-1).monotonicMs - recent[0].monotonicMs) / 1000;
  return seconds > 0 ? (recent.length - 1) / seconds : null;
}

function renderPowerChart() {
  const run = state.powerTestRun;
  const samples = run?.samples || [];
  const origin = run?.startCrossing?.monotonicMs || samples[0]?.monotonicMs || 0;
  const points = samples.slice(-600).map(sample => ({ time: sample.monotonicMs - origin, value: sample.speedKmh }));
  drawLineChart($("#powerChart"), points, { unit: "km/h", colorVariable: "--info" });
}

function powerBadge(run) {
  if (!run) return { className: "neutral", text: "EI ALOITETTU" };
  if (run.status === "complete") return { className: "complete", text: "VALMIS" };
  if (run.status === "aborted") return { className: "aborted", text: "KESKEYTYNYT" };
  if (run.status === "running") return { className: "running", text: "AJANOTTO" };
  if (run.status === "armed") return { className: "ready", text: "VALMIS" };
  return { className: "neutral", text: run.status === "ready" ? "GPS VALMIS" : "HAKEE GPS:ÄÄ" };
}

function renderPowerTestStatus() {
  const run = state.powerTestRun;
  const badge = powerBadge(run);
  $("#powerStatusBadge").className = `power-test-badge ${badge.className}`;
  $("#powerStatusBadge").textContent = badge.text;
  const sample = state.powerLastGpsSample;
  $("#powerGpsSpeed").textContent = Number.isFinite(sample?.speedKmh) ? Math.round(sample.speedKmh) : "–";
  $("#powerGpsAccuracy").textContent = sample
    ? `${Number.isFinite(sample.horizontalAccuracyM) ? sample.horizontalAccuracyM.toFixed(0) : "–"} / ${Number.isFinite(sample.speedAccuracyMps) ? sample.speedAccuracyMps.toFixed(2).replace(".", ",") : "–"}`
    : "–";
  const rate = livePowerGpsRate(run);
  $("#powerGpsRate").textContent = Number.isFinite(rate) ? rate.toFixed(1).replace(".", ",") : "–";
  const elapsed = run?.status === "running" && sample && Number.isFinite(run.startedAtMs)
    ? Math.max(0, (sample.monotonicMs - run.startedAtMs) / 1000)
    : run?.result?.elapsedSeconds || 0;
  $("#powerElapsed").textContent = elapsed.toFixed(3).replace(".", ",");
  const type = run?.status === "aborted" ? "error" : ["acquiring", "ready"].includes(run?.status) ? "warning" : "";
  setNotice("powerTestStatus", run ? (run.abortReason || run.statusText) : "Täytä kokonaismassa ja valitse testi. OBD-yhteys on vapaaehtoinen; GPS tekee ajanoton.", type);
  $("#powerTargetLabel").textContent = run ? `Tavoite ${run.settings.label}` : "Tavoite –";
  $("#powerArmButton").disabled = powerRunActive();
  $("#powerArmButton").textContent = run && ["complete", "aborted"].includes(run.status) ? "Aloita uusi testi" : "Valmistele ja viritä testi";
  $("#powerCancelButton").disabled = !powerRunActive();
  for (const id of ["powerPreset", "powerStartKmh", "powerEndKmh", "powerTotalMass", "powerRoadGrade", "powerTemperature", "powerPressure", "powerCd", "powerFrontalArea", "powerCrr", "powerDrivetrainLoss"]) {
    if ($(`#${id}`)) $(`#${id}`).disabled = powerRunActive();
  }
  $("#powerObdStatus").textContent = state.connected
    ? `OBD: ${state.client?.adapterIdentity || "yhdistetty"}${state.liveActive ? " · nopeus, kierrokset ja kuormitus tallentuvat GPS:n rinnalle" : " · live-luku käynnistyy testin ajaksi"}`
    : "OBD: ei yhteyttä — GPS-ajanotto ja tehoarvio toimivat silti.";
  renderPowerChart();
}

function renderPowerResult(run = state.powerTestRun) {
  const card = $("#powerResultCard");
  if (!run?.result) { card.classList.add("hidden"); return; }
  const result = run.result;
  card.classList.remove("hidden");
  $("#powerResultTime").textContent = result.elapsedSeconds.toFixed(3).replace(".", ",");
  $("#powerResultPowerLabel").textContent = run.settings.vehicleKey === VEHICLE_KEYS.CT200H ? "JÄRJESTELMÄTEHOARVIO" : "MOOTTORITEHOARVIO";
  $("#powerResultPower").textContent = Number.isFinite(result.peakSystemPowerKw)
    ? `${result.peakSystemPowerKw.toFixed(0)} / ${result.peakSystemPowerHp.toFixed(0)}`
    : "–";
  const metrics = result.quality.metrics;
  setNotice(
    "powerQualitySummary",
    `Mittauslaatu ${result.quality.confidenceText} ${Math.round(result.quality.score)}/100 · GPS ${Number.isFinite(metrics.sampleRateHz) ? metrics.sampleRateHz.toFixed(1).replace(".", ",") : "–"} Hz · suurin näyteväli ${Number.isFinite(metrics.maximumGapMs) ? Math.round(metrics.maximumGapMs) : "–"} ms · pyörätehoarvio ${Number.isFinite(result.peakWheelPowerKw) ? result.peakWheelPowerKw.toFixed(1).replace(".", ",") : "–"} kW · häviökorjattu arvio ${Number.isFinite(result.peakSystemPowerKw) ? result.peakSystemPowerKw.toFixed(1).replace(".", ",") : "–"} kW.`,
    result.quality.confidence === "low" ? "warning" : ""
  );
  $("#powerSplitGrid").innerHTML = result.splits.map(split =>
    `<div><span>${escapeHtml(`${run.settings.startKmh.toFixed(0)}–${split.targetKmh.toFixed(split.targetKmh % 1 ? 1 : 0)} km/h`)}</span><strong>${split.elapsedSeconds.toFixed(3).replace(".", ",")} s</strong></div>`
  ).join("");
  const comparison = comparePowerTestRuns(state.powerTestRuns, run);
  if (comparison.count) {
    setNotice(
      "powerComparison",
      `Aiemmat saman auton ${run.settings.label} -vedot: ${comparison.count} kpl · paras ${comparison.bestSeconds.toFixed(3).replace(".", ",")} s · keskiarvo ${comparison.averageSeconds.toFixed(3).replace(".", ",")} s${Number.isFinite(comparison.timeSpreadSeconds) ? ` · hajontaväli ${comparison.timeSpreadSeconds.toFixed(3).replace(".", ",")} s` : ""}.`,
      ""
    );
  } else {
    setNotice("powerComparison", "Ensimmäinen saman auton ja saman nopeusvälin tallennettu veto. Tee vähintään kaksi vastakkaissuuntaista vetoa toistettavuuden arvioimiseksi.", "warning");
  }
  $("#powerWarnings").innerHTML = (result.warnings || []).map(warning => `<p>• ${escapeHtml(warning)}</p>`).join("");
}

function renderPowerHistory() {
  const root = $("#powerHistory");
  if (!root) return;
  const vehicleKey = powerVehicleKey();
  const runs = state.powerTestRuns.filter(run => run.vehicleKey === vehicleKey).slice(0, 8);
  root.innerHTML = "";
  root.className = runs.length ? "session-list" : "session-list empty-state";
  if (!runs.length) { root.textContent = "Ei tallennettuja tehotestejä"; return; }
  for (const run of runs) {
    const item = document.createElement("div");
    item.className = "session-item";
    const quality = run.result?.quality?.confidenceText || "tuntematon";
    const power = Number.isFinite(run.result?.peakSystemPowerKw) ? `${run.result.peakSystemPowerKw.toFixed(0)} kW` : "teho –";
    item.innerHTML = `<div><strong>${escapeHtml(formatDateTime(run.createdAt))} · ${escapeHtml(run.settings?.label || "tehotesti")}</strong><p>${run.result.elapsedSeconds.toFixed(3).replace(".", ",")} s · ${escapeHtml(power)} · laatu ${escapeHtml(quality)}</p></div><span class="chevron">${run.result?.valid ? "✓" : "!"}</span>`;
    root.append(item);
  }
}

async function stopPowerTestResources() {
  powerGpsSource.stop();
  if (state.powerLiveStartedByTest) {
    state.powerLiveStartedByTest = false;
    if (state.liveActive) await stopLive();
  }
  if (!state.recording && !state.ctPurchaseRoadActive) await setKeepAwake(false);
}

async function finishPowerTest() {
  const run = state.powerTestRun;
  if (!run?.result) return;
  await stopPowerTestResources();
  state.powerTestReport = buildPowerTestReport(run);
  storeCompletedPowerRun(run);
  renderPowerTestStatus();
  renderPowerResult(run);
  renderPowerHistory();
  toast(`${run.settings.label} valmis: ${run.result.elapsedSeconds.toFixed(3).replace(".", ",")} s`);
}

function handlePowerGpsSample(rawSample) {
  const run = state.powerTestRun;
  if (!run || !powerRunActive()) return;
  const event = ingestPowerTestSample(run, rawSample, powerObdSnapshot());
  state.powerLastGpsSample = run.samples.at(-1) || state.powerLastGpsSample;
  renderPowerTestStatus();
  if (event.type === "started") toast("Tehotestin ajanotto käynnistyi");
  if (event.type === "complete") void finishPowerTest();
  if (event.type === "aborted") void cancelPowerTest(event.reason || run.abortReason, false);
}

function handlePowerGpsError(error) {
  if (!powerRunActive()) return;
  const message = String(error?.message || error || "GPS-virhe");
  setNotice("powerTestStatus", message, "error");
  if (/poistettiin käytöstä|permission|oikeus|valesijain/i.test(message)) void cancelPowerTest(message, false);
}

async function startPowerTest() {
  if (powerRunActive()) return;
  if (state.injectorTestRunning) return toast("Viimeistele suutintesti ennen tehotestiä");
  if (state.recording) return toast("Lopeta tavallinen koeajotallennus ennen tehotestiä");
  if (state.ctPurchaseRoadActive) return toast("Lopeta CT-ostotarkastuksen koeajovaihe ennen tehotestiä");
  if (state.diagnosticRunning) return toast("Odota diagnostiikan valmistumista ennen tehotestiä");
  let settings;
  try { settings = powerSettingsFromForm(); }
  catch (error) { setNotice("powerTestStatus", error.message, "error"); return; }
  const run = createPowerTestRun(settings, {
    appVersion: APP_VERSION,
    adapter: state.connected ? state.client?.adapterIdentity || "OBD yhdistetty" : "OBD ei käytössä",
    protocol: state.connected ? state.client?.protocolIdentity || "EOBD" : "GPS-päämittaus"
  });
  state.powerTestRun = run;
  state.powerTestReport = "";
  state.powerLastGpsSample = null;
  $("#powerResultCard").classList.add("hidden");
  renderPowerTestStatus();
  try {
    state.powerGpsSourceInfo = await powerGpsSource.start(handlePowerGpsSample, handlePowerGpsError);
    if (state.connected && !state.liveActive) {
      state.powerLiveStartedByTest = true;
      void startLive();
    } else {
      state.powerLiveStartedByTest = false;
    }
    await setKeepAwake($("#powerKeepAwake").checked);
    toast("GPS käynnistyi · testi virittyy automaattisesti");
  } catch (error) {
    cancelPowerTestRun(run, error.message);
    await stopPowerTestResources();
    renderPowerTestStatus();
    setNotice("powerTestStatus", `${error.message}. Tarkista Androidin Tarkka sijainti -oikeus ja puhelimen GPS.`, "error");
  }
}

async function cancelPowerTest(reason = "Käyttäjä keskeytti testin", showToast = true) {
  const run = state.powerTestRun;
  if (!run) return;
  cancelPowerTestRun(run, reason);
  await stopPowerTestResources();
  renderPowerTestStatus();
  if (showToast) toast("Tehotesti keskeytettiin");
}

function powerReportFilename(extension = "txt") {
  const run = state.powerTestRun;
  const timestamp = new Date(run?.createdAt || Date.now()).toISOString().replace(/[:.]/g, "-");
  const vehicle = run?.vehicleKey === VEHICLE_KEYS.CT200H ? "Lexus_CT200h" : "Lexus_IS220d";
  return `${vehicle}_tehotesti_${run?.settings?.presetId || "power"}_Flex-${APP_VERSION}_${timestamp}.${extension}`;
}

async function copyPowerReport() {
  if (!state.powerTestReport) return toast("Aja tehotesti ensin");
  try { await navigator.clipboard.writeText(state.powerTestReport); toast("Tehotestiraportti kopioitu"); }
  catch { toast("Raportin kopiointi ei onnistunut"); }
}

async function saveOrSharePowerReport(share = false) {
  const run = state.powerTestRun;
  if (!run?.result || !state.powerTestReport) return toast("Aja tehotesti ensin");
  const filename = powerReportFilename("txt");
  const prompt = buildPowerTestAnalysisPrompt(run);
  const title = `Lexus OBD Flex · ${run.settings.label} tehotesti`;
  try {
    if (nativeTransport.available() && globalThis.obd?.exportCsv) {
      const uri = await nativeTransport.exportCsv(filename, state.powerTestReport, "text/plain");
      if (!uri?.startsWith("content:")) throw new Error("Android ei palauttanut tiedoston osoitetta");
      if (share) {
        await nativeTransport.shareCsv(uri, prompt, title, "text/plain");
        toast("Valitse ChatGPT jakovalikosta");
      } else {
        toast("Raportti tallennettu Lataukset/Lexus OBD -kansioon");
      }
      return;
    }
    const file = new File([state.powerTestReport], filename, { type: "text/plain;charset=utf-8" });
    if (share && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ title, text: prompt, files: [file] });
      return;
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    if (share) await navigator.clipboard?.writeText(prompt);
    toast(share ? "Raportti tallennettu ja analyysipyyntö kopioitu" : "Raportti tallennettu");
  } catch (error) {
    if (error?.name !== "AbortError") toast(`Raporttitoiminto epäonnistui: ${error.message}`);
  }
}

async function savePowerCsv() {
  const run = state.powerTestRun;
  if (!run?.result) return toast("Aja tehotesti ensin");
  const filename = powerReportFilename("csv");
  const csv = powerTestToCsv(run);
  try {
    if (nativeTransport.available() && globalThis.obd?.exportCsv) {
      await nativeTransport.exportCsv(filename, csv, "text/csv");
      toast("Raakadata tallennettu Lataukset/Lexus OBD -kansioon");
      return;
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    toast("Raakadata tallennettu");
  } catch (error) {
    toast(`CSV-tallennus epäonnistui: ${error.message}`);
  }
}

async function sendTerminalCommand() {
  if (state.injectorTestRunning) return toast("Raakaterminaali on lukittu suutintestin ajaksi");
  if (!requireConnection(false)) return;
  if (state.client?.binaryQuicklynks) {
    toast("Quicklynks FFF6 ei käytä ASCII-ELM327-komentoja");
    appendBleDiagnostic("Raakaterminaalin ASCII-komento estettiin Quicklynks FFF6 -yhteydellä");
    return;
  }
  const input = $("#terminalCommand");
  const command = input.value.replace(/\s+/g, "").toUpperCase();
  const profileScoped = /^(?:21|13|0221)/.test(command);
  if (!isSafeTerminalCommand(command) || profileScoped && !isProfileReadOnlyCommand(command, state.vehicleKey)) {
    toast("Komento estettiin: vain turvalliset AT- ja lukukomennot sallitaan");
    return;
  }
  input.value = "";
  try { await state.client.command(command, 4000); }
  catch (error) { appendTerminal(`${formatClock(Date.now())}  ! ${error.message}`); }
}

function goToPage(name) {
  $$(".page").forEach(page => page.classList.toggle("active", page.id === `page-${name}`));
  $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.page === name));
  if (name === "sessions") renderSessionList();
  if (name === "live") requestAnimationFrame(updateLiveChart);
  if (name === "dpnr") requestAnimationFrame(renderDpnrMonitor);
  if (name === "power") {
    renderPowerTestStatus();
    renderPowerResult();
    renderPowerHistory();
  }
  if (name === "injector-test") {
    renderInjectorProgress();
    if (state.injectorTestRun?.samples?.length) renderInjectorSample(state.injectorTestRun.samples.at(-1));
  }
  syncUiShellNavigation(name);
  window.scrollTo({ top: 0, behavior: "instant" });
}

function confirmAction(title, text) {
  const dialog = $("#confirmDialog");
  $("#dialogTitle").textContent = title;
  $("#dialogText").textContent = text;
  dialog.showModal();
  return new Promise(resolve => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true });
  });
}

let toastTimer;
function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 3200);
}

function formatValue(def, value) {
  if (def.format === "onOff") return Number(value) ? "päällä" : "pois";
  if (def.format === "dpnrState") return ["valmiustila", "valmis", "käynnissä", "valmistunut"][Number(value)] || `koodi ${value}`;
  return Number(value).toFixed(def.decimals);
}
function formatClock(timestamp) { return new Date(timestamp).toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }); }
function formatDateTime(timestamp) { return new Date(timestamp).toLocaleString("fi-FI", { dateStyle: "short", timeStyle: "short" }); }
function formatElapsed(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }

function attachEvents() {
  $$(".nav-item").forEach(button => button.addEventListener("click", () => goToPage(button.dataset.page)));
  $$('[data-go]').forEach(button => button.addEventListener("click", () => goToPage(button.dataset.go)));
  $("#themeSelect").addEventListener("change", event => {
    const selected = themeController.setPreference(event.target.value);
    toast(`Teema vaihdettu: ${selected.label}`);
  });
  $("#refreshDevices").addEventListener("click", () => refreshDevices(true));
  $("#copyBleDiagnostics").addEventListener("click", async () => {
    if (!state.bleDiagnosticsReport) return toast("Aja BLE-haku ensin");
    try {
      if (bleTransport.available()) {
        const diagnostics = await bleTransport.diagnostics();
        if (diagnostics.gattUuids) appendBleDiagnostic(`Natiivi UUID-yhteenveto ${diagnostics.gattUuids}`);
        if (diagnostics.lastGattEvent) appendBleDiagnostic(`Natiivi GATT-tila ${diagnostics.lastGattEvent}`);
      }
      await navigator.clipboard.writeText(state.bleDiagnosticsReport);
      toast("BLE-diagnostiikka kopioitu");
    } catch {
      toast("Kopiointi ei onnistunut");
    }
  });
  $("#runGekoTest").addEventListener("click", runGekoDiagnostic);
  $("#cancelGekoTest").addEventListener("click", () => {
    if (!state.diagnosticRunning) return;
    state.diagnosticAbortRequested = true;
    $("#cancelGekoTest").disabled = true;
    renderFullDiagnosticProgress("Keskeytyspyyntö vastaanotettu · nykyinen komento ja palautus viimeistellään…");
  });
  $("#copyElmDiagnostics").addEventListener("click", copyFullDiagnosticReport);
  $("#saveElmDiagnostics").addEventListener("click", () => saveOrShareFullDiagnostic(false));
  $("#shareElmDiagnostics").addEventListener("click", () => saveOrShareFullDiagnostic(true));
  $("#runQuicklynksDiagnostic").addEventListener("click", runQuicklynksWideDiagnostic);
  $("#cancelQuicklynksDiagnostic").addEventListener("click", () => {
    if (!state.diagnosticRunning || state.diagnosticRun?.kind !== "quicklynks") return;
    state.diagnosticAbortRequested = true;
    $("#cancelQuicklynksDiagnostic").disabled = true;
    renderQuicklynksDiagnosticProgress("Keskeytyspyyntö vastaanotettu · nykyinen kysely viimeistellään…");
  });
  $("#copyQuicklynksDiagnostics").addEventListener("click", copyFullDiagnosticReport);
  $("#saveQuicklynksDiagnostics").addEventListener("click", () => saveOrShareFullDiagnostic(false));
  $("#shareQuicklynksDiagnostics").addEventListener("click", () => saveOrShareFullDiagnostic(true));
  $("#obdPlusTraceFile").addEventListener("change", event => {
    const hasFile = Boolean(event.target.files?.length);
    $("#analyzeObdPlusTrace").disabled = !hasFile || state.obdPlusTraceRunning;
    state.obdPlusTraceAnalysis = null;
    state.obdPlusTraceReport = "";
    $("#obdPlusTraceActions")?.classList.add("hidden");
    $("#obdPlusTraceReport")?.classList.add("hidden");
    setObdPlusTraceStatus(hasFile ? `Valittu: ${event.target.files[0].name}` : "");
  });
  $("#analyzeObdPlusTrace").addEventListener("click", analyzeObdPlusTraceFile);
  $("#copyObdPlusTrace").addEventListener("click", copyObdPlusTraceReport);
  $("#saveObdPlusTrace").addEventListener("click", () => saveOrShareObdPlusTrace(false));
  $("#shareObdPlusTrace").addEventListener("click", () => saveOrShareObdPlusTrace(true));
  $("#deviceSelect").addEventListener("change", updateDeviceHelp);
  $("#vehicleSelect").addEventListener("change", event => {
    if (powerRunActive() || state.injectorTestRunning) {
      event.target.value = state.vehicleSelection;
      toast("Ajoneuvoprofiilia ei voi vaihtaa kesken testin");
      return;
    }
    selectVehicleProfile(event.target.value);
  });
  $("#connectButton").addEventListener("click", connect);
  $("#disconnectButton").addEventListener("click", disconnect);
  $("#detectVehicleButton").addEventListener("click", () => detectVehicleProfile({ userInitiated: true }));
  $("#scanDtcButton").addEventListener("click", readDtc);
  $("#clearDtcButton").addEventListener("click", clearDtc);
  $("#ctRunPreflight").addEventListener("click", runCtPurchasePreflight);
  $("#ctToggleRoadTest").addEventListener("click", toggleCtPurchaseRoadTest);
  $("#ctFinalizeTest").addEventListener("click", finalizeCtPurchaseTest);
  $("#ctCopyReport").addEventListener("click", copyCtPurchaseReport);
  $("#ctSaveReport").addEventListener("click", () => saveOrShareCtPurchaseReport(false));
  $("#ctShareReport").addEventListener("click", () => saveOrShareCtPurchaseReport(true));
  $("#startInjectorTest").addEventListener("click", runInjectorTest);
  $("#cancelInjectorTest").addEventListener("click", () => {
    if (!state.injectorTestRunning) return;
    state.injectorTestAbortRequested = true;
    $("#cancelInjectorTest").disabled = true;
    renderInjectorProgress("Keskeytyspyyntö vastaanotettu · nykyinen lukukierros ja palautus viimeistellään…");
  });
  $("#copyInjectorReport").addEventListener("click", copyInjectorTestReport);
  $("#saveInjectorReport").addEventListener("click", () => saveOrShareInjectorTestReport(false));
  $("#shareInjectorReport").addEventListener("click", () => saveOrShareInjectorTestReport(true));
  $("#toggleLiveButton").addEventListener("click", () => state.liveActive ? stopLive() : startLive());
  $("#dpnrToggleLiveButton").addEventListener("click", () => state.liveActive ? stopLive() : startLive());
  $("#liveChartMetric").addEventListener("change", updateLiveChart);
  $("#dpnrChartMetric").addEventListener("change", updateDpnrChart);
  $("#recordButton").addEventListener("click", startRecording);
  $("#dpnrRecordButton").addEventListener("click", startRecording);
  $("#markerButton").addEventListener("click", addMarker);
  $("#keepAwake").addEventListener("change", event => state.recording && setKeepAwake(event.target.checked));
  $("#dpnrKeepAwake").addEventListener("change", event => state.recording && setKeepAwake(event.target.checked));
  $("#powerPreset").addEventListener("change", event => {
    $("#powerCustomRange").classList.toggle("hidden", event.target.value !== "custom");
    renderPowerTestStatus();
  });
  $("#powerArmButton").addEventListener("click", startPowerTest);
  $("#powerCancelButton").addEventListener("click", () => cancelPowerTest());
  $("#powerCopyReport").addEventListener("click", copyPowerReport);
  $("#powerSaveReport").addEventListener("click", () => saveOrSharePowerReport(false));
  $("#powerShareReport").addEventListener("click", () => saveOrSharePowerReport(true));
  $("#powerSaveCsv").addEventListener("click", savePowerCsv);
  $("#powerKeepAwake").addEventListener("change", event => powerRunActive() && setKeepAwake(event.target.checked));
  $("#terminalSend").addEventListener("click", sendTerminalCommand);
  $("#terminalCommand").addEventListener("keydown", event => { if (event.key === "Enter") sendTerminalCommand(); });
  $$('[data-terminal-command]').forEach(button => button.addEventListener("click", () => {
    const input = $("#terminalCommand");
    input.value = button.dataset.terminalCommand || "";
    input.focus();
  }));
  $("#clearTerminal").addEventListener("click", () => { state.terminalEntries = []; $("#terminalLog").textContent = ""; });
  $("#copyTerminal").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(state.terminalEntries.join("\n")); toast("Terminaaliloki kopioitu"); }
    catch { toast("Kopiointi ei onnistunut"); }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && powerRunActive()) void cancelPowerTest("Sovellus siirtyi taustalle kesken GPS-mittauksen", false);
    if (document.visibilityState === "hidden" && state.injectorTestRunning) {
      state.injectorTestAbortRequested = true;
      renderInjectorProgress("Sovellus siirtyi taustalle · testi keskeytetään turvallisesti ja raportti viimeistellään…");
    }
    if (document.visibilityState === "visible" && state.recording && ($("#keepAwake").checked || $("#dpnrKeepAwake")?.checked)) setKeepAwake(true);
    if (document.visibilityState === "visible" && powerRunActive() && $("#powerKeepAwake").checked) setKeepAwake(true);
  });
}

async function captureFreshDpnrPressureTestSample(phase = {}) {
  if (
    state.vehicleKey !== VEHICLE_KEYS.IS220D ||
    !state.connected ||
    !state.ecuConnected ||
    state.quicklynks ||
    !state.client?.runReadOnlyEcuTransaction
  ) {
    throw new Error("DPNR-testi vaatii yhdistetyn IS220d-moottori-ECU:n ASCII ELM/vLinker -yhteydellä.");
  }

  const probe = getVehicleReadDataProbes(VEHICLE_KEYS.IS220D, { liveOnly: true })
    .find(candidate => candidate.command === "217E");
  if (!probe?.rawCommand) throw new Error("IS220d 217E -paine-eroprofiili puuttuu.");

  const attempt = async queryForm => {
    const rawSingleFrame = queryForm === "raw-single-frame";
    try {
      const transaction = await state.client.runReadOnlyEcuTransaction({
        requestHeader: probe.requestHeader,
        responseHeader: rawSingleFrame ? probe.responseHeader : "",
        setupCommands: rawSingleFrame
          ? ["ATSP6", "ATCAF0", "ATCFC0", "ATAL", "ATH1", "ATS1", "ATSTFF"]
          : ["ATSP6", "ATCAF1", "ATCFC1", "ATAL", "ATH0", "ATS0", "ATSTFF"],
        requests: [{
          command: rawSingleFrame ? probe.rawCommand : probe.command,
          service: probe.service,
          timeoutMs: rawSingleFrame ? 9000 : 7000
        }],
        continueOnReadError: true,
        label: `DPNR-paine-erotesti · ${queryForm}`,
        profileKey: VEHICLE_KEYS.IS220D
      });
      const response = transaction.responses[0] || null;
      const decoded = response && !response.error
        ? decodeToyotaReadDataResponse(response.raw, probe.identifier, VEHICLE_KEYS.IS220D)
        : null;
      return { queryForm, transaction, response, decoded, error: response?.error || "" };
    } catch (error) {
      return {
        queryForm,
        transaction: null,
        response: { raw: error?.raw || error?.partialRaw || "", error: error?.message || String(error) },
        decoded: null,
        error: error?.message || String(error)
      };
    }
  };

  const formatted = await attempt("formatted");
  let rawFallback = null;
  let selected = formatted;

  if (!formatted.decoded?.complete) {
    try {
      rawFallback = await attempt("raw-single-frame");
      if (rawFallback.decoded?.complete) selected = rawFallback;
    } finally {
      // The raw fallback changes ELM framing only temporarily. Restore the
      // normal live-data framing before any later Mode 01 or Toyota request.
      for (const command of ["ATCAF1", "ATCFC1", "ATH0", "ATS0", "ATAT1", "ATST32", "ATSH7E0"]) {
        try { await state.client.command(command, 3500); } catch {}
      }
    }
  }

  if (!selected.decoded?.complete) {
    const describe = result => {
      const raw = String(result?.response?.raw || "").replace(/\s+/g, " ").trim();
      return result?.error || raw || "ei positiivista vastausta";
    };
    throw new Error(
      `Toyota 217E ei palauttanut kelvollista 617E-paine-erovastausta. Muotoiltu: ${describe(formatted)}. Raaka ISO-TP: ${describe(rawFallback)}.`
    );
  }

  const pressureKpa = Number(selected.decoded.values?.dpnrDifferentialPressureKpa);
  if (!Number.isFinite(pressureKpa)) throw new Error("617E-vastaus saatiin, mutta paine-eroa ei voitu purkaa.");

  const timestamp = Date.now();
  const pressureDef = PID_BY_ID.dpnrDifferentialPressure;
  if (pressureDef) {
    applyMetricResult(pressureDef, {
      value: pressureKpa,
      raw: selected.response.raw,
      updatedAt: timestamp,
      source: `Toyota 217E · DPNR-testi · ${selected.queryForm}`
    }, {});
  }

  let rpm = NaN;
  let rpmUpdatedAt = NaN;
  try {
    const rpmRaw = await state.client.command("010C", 3500);
    rpm = Number(decodePidResponse("rpm", rpmRaw));
    if (Number.isFinite(rpm)) {
      rpmUpdatedAt = Date.now();
      const rpmDef = PID_BY_ID.rpm;
      if (rpmDef) applyMetricResult(rpmDef, { value: rpm, raw: rpmRaw, updatedAt: rpmUpdatedAt, source: "Mode 01 0C · DPNR-testi" }, {});
    }
  } catch (error) {
    // KOEO can still be measured from a fresh 617E even if Mode 01 RPM is
    // unavailable with the engine stopped. Running-engine phases require RPM
    // in collectDpnrTestPhase and therefore remain fail-closed.
    if (phase?.id !== "koeo") {
      appendElmDiagnosticLine(`${formatClock(Date.now())} DPNR RPM ei saatavilla · ${error?.message || error}`);
    }
  }

  const coolantUpdatedAt = Number(state.updatedAt.coolant);
  const coolantC = Number.isFinite(coolantUpdatedAt) && Date.now() - coolantUpdatedAt <= 15000
    ? Number(state.values.coolant)
    : NaN;

  return {
    timestamp,
    pressureKpa,
    rpm,
    rpmUpdatedAt,
    coolantC,
    raw217e: selected.response.raw,
    queryForm: selected.queryForm,
    transactionId: selected.transaction?.transactionId || ""
  };
}

async function init() {
  configureUiShellNavigation(goToPage);
  configureDpnrTestLive({
    available: () => state.vehicleKey === VEHICLE_KEYS.IS220D && state.connected &&
      state.ecuConnected && !state.quicklynks && !state.diagnosticRunning &&
      !state.injectorTestRunning && document.visibilityState !== "hidden" &&
      $("#page-dpnr")?.classList.contains("active"),
    running: () => state.liveActive,
    session: () => state.liveRunId,
    start: () => {},
    prepare: async () => { if (state.liveActive) await stopLive(); },
    capture: captureFreshDpnrPressureTestSample,
    read: () => ({
      timestamp: state.updatedAt.dpnrDifferentialPressure,
      pressureKpa: state.values.dpnrDifferentialPressure,
      rpm: state.values.rpm,
      rpmUpdatedAt: state.updatedAt.rpm,
      coolantC: state.values.coolant,
      raw217e: state.rawValues.dpnrDifferentialPressure
    })
  });
  themeController = createThemeController({ onChange: handleThemeChange });
  renderThemeSelection(themeController.getSnapshot());
  attachEvents();
  loadPowerHistory();
  $("#protocolSelect").value = localStorage.getItem("obdProtocol") || "auto";
  $("#vehicleSelect").value = state.vehicleSelection;
  applyVehicleProfileUi();
  renderMetrics();
  updateDriveValues();
  renderCtPurchaseProgress();
  renderInjectorProgress();
  renderInjectorSample();
  applyPowerVehicleDefaults();
  renderPowerTestStatus();
  renderPowerHistory();
  await refreshDevices(false);
  resetConnectionStages();
  renderElmDiagnostics();
  renderQuicklynksDiagnostics();
  await renderSessionList();
  appendTerminal(`${formatClock(Date.now())}  Lexus OBD Flex ${APP_VERSION} diagnostiikka valmis · ${activeVehicleName()}`);
}

init().catch(error => {
  showConnectionError(error.message);
  appendTerminal(`${formatClock(Date.now())}  ! Käynnistysvirhe: ${error.message}`);
});
