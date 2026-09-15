export const DPNR_PRESSURE_SENSOR_BUILD_MARKER = "__IS220D_DPNR_PRESSURE_SENSOR_TEST_V2__";

const APP_VERSION_ANCHOR = 'import { APP_VERSION } from "./app-version.js";';
const SENSOR_IMPORT = 'import "./dpnr-pressure-sensor-test.js";';
const DPNR_PAGE_ANCHOR = '  if (name === "dpnr") requestAnimationFrame(renderDpnrMonitor);';
const DPNR_PAGE_AUTOSTART = `  if (name === "dpnr") {
    requestAnimationFrame(renderDpnrMonitor);
    if (
      state.vehicleKey === VEHICLE_KEYS.IS220D &&
      state.connected &&
      state.ecuConnected &&
      !state.liveActive &&
      !state.quicklynks &&
      !state.diagnosticRunning &&
      !state.injectorTestRunning
    ) {
      void startLive();
    }
  }`;

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
  if (input.includes(SENSOR_IMPORT)) {
    throw new Error("DPNR pressure sensor transform: sensor import exists without current build marker");
  }
  return input
    .replace(
      APP_VERSION_ANCHOR,
      `${APP_VERSION_ANCHOR}\n${SENSOR_IMPORT}\nglobalThis.${DPNR_PRESSURE_SENSOR_BUILD_MARKER} = true;`
    )
    .replace(DPNR_PAGE_ANCHOR, DPNR_PAGE_AUTOSTART);
}
