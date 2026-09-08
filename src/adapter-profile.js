export const VLINKER_PROFILE_VERSION = "vlinker-mc-plus-v1";
export const MANAGED_RECONNECT_DELAYS_MS = Object.freeze([700, 1500, 3000]);

export const VLINKER_CAPABILITY_PROBES = Object.freeze([
  Object.freeze({ command: "ATI", expected: "identity", label: "ELM/adapteritunniste", timeoutMs: 5000 }),
  Object.freeze({ command: "STI", expected: "identity", optional: true, label: "STN-yhteensopivan ytimen tunniste", timeoutMs: 3500 }),
  Object.freeze({ command: "STDI", expected: "optional", optional: true, label: "STN-laitetunniste", timeoutMs: 3500 }),
  Object.freeze({ command: "AT@1", expected: "optional", optional: true, label: "Adapterin kuvaus", timeoutMs: 3500 }),
  Object.freeze({ command: "AT@2", expected: "optional", optional: true, label: "Adapterin laitetunniste", timeoutMs: 3500 }),
  Object.freeze({ command: "ATRV", expected: "optional", optional: true, label: "OBD-liitännän jännite", timeoutMs: 3500 }),
  Object.freeze({ command: "ATIGN", expected: "optional", optional: true, label: "Sytytysvirran tila", timeoutMs: 3500 }),
  Object.freeze({ command: "ATDP", expected: "optional", optional: true, label: "Nykyisen protokollan kuvaus", timeoutMs: 3500 }),
  Object.freeze({ command: "ATDPN", expected: "optional", optional: true, label: "Nykyisen protokollan numero", timeoutMs: 3500 }),
  Object.freeze({ command: "ATCS", expected: "optional", optional: true, label: "CAN-ohjaimen raportoima tila", timeoutMs: 3500 })
]);

const cleanName = value => String(value || "").trim().replace(/\s+/g, " ");
const foldedName = value => cleanName(value).toLocaleLowerCase("en-US");

export function isVLinkerName(value) {
  return /\bv\s*linker\b/i.test(cleanName(value));
}

export function isVLinkerMcPlusBleName(value) {
  const name = foldedName(value).replace(/[ _]/g, "-");
  return name.includes("vlinker") && (
    name.includes("mc+") ||
    name.includes("mc-ios") ||
    name.includes("mc+ios") ||
    name.includes("mc-ble")
  );
}

export function isVLinkerMcClassicName(value) {
  const name = foldedName(value).replace(/[ _]/g, "-");
  return name.includes("vlinker") && (
    name === "vlinker-mc" ||
    name.includes("vlinker-mc-android") ||
    name.includes("vlinker-mc+android")
  );
}

export function classifyAdapterDevice(device = {}) {
  const name = cleanName(device.name);
  const transport = device.transport || (device.simulated ? "simulated" : "classic");
  const vlinker = isVLinkerName(name);
  const vlinkerBleName = isVLinkerMcPlusBleName(name);
  const vlinkerClassicName = isVLinkerMcClassicName(name);
  const quicklynks = /quicklynks|bk-ble|beken/i.test(name);
  const simulated = Boolean(device.simulated) || transport === "simulated";

  let adapterFamily = "generic-elm327";
  let adapterLabel = name || "Nimetön OBD-laite";
  let channelLabel = transport === "ble" ? "BLE" : "Classic";
  let priority = transport === "ble" ? 40 : 50;
  let recommended = false;

  if (simulated) {
    adapterFamily = "simulator";
    priority = 100;
    channelLabel = "Simulaattori";
  } else if (vlinker) {
    adapterFamily = vlinkerBleName || transport === "ble"
      ? "vlinker-mc-plus"
      : "vlinker-mc-or-mc-plus";
    if (transport === "classic") {
      adapterLabel = "vLinker MC / MC+";
      channelLabel = "Bluetooth Classic · suositeltu";
      priority = 0;
      recommended = true;
    } else {
      adapterLabel = "vLinker MC+";
      channelLabel = "Bluetooth LE · MC-IOS";
      priority = 10;
    }
  } else if (quicklynks) {
    adapterFamily = "quicklynks-bk-ble";
    priority = 20;
  }

  return {
    ...device,
    name,
    transport,
    adapterFamily,
    adapterLabel,
    channelLabel,
    priority,
    recommended,
    vlinker,
    vlinkerBleName,
    vlinkerClassicName,
    quicklynks,
    profileVersion: vlinker ? VLINKER_PROFILE_VERSION : "generic-v1"
  };
}

export function sortAdapterDevices(devices = []) {
  return [...devices]
    .map(classifyAdapterDevice)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.transport === "ble" && b.transport === "ble") return (b.rssi ?? -999) - (a.rssi ?? -999);
      return a.adapterLabel.localeCompare(b.adapterLabel, "fi");
    });
}

export function selectedAdapterHelp(profile = {}) {
  const device = classifyAdapterDevice(profile);
  if (device.vlinker && device.transport === "classic") {
    return "vLinker MC+: paina adapterin mustaa painiketta, parita Androidissa nimi vLinker MC tai vLinker MC-Android ja käytä PIN-koodia 1234. Classic on Flexin ensisijainen ja varmimmin testattava yhteystapa.";
  }
  if (device.vlinker && device.transport === "ble") {
    return "vLinker MC+: valitse Flexissä BLE-mainos vLinker MC-IOS tai vLinker MC+. BLE:tä ei pariteta Androidin asetuksissa. Paina adapterin mustaa painiketta, jos se on virransäästötilassa.";
  }
  if (device.transport === "ble") {
    return "BLE-lukija yhdistetään suoraan sovelluksesta. Sitä ei tavallisesti pariteta Androidin Bluetooth-asetuksissa.";
  }
  if (device.transport === "classic") {
    return "Bluetooth Classic -lukija pitää parittaa ensin Androidin asetuksissa. Tavallinen PIN on 1234 tai 0000.";
  }
  return "Simulaattori toimii ilman autoa ja Bluetooth-lukijaa.";
}

function lastResult(results, command) {
  const normalized = String(command).toUpperCase();
  return [...(results || [])].reverse().find(result => String(result?.command || "").toUpperCase() === normalized) || null;
}

function resultText(results, command) {
  const result = lastResult(results, command);
  if (!result || !result.validResponse) return "";
  return String(result.cleaned || result.raw || "").trim();
}

export function summarizeAdapterCapabilities(results = [], meta = {}) {
  const identity = resultText(results, "ATI");
  const stnIdentity = resultText(results, "STI");
  const stnDeviceId = resultText(results, "STDI");
  const description = resultText(results, "AT@1");
  const deviceId = resultText(results, "AT@2");
  const voltageText = resultText(results, "ATRV");
  const voltageMatch = voltageText.replace(",", ".").match(/(-?\d+(?:\.\d+)?)\s*V?/i);
  const voltage = voltageMatch ? Number(voltageMatch[1]) : null;
  const nameEvidence = [meta.device, meta.name, identity, description, deviceId].filter(Boolean).join(" ");
  const vlinkerDetected = isVLinkerName(nameEvidence);
  const stnSupported = Boolean(stnIdentity || stnDeviceId);
  const profile = classifyAdapterDevice({ name: meta.name || meta.device || "", transport: meta.transportKind || meta.transport });
  const successfulCommands = VLINKER_CAPABILITY_PROBES
    .map(probe => probe.command)
    .filter(command => lastResult(results, command)?.validResponse);
  const unsupportedCommands = VLINKER_CAPABILITY_PROBES
    .map(probe => probe.command)
    .filter(command => lastResult(results, command)?.unsupported);

  return {
    profileVersion: vlinkerDetected || profile.vlinker ? VLINKER_PROFILE_VERSION : profile.profileVersion,
    adapterFamily: vlinkerDetected ? "vlinker-mc-or-mc-plus" : profile.adapterFamily,
    vlinkerDetected,
    stnSupported,
    identity,
    stnIdentity,
    stnDeviceId,
    description,
    deviceId,
    voltageText,
    voltage: Number.isFinite(voltage) ? voltage : null,
    ignition: resultText(results, "ATIGN"),
    protocol: resultText(results, "ATDP"),
    protocolNumber: resultText(results, "ATDPN"),
    canStatus: resultText(results, "ATCS"),
    successfulCommands,
    unsupportedCommands,
    transport: meta.transport || profile.channelLabel,
    transportProfile: meta.transportProfile || ""
  };
}

export function formatAdapterCapabilitySummary(summary = {}) {
  const model = summary.vlinkerDetected ? "vLinker MC / MC+ tunnistettu" : "ELM/STN-adapteri";
  const core = summary.stnIdentity || summary.identity || "tunniste puuttuu";
  const protocol = summary.protocol || summary.protocolNumber || "protokolla ei tiedossa";
  const voltage = Number.isFinite(summary.voltage) ? `${summary.voltage.toFixed(1)} V` : (summary.voltageText || "jännite ei tiedossa");
  const stn = summary.stnSupported ? "ST-komennot käytettävissä" : "ST-komentoja ei vahvistettu";
  return `${model} · ${core} · ${protocol} · ${voltage} · ${stn}`;
}

export function redactBluetoothAddress(value) {
  const text = String(value || "");
  const parts = text.split(":");
  if (parts.length !== 6) return text || "ei tietoa";
  return `**:**:**:**:${parts[4]}:${parts[5]}`;
}
