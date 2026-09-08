import {
  NativeElmTransport,
  NativeBleElmTransport,
  FakeElmTransport,
  Elm327Client,
  QuicklynksClient,
  PID_DEFINITIONS,
  PID_BY_ID,
  parseDtcResponse,
  parseMilStatus,
  cleanElmResponse,
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
  TOYOTA_READ_DATA_PROBES,
  TOYOTA_READ_DATA_ALLOWED_COMMANDS,
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

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const APP_VERSION = "0.6.9";
const DPNR_MONITOR_METRIC_IDS = Object.freeze([
  "dpnrDifferentialPressure",
  "dpnrInletTemperature",
  "dpnrOutletTemperature",
  "dpnrSulfurRegenerationState",
  "dpnrPmRegenerationState",
  "dpnrRegenerationActive"
]);

const nativeTransport = new NativeElmTransport(globalThis.obd);
const bleTransport = new NativeBleElmTransport(globalThis.bleObd);
const fakeTransport = new FakeElmTransport();

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
  obdPlusTraceReport: ""
};

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
    `IS220d OBD Flex ${APP_VERSION} · vLinker/ELM327-diagnostiikka`,
    `Aika: ${new Date(state.elmDiagnosticStartedAt || Date.now()).toLocaleString("fi-FI")}`,
    `Laite: ${state.elmDiagnosticDevice || "ei valittu"}`,
    `Valittu protokolla: ${$("#protocolSelect")?.selectedOptions[0]?.textContent || "ei tietoa"}`,
    `Bluetooth: ${stage("bluetooth").status} · ${stage("bluetooth").message}`,
    `ELM327: ${stage("elm").status} · ${stage("elm").message}`,
    `Moottori-ECU: ${stage("ecu").status} · ${stage("ecu").message}`,
    `Toyota 21 7E / 21 7F / 21 2C: ${state.toyotaProbeStatus}`,
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
  $("#connectButton").disabled = state.connected || state.connecting || state.reconnecting;
  $("#disconnectButton").disabled = !state.connected && !state.connecting && !state.reconnecting;
  $("#deviceSelect").disabled = state.connected || state.connecting || state.reconnecting;
  $("#protocolSelect").disabled = state.connected || state.connecting || state.reconnecting;
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
    `IS220d OBD Flex ${APP_VERSION} · BLE-diagnostiikka`,
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
        state.client = new Elm327Client(state.transport, logTraffic, handleElmState);
        info = await state.client.initializeConnected(transportInfo, protocol);
      }
      appendBleDiagnostic(`GATT valmis · profiili ${info.transportProfile || "tuntematon"}`);
      if (info.gattUuids) appendBleDiagnostic(`Löydetyt UUID:t ${info.gattUuids}`);
      if (info.writeUuid || info.notifyUuid) appendBleDiagnostic(`TX ${info.writeUuid || "–"} · RX ${info.notifyUuid || "–"}`);
      if (info.notificationEnabled) appendBleDiagnostic(`Notification/CCCD käytössä · arvo ${info.cccdValue || "0100"}`);
      if (Number.isFinite(info.payloadSize)) appendBleDiagnostic(`BLE-hyötykuorma ${info.payloadSize} tavua · kirjoitustapa ${info.writeType === 1 ? "ilman vastausta" : "vastauksella"}`);
    } else {
      state.client = new Elm327Client(state.transport, logTraffic, handleElmState);
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
    state.ecuConnected = state.quicklynks || Boolean(info.ecuConnected);
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
      toast(simulated ? "Simulaattori yhdistetty" : state.quicklynks ? "Quicklynks FFF6 yhdistetty" : "ELM327 ja moottori-ECU yhdistetty");
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
  state.connecting = false;
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
  if (state.reconnecting || state.diagnosticRunning || state.transport === fakeTransport || !state.transport) return;
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
    setNotice("dtcNotice", "Luettu. Selitteet ovat yleisiä EOBD-kuvauksia, eivät varma Lexus-kohtainen vianmääritys.", "");
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
    card.innerHTML = `<div class="dtc-code">${escapeHtml(item.code)}</div><div><strong>${escapeHtml(item.description)}</strong><p>Tarkista oireet ja mittausdata ennen osien vaihtamista.</p></div>`;
    root.append(card);
  }
}

async function clearDtc() {
  if (!requireConnection()) return;
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
  for (const def of PID_DEFINITIONS) {
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
    const raw = id.startsWith("dpnr") ? (id.includes("Temperature") ? dpnrRaw("217F") : dpnrRaw("217E")) : "–";
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
  const map = state.values.map;
  const barometricPressure = state.values.barometricPressure;
  const mapAt = state.updatedAt.map;
  const barometricAt = state.updatedAt.barometricPressure;
  if (![map, barometricPressure, mapAt, barometricAt].every(Number.isFinite)) return;

  const def = PID_BY_ID.boostPressure;
  const measuredAt = Math.min(mapAt, barometricAt);
  const previousUpdatedAt = state.updatedAt.boostPressure;
  const value = map - barometricPressure;
  state.values.boostPressure = value;
  state.updatedAt.boostPressure = measuredAt;
  state.rawValues.boostPressure = "derived:map-barometricPressure";
  state.valueSources.boostPressure = "Johdettu MAP − ilmanpaine";
  cycleRaw.boostPressure = state.rawValues.boostPressure;
  const history = state.histories.boostPressure;
  if (!Number.isFinite(previousUpdatedAt) || measuredAt > previousUpdatedAt || !history.length) {
    history.push({ time: measuredAt, value });
    if (history.length > 180) history.splice(0, history.length - 180);
  }
  updateMetricCard(def);
  if ($("#liveChartMetric").value === def.id) updateLiveChart();
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
  if (!requireConnection() || state.liveActive) return;
  const liveClient = state.client;
  state.liveActive = true;
  const runId = ++state.liveRunId;
  setLiveButtonState(true);
  setNotice("supportNotice", "Selvitetään ECU:n tukemia standardoituja PID-arvoja…");
  try {
    const supportedPids = await liveClient.readSupportedPids();
    state.supportedPids = supportedPids;
    const readable = PID_DEFINITIONS.filter(def =>
      !def.derived && (supportedPids.has(def.pid) || supportedPids.has(def.id))
    );
    const toyotaLiveCount = readable.filter(def => def.toyotaCommand).length;
    renderMetrics();
    setNotice(
      "supportNotice",
      liveClient.binaryQuicklynks
        ? `${readable.length} varmennettua arvoa luetaan Quicklynksin pääkehyksestä sekä 2 s / 15 s Mode 01 -ryhmistä. Standardoidut diesel-PIDit kokeillaan yksi kerrallaan; lyhyt vastaus tulkitaan payload-only-muodossa ja mittari näytetään vasta hyväksytyn 41-vastauksen jälkeen. Toyota 21 -kyselyitä ei lähetetä Quicklynksille.`
        : toyotaLiveCount
          ? `${readable.length} arvoa on tuettu. Näistä ${toyotaLiveCount} on vLinker MC+:lla tässä yhteydessä varmennettuja Toyota Read Data -arvoja komennoista 217E, 217F ja 212C. Lähdekohtainen prioriteettipollaus lukee saman vastauksen vain kerran ja jakaa sen kaikille ryhmän mittareille.`
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
  const baseItems = new Set(["coolant", "load", "adapterVoltage", "voltage", "quicklynksField80", "maf", "map", "boostPressure", "railPressure"]);
  const items = [
    "coolant", "load", "adapterVoltage", "voltage", "quicklynksField80", "maf", "map",
    "boostPressure", "boostPressureTarget", "boostPressureActual", "railPressure", "railPressureTarget",
    "railPressureActual", "toyotaRailPressure", "egrPositionTarget", "egrPositionActual",
    "dpnrDifferentialPressure", "dpnrSulfurRegenerationState", "dpnrPmRegenerationState",
    "dpnrInletTemperature", "dpnrOutletTemperature", "injectionFeedback1", "injectionFeedback2",
    "injectionFeedback3", "injectionFeedback4", "toyotaFuelTemperature", "toyotaInjectionTiming",
    "dpfRegenerationActive", "dpfDifferentialPressure", "dpfInletTemperature", "dpfOutletTemperature",
    "dieselLambdaB1S1"
  ].filter(id => baseItems.has(id) || Number.isFinite(state.values[id]));
  $("#driveSecondary").innerHTML = items.map(id => {
    const def = PID_BY_ID[id];
    const value = state.values[id];
    return `<div><span>${escapeHtml(def.short)}</span><strong>${Number.isFinite(value) ? `${formatValue(def, value)} ${escapeHtml(def.unit)}` : "–"}</strong></div>`;
  }).join("");
  const banner = $("#dpfRegenBanner");
  const regenState = $("#dpfRegenState");
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
  if (!requireConnection()) return;
  if (state.recording) { await stopRecording(); return; }
  const now = Date.now();
  state.recording = {
    id: `drive-${now}`,
    schemaVersion: 5,
    appVersion: APP_VERSION,
    startedAt: now,
    endedAt: null,
    vehicle: "Lexus IS220d 2008 · 2AD-FHV",
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
  await setKeepAwake($("#keepAwake").checked || $("#dpnrKeepAwake").checked);
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
  session.schemaVersion = 3;
  session.appVersion ||= APP_VERSION;
  await SessionStore.save(session);
  const csv = sessionToCsv(session);
  const filename = `IS220d_OBD_${new Date(session.startedAt).toISOString().replace(/[:.]/g, "-")}.csv`;
  try {
    if (nativeTransport.available() && globalThis.obd?.exportCsv) {
      const result = await nativeTransport.exportCsv(filename, csv);
      toast(result?.startsWith("content:") ? "CSV tallennettu Lataukset/IS220d OBD -kansioon" : "CSV tallennettu");
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
  session.schemaVersion = 3;
  session.appVersion ||= APP_VERSION;
  await SessionStore.save(session);

  const hasResearch = Boolean(session.quicklynksResearch?.events?.length);
  const csv = hasResearch ? sessionToQuicklynksResearchCsv(session) : sessionToCsv(session);
  const prompt = hasResearch ? buildQuicklynksResearchAiPrompt(session) : buildAiAnalysisPrompt(session);
  const prefix = hasResearch ? "IS220d_OBD_AI_PID" : "IS220d_OBD_AI";
  const filename = `${prefix}_${new Date(session.startedAt).toISOString().replace(/[:.]/g, "-")}.csv`;

  try {
    if (nativeTransport.available() && globalThis.obd?.exportCsv && globalThis.obd?.shareCsv) {
      const uri = await nativeTransport.exportCsv(filename, csv);
      if (!uri?.startsWith("content:")) throw new Error("Android ei palauttanut jaettavaa tiedosto-osoitetta");
      await nativeTransport.shareCsv(uri, prompt, "Lexus IS220d koeajodatan analyysi", "text/csv");
      toast("Valitse tekoälysovellus jakovalikosta");
      return;
    }

    const file = new File([csv], filename, { type: "text/csv;charset=utf-8" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({
        title: "Lexus IS220d koeajodatan analyysi",
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
  if (!TOYOTA_READ_DATA_ALLOWED_COMMANDS.includes(command)) {
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
  state.adapterCapabilities = run.summary.adapterCapabilities;
  state.fullDiagnosticReport = buildFullDiagnosticReport(run);
  const summary = run.summary;
  const status = $("#diagnosticSummary");
  if (status) {
    status.textContent = summary.toyotaResponseCount
      ? `Toyota Read Data toimii: ${summary.toyotaResponseCount}/${TOYOTA_READ_DATA_PROBES.length} varmennettua vastausta. Raportissa ovat raakadata, käytetty kyselymuoto ja puretut DPNR/EGR-arvot.`
      : summary.validObdResponseCount
        ? `Tavallista ECU-dataa löytyi, mutta Toyota 217E/217F/212C ei vastannut. Raportti erottaa normaalin, suodatetun ja raa'an kyselyprofiilin.`
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
  if (state.recording) {
    setNotice("gekoTestResult", "Lopeta koeajotallennus ennen laajaa diagnostiikkaa.", "warning");
    return;
  }
  if (state.liveActive) await stopLive();

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
      vehicle: "Lexus IS220d 2008 · 2AD-FHV · 2,2 D-CAT",
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
    await runFullDiagnosticSteps("Adapteri", [
      ...VLINKER_CAPABILITY_PROBES
    ]);

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
    if (preToyotaSummary.adapterResponded) {
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
        { command: "ATSH7E0", expected: "ok", label: "Toyota-moottori-ECU 7E0", requestHeader: "7E0" }
      ]);

      const toyotaSetupResults = state.diagnosticRun.results.filter(result => result.phase === "Toyota Read Data · normaali ELM-muoto");
      const canReady = toyotaSetupResults.some(result => result.command === "ATSP6" && result.validResponse);
      const headerReady = toyotaSetupResults.some(result => result.command === "ATSH7E0" && result.validResponse);

      if (canReady && headerReady) {
        await runFullDiagnosticSteps("Toyota Read Data · normaali ELM-muoto",
          TOYOTA_READ_DATA_PROBES.map(probe => ({ ...toyotaDiagnosticStep(probe, "formatted"), pauseAfterMs: 250 }))
        );

        let missing = TOYOTA_READ_DATA_PROBES.filter(probe => !toyotaProbeResponded(state.diagnosticRun, probe.identifier));
        if (missing.length) {
          await runFullDiagnosticSteps("Toyota Read Data · 7E8-suodatettu", [
            { command: "ATCAF1", expected: "ok", label: "Pidä automaattinen CAN-muotoilu" },
            { command: "ATCFC1", expected: "ok", label: "Pidä automaattinen flow control" },
            { command: "ATSTFF", expected: "ok", label: "Pisin ELM-vastausodotus" },
            { command: "ATSH7E0", expected: "ok", label: "Toyota-moottori-ECU 7E0", requestHeader: "7E0" },
            { command: "ATCRA7E8", expected: "ok", optional: true, label: "Rajaa vastaukset moottori-ECUun 7E8", requestHeader: "7E0" },
            ...missing.map(probe => ({ ...toyotaDiagnosticStep(probe, "filtered-formatted", 16000), pauseAfterMs: 350 }))
          ]);
        }

        missing = TOYOTA_READ_DATA_PROBES.filter(probe => !toyotaProbeResponded(state.diagnosticRun, probe.identifier));
        if (missing.length) {
          await runFullDiagnosticSteps("Toyota Read Data · raaka ISO-TP", [
            { command: "ATSP6", expected: "ok", label: "Varmista CAN 11/500" },
            { command: "ATCAF0", expected: "ok", label: "Käytä raakaa CAN-kehystä" },
            { command: "ATCFC0", expected: "ok", label: "Poista automaattinen flow control yksikehyskyselyltä" },
            { command: "ATH1", expected: "ok", label: "CAN-otsakkeet näkyviin" },
            { command: "ATS1", expected: "ok", label: "Välilyönnit näkyviin" },
            { command: "ATSTFF", expected: "ok", label: "Pisin ELM-vastausodotus" },
            { command: "ATSH7E0", expected: "ok", label: "Toyota-moottori-ECU 7E0", requestHeader: "7E0" },
            { command: "ATCRA7E8", expected: "ok", optional: true, label: "Rajaa vastaukset moottori-ECUun 7E8", requestHeader: "7E0" },
            ...missing.map(probe => ({ ...toyotaDiagnosticStep(probe, "raw-single-frame", 16000), pauseAfterMs: 350 }))
          ]);
        }

        const toyotaSummary = summarizeFullDiagnostic(state.diagnosticRun);
        state.toyotaProbeStatus = `positiiviset vastaukset ${toyotaSummary.toyotaResponseCount}/${TOYOTA_READ_DATA_PROBES.length}`;
      } else {
        state.toyotaProbeStatus = `ei lähetetty: CAN-alustus=${canReady ? "OK" : "FAIL"}, ATSH7E0=${headerReady ? "OK" : "FAIL"}`;
        for (const probe of TOYOTA_READ_DATA_PROBES) {
          appendSkippedDiagnosticStep(
            { phase: "Toyota Read Data", ...toyotaDiagnosticStep(probe, "formatted") },
            state.toyotaProbeStatus
          );
        }
      }
    } else {
      state.toyotaProbeStatus = "ei lähetetty: ELM-adapteri ei vastannut ATI-kyselyyn";
      for (const probe of TOYOTA_READ_DATA_PROBES) {
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
      vehicle: "Lexus IS220d 2008 · 2AD-FHV · 2,2 D-CAT",
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
  return `IS220d_Flex_laaja_diagnostiikka_${adapter}_${timestamp}_${nonce}.txt`;
}

async function saveOrShareFullDiagnostic(share = false) {
  if (!state.fullDiagnosticReport || !state.diagnosticRun) return toast("Aja laaja diagnostiikka ensin");
  const filename = fullDiagnosticFilename();
  const quicklynks = state.diagnosticRun.kind === "quicklynks";
  const prompt = quicklynks
    ? buildQuicklynksWideDiagnosticAnalysisPrompt(state.diagnosticRun)
    : buildFullDiagnosticAnalysisPrompt(state.diagnosticRun);
  const title = quicklynks
    ? "IS220d Flex · laaja Quicklynks BLE -diagnostiikka"
    : "IS220d Flex · laaja ELM/CAN-diagnostiikka";
  try {
    if (nativeTransport.available() && globalThis.obd?.exportCsv) {
      const uri = await nativeTransport.exportCsv(filename, state.fullDiagnosticReport, "text/plain");
      if (!(uri?.startsWith("content:"))) throw new Error("Android ei palauttanut tiedoston osoitetta");
      if (share) {
        await nativeTransport.shareCsv(uri, prompt, title, "text/plain");
        toast("Valitse ChatGPT jakovalikosta");
      } else {
        toast("Raportti tallennettu Lataukset/IS220d OBD -kansioon");
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
  return `IS220d_Flex_OBDPlus_BLE_trace_${timestamp}_${nonce}.txt`;
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
  const title = "IS220d Flex · OBD Plus / Quicklynks BLE -jälkiraportti";
  try {
    if (nativeTransport.available() && globalThis.obd?.exportCsv) {
      const uri = await nativeTransport.exportCsv(filename, state.obdPlusTraceReport, "text/plain");
      if (!(uri?.startsWith("content:"))) throw new Error("Android ei palauttanut tiedoston osoitetta");
      if (share) {
        await nativeTransport.shareCsv(uri, prompt, title, "text/plain");
        toast("Valitse ChatGPT jakovalikosta");
      } else {
        toast("Raportti tallennettu Lataukset/IS220d OBD -kansioon");
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

async function sendTerminalCommand() {
  if (!requireConnection(false)) return;
  if (state.client?.binaryQuicklynks) {
    toast("Quicklynks FFF6 ei käytä ASCII-ELM327-komentoja");
    appendBleDiagnostic("Raakaterminaalin ASCII-komento estettiin Quicklynks FFF6 -yhteydellä");
    return;
  }
  const input = $("#terminalCommand");
  const command = input.value.replace(/\s+/g, "").toUpperCase();
  if (!isSafeTerminalCommand(command)) {
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
  $("#connectButton").addEventListener("click", connect);
  $("#disconnectButton").addEventListener("click", disconnect);
  $("#scanDtcButton").addEventListener("click", readDtc);
  $("#clearDtcButton").addEventListener("click", clearDtc);
  $("#toggleLiveButton").addEventListener("click", () => state.liveActive ? stopLive() : startLive());
  $("#dpnrToggleLiveButton").addEventListener("click", () => state.liveActive ? stopLive() : startLive());
  $("#liveChartMetric").addEventListener("change", updateLiveChart);
  $("#dpnrChartMetric").addEventListener("change", updateDpnrChart);
  $("#recordButton").addEventListener("click", startRecording);
  $("#dpnrRecordButton").addEventListener("click", startRecording);
  $("#markerButton").addEventListener("click", addMarker);
  $("#keepAwake").addEventListener("change", event => state.recording && setKeepAwake(event.target.checked));
  $("#dpnrKeepAwake").addEventListener("change", event => state.recording && setKeepAwake(event.target.checked));
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
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && state.recording && $("#keepAwake").checked) setKeepAwake(true); });
}

async function init() {
  attachEvents();
  $("#protocolSelect").value = localStorage.getItem("obdProtocol") || "auto";
  renderMetrics();
  updateDriveValues();
  await refreshDevices(false);
  resetConnectionStages();
  renderElmDiagnostics();
  renderQuicklynksDiagnostics();
  await renderSessionList();
  appendTerminal(`${formatClock(Date.now())}  IS220d OBD Flex ${APP_VERSION} diagnostiikka valmis`);
}

init().catch(error => {
  showConnectionError(error.message);
  appendTerminal(`${formatClock(Date.now())}  ! Käynnistysvirhe: ${error.message}`);
});
