export const DPNR_CLEANING_BUILD_MARKER = "__FLEX_DPNR_CLEANING_TEST_V1__";

const IMPORT_ANCHOR = 'import { recordEcuSurveySnapshot } from "./ecu-survey-history.js";';
const STATE_ANCHOR = "let themeController;";

export function patchMainForDpnrCleaningTest(source) {
  let output = String(source || "");
  if (output.includes(DPNR_CLEANING_BUILD_MARKER)) return output;
  if (!output.includes(IMPORT_ANCHOR)) throw new Error("DPNR cleaning transform: main.js import anchor puuttuu");
  if (!output.includes(STATE_ANCHOR)) throw new Error("DPNR cleaning transform: main.js state anchor puuttuu");

  output = output.replace(
    IMPORT_ANCHOR,
    `${IMPORT_ANCHOR}\nimport { installDpnrCleaningTest } from "./dpnr-cleaning-test.js";`
  );

  const install = `
const ${DPNR_CLEANING_BUILD_MARKER} = true;
installDpnrCleaningTest({
  appVersion: APP_VERSION,
  canRun: () => {
    if (!state.connected || !state.client) return { ok: false, message: "Yhdistä ensin autoon." };
    if (state.vehicleKey !== VEHICLE_KEYS.IS220D) return { ok: false, message: "DPNR-letkutesti on käytössä vain tunnistetulle Lexus IS220d:lle." };
    if (state.quicklynks || !(state.client instanceof Elm327Client)) return { ok: false, message: "Testi vaatii vLinker-/ASCII-ELM327-yhteyden; Quicklynksin binääripolku ei lähetä Toyota 217E -kyselyä." };
    if (state.diagnosticRunning || state.liveActive || state.recording || state.ctPurchaseRoadActive || state.injectorTestRunning || powerRunActive()) {
      return { ok: false, message: "Lopeta live-data, tallennus tai muu testi ennen DPNR ennen/jälkeen -mittausta." };
    }
    return { ok: true };
  },
  readCommand: async (command, timeoutMs) => {
    if (!state.client) throw new Error("OBD-yhteys puuttuu");
    return state.client.command(command, timeoutMs);
  }
});
`;

  output = output.replace(STATE_ANCHOR, `${install}\n${STATE_ANCHOR}`);
  return output;
}
