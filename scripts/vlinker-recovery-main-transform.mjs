export const VLINKER_RECOVERY_BUILD_MARKER = "__IS220D_VLINKER_RECOVERY_V1__";

const lines = (...items) => items.join("\n");
const APP_VERSION_ANCHOR = 'import { APP_VERSION } from "./app-version.js";';

const REFRESH_HISTORY_ANCHOR = lines(
  '  const currentOption = select.selectedOptions[0];',
  '  const previous = currentOption?.dataset.address || localStorage.getItem("lastObdDevice") || "";',
  '  const previousTransport = currentOption?.dataset.transport || localStorage.getItem("lastObdTransport") || "";'
);
const REFRESH_HISTORY_REPLACEMENT = lines(
  '  // Only a transport that reached a usable adapter connection may become the automatic default.',
  '  // Legacy lastObd* keys are intentionally not trusted here because older builds wrote them before',
  '  // the ELM handshake and a failed vLinker MC-IOS attempt could therefore poison the next startup.',
  '  const previous = localStorage.getItem("lastSuccessfulObdDevice") || "";',
  '  const previousTransport = localStorage.getItem("lastSuccessfulObdTransport") || "";'
);

const SORT_ANCHOR = '  devices = sortAdapterDevices([...unique.values()]);';
const SORT_REPLACEMENT = lines(
  SORT_ANCHOR,
  '  const hasPairedClassicVlinker = devices.some(device => {',
  '    const candidate = classifyAdapterDevice(device);',
  '    return candidate.vlinker && candidate.transport === "classic";',
  '  });'
);

const OPTION_ANCHOR = lines(
  '    const profile = classifyAdapterDevice(device);',
  '    const transport = profile.transport;',
  '    option.value = `${transport}:${device.address}`;',
  '    const type = device.simulated ? "" : profile.channelLabel;',
  '    const signal = device.transport === "ble" && Number.isFinite(device.rssi) ? ` · ${device.rssi} dBm` : "";',
  '    option.textContent = `${profile.adapterLabel}${device.simulated ? "" : ` · ${type}${signal} · ${device.address}`}`;'
);
const OPTION_REPLACEMENT = lines(
  '    const profile = classifyAdapterDevice(device);',
  '    const transport = profile.transport;',
  '    const vlinkerNeedsClassicPairing = profile.vlinker && transport === "ble" && !hasPairedClassicVlinker;',
  '    option.value = `${transport}:${device.address}`;',
  '    const type = device.simulated ? "" : profile.channelLabel;',
  '    const signal = device.transport === "ble" && Number.isFinite(device.rssi) ? ` · ${device.rssi} dBm` : "";',
  '    option.textContent = `${profile.adapterLabel}${device.simulated ? "" : ` · ${type}${signal} · ${device.address}`}${vlinkerNeedsClassicPairing ? " · Classic-paritus puuttuu" : ""}`;'
);

const OPTION_DATASET_ANCHOR = '    option.dataset.vlinker = String(profile.vlinker);';
const OPTION_DATASET_REPLACEMENT = lines(
  OPTION_DATASET_ANCHOR,
  '    option.dataset.vlinkerNeedsClassicPairing = String(vlinkerNeedsClassicPairing);'
);

const SELECTED_PROFILE_ANCHOR = lines(
  '    simulated: option?.dataset?.simulated === "true",',
  '    knownFallback: option?.dataset?.knownFallback === "true"'
);
const SELECTED_PROFILE_REPLACEMENT = lines(
  '    simulated: option?.dataset?.simulated === "true",',
  '    knownFallback: option?.dataset?.knownFallback === "true",',
  '    vlinkerNeedsClassicPairing: option?.dataset?.vlinkerNeedsClassicPairing === "true"'
);

const DEVICE_HELP_ANCHOR = lines(
  'function updateDeviceHelp() {',
  '  const profile = selectedAdapterProfile();',
  '  if (profile.transport === "ble") {'
);
const DEVICE_HELP_REPLACEMENT = lines(
  'function updateDeviceHelp() {',
  '  const profile = selectedAdapterProfile();',
  '  if (profile.vlinker && profile.transport === "ble" && profile.vlinkerNeedsClassicPairing) {',
  '    $("#deviceHelp").textContent = "vLinker MC-IOS näkyy BLE-mainoksena, mutta Flex ei löydä paritettua vLinker MC / MC-Android Classic -yhteyttä. Parita Androidin Bluetooth-asetuksissa vLinker MC / MC-Android PIN-koodilla 1234 ja päivitä laitelista. BLE-mainos ei tarkoita, että Classic-paritus olisi kunnossa.";',
  '  } else if (profile.transport === "ble") {'
);

const EARLY_PERSIST_ANCHOR = lines(
  '  const selectedProfile = selectedAdapterProfile();',
  '  localStorage.setItem("lastObdDevice", address);',
  '  localStorage.setItem("lastObdTransport", transportType);',
  '  localStorage.setItem("obdProtocol", protocol);'
);
const EARLY_PERSIST_REPLACEMENT = lines(
  '  const selectedProfile = selectedAdapterProfile();',
  '  localStorage.setItem("obdProtocol", protocol);'
);

const SUCCESS_ANCHOR = lines(
  '    state.connected = true;',
  '    state.client?.setVehicleKey?.(state.vehicleKey);'
);
const SUCCESS_REPLACEMENT = lines(
  '    state.connected = true;',
  '    // Persist the route only after the adapter protocol has actually initialized.',
  '    // This prevents a failed MC-IOS/GATT attempt from replacing a working Classic route.',
  '    localStorage.setItem("lastSuccessfulObdDevice", address);',
  '    localStorage.setItem("lastSuccessfulObdTransport", transportType);',
  '    localStorage.setItem("lastObdDevice", address);',
  '    localStorage.setItem("lastObdTransport", transportType);',
  '    state.client?.setVehicleKey?.(state.vehicleKey);'
);

const CATCH_ANCHOR = lines(
  '    setConnectionStatus("error", "Yhteysvirhe");',
  '    if (state.connectionStages.bluetooth.status === "testing") setConnectionStage("bluetooth", "error", error.message);',
  '    showConnectionError(connectionAdvice(error));'
);
const CATCH_REPLACEMENT = lines(
  '    const gattWasConnected = transportType === "ble" && state.connectionStages.bluetooth.status === "connected";',
  '    if (gattWasConnected) {',
  '      setConnectionStage("bluetooth", "error", "GATT-yhteys muodostui, mutta yhteys suljettiin adapterialustuksen epäonnistuttua");',
  '    }',
  '    if (gattWasConnected && selectedProfile.vlinker && !selectedProfile.quicklynks) {',
  '      setConnectionStage("elm", "error", `GATT toimi, mutta vLinkerin ELM327-kanava ei vastannut: ${error.message}`);',
  '      setConnectionStatus("error", "GATT toimi · ELM ei vastaa");',
  '      const recoveryAdvice = selectedProfile.vlinkerNeedsClassicPairing',
  '        ? "vLinker MC-IOS löytyi BLE:nä ja GATT avautui, mutta ELM327 ei vastannut. Parita Androidin Bluetooth-asetuksissa vLinker MC / MC-Android uudelleen PIN-koodilla 1234, päivitä Flexin laitelista ja valitse Bluetooth Classic. Epäonnistunut BLE-kokeilu ei enää korvaa viimeksi toimivaa yhteystapaa."',
  '        : `vLinkerin BLE/GATT avautui, mutta ELM327-kanava ei vastannut. ${connectionAdvice(error)}`;',
  '      showConnectionError(recoveryAdvice);',
  '    } else {',
  '      setConnectionStatus("error", "Yhteysvirhe");',
  '      if (state.connectionStages.bluetooth.status === "testing") setConnectionStage("bluetooth", "error", error.message);',
  '      showConnectionError(connectionAdvice(error));',
  '    }'
);

function count(source, needle) {
  return source.split(needle).length - 1;
}

function replaceExactlyOnce(source, anchor, replacement, label) {
  const occurrences = count(source, anchor);
  if (occurrences !== 1) throw new Error(`vLinker recovery transform: ${label} anchor count ${occurrences}, expected 1`);
  return source.replace(anchor, replacement);
}

export function patchMainForVLinkerRecovery(source) {
  let text = String(source || "");
  if (text.includes(VLINKER_RECOVERY_BUILD_MARKER)) return text;
  if (count(text, APP_VERSION_ANCHOR) !== 1) throw new Error("vLinker recovery transform: APP_VERSION anchor missing or ambiguous");

  text = text.replace(
    APP_VERSION_ANCHOR,
    `${APP_VERSION_ANCHOR}\nglobalThis.${VLINKER_RECOVERY_BUILD_MARKER} = true;`
  );
  text = replaceExactlyOnce(text, REFRESH_HISTORY_ANCHOR, REFRESH_HISTORY_REPLACEMENT, "refresh history");
  text = replaceExactlyOnce(text, SORT_ANCHOR, SORT_REPLACEMENT, "device sort");
  text = replaceExactlyOnce(text, OPTION_ANCHOR, OPTION_REPLACEMENT, "device option");
  text = replaceExactlyOnce(text, OPTION_DATASET_ANCHOR, OPTION_DATASET_REPLACEMENT, "option dataset");
  text = replaceExactlyOnce(text, SELECTED_PROFILE_ANCHOR, SELECTED_PROFILE_REPLACEMENT, "selected profile");
  text = replaceExactlyOnce(text, DEVICE_HELP_ANCHOR, DEVICE_HELP_REPLACEMENT, "device help");
  text = replaceExactlyOnce(text, EARLY_PERSIST_ANCHOR, EARLY_PERSIST_REPLACEMENT, "early persistence");
  text = replaceExactlyOnce(text, SUCCESS_ANCHOR, SUCCESS_REPLACEMENT, "successful persistence");
  text = replaceExactlyOnce(text, CATCH_ANCHOR, CATCH_REPLACEMENT, "connection failure UI");
  return text;
}
