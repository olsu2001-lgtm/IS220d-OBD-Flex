export const DPNR_PRESSURE_SENSOR_BUILD_MARKER = "__IS220D_DPNR_PRESSURE_SENSOR_TEST_V3__";

const APP_VERSION_ANCHOR = 'import { APP_VERSION } from "./app-version.js";';
const SENSOR_IMPORT = 'import "./dpnr-pressure-sensor-test.js";';
const DPNR_PAGE_ANCHOR = '  if (name === "dpnr") requestAnimationFrame(renderDpnrMonitor);';
const INIT_ANCHOR = 'async function init() {';
const DPNR_ADAPTER_START_ANCHOR = '    start: () => { if (!state.liveActive) void startLive(); },';

const DPNR_DIRECT_CAPTURE_HELPER = `async function captureFreshDpnrPressureTestSample(phase = {}) {
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
        label: \`DPNR-paine-erotesti · \${queryForm}\`,
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
      const raw = String(result?.response?.raw || "").replace(/\\s+/g, " ").trim();
      return result?.error || raw || "ei positiivista vastausta";
    };
    throw new Error(
      \`Toyota 217E ei palauttanut kelvollista 617E-paine-erovastausta. Muotoiltu: \${describe(formatted)}. Raaka ISO-TP: \${describe(rawFallback)}.\`
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
      source: \`Toyota 217E · DPNR-testi · \${selected.queryForm}\`
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
      appendElmDiagnosticLine(\`\${formatClock(Date.now())} DPNR RPM ei saatavilla · \${error?.message || error}\`);
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
`;

function count(source, needle) {
  return String(source || "").split(needle).length - 1;
}

export function patchMainForDpnrPressureSensorTest(source) {
  const input = String(source || "");
  if (input.includes(DPNR_PRESSURE_SENSOR_BUILD_MARKER)) return input;
  if (count(input, APP_VERSION_ANCHOR) !== 1) {
    throw new Error("DPNR pressure sensor transform: APP_VERSION anchor missing or ambiguous");
  }
  if (count(input, DPNR_PAGE_ANCHOR) !== 1) {
    throw new Error("DPNR pressure sensor transform: DPNR page navigation anchor missing or ambiguous");
  }
  if (count(input, INIT_ANCHOR) !== 1) {
    throw new Error("DPNR pressure sensor transform: init anchor missing or ambiguous");
  }
  if (count(input, DPNR_ADAPTER_START_ANCHOR) !== 1) {
    throw new Error("DPNR pressure sensor transform: test-live adapter anchor missing or ambiguous");
  }
  if (input.includes(SENSOR_IMPORT)) {
    throw new Error("DPNR pressure sensor transform: sensor import exists without current build marker");
  }
  return input
    .replace(
      APP_VERSION_ANCHOR,
      `${APP_VERSION_ANCHOR}\n${SENSOR_IMPORT}\nglobalThis.${DPNR_PRESSURE_SENSOR_BUILD_MARKER} = true;`
    )
    .replace(INIT_ANCHOR, `${DPNR_DIRECT_CAPTURE_HELPER}\n${INIT_ANCHOR}`)
    .replace(
      DPNR_ADAPTER_START_ANCHOR,
      `    start: () => {},\n    prepare: async () => { if (state.liveActive) await stopLive(); },\n    capture: captureFreshDpnrPressureTestSample,`
    );
}
