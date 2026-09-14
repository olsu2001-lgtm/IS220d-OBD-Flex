export const DPNR_PRESSURE_SENSOR_BUILD_MARKER = "__IS220D_DPNR_PRESSURE_SENSOR_TEST_V1__";

const APP_VERSION_ANCHOR = 'import { APP_VERSION } from "./app-version.js";';
const SENSOR_IMPORT = 'import "./dpnr-pressure-sensor-test.js";';

function count(source, needle) {
  return String(source || "").split(needle).length - 1;
}

export function patchMainForDpnrPressureSensorTest(source) {
  const input = String(source || "");
  if (input.includes(DPNR_PRESSURE_SENSOR_BUILD_MARKER)) return input;
  if (count(input, APP_VERSION_ANCHOR) !== 1) {
    throw new Error("DPNR pressure sensor transform: APP_VERSION anchor missing or ambiguous");
  }
  if (input.includes(SENSOR_IMPORT)) {
    throw new Error("DPNR pressure sensor transform: sensor import exists without build marker");
  }
  return input.replace(
    APP_VERSION_ANCHOR,
    `${APP_VERSION_ANCHOR}\n${SENSOR_IMPORT}\nglobalThis.${DPNR_PRESSURE_SENSOR_BUILD_MARKER} = true;`
  );
}
