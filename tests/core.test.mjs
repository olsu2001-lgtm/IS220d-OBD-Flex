import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync, deflateSync } from "node:zlib";
import {
  cleanElmResponse,
  decodeDtcBytes,
  parseDtcResponse,
  parseMilStatus,
  hasModePidResponse,
  hasToyotaReadDataResponse,
  extractToyotaReadDataPayload,
  parseToyotaNegativeResponse,
  decodeToyotaReadDataResponse,
  decodePidResponse,
  parseSupportedPids,
  isSafeTerminalCommand,
  NativeElmTransport,
  NativeBleElmTransport,
  FakeElmTransport,
  Elm327Client,
  QuicklynksClient,
  QuicklynksFrameBuffer,
  QUICKLYNKS_LIVE_QUERY_HEX,
  QUICKLYNKS_PRODUCTION_GROUPS,
  QUICKLYNKS_OPTIONAL_STANDARD_PIDS,
  QUICKLYNKS_RESEARCH_PROBES,
  buildQuicklynksProductionQuery,
  parseQuicklynksProductionResponse,
  buildQuicklynksOptionalStandardQuery,
  parseQuicklynksOptionalStandardResponse,
  buildQuicklynksResearchQuery,
  parseQuicklynksResearchResponse,
  createQuicklynksResearchState,
  bytesToHex,
  hexToBytes,
  parseQuicklynksRealtimeFrame,
  PID_BY_ID,
  TOYOTA_LIVE_METRIC_IDS,
  sessionToCsv,
  sessionToQuicklynksResearchCsv,
  calculateSessionStats,
  buildAiAnalysisPrompt,
  buildQuicklynksResearchAiPrompt,
  FULL_DIAGNOSTIC_ENGINE_HEADERS,
  TOYOTA_READ_DATA_PROBES,
  TOYOTA_READ_DATA_ALLOWED_COMMANDS,
  evaluateFullDiagnosticStep,
  summarizeFullDiagnostic,
  buildFullDiagnosticReport,
  buildFullDiagnosticAnalysisPrompt,
  createDiagnosticReportId,
  QUICKLYNKS_SUPPORT_BITMAP_PROBES,
  buildQuicklynksSupportBitmapQuery,
  normalizeQuicklynksNotificationChunks,
  evaluateQuicklynksSupportBitmapEvent,
  QUICKLYNKS_WIDE_DIAGNOSTIC_PROBES,
  QUICKLYNKS_WIDE_DIAGNOSTIC_ROUNDS,
  evaluateQuicklynksWideDiagnosticEvent,
  summarizeQuicklynksWideDiagnostic,
  buildQuicklynksWideDiagnosticReport,
  buildQuicklynksWideDiagnosticAnalysisPrompt
} from "../src/core.js";
import {
  parseBtsnoopHci,
  analyzeQuicklynksBtsnoop,
  decodeBtsnooz,
  extractBtsnoopSource,
  buildQuicklynksTraceReport,
  buildQuicklynksTraceAnalysisPrompt
} from "../src/btsnoop.js";

const VERIFIED_QUICKLYNKS_RESPONSE = "13410C800000022680000E04DA00100C660343FF";
const FAST_ELM_OPTIONS = Object.freeze({
  wait: async () => {},
  transportSettleMs: 0,
  resetSettleMs: 0,
  protocolSettleMs: 0,
  retrySettleMs: 0
});

function makeAclAttPacket(opcode, handle, valueHex, connectionHandle = 1) {
  const value = Uint8Array.from(valueHex.match(/../g)?.map(part => Number.parseInt(part, 16)) || []);
  const attLength = 3 + value.length;
  const packet = new Uint8Array(9 + attLength);
  const view = new DataView(packet.buffer);
  packet[0] = 0x02;
  view.setUint16(1, connectionHandle & 0x0fff, true);
  view.setUint16(3, 4 + attLength, true);
  view.setUint16(5, attLength, true);
  view.setUint16(7, 0x0004, true);
  packet[9] = opcode;
  view.setUint16(10, handle, true);
  packet.set(value, 12);
  return packet;
}

function makeBtsnoop(records) {
  const size = 16 + records.reduce((sum, record) => sum + 24 + record.packet.length, 0);
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("btsnoop\0"), 0);
  view.setUint32(8, 1, false);
  view.setUint32(12, 1002, false);
  let offset = 16;
  const epoch = 0x00dcddb30f2f8000n;
  records.forEach((record, index) => {
    view.setUint32(offset, record.packet.length, false);
    view.setUint32(offset + 4, record.packet.length, false);
    view.setUint32(offset + 8, record.flags ?? 0, false);
    view.setUint32(offset + 12, 0, false);
    view.setBigUint64(offset + 16, epoch + BigInt(index * 100000), false);
    bytes.set(record.packet, offset + 24);
    offset += 24 + record.packet.length;
  });
  return bytes;
}

function makeZip(name, data, method = 0) {
  const packed = method === 8 ? new Uint8Array(deflateRawSync(data)) : data;
  const nameBytes = new TextEncoder().encode(name);
  const localSize = 30 + nameBytes.length + packed.length;
  const centralSize = 46 + nameBytes.length;
  const bytes = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(8, method, true);
  view.setUint32(18, packed.length, true);
  view.setUint32(22, data.length, true);
  view.setUint16(26, nameBytes.length, true);
  bytes.set(nameBytes, 30);
  bytes.set(packed, 30 + nameBytes.length);
  const central = localSize;
  view.setUint32(central, 0x02014b50, true);
  view.setUint16(central + 4, 20, true);
  view.setUint16(central + 6, 20, true);
  view.setUint16(central + 10, method, true);
  view.setUint32(central + 16, 0, true);
  view.setUint32(central + 20, packed.length, true);
  view.setUint32(central + 24, data.length, true);
  view.setUint16(central + 28, nameBytes.length, true);
  view.setUint32(central + 42, 0, true);
  bytes.set(nameBytes, central + 46);
  const eocd = central + centralSize;
  view.setUint32(eocd, 0x06054b50, true);
  view.setUint16(eocd + 8, 1, true);
  view.setUint16(eocd + 10, 1, true);
  view.setUint32(eocd + 12, centralSize, true);
  view.setUint32(eocd + 16, central, true);
  return bytes;
}

function makeBtsnooz(records, version = 2) {
  const headerLength = version === 1 ? 7 : 9;
  const bodyLength = records.reduce((sum, record) => sum + headerLength + record.packet.length - 1, 0);
  const body = new Uint8Array(bodyLength);
  const bodyView = new DataView(body.buffer);
  let offset = 0;
  let lastTimestampUs = 0n;
  records.forEach((record, index) => {
    const includedLength = record.packet.length;
    const originalLength = record.originalLength ?? includedLength;
    const deltaUs = record.deltaUs ?? (index === 0 ? 1000 : 100000);
    const type = record.packet[0] === 0x02 ? ((record.flags ?? 0) === 1 ? 0x11 : 0x21) : 0x20;
    bodyView.setUint16(offset, includedLength, true);
    if (version === 2) bodyView.setUint16(offset + 2, originalLength, true);
    bodyView.setUint32(offset + (version === 1 ? 2 : 4), deltaUs, true);
    bodyView.setUint8(offset + (version === 1 ? 6 : 8), type);
    body.set(record.packet.slice(1), offset + headerLength);
    offset += headerLength + includedLength - 1;
    lastTimestampUs += BigInt(deltaUs);
  });
  const compressed = new Uint8Array(deflateSync(body));
  const snooz = new Uint8Array(9 + compressed.length);
  const view = new DataView(snooz.buffer);
  view.setInt8(0, version);
  view.setBigUint64(1, lastTimestampUs, true);
  snooz.set(compressed, 9);
  return snooz;
}

function makeBugreportText(snooz) {
  const base64 = Buffer.from(snooz).toString("base64");
  const wrapped = base64.match(/.{1,76}/g)?.join("\n") || "";
  return new TextEncoder().encode([
    "========================================================",
    "--- BEGIN:BTSNOOP_LOG_SUMMARY",
    wrapped,
    "--- END:BTSNOOP_LOG_SUMMARY",
    "========================================================"
  ].join("\n"));
}

test("ELM327-vastaus siivotaan kaiusta, SEARCHING-rivistä ja kehotteesta", () => {
  const raw = "010C\rSEARCHING...\r41 0C 1A F8\r>";
  assert.equal(cleanElmResponse(raw, "010C"), "41 0C 1A F8");
});

test("0.6.4 eristää btsnoop-lokista vain Quicklynks-kahvan ATT-liikenteen", () => {
  const snoop = makeBtsnoop([
    { flags: 0, packet: makeAclAttPacket(0x52, 0x25, "02410C", 2) },
    { flags: 1, packet: makeAclAttPacket(0x1b, 0x25, "53414C41494E454E", 2) },
    { flags: 0, packet: makeAclAttPacket(0x52, 0x25, "02410C") },
    { flags: 1, packet: makeAclAttPacket(0x1b, 0x25, "03411580") },
    { flags: 0, packet: makeAclAttPacket(0x52, 0x25, "05217E000000") },
    { flags: 1, packet: makeAclAttPacket(0x1b, 0x25, "07617E0102030405") }
  ]);
  const parsed = parseBtsnoopHci(snoop);
  assert.equal(parsed.version, 1);
  assert.equal(parsed.datalinkType, 1002);
  assert.equal(parsed.recordCount, 6);
  assert.equal(parsed.attEvents.length, 6);
  const analysis = analyzeQuicklynksBtsnoop(snoop, { sourceName: "btsnoop_hci.log" });
  assert.equal(analysis.targetHandleHex, "0x0025");
  assert.equal(analysis.targetConnectionHandleHex, "0x001");
  assert.equal(analysis.targetEventCount, 4);
  assert.equal(analysis.sequences.length, 2);
  assert.equal(analysis.uniqueRequests.length, 2);
  assert.equal(analysis.unknownRequests.length, 1);
  assert.equal(analysis.toyotaTargetRequests.length, 1);
  assert.equal(analysis.sequences[0].responseChunks[0].valueHex, "03411580");
  const report = buildQuicklynksTraceReport(analysis, { appVersion: "0.6.4", analyzedAt: Date.UTC(2026, 7, 10, 12, 0, 0) });
  assert.match(report, /quicklynks-obdplus-btsnoop-readonly-v1/);
  assert.match(report, /Quicklynks HCI-yhteys: 0x001/);
  assert.match(report, /Quicklynks ATT-kahva: 0x0025/);
  assert.match(report, /tuntematon binäärikuori/);
  assert.match(report, /05217E000000/);
  assert.doesNotMatch(report, /53414C41494E454E/);
  const prompt = buildQuicklynksTraceAnalysisPrompt(analysis);
  assert.match(prompt, /21 7E ja 21 7F/);
  assert.match(prompt, /Älä ehdota tuntemattoman kuoren lähettämistä/);
});

test("0.6.4 purkaa btsnoop_hci.log-tiedoston Android-bugiraportin ZIP-paketista", async () => {
  const snoop = makeBtsnoop([
    { flags: 0, packet: makeAclAttPacket(0x52, 0x25, "0D410C0D848005857F8182048683") },
    { flags: 1, packet: makeAclAttPacket(0x1b, 0x25, VERIFIED_QUICKLYNKS_RESPONSE) }
  ]);
  const zip = makeZip("FS/data/misc/bluetooth/logs/btsnoop_hci.log", snoop);
  const extracted = await extractBtsnoopSource(zip, "bugreport.zip");
  assert.equal(extracted.container, "zip-btsnoop");
  assert.equal(extracted.entryName, "FS/data/misc/bluetooth/logs/btsnoop_hci.log");
  assert.deepEqual(extracted.bytes, snoop);
  const analysis = analyzeQuicklynksBtsnoop(extracted.bytes, { sourceName: "bugreport.zip", sourceEntryName: extracted.entryName });
  assert.equal(analysis.onlyKnownTableProtocol, true);
  assert.equal(analysis.unknownRequests.length, 0);
});

test("0.6.4 purkaa myös deflate-pakatun btsnoop-merkinnän", async () => {
  const snoop = makeBtsnoop([
    { flags: 0, packet: makeAclAttPacket(0x52, 0x25, "02410C") },
    { flags: 1, packet: makeAclAttPacket(0x1b, 0x25, "03411580") }
  ]);
  const zip = makeZip("FS/data/misc/bluetooth/logs/btsnoop_hci.log", snoop, 8);
  const extracted = await extractBtsnoopSource(zip, "bugreport-deflate.zip");
  assert.deepEqual(extracted.bytes, snoop);
});

test("0.6.4 muuntaa AOSP btsnooz v2 -aineiston kelvolliseksi btsnoop-lokiksi", async () => {
  const records = [
    { flags: 0, packet: makeAclAttPacket(0x52, 0x25, "0D410C0D848005857F8182048683") },
    { flags: 1, packet: makeAclAttPacket(0x1b, 0x25, VERIFIED_QUICKLYNKS_RESPONSE) }
  ];
  const decoded = await decodeBtsnooz(makeBtsnooz(records, 2));
  const parsed = parseBtsnoopHci(decoded);
  assert.equal(parsed.datalinkType, 1002);
  assert.equal(parsed.recordCount, 2);
  assert.equal(parsed.attEvents.length, 2);
  const analysis = analyzeQuicklynksBtsnoop(decoded);
  assert.equal(analysis.targetHandleHex, "0x0025");
  assert.equal(analysis.sequences.length, 1);
});

test("0.6.4 purkaa bugiraportin pää-TXT:n BTSNOOP_LOG_SUMMARY-osion", async () => {
  const records = [
    { flags: 0, packet: makeAclAttPacket(0x52, 0x25, "02410C") },
    { flags: 1, packet: makeAclAttPacket(0x1b, 0x25, "03411580") }
  ];
  const zip = makeZip("bugreport-CPH2415.txt", makeBugreportText(makeBtsnooz(records, 2)), 8);
  const extracted = await extractBtsnoopSource(zip, "bugreport-CPH2415.zip");
  assert.equal(extracted.container, "zip-btsnooz");
  assert.equal(extracted.entryName, "bugreport-CPH2415.txt#BTSNOOP_LOG_SUMMARY");
  const analysis = analyzeQuicklynksBtsnoop(extracted.bytes, {
    sourceName: "bugreport-CPH2415.zip",
    sourceEntryName: extracted.entryName,
    sourceContainer: extracted.container
  });
  assert.equal(analysis.targetHandleHex, "0x0025");
  const report = buildQuicklynksTraceReport(analysis, { appVersion: "0.6.4" });
  assert.match(report, /Lähdemuoto: zip-btsnooz/);
});

test("0.6.4 tukee myös AOSP btsnooz v1 -tietuerakennetta", async () => {
  const records = [
    { flags: 0, packet: makeAclAttPacket(0x52, 0x25, "02410C") },
    { flags: 1, packet: makeAclAttPacket(0x1b, 0x25, "03411580") }
  ];
  const decoded = await decodeBtsnooz(makeBtsnooz(records, 1));
  assert.equal(parseBtsnoopHci(decoded).recordCount, 2);
  assert.equal(analyzeQuicklynksBtsnoop(decoded).sequences.length, 1);
});

test("0.6.4 erottaa puuttuvan ja vioittuneen BTSNOOP_LOG_SUMMARY-osion", async () => {
  const missing = makeZip("bugreport-CPH2415.txt", new TextEncoder().encode("ei Bluetooth HCI -osiota"));
  await assert.rejects(() => extractBtsnoopSource(missing, "missing.zip"), /ei löytynyt erillistä btsnoop_hci\.log-tiedostoa eikä pää-TXT:n BTSNOOP_LOG_SUMMARY-osiota/);
  const brokenText = new TextEncoder().encode("--- BEGIN:BTSNOOP_LOG_SUMMARY\nnot-base64!\n--- END:BTSNOOP_LOG_SUMMARY");
  const broken = makeZip("bugreport-CPH2415.txt", brokenText);
  await assert.rejects(() => extractBtsnoopSource(broken, "broken.zip"), /BTSNOOP_LOG_SUMMARY löytyi, mutta sen purku epäonnistui/);
});

test("vikakoodit muodostetaan SAE-koodauksesta", () => {
  assert.equal(decodeDtcBytes(0x04, 0x01), "P0401");
  assert.equal(decodeDtcBytes(0x00, 0x87), "P0087");
  assert.deepEqual(parseDtcResponse("43 04 01 00 00\r>", 0x43).map(item => item.code), ["P0401"]);
});

test("MIL-tila ja koodien määrä tulkitaan", () => {
  assert.deepEqual(parseMilStatus("41 01 83 07 A0 01\r>"), { milOn: true, count: 3 });
});

test("keskeiset PID-muunnokset ovat oikein", () => {
  assert.equal(decodePidResponse("rpm", "41 0C 1A F8\r>"), 1726);
  assert.equal(decodePidResponse("speed", "41 0D 64\r>"), 100);
  assert.equal(decodePidResponse("coolant", "41 05 7B\r>"), 83);
  assert.equal(decodePidResponse("maf", "41 10 07 D0\r>"), 20);
  assert.equal(decodePidResponse("railPressure", "41 23 0B B8\r>"), 30000);
  assert.equal(decodePidResponse("voltage", "41 42 37 78\r>"), 14.2);
  assert.equal(decodePidResponse("fuelRate", "41 5E 00 4C\r>"), 3.8);
});

test("standardoidut diesel-PIDit tulkitaan dokumentoiduilla Mode 01 -kaavoilla", () => {
  const egr = "41 69 FF 80 66 80 00 00 00\r>";
  assert.equal(Math.round(decodePidResponse("egrPositionTarget", egr)), 50);
  assert.equal(Math.round(decodePidResponse("egrPositionActual", egr)), 40);
  assert.equal(decodePidResponse("egrPositionError", egr), 0);

  const rail = "41 6D FF 0F A0 0F 3C 50\r>";
  assert.equal(decodePidResponse("railPressureTarget", rail), 40000);
  assert.equal(decodePidResponse("railPressureActual", rail), 39000);
  assert.equal(decodePidResponse("fuelRailTemperature", rail), 40);

  const boost = "41 70 FF 0C 80 0B 40\r>";
  assert.equal(decodePidResponse("boostPressureTarget", boost), 100);
  assert.equal(decodePidResponse("boostPressureActual", boost), 90);
  assert.equal(Math.round(decodePidResponse("vgtPositionTarget", "41 71 FF 80 66 00 00 00\r>")), 50);
  assert.equal(Math.round(decodePidResponse("vgtPositionActual", "41 71 FF 80 66 00 00 00\r>")), 40);
  assert.equal(decodePidResponse("exhaustPressureB1", "41 73 FF 03 E8 00 00\r>"), 10);
  assert.equal(decodePidResponse("injectionTiming", "41 5D 69 00\r>"), 0);
});

test("DPF-, EGT- ja lambda-PIDit tulkitaan ilman Toyota-kohtaisten arvojen arvaamista", () => {
  assert.equal(decodePidResponse("exhaustTemperatureB1S1", "41 78 03 0D 48 0B B8\r>"), 300);
  assert.equal(decodePidResponse("exhaustTemperatureB1S2", "41 78 03 0D 48 0B B8\r>"), 260);
  const dpfPressure = "41 7A 07 00 64 27 10 26 AC\r>";
  assert.equal(decodePidResponse("dpfDifferentialPressure", dpfPressure), 1);
  assert.equal(decodePidResponse("dpfInletPressure", dpfPressure), 100);
  assert.equal(decodePidResponse("dpfOutletPressure", dpfPressure), 99);
  const dpfTemperature = "41 7C 03 0D 48 0B B8\r>";
  assert.equal(decodePidResponse("dpfInletTemperature", dpfTemperature), 300);
  assert.equal(decodePidResponse("dpfOutletTemperature", dpfTemperature), 260);
  const dpfState = "41 8B 0F 03 80 0E 10 01 2C\r>";
  assert.equal(decodePidResponse("dpfRegenerationActive", dpfState), 1);
  assert.equal(decodePidResponse("dpfActiveRegeneration", dpfState), 1);
  assert.equal(Math.round(decodePidResponse("dpfRegenerationTrigger", dpfState)), 50);
  assert.equal(decodePidResponse("dpfAverageRegenerationTime", dpfState), 1);
  assert.equal(decodePidResponse("dpfAverageRegenerationDistance", dpfState), 300);
  const lambdaData = [0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0x20, 0x00, 0, 0, 0, 0, 0, 0];
  assert.equal(PID_BY_ID.dieselLambdaB1S1.decode(lambdaData), 1);
  assert.equal(decodePidResponse("pmSensorDpfLoad", "41 8F FF 00 13 88\r>"), 50);
});

test("tuettujen PIDien bittikartta tulkitaan", () => {
  const supported = parseSupportedPids("41 00 88 18 00 01\r>", 0x00);
  assert.equal(supported.has(0x01), true);
  assert.equal(supported.has(0x05), true);
  assert.equal(supported.has(0x0c), true);
  assert.equal(supported.has(0x0d), true);
  assert.equal(supported.has(0x20), true);
});

test("ELM327:n ECU- ja Toyota-vastaukset tunnistetaan myös CAN-otsakkeiden kanssa", () => {
  assert.equal(hasModePidResponse("7E8 06 41 00 98 3B 80 13\r>", 0x41, 0x00), true);
  assert.equal(hasModePidResponse("NO DATA\r>", 0x41, 0x00), false);
  assert.equal(hasToyotaReadDataResponse("7E8 10 14 61 7E 01 02 03\r7E8 21 04 05 06\r>"), true);
  assert.equal(hasToyotaReadDataResponse("7E8 03 7F 21 12\r>"), false);
});

test("Techstreamin tuotanto- ja suutintestivastaukset puretaan määritellyillä kaavoilla", () => {
  assert.deepEqual(extractToyotaReadDataPayload("7E8 06 61 7E 0A 04 02 00\r>", 0x7e), [0x0a, 0x04, 0x02, 0x00]);
  const pressure = decodeToyotaReadDataResponse("7E8 06 61 7E 0A 04 02 00\r>", 0x7e);
  assert.equal(pressure.complete, true);
  assert.ok(Math.abs(pressure.values.dpnrDifferentialPressureKpa - 4.9996) < 0.0001);
  assert.equal(pressure.values.sulfurRegenerationStateName, "Operate");
  assert.equal(pressure.values.pmRegenerationStateName, "Standby");
  assert.equal(pressure.values.regenerationActive, true);

  const temperatures = decodeToyotaReadDataResponse("7E8 06 61 7F 01 00 02 00\r>", 0x7f);
  assert.equal(temperatures.values.dpnrInletTemperatureC, 160);
  assert.equal(temperatures.values.dpnrOutletTemperatureC, 320);

  const egr = decodeToyotaReadDataResponse("7E8 03 61 2C 80\r>", 0x2c);
  assert.ok(Math.abs(egr.values.egrPositionPercent - 50.196078) < 0.0001);

  const fuelTemperature = decodeToyotaReadDataResponse("7E8 03 61 93 52\r>", 0x93);
  assert.equal(fuelTemperature.values.fuelTemperatureC, 42);
  const railPressure = decodeToyotaReadDataResponse("7E8 03 61 96 28\r>", 0x96);
  assert.equal(railPressure.values.railPressureMpa, 40);
  const feedback = decodeToyotaReadDataResponse("7E8 06 61 9C 40 38 48 30\r>", 0x9c);
  assert.deepEqual(feedback.values, {
    injectionFeedback1Mm3: 0,
    injectionFeedback2Mm3: -1.25,
    injectionFeedback3Mm3: 1.25,
    injectionFeedback4Mm3: -2.5
  });
  const timing = decodeToyotaReadDataResponse("7E8 04 61 AF 03 B6\r>", 0xaf);
  assert.equal(timing.values.injectionTimingDegCa, 5);
  assert.deepEqual(parseToyotaNegativeResponse("7E8 03 7F 21 12\r>"), {
    code: "12",
    description: "alitoimintoa tai tunnistetta ei tueta"
  });
});

test("vLinker MC+ löytää varmennetut Toyota-livearvot ja lukee saman 217E-kehyksen vain kerran ryhmälle", async () => {
  const commands = [];
  const transport = {
    async connect() { return { ok: true, name: "vLinker MC-Android", address: "AA:BB:CC:DD:EE:FF", transport: "classic" }; },
    async disconnect() {},
    async send(command) {
      commands.push(command);
      if (command === "ATI") return "ELM327 v2.2\r>";
      if (command === "ATDP") return "ISO 15765-4 (CAN 11/500)\r>";
      if (command === "0100") return "41 00 00 00 00 00\r>";
      if (command === "217E") return "7E8 06 61 7E 0A 04 02 00\r>";
      if (command === "217F") return "7E8 06 61 7F 01 00 02 00\r>";
      if (command === "212C") return "7E8 03 61 2C 80\r>";
      if (command.startsWith("AT")) return "OK\r>";
      return "NO DATA\r>";
    }
  };
  const client = new Elm327Client(transport, () => {}, () => {}, FAST_ELM_OPTIONS);
  const info = await client.connect("AA:BB:CC:DD:EE:FF", "auto");
  assert.equal(info.adapterProfile.vlinker, true);
  const supported = await client.readSupportedPids();
  assert.deepEqual([...TOYOTA_LIVE_METRIC_IDS].sort(), [
    "dpnrDifferentialPressure", "dpnrInletTemperature", "dpnrOutletTemperature",
    "dpnrPmRegenerationState", "dpnrRegenerationActive", "dpnrSulfurRegenerationState",
    "toyotaEgrPosition"
  ].sort());
  for (const id of TOYOTA_LIVE_METRIC_IDS) assert.equal(supported.has(id), true);

  client.toyotaResponseCache.get("217E").updatedAt = 0;
  const before = commands.filter(command => command === "217E").length;
  const pressure = await client.readPid(PID_BY_ID.dpnrDifferentialPressure);
  const state = await client.readPid(PID_BY_ID.dpnrPmRegenerationState);
  assert.ok(Math.abs(pressure.value - 4.9996) < 0.0001);
  assert.equal(state.value, 0);
  assert.equal(commands.filter(command => command === "217E").length, before + 1);
  assert.deepEqual([...new Set(commands.filter(command => /^21/.test(command)))].sort(), ["212C", "217E", "217F"]);
});

test("Toyota Read Data -sallintalista estää kentässä vastaamattoman 219C-pyynnön", () => {
  assert.deepEqual(TOYOTA_READ_DATA_PROBES.map(probe => probe.command), ["217E", "217F", "212C"]);
  assert.deepEqual(TOYOTA_READ_DATA_ALLOWED_COMMANDS.slice(0, 6), [
    "217E", "02217E0000000000",
    "217F", "02217F0000000000",
    "212C", "02212C0000000000"
  ]);
  assert.equal(TOYOTA_READ_DATA_ALLOWED_COMMANDS.includes("2193"), true);
  assert.equal(TOYOTA_READ_DATA_ALLOWED_COMMANDS.includes("2196"), true);
  assert.equal(TOYOTA_READ_DATA_ALLOWED_COMMANDS.includes("219C"), false);
  assert.equal(TOYOTA_READ_DATA_ALLOWED_COMMANDS.includes("21AF"), true);
  assert.equal(evaluateFullDiagnosticStep(
    { command: "217F", expected: "toyotaReadData", toyotaIdentifier: 0x7f },
    "7E8 06 61 7F 01 00 02 00\r>"
  ).status, "PASS");
  assert.equal(evaluateFullDiagnosticStep(
    { command: "212C", expected: "toyotaReadData", toyotaIdentifier: 0x2c },
    "7E8 03 7F 21 12\r>"
  ).negativeToyota.code, "12");
});

test("raakaterminaali estää kirjoittavat komennot", () => {
  assert.equal(isSafeTerminalCommand("ATI"), true);
  assert.equal(isSafeTerminalCommand("01 0C"), true);
  assert.equal(isSafeTerminalCommand("03"), true);
  assert.equal(isSafeTerminalCommand("04"), false);
  assert.equal(isSafeTerminalCommand("2F01"), false);
  assert.equal(isSafeTerminalCommand("217E"), true);
  assert.equal(isSafeTerminalCommand("217F"), true);
  assert.equal(isSafeTerminalCommand("212C"), true);
  assert.equal(isSafeTerminalCommand("219C"), false);
  assert.equal(isSafeTerminalCommand("21AF"), true);
  assert.equal(isSafeTerminalCommand("2192"), false);
});

test("laaja diagnostiikka käy läpi kaikki 7E0–7E7-pyyntöosoitteet", () => {
  assert.deepEqual(FULL_DIAGNOSTIC_ENGINE_HEADERS, ["7E0", "7E1", "7E2", "7E3", "7E4", "7E5", "7E6", "7E7"]);
});

test("laajan diagnostiikan vaihe arvioi identiteetin, OBD-vastauksen ja tyhjän kuuntelun", () => {
  assert.equal(evaluateFullDiagnosticStep({ command: "ATI", expected: "identity" }, "ELM327 v2.1\r>").status, "PASS");
  assert.equal(evaluateFullDiagnosticStep({ command: "0100", expected: "modePid", responseMode: 0x41, pid: 0x00 }, "7E8 06 41 00 98 3B 80 13\r>").status, "PASS");
  assert.equal(evaluateFullDiagnosticStep({ command: "0100", expected: "modePid", responseMode: 0x41, pid: 0x00 }, "NO DATA\r>", "Ohjainlaite ei palauttanut tietoa").status, "FAIL");
  assert.equal(evaluateFullDiagnosticStep({ command: "ATMA", expected: "monitor" }, "", "Aikakatkaisu: ATMA").status, "WARN");
  assert.equal(evaluateFullDiagnosticStep({ command: "AT@2", expected: "optional", optional: true }, "?\r>", "ELM327 ei tunnistanut komentoa").unsupported, true);
});

test("laaja raportti säilyttää raakavastaukset ja välttää varman ATCS-vikapäätelmän", () => {
  const run = {
    startedAt: Date.UTC(2026, 7, 5, 12, 0, 0),
    endedAt: Date.UTC(2026, 7, 5, 12, 1, 0),
    cancelled: false,
    meta: { appVersion: "0.5.1", vehicleKey: "is220d", device: "OBDII", address: "66:1E:32:1F:27:BA", engineRunning: true, initialConnectionStrategy: "forced-can6" },
    results: [
      { sequence: 1, phase: "Adapteri", label: "Tunniste", command: "ATI", status: "PASS", expected: "identity", validResponse: true, raw: "ELM327 v2.1\r>", cleaned: "ELM327 v2.1", durationMs: 80, timeoutMs: 5000 },
      { sequence: 2, phase: "CAN", label: "Protokolla", command: "ATSP6", status: "PASS", expected: "ok", validResponse: true, raw: "OK\r>", cleaned: "OK", durationMs: 30, timeoutMs: 4000 },
      { sequence: 3, phase: "CAN", label: "Laskurit", command: "ATCS", status: "PASS", expected: "optional", validResponse: true, raw: "T:60 R:00\r>", cleaned: "T:60 R:00", durationMs: 20, timeoutMs: 4000 },
      { sequence: 4, phase: "ECU", label: "7E0 kierrokset", command: "010C", requestHeader: "7E0", status: "PASS", expected: "modePid", validResponse: true, raw: "7E8 04 41 0C 0C 80\r>", cleaned: "7E8 04 41 0C 0C 80", durationMs: 90, timeoutMs: 6000 }
    ]
  };
  run.summary = summarizeFullDiagnostic(run);
  assert.equal(run.summary.adapterResponded, true);
  assert.deepEqual(run.summary.directHeaders, ["7E0"]);
  assert.match(run.summary.findings.join("\n"), /ATCS palautti arvon/);
  assert.match(run.summary.findings.join("\n"), /ilman kloonikohtaista virhelaskuritulkintaa/);
  const report = buildFullDiagnosticReport(run);
  assert.match(report, /BEGIN LEXUS OBD FLEX FULL DIAGNOSTIC REPORT/);
  assert.match(report, /Raporttimuoto: elm-can-readonly-v6-multivehicle/);
  assert.match(report, /Ajoneuvoprofiili: is220d-xe20-2ad-fhv-readonly-v1/);
  assert.match(report, /Yhdistämisessä toiminut yhteyspolku: forced-can6/);
  assert.match(report, /Bluetooth-osoite: \*\*:\*\*:\*\*:\*\*:27:BA/);
  assert.doesNotMatch(report, /66:1E:32:1F:27:BA/);
  assert.match(report, /RAW_BEGIN\n7E8 04 41 0C 0C 80/);
  assert.match(report, /KONELUETTAVA TSV/);
  assert.match(report, /connection_strategy/);
  assert.match(buildFullDiagnosticAnalysisPrompt(run), /älä päättele ATCS-arvosta yksin/i);
});

test("tunnistamattoman auton raportti ei nimeä sitä IS220d:ksi", () => {
  const run = { startedAt: Date.now(), endedAt: Date.now(), meta: { vehicleKey: "auto", vehicle: "Yleinen EOBD" }, results: [] };
  const report = buildFullDiagnosticReport(run);
  assert.match(report, /Ajoneuvoprofiili: tunnistamaton \/ yleinen EOBD/);
  assert.match(report, /Toyota Read Data -vastauksia: 0\/0/);
  assert.doesNotMatch(report, /Ajoneuvoprofiili: is220d/);
});

test("raporttitunnus on vakaa annetulla ajalla ja satunnaisarvolla", () => {
  assert.equal(createDiagnosticReportId("qkl", Date.UTC(2026, 7, 9, 12, 34, 56, 789), 0.5), "QKL-20260809123456789-800000");
});

test("Quicklynks-laaja diagnostiikka käyttää vain lukittuja 02 41 PID -kyselyjä kolmella kierroksella", () => {
  assert.equal(QUICKLYNKS_WIDE_DIAGNOSTIC_ROUNDS, 3);
  assert.equal(QUICKLYNKS_WIDE_DIAGNOSTIC_PROBES.length, 15);
  const pids = QUICKLYNKS_WIDE_DIAGNOSTIC_PROBES.map(probe => probe.identifierHex);
  assert.deepEqual(pids, ["0C", "05", "0B", "10", "2C", "2D", "69", "73", "78", "79", "7A", "7B", "7C", "8B", "8F"]);
  for (const probe of QUICKLYNKS_WIDE_DIAGNOSTIC_PROBES) {
    assert.match(buildQuicklynksResearchQuery(probe), /^0241[0-9A-F]{2}$/);
  }
});

test("0.6.1 kartoittaa kuusi tukibittikandidaattia vain 02 41 PID -lukukyselyillä", () => {
  assert.deepEqual(QUICKLYNKS_SUPPORT_BITMAP_PROBES.map(probe => probe.identifierHex), ["00", "20", "40", "60", "80", "A0"]);
  assert.deepEqual(QUICKLYNKS_SUPPORT_BITMAP_PROBES.map(buildQuicklynksSupportBitmapQuery), [
    "024100", "024120", "024140", "024160", "024180", "0241A0"
  ]);
  assert.throws(() => buildQuicklynksSupportBitmapQuery(0xc0), /sallittuun listaan/);
});

test("Quicklynksin FF-jatkomerkit poistetaan vain keskeneräisen kehyksen palarajoista", () => {
  const first = `2141${"00".repeat(18)}`;
  const second = `FF${"00".repeat(14)}`;
  const normalized = normalizeQuicklynksNotificationChunks(`${first}|${second}`);
  assert.equal(normalized.continuationMarkersStripped, 1);
  assert.equal(normalized.normalizedHex, `2141${"00".repeat(32)}`);

  const completeThenFfFrame = normalizeQuicklynksNotificationChunks("024180|FF41");
  assert.equal(completeThenFfFrame.continuationMarkersStripped, 0);
  assert.equal(completeThenFfFrame.normalizedHex, "024180FF41");
});

test("tukibittikandidaatti vaatii täsmälleen neljä tavua ja firmware-artefakti hylätään", () => {
  const probe = QUICKLYNKS_SUPPORT_BITMAP_PROBES[0];
  const valid = evaluateQuicklynksSupportBitmapEvent(probe, {
    requestHex: "024100",
    responseHex: "054198180001",
    notificationHex: "054198180001",
    outcome: "response"
  });
  assert.equal(valid.validBitmap, true);
  assert.equal(valid.dataHex, "98180001");
  assert.equal(valid.advertisedPids.includes("01"), true);
  assert.equal(valid.advertisedPids.includes("20"), true);

  const artifact = evaluateQuicklynksSupportBitmapEvent(probe, {
    requestHex: "024100",
    responseHex: `2141${"00".repeat(18)}FF${"00".repeat(14)}`,
    notificationHex: `2141${"00".repeat(18)}|FF${"00".repeat(14)}`,
    outcome: "response"
  });
  assert.equal(artifact.validBitmap, false);
  assert.equal(artifact.artifact, true);
  assert.equal(artifact.supportState, "firmware-artifact");
  assert.equal(artifact.continuationMarkersStripped, 1);
});

test("Quicklynks-laajan diagnostiikan vastaus vaatii payload-only-rakenteen ja dokumentoidun pituuden", () => {
  const probe = QUICKLYNKS_WIDE_DIAGNOSTIC_PROBES.find(item => item.identifierHex === "7A");
  const valid = evaluateQuicklynksWideDiagnosticEvent(probe, {
    requestHex: "02417A",
    responseHex: "0841070064271026AC",
    outcome: "response",
    notificationCount: 2,
    notificationHex: "08410700|64271026AC"
  });
  assert.equal(valid.status, "PASS");
  assert.equal(valid.validResponse, true);
  assert.equal(valid.fragmented, true);
  assert.equal(valid.dataHex, "070064271026AC");

  const echo = evaluateQuicklynksWideDiagnosticEvent(probe, { requestHex: "02417A", responseHex: "02417A", outcome: "response" });
  assert.equal(echo.validResponse, false);
  const wrongType = evaluateQuicklynksWideDiagnosticEvent(probe, { requestHex: "02417A", responseHex: "0842070064271026AC", outcome: "response" });
  assert.equal(wrongType.validResponse, false);

  const longProbe = QUICKLYNKS_WIDE_DIAGNOSTIC_PROBES.find(item => item.identifierHex === "8F");
  const artifact = evaluateQuicklynksWideDiagnosticEvent(longProbe, {
    requestHex: "02418F",
    responseHex: `2141${"00".repeat(18)}FF${"00".repeat(14)}`,
    notificationHex: `2141${"00".repeat(18)}|FF${"00".repeat(14)}`,
    outcome: "response",
    notificationCount: 2
  });
  assert.equal(artifact.validResponse, false);
  assert.equal(artifact.artifact, true);
  assert.equal(artifact.supportState, "firmware-artifact");
  assert.equal(artifact.continuationMarkersStripped, 1);
});

test("Quicklynks-laaja raportti säilyttää raakavastauksen, BLE-palat ja toistettavuuden", () => {
  const run = {
    kind: "quicklynks",
    startedAt: Date.UTC(2026, 7, 9, 12, 0, 0),
    endedAt: Date.UTC(2026, 7, 9, 12, 1, 0),
    cancelled: false,
    meta: {
      reportId: "QKL-20260809120000000-ABC123",
      appVersion: "0.6.1",
      engineRunningDeclared: null,
      observedRpm: 800,
      adapter: "Quicklynks BK-BLE-1.0 · OBD",
      address: "25:28:07:06:00:66",
      bleDiagnostics: { sdk: 35, notificationEnabled: true, responseChunkCount: 2 }
    },
    supportResults: [{
      sequence: 1,
      testKind: "support-bitmap",
      round: 0,
      status: "PASS",
      identifierHex: "00",
      category: "support-bitmap",
      label: "PID-tukibittikandidaatti 01–20",
      requestHex: "024100",
      responseHex: "054198180001",
      notificationCount: 1,
      notificationHex: "054198180001",
      durationMs: 100,
      outcome: "response",
      validResponse: true,
      validBitmap: true,
      supportState: "bitmap-candidate",
      advertisedPids: ["01", "04", "05", "0C", "0D", "20"],
      nextRangeAdvertised: true,
      timeout: false,
      disconnected: false,
      fragmented: false,
      combinedFrames: false,
      frameCount: 1,
      validFrameHex: "054198180001",
      dataHex: "98180001",
      pendingHex: "",
      continuationMarkersStripped: 0,
      interpretation: "Quicklynks palautti 4 tavun tukibittikandidaatin"
    }],
    results: [1, 2, 3].map((round, index) => ({
      sequence: index + 2,
      testKind: "pid",
      round,
      status: "PASS",
      identifierHex: "7A",
      category: "dpf",
      label: "DPF-paineet B1",
      requestHex: "02417A",
      responseHex: "0841070064271026AC",
      notificationCount: 2,
      notificationHex: "08410700|64271026AC",
      durationMs: 120,
      outcome: "response",
      validResponse: true,
      timeout: false,
      disconnected: false,
      fragmented: true,
      combinedFrames: false,
      frameCount: 1,
      validFrameHex: "0841070064271026AC",
      dataHex: "070064271026AC",
      pendingHex: "",
      interpretation: "Kelvollinen PIDin 7A payload-only 41 -vastaus"
    }))
  };
  run.summary = summarizeQuicklynksWideDiagnostic(run);
  assert.deepEqual(run.summary.dpfEgrPids, ["7A"]);
  assert.deepEqual(run.summary.repeatablePids, ["7A"]);
  assert.equal(run.summary.engineRunning, true);
  const report = buildQuicklynksWideDiagnosticReport(run);
  assert.match(report, /Raporttityyppi: Laaja Quicklynks BLE -diagnostiikka/);
  assert.match(report, /Raporttitunnus: QKL-20260809120000000-ABC123/);
  assert.match(report, /quicklynks-ble-readonly-v2/);
  assert.match(report, /RAW_BEGIN\n0841070064271026AC/);
  assert.match(report, /NOTIFICATION_CHUNKS_BEGIN\n08410700\|64271026AC/);
  assert.match(report, /PID-TUKIBITTIKANDIDAATIT/);
  assert.match(report, /bitmap 98180001/);
  assert.match(report, /continuation_markers_stripped/);
  assert.match(report, /Kolmella kierroksella vastanneet PIDit: 7A/);
  assert.match(buildQuicklynksWideDiagnosticAnalysisPrompt(run), /Techstream/i);
});

test("natiivikuljetukset merkitsevät Classic- ja BLE-laitteet oikein", async () => {
  const classic = new NativeElmTransport({
    pairedDevices: () => JSON.stringify([{ name: "ELM327", address: "AA:BB" }]),
    connect: () => JSON.stringify({ ok: true }),
    send: () => ">",
    disconnect: () => {},
    isConnected: () => true
  });
  const ble = new NativeBleElmTransport({
    scanDevices: () => JSON.stringify([
      { name: "BLE327", address: "CC:DD", rssi: -42, services: "[0000fff0-0000-1000-8000-00805f9b34fb]" },
      { name: "Nimetön BLE-laite", address: "EE:FF", rssi: -61 }
    ]),
    diagnostics: () => JSON.stringify({ sdk: 35, bluetoothEnabled: true, scanPermission: true, connectPermission: true }),
    connect: () => JSON.stringify({ ok: true }),
    send: () => ">",
    disconnect: () => {},
    isConnected: () => true
  });
  assert.equal((await classic.pairedDevices())[0].transport, "classic");
  assert.deepEqual(await ble.scanDevices(1000), [
    { name: "BLE327", address: "CC:DD", rssi: -42, services: "[0000fff0-0000-1000-8000-00805f9b34fb]", transport: "ble" },
    { name: "Nimetön BLE-laite", address: "EE:FF", rssi: -61, transport: "ble" }
  ]);
  assert.deepEqual(await ble.diagnostics(), {
    nativeDiagnostics: true,
    sdk: 35,
    bluetoothEnabled: true,
    scanPermission: true,
    connectPermission: true,
    connectionEvents: []
  });
});

test("BLE-kuljetus palauttaa Quicklynksin monipalavastauksen ilman FF-jatkomerkkejä", async () => {
  const raw = `2141${"00".repeat(18)}FF${"00".repeat(14)}`;
  const chunks = `2141${"00".repeat(18)}|FF${"00".repeat(14)}`;
  const transport = new NativeBleElmTransport({
    scanDevices: () => "[]",
    connect: () => JSON.stringify({ ok: true }),
    send: () => raw,
    diagnostics: () => JSON.stringify({ responseChunkCount: 2, responseChunksHex: chunks }),
    disconnect: () => {},
    isConnected: () => true
  });
  const normalized = await transport.sendBinary("02418F", 1000);
  assert.equal(normalized, `2141${"00".repeat(32)}`);
  assert.equal(transport.connectionEvents.some(line => /poistettu 1 FF-jatkomerkkiä/.test(line)), true);
});

test("BLE-profiilin tieto säilyy ELM327-alustuksen läpi", async () => {
  const commands = [];
  const bridge = {
    scanDevices: () => "[]",
    connect: () => JSON.stringify({ ok: true, transport: "ble", transportProfile: "FFF0 · FFF2→FFF1" }),
    send: command => {
      commands.push(command);
      if (command === "ATI") return "ELM327 v1.5\r>";
      if (command === "ATDP") return "ISO 15765-4 CAN\r>";
      return "OK\r>";
    },
    disconnect: () => {},
    isConnected: () => true
  };
  const client = new Elm327Client(new NativeBleElmTransport(bridge), () => {}, () => {}, FAST_ELM_OPTIONS);
  const info = await client.connect("CC:DD", "auto");
  assert.equal(info.transportProfile, "FFF0 · FFF2→FFF1");
  assert.equal(info.adapter, "ELM327 v1.5");
  assert.deepEqual(commands.slice(0, 3), ["ATI", "0100", "ATZ"]);
});

test("0.5.1 säilyttää toimivan nykytilan eikä nollaa ELM-kloonia turhaan", async () => {
  const commands = [];
  const waits = [];
  const transport = {
    async connect() { return { ok: true, name: "GEKO" }; },
    async send(command) {
      commands.push(command);
      if (command === "ATI") return "ELM327 v2.1\r>";
      if (command === "0100") return "41 00 98 3B 80 13\r>";
      if (command === "ATDP") return "ISO 15765-4 CAN 11/500\r>";
      return "OK\r>";
    },
    async disconnect() {},
    isConnected() { return true; }
  };
  const client = new Elm327Client(transport, () => {}, () => {}, {
    wait: async milliseconds => waits.push(milliseconds),
    transportSettleMs: 1800,
    resetSettleMs: 1800,
    protocolSettleMs: 900,
    retrySettleMs: 2500
  });
  const info = await client.connect("AA:BB", "auto");
  assert.equal(info.ecuConnected, true);
  assert.equal(info.connectionStrategy, "current");
  assert.deepEqual(commands.slice(0, 2), ["ATI", "0100"]);
  assert.equal(commands.includes("ATZ"), false);
  assert.equal(commands.includes("ATSP0"), false);
  assert.equal(commands.includes("ATTP6"), false);
  assert.equal(commands.includes("ATSP6"), false);
  assert.deepEqual(waits, [1800]);
});

test("0.5.1 tekee hitaan otsakkeettoman automaattihaun ja pysähtyy ensimmäiseen 41 00 -vastaukseen", async () => {
  const commands = [];
  const waits = [];
  let automaticAttempts = 0;
  let automaticMode = false;
  const transport = {
    async connect() { return { ok: true, name: "GEKO" }; },
    async send(command) {
      commands.push(command);
      if (command === "ATI" || command === "ATZ") return "ELM327 v2.1\r>";
      if (command === "ATSP0") { automaticMode = true; return "OK\r>"; }
      if (command === "0100") {
        if (!automaticMode) return "NO DATA\r>";
        automaticAttempts += 1;
        return automaticAttempts === 2 ? "41 00 98 3B 80 13\r>" : "NO DATA\r>";
      }
      if (command === "ATDP") return "AUTO, ISO 15765-4 CAN 11/500\r>";
      return "OK\r>";
    },
    async disconnect() {},
    isConnected() { return true; }
  };
  const client = new Elm327Client(transport, () => {}, () => {}, {
    wait: async milliseconds => waits.push(milliseconds),
    transportSettleMs: 1800,
    resetSettleMs: 1800,
    protocolSettleMs: 900,
    retrySettleMs: 2500
  });
  const info = await client.connect("AA:BB", "auto");
  assert.equal(info.ecuConnected, true);
  assert.equal(info.connectionStrategy, "auto-sp0");
  assert.equal(commands.includes("ATZ"), true);
  assert.equal(commands.includes("ATSP0"), true);
  assert.equal(commands.includes("ATSH7DF"), false);
  assert.equal(commands.includes("ATTP6"), false);
  assert.equal(commands.includes("ATSP6"), false);
  assert.deepEqual(waits, [1800, 1800, 900, 2500]);
});

test("ELM327 erottaa Bluetooth-, adapteri- ja ECU-vaiheet sekä kokeilee automaatin jälkeen CAN 6:ta", async () => {
  const commands = [];
  const states = [];
  let forcedCan = false;
  const transport = {
    async connect() { return { ok: true, name: "OBDII", address: "AA:BB" }; },
    async send(command) {
      commands.push(command);
      if (command === "ATI") return "ELM327 v1.5\r>";
      if (command === "ATDP") return "ISO 15765-4 CAN 11/500\r>";
      if (command === "ATSP6") { forcedCan = true; return "OK\r>"; }
      if (command === "0100") return forcedCan ? "41 00 98 3B 80 13\r>" : "UNABLE TO CONNECT\r>";
      return "OK\r>";
    },
    async disconnect() {},
    isConnected() { return true; }
  };
  const client = new Elm327Client(transport, () => {}, event => states.push(event), FAST_ELM_OPTIONS);
  const info = await client.connect("AA:BB", "auto");
  assert.equal(info.ecuConnected, true);
  assert.equal(client.ecuConnected, true);
  assert.ok(commands.filter(command => command === "0100").length >= 2);
  assert.equal(commands[0], "ATI");
  assert.equal(commands[1], "0100");
  assert.equal(commands.includes("ATTP6"), true);
  assert.equal(commands.includes("ATSP6"), true);
  assert.equal(states.some(event => event.stage === "bluetooth" && event.status === "connected"), true);
  assert.equal(states.some(event => event.stage === "elm" && event.status === "connected"), true);
  assert.equal(states.some(event => event.stage === "ecu" && event.status === "retry"), true);
  assert.equal(states.some(event => event.stage === "ecu" && event.status === "connected"), true);
});

test("ELM327-yhteys jää diagnosoitavaksi, vaikka ECU ei vastaisi", async () => {
  const states = [];
  const transport = {
    async connect() { return { ok: true, name: "OBDII" }; },
    async send(command) {
      if (command === "ATI") return "ELM327 v1.5\r>";
      if (command === "ATDP") return "ISO 15765-4 CAN\r>";
      if (command === "0100") return "NO DATA\r>";
      return "OK\r>";
    },
    async disconnect() {},
    isConnected() { return true; }
  };
  const client = new Elm327Client(transport, () => {}, event => states.push(event), FAST_ELM_OPTIONS);
  const info = await client.connect("AA:BB", "can6");
  assert.equal(info.ecuConnected, false);
  assert.equal(client.connected, true);
  assert.match(info.ecuError, /ei palauttanut tietoa/i);
  assert.equal(states.some(event => event.stage === "ecu" && event.status === "error"), true);
});

test("Quicklynks HEX -muunnos on häviötön", () => {
  assert.equal(bytesToHex(hexToBytes(QUICKLYNKS_LIVE_QUERY_HEX)), QUICKLYNKS_LIVE_QUERY_HEX);
  assert.throws(() => hexToBytes("ABC"), /HEX-data/);
  assert.throws(() => hexToBytes("GG"), /HEX-data/);
});

test("Quicklynksin varmennettu mittarikehys tulkitaan valmistajan kaavoilla", () => {
  const parsed = parseQuicklynksRealtimeFrame(VERIFIED_QUICKLYNKS_RESPONSE);
  assert.equal(parsed.type, "realtime");
  assert.equal(parsed.rpm, 800);
  assert.equal(parsed.speed, 0);
  assert.equal(parsed.coolant, 88);
  assert.equal(parsed.adapterVoltage, 12.42);
  assert.equal(parsed.load, 40);
  assert.equal(parsed.quicklynksField80, 3.8);
  assert.equal(parsed.quicklynksTripDistance, 2);
  assert.equal(parsed.quicklynksRuntime, 835);
  assert.equal(parsed.unknownHex, "85:000E 81:0010 82:0C 83:FF");
  assert.deepEqual(parsed.unmappedFields, {
    "85": "000E",
    "81": "0010",
    "82": "0C",
    "83": "FF"
  });
  assert.throws(() => parseQuicklynksRealtimeFrame("04410C8000"), /liian lyhyt/);
});

test("Quicklynks-puskuri kokoaa pirstoutuneen kehyksen", () => {
  const events = [];
  const buffer = new QuicklynksFrameBuffer(event => events.push(event));
  assert.deepEqual(buffer.push("13410C800000"), []);
  assert.equal(buffer.pendingHex(), "13410C800000");
  const frames = buffer.push("022680000E04DA00100C660343FF");
  assert.equal(frames.length, 1);
  assert.equal(bytesToHex(frames[0]), VERIFIED_QUICKLYNKS_RESPONSE);
  assert.equal(buffer.pendingHex(), "");
  assert.ok(events.some(event => event.type === "partial"));
  assert.ok(events.some(event => event.type === "frame"));
});

test("Quicklynks-puskuri erottaa yhdistetyt kehykset ja hylkää nollapituisen", () => {
  const events = [];
  const buffer = new QuicklynksFrameBuffer(event => events.push(event));
  const frames = buffer.push(`00${VERIFIED_QUICKLYNKS_RESPONSE}${VERIFIED_QUICKLYNKS_RESPONSE}`);
  assert.equal(frames.length, 2);
  assert.ok(events.some(event => event.type === "invalid" && /pituustavu oli 00/.test(event.message)));
});

test("Quicklynks-asiakas jakaa yhden mittarikehyksen kahdeksalle varmennetulle arvolle eikä lähetä AT-komentoja", async () => {
  const sent = [];
  const diagnostics = [];
  const transport = {
    connected: true,
    isConnected() { return this.connected; },
    async sendBinary(hex) { sent.push(hex); return VERIFIED_QUICKLYNKS_RESPONSE; },
    async disconnect() { this.connected = false; }
  };
  const client = new QuicklynksClient(transport, () => {}, event => diagnostics.push(event));
  const info = client.adoptConnection({
    ok: true,
    name: "OBD",
    binaryProtocol: true,
    transportProfile: "Quicklynks FFF0/FFF6 · binääri"
  });
  assert.match(info.adapter, /Quicklynks/);
  const load = await client.readPid(PID_BY_ID.load);
  const coolant = await client.readPid(PID_BY_ID.coolant);
  const rpm = await client.readPid(PID_BY_ID.rpm);
  const speed = await client.readPid(PID_BY_ID.speed);
  const adapterVoltage = await client.readPid(PID_BY_ID.adapterVoltage);
  const field80 = await client.readPid(PID_BY_ID.quicklynksField80);
  const tripDistance = await client.readPid(PID_BY_ID.quicklynksTripDistance);
  const runtime = await client.readPid(PID_BY_ID.quicklynksRuntime);
  assert.equal(load.value, 40);
  assert.equal(coolant.value, 88);
  assert.equal(rpm.value, 800);
  assert.equal(speed.value, 0);
  assert.equal(adapterVoltage.value, 12.42);
  assert.equal(field80.value, 3.8);
  assert.equal(tripDistance.value, 2);
  assert.equal(runtime.value, 835);
  assert.match(field80.source, /merkitys ja yksikkö avoin/);
  assert.deepEqual(sent, [QUICKLYNKS_LIVE_QUERY_HEX]);
  assert.ok(diagnostics.some(event => event.type === "parsed"));
  await assert.rejects(() => client.command("ATI"), /ELM327-komentoa ei lähetetty/);
});

test("Quicklynksin varmennetut fast- ja slow-ryhmät muodostetaan ja tulkitaan tunnetuilla kaavoilla", () => {
  assert.deepEqual(QUICKLYNKS_PRODUCTION_GROUPS.map(group => group.id), ["fast", "slow"]);
  assert.equal(buildQuicklynksProductionQuery("fast"), "07410B1023494A4C");
  assert.equal(buildQuicklynksProductionQuery("slow"), "0741010F1F313342");

  const fast = parseQuicklynksProductionResponse("fast", "09418210D818D3285199");
  assert.equal(fast.values.map, 130);
  assert.equal(fast.values.maf, 43.12);
  assert.equal(fast.values.railPressure, 63550);
  assert.equal(Math.round(fast.values.pedal), 16);
  assert.equal(Math.round(fast.values.pedalE), 32);
  assert.equal(Math.round(fast.values.commandedThrottle), 60);

  const slow = parseQuicklynksProductionResponse("slow", "0D41000600004105F90490652FAF");
  assert.equal(slow.values.milOn, 0);
  assert.equal(slow.values.dtcCount, 0);
  assert.equal(slow.values.intakeTemp, 25);
  assert.equal(slow.values.runtime, 1529);
  assert.equal(slow.values.distanceClear, 1168);
  assert.equal(slow.values.barometricPressure, 101);
  assert.equal(slow.values.voltage, 12.207);
  assert.throws(
    () => parseQuicklynksProductionResponse("fast", "03418210"),
    /hyötydatan pituus/
  );
});

test("Quicklynksin standardoidut diesel-lisäkyselyt ovat sallittuja yksittäisiä 0x41-lukuja", () => {
  assert.equal(QUICKLYNKS_OPTIONAL_STANDARD_PIDS.length, 17);
  assert.equal(QUICKLYNKS_OPTIONAL_STANDARD_PIDS.some(item => item.pid === 0x86), false);
  assert.equal(buildQuicklynksOptionalStandardQuery(0x7a), "02417A");
  assert.equal(buildQuicklynksOptionalStandardQuery(0x8b), "02418B");
  assert.throws(() => buildQuicklynksOptionalStandardQuery(0x60), /sallittuun listaan/);

  const parsed = parseQuicklynksOptionalStandardResponse(0x7a, "0841070064271026AC");
  assert.equal(parsed.pidHex, "7A");
  assert.equal(parsed.values.dpfDifferentialPressure, 1);
  assert.equal(parsed.values.dpfInletPressure, 100);
  assert.equal(parsed.values.dpfOutletPressure, 99);
  assert.throws(
    () => parseQuicklynksOptionalStandardResponse(0x7a, "09417A070064271026AC"),
    /lyhyttä 41-payload-kehystä/
  );
  assert.equal(parseQuicklynksOptionalStandardResponse(0x5d, "03416900").values.injectionTiming, 0);
  assert.throws(
    () => parseQuicklynksOptionalStandardResponse(0x2c, "024100"),
    /lyhyttä 41-payload-kehystä/
  );
});

test("Quicklynks löytää tuetun diesel-PIDin ja palauttaa sen mittarit ilman tukibittikyselyä", async () => {
  const sent = [];
  const transport = {
    isConnected: () => true,
    async sendBinary(hex) {
      sent.push(hex);
      if (hex === "024124") return "054180000000";
      throw new Error("odottamaton pyyntö");
    },
    async disconnect() {}
  };
  const client = new QuicklynksClient(transport);
  client.adoptConnection({ binaryProtocol: true });
  const result = await client.pollOptionalStandardMetrics();
  assert.deepEqual(sent, ["024124"]);
  assert.equal(result.pidHex, "24");
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].definition.id, "lambdaB1S1");
  assert.ok(result.results[0].value > 0.99 && result.results[0].value < 1.01);
  assert.equal((await client.readSupportedPids()).has("lambdaB1S1"), true);
});

test("ELM327 lukee monikenttäisen PIDin vain kerran lyhyessä päivitysjaksossa", async () => {
  const client = new Elm327Client({ async disconnect() {} });
  const commands = [];
  client.command = async command => {
    commands.push(command);
    return "41 6D 01 07 D0 07 BC 55";
  };

  const target = await client.readPid(PID_BY_ID.railPressureTarget);
  const actual = await client.readPid(PID_BY_ID.railPressureActual);
  const temperature = await client.readPid(PID_BY_ID.fuelRailTemperature);

  assert.deepEqual(commands, ["016D"]);
  assert.equal(target.value, 20000);
  assert.equal(actual.value, 19800);
  assert.equal(temperature.value, 45);
});

test("Quicklynks-asiakas lukee tuotanto-PIDit ryhmittäin ja palauttaa mittauksen iän", async () => {
  const sent = [];
  const transport = {
    isConnected: () => true,
    async sendBinary(hex) {
      sent.push(hex);
      if (hex === buildQuicklynksProductionQuery("fast")) return "09418210D818D3285199";
      if (hex === buildQuicklynksProductionQuery("slow")) return "0D41000600004105F90490652FAF";
      return VERIFIED_QUICKLYNKS_RESPONSE;
    },
    async disconnect() {}
  };
  const client = new QuicklynksClient(transport);
  client.adoptConnection({ binaryProtocol: true });

  const map = await client.readPid(PID_BY_ID.map);
  const maf = await client.readPid(PID_BY_ID.maf);
  const rail = await client.readPid(PID_BY_ID.railPressure);
  const intake = await client.readPid(PID_BY_ID.intakeTemp);
  const voltage = await client.readPid(PID_BY_ID.voltage);
  const mil = await client.readPid(PID_BY_ID.milOn);
  assert.equal(map.value, 130);
  assert.equal(maf.value, 43.12);
  assert.equal(rail.value, 63550);
  assert.equal(intake.value, 25);
  assert.equal(voltage.value, 12.207);
  assert.equal(mil.value, 0);
  assert.equal(Number.isFinite(map.updatedAt), true);
  assert.equal(map.ageMs >= 0, true);
  assert.deepEqual(sent, [
    buildQuicklynksProductionQuery("fast"),
    buildQuicklynksProductionQuery("slow")
  ]);
});

test("kaksi peräkkäistä tuotantoryhmän virhettä asettaa vain lisäryhmän tauolle", async () => {
  let sends = 0;
  const transport = {
    isConnected: () => true,
    async sendBinary() {
      sends++;
      throw new Error("Quicklynks-kysely aikakatkaistiin");
    },
    async disconnect() {}
  };
  const client = new QuicklynksClient(transport);
  client.adoptConnection({ binaryProtocol: true });
  await assert.rejects(() => client.readPid(PID_BY_ID.map), /fast-ryhmä/);
  client.productionGroupState.get("fast").nextAt = 0;
  await assert.rejects(() => client.readPid(PID_BY_ID.map), /fast-ryhmä/);
  const paused = await client.readPid(PID_BY_ID.map);
  assert.equal(paused.value, null);
  assert.match(paused.warning, /aikakatkaistiin/);
  assert.equal(sends, 2);
  assert.equal(client.productionGroupState.get("fast").pausedUntil > Date.now(), true);
});

test("Quicklynks-asiakas estää päällekkäiset kyselyt", async () => {
  let active = 0;
  let maxActive = 0;
  const transport = {
    isConnected: () => true,
    async sendBinary() {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 12));
      active--;
      return VERIFIED_QUICKLYNKS_RESPONSE;
    },
    async disconnect() {}
  };
  const client = new QuicklynksClient(transport);
  client.adoptConnection({ binaryProtocol: true });
  await Promise.all([client.queryRealtime(), client.queryRealtime(), client.queryRealtime()]);
  assert.equal(maxActive, 1);
});

test("Quicklynks-asiakas lähettää tukibittikokeessa vain sallitun yksittäisen 41-kyselyn", async () => {
  const sent = [];
  const transport = {
    isConnected: () => true,
    async sendBinary(hex) {
      sent.push(hex);
      return "054198180001";
    },
    async disconnect() {}
  };
  const client = new QuicklynksClient(transport);
  client.adoptConnection({ binaryProtocol: true });
  const event = await client.probeSupportBitmap(0x00, 1000);
  assert.deepEqual(sent, ["024100"]);
  assert.equal(event.outcome, "response");
  await assert.rejects(() => client.probeSupportBitmap(0xc0, 1000), /sallittuun listaan/);
});

test("PID-tutkimus käyttää vain kiinteitä 0x41-lukukuoria", () => {
  const identifiers = QUICKLYNKS_RESEARCH_PROBES.map(probe => `${probe.queryTypeHex}:${probe.identifierHex}`);
  assert.equal(new Set(identifiers).size, identifiers.length);
  for (const probe of QUICKLYNKS_RESEARCH_PROBES) {
    const query = buildQuicklynksResearchQuery(probe);
    assert.match(query, /^0241[0-9A-F]{2}$/);
    assert.equal(query.slice(-2), probe.identifierHex);
  }
  assert.throws(() => buildQuicklynksResearchQuery(0x02), /sallittujen listaan/);
  assert.throws(() => buildQuicklynksResearchQuery(0x60), /sallittujen listaan/);
  assert.equal(QUICKLYNKS_RESEARCH_PROBES.length, 55);
  assert.equal(QUICKLYNKS_RESEARCH_PROBES.some(probe => probe.group === "toyota_read_data_21"), false);
  assert.equal(QUICKLYNKS_RESEARCH_PROBES.some(probe => probe.group === "verified_query_split"), true);
  assert.equal(QUICKLYNKS_RESEARCH_PROBES.some(probe => probe.group === "standard_read_candidate"), true);
  assert.equal(QUICKLYNKS_RESEARCH_PROBES.some(probe => probe.group === "aftertreatment_standard_candidate"), true);
  assert.equal(QUICKLYNKS_RESEARCH_PROBES.some(probe => probe.group === "diesel_standard_candidate"), true);
});

test("0.4.3 priorisoi standardoidut jälkikäsittely- ja dieselryhmät", () => {
  const firstFive = QUICKLYNKS_RESEARCH_PROBES.slice(0, 5);
  assert.deepEqual(firstFive.map(probe => probe.identifier), [0x78, 0x79, 0x7a, 0x7b, 0x7c]);
  assert.deepEqual(firstFive.map(buildQuicklynksResearchQuery), [
    "024178",
    "024179",
    "02417A",
    "02417B",
    "02417C"
  ]);
  assert.equal(firstFive.every(probe => probe.group === "aftertreatment_standard_candidate"), true);
  const research = createQuicklynksResearchState(1000);
  assert.equal(research.schemaVersion, 6);
  assert.equal(research.planId, "quicklynks-read41-payload-v6-no-active-test");
  assert.equal(research.totalProbes, 55);
  assert.deepEqual(
    QUICKLYNKS_RESEARCH_PROBES.slice(5, 13).map(probe => probe.identifier),
    [0x69, 0x6d, 0x70, 0x71, 0x73, 0x8b, 0x8c, 0x8f]
  );
});

test("PID-tutkimus säilyttää payload-only-vastauskehyksen tulkitsemattomana", () => {
  const parsed = parseQuicklynksResearchResponse("03411580");
  assert.equal(parsed.frames.length, 1);
  assert.deepEqual(parsed.frames[0], {
    rawHex: "03411580",
    followingLength: 3,
    responseTypeHex: "41",
    payloadHex: "1580"
  });
  assert.equal(parsed.pendingHex, "");
  assert.equal(parsed.error, "");
});

test("Quicklynks PID -tutkimus kirjaa vastauksen mutta ei lisää sille muunnosta", async () => {
  const sent = [];
  const traffic = [];
  const transport = {
    isConnected: () => true,
    async sendBinary(hex) {
      sent.push(hex);
      return "03411580";
    },
    async disconnect() {}
  };
  const client = new QuicklynksClient(transport, event => traffic.push(event));
  client.adoptConnection({ binaryProtocol: true });
  const probe = QUICKLYNKS_RESEARCH_PROBES.find(item => item.identifier === 0x0c);
  const event = await client.probeResearchIdentifier(probe, 750);
  assert.deepEqual(sent, ["02410C"]);
  assert.equal(event.outcome, "response");
  assert.equal(event.responseTypeHex, "41");
  assert.equal(event.payloadHex, "1580");
  assert.equal("value" in event, false);
  assert.equal("unit" in event, false);
  assert.equal(traffic.every(item => item.research === true), true);
});

test("PID-tutkimus hylkää tyhjän 41 00 -palautteen ja jatkuvan 13 41 -koontikehyksen", async () => {
  let call = 0;
  const transport = {
    isConnected: () => true,
    async sendBinary() {
      call += 1;
      return call === 1 ? "024100" : VERIFIED_QUICKLYNKS_RESPONSE;
    },
    async disconnect() {}
  };
  const client = new QuicklynksClient(transport);
  client.adoptConnection({ binaryProtocol: true });
  const empty = await client.probeResearchIdentifier(0x0c, 750);
  const continuous = await client.probeResearchIdentifier(0x0d, 750);
  assert.equal(empty.outcome, "invalid");
  assert.match(empty.error, /lyhyttä 41-payload/);
  assert.equal(continuous.outcome, "invalid");
  assert.match(continuous.error, /lyhyttä 41-payload/);
});

test("PID-tutkimuksen aikakatkaisu palautuu tapahtumana eikä katkaise asiakasjonoa", async () => {
  const transport = {
    isConnected: () => true,
    async sendBinary() {
      const error = new Error("Quicklynks-kysely aikakatkaistiin");
      error.partialHex = "0241";
      throw error;
    },
    async disconnect() {}
  };
  const client = new QuicklynksClient(transport);
  client.adoptConnection({ binaryProtocol: true });
  const first = await client.probeResearchIdentifier(0x0c, 50);
  const second = await client.probeResearchIdentifier(0x0d, 50);
  assert.equal(first.outcome, "timeout");
  assert.equal(first.responseHex, "0241");
  assert.equal(second.outcome, "timeout");
});

test("simulaattori alustuu ja palauttaa realistista live-dataa", async () => {
  const transport = new FakeElmTransport();
  const client = new Elm327Client(transport, () => {}, () => {}, FAST_ELM_OPTIONS);
  const info = await client.connect("FAKE:IS220D", "auto");
  assert.match(info.adapter, /ELM327/);
  const supported = await client.readSupportedPids();
  assert.equal(supported.has(PID_BY_ID.rpm.pid), true);
  const rpm = await client.readPid(PID_BY_ID.rpm);
  assert.equal(Number.isFinite(rpm.value), true);
  assert.ok(rpm.value > 600 && rpm.value < 4000);
  const fuelRate = await client.readPid(PID_BY_ID.fuelRate);
  assert.equal(Number.isFinite(fuelRate.value), true);
  assert.ok(fuelRate.value >= 0.8);
  await client.disconnect();
});

test("CSV-vienti ja sessiotilastot", () => {
  const session = {
    schemaVersion: 4,
    appVersion: "0.6.8",
    startedAt: Date.parse("2026-07-22T12:00:00Z"),
    endedAt: Date.parse("2026-07-22T12:00:01Z"),
    vehicle: "Lexus IS220d 2008 · 2AD-FHV",
    adapter: "ELM327",
    protocol: "ISO 15765-4 CAN",
    note: "Nykäisy ylämäessä",
    samples: [
      {
        timestamp: Date.parse("2026-07-22T12:00:00Z"),
        values: { load: 40, coolant: 88, rpm: 800, speed: 0, voltage: 12.42, fuelRate: 3.8 },
        valueAgesMs: { load: 12, coolant: 12, rpm: 12, speed: 12, voltage: 240, fuelRate: 240 },
        pollQuality: { sourceCount: 3, attempts: 5, hits: 5, cacheHits: 1, misses: 0, lossPercent: 0, maxMissStreak: 0, latencyEwmaMs: 100 }
      },
      {
        timestamp: Date.parse("2026-07-22T12:00:01Z"),
        values: { load: 70, coolant: 89, rpm: 1800, speed: 52, voltage: 14.18, fuelRate: 6.2 },
        valueAgesMs: { load: 18, coolant: 18, rpm: 18, speed: 18, voltage: 320, fuelRate: 320 },
        pollQuality: { sourceCount: 3, attempts: 10, hits: 9, cacheHits: 2, misses: 1, lossPercent: 10, maxMissStreak: 1, latencyEwmaMs: 120.5 },
        marker: "Nykäisy"
      }
    ],
    markers: [{ timestamp: Date.parse("2026-07-22T12:00:01Z"), label: "Nykäisy" }]
  };
  const csv = sessionToCsv(session);
  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.match(csv, /schema_version;app_version;vehicle;vehicle_key;vehicle_profile_version;adapter;protocol/);
  assert.match(csv, /timestamp;elapsed_ms;sample_gap_ms/);
  assert.match(csv, /poll_source_count;poll_attempts;poll_hits;poll_cache_hits;poll_misses;poll_loss_percent;poll_max_miss_streak;poll_latency_ewma_ms/);
  assert.match(csv, /load;load_unit;load_age_ms/);
  assert.match(csv, /coolant;coolant_unit/);
  assert.match(csv, /rpm;rpm_unit/);
  assert.match(csv, /speed;speed_unit/);
  assert.match(csv, /voltage;voltage_unit/);
  assert.match(csv, /fuelRate;fuelRate_unit/);
  assert.match(csv, /12,42;V;240/);
  assert.match(csv, /3;10;9;2;1;10;1;120,5/);
  assert.doesNotMatch(csv, /12\.42;V/);
  assert.match(csv, /Nykäisy/);
  assert.match(csv, /Nykäisy ylämäessä/);
  const stats = calculateSessionStats(session);
  assert.equal(stats.coolant.max, 89);
  assert.equal(stats.rpm.min, 800);
  assert.equal(stats.rpm.max, 1800);
  assert.equal(stats.speed.avg, 26);
  assert.equal(stats.fuelRate.avg, 5);
  const prompt = buildAiAnalysisPrompt(session);
  assert.match(prompt, /Pollauksen laatu lopussa: onnistuneet 9\/10/);
  assert.match(prompt, /poll_\* -sarakkeet/);
});

test("vanhan Quicklynks-session väärät fuelRate-, adapterMaf- ja voltage-nimet korjataan viennissä", () => {
  const session = {
    appVersion: "0.3.4",
    startedAt: Date.parse("2026-07-29T04:41:33Z"),
    endedAt: Date.parse("2026-07-29T04:41:34Z"),
    adapter: "Quicklynks BK-BLE-1.0 · OBD",
    protocol: "Quicklynks-binääriprotokolla",
    samples: [
      { timestamp: Date.parse("2026-07-29T04:41:33Z"), values: { rpm: 800, fuelRate: 6.3, voltage: 12.42 } },
      { timestamp: Date.parse("2026-07-29T04:41:34Z"), values: { rpm: 1800, adapterMaf: 17.0, voltage: 14.18 } }
    ]
  };
  const csv = sessionToCsv(session);
  assert.match(csv, /quicklynksField80;quicklynksField80_unit/);
  assert.match(csv, /adapterVoltage;adapterVoltage_unit/);
  assert.doesNotMatch(csv, /adapterMaf;adapterMaf_unit/);
  assert.doesNotMatch(csv, /(^|;)voltage;voltage_unit/m);
  assert.doesNotMatch(csv, /fuelRate;fuelRate_unit/);
  assert.match(csv, /6,3;;/);
  const stats = calculateSessionStats(session);
  assert.equal(stats.quicklynksField80.avg, 11.65);
  assert.equal(stats.adapterVoltage.avg, 13.3);
  assert.equal(stats.fuelRate, undefined);
  assert.equal(stats.voltage, undefined);
});

test("tekoälyanalyysipyyntö kertoo datan rajat ja kuljettajan oireen", () => {
  const session = {
    startedAt: Date.parse("2026-07-29T04:41:33Z"),
    endedAt: Date.parse("2026-07-29T04:57:51Z"),
    vehicle: "Lexus IS220d 2008 · 2AD-FHV",
    adapter: "Quicklynks BK-BLE-1.0 · OBD",
    protocol: "Quicklynks-binääriprotokolla",
    note: "Tärinä kuutosvaihteella ylämäessä",
    samples: [
      { timestamp: Date.parse("2026-07-29T04:41:33Z"), connected: true, values: { rpm: 800, quicklynksField80: 6.3, adapterVoltage: 12.4, voltage: 12.2 } },
      { timestamp: Date.parse("2026-07-29T04:41:34Z"), connected: true, values: { rpm: 1800, quicklynksField80: 17.0, adapterVoltage: 14.1, voltage: 14.0 } }
    ],
    markers: []
  };
  const prompt = buildAiAnalysisPrompt(session);
  assert.match(prompt, /Tärinä kuutosvaihteella ylämäessä/);
  assert.match(prompt, /quicklynksField80/);
  assert.match(prompt, /ei ole standardin PID 10 MAF eikä polttoainevirta/);
  assert.match(prompt, /adapterVoltage/);
  assert.match(prompt, /boostPressure on johdettu/);
  assert.match(prompt, /\*_age_ms/);
  assert.match(prompt, /DPNR-noki-\/tuhka/);
  assert.match(prompt, /Toyota-kohtaisia suuttimien korjauksia/);
  assert.match(prompt, /Älä ehdota osien vaihtoa pelkän korrelaation perusteella/);
});

test("PID-tutkimusvienti yhdistää koeajonäytteet ja raakatutkimuksen Excel-turvallisesti", () => {
  const startedAt = Date.parse("2026-07-29T04:41:33Z");
  const research = createQuicklynksResearchState(startedAt);
  research.nextProbeIndex = 1;
  research.events.push({
    sequence: 1,
    timestamp: startedAt + 500,
    group: "verified_query_split",
    identifierHex: "0C",
    candidateLabel: "RPM-kenttä varmennetusta koontikyselystä",
    requestHex: "02410C",
    outcome: "response",
    durationMs: 38,
    responseHex: "03411580",
    frameCount: 1,
    responseTypeHex: "41",
    payloadHex: "1580",
    pendingHex: "",
    error: "",
    context: {
      connected: true,
      values: { rpm: 800, speed: 0, adapterVoltage: 12.44 },
      valueAgesMs: { rpm: 20, speed: 20, adapterVoltage: 50 },
      liveFrameHex: VERIFIED_QUICKLYNKS_RESPONSE
    }
  });
  const session = {
    schemaVersion: 3,
    appVersion: "0.3.7",
    startedAt,
    endedAt: startedAt + 1000,
    vehicle: "Lexus IS220d 2008 · 2AD-FHV",
    adapter: "Quicklynks BK-BLE-1.0 · OBD",
    protocol: "Quicklynks-binääriprotokolla",
    samples: [{
      timestamp: startedAt,
      connected: true,
      values: { rpm: 800, speed: 0, adapterVoltage: 12.44 },
      valueAgesMs: { rpm: 20, speed: 20, adapterVoltage: 50 },
      raw: { rpm: VERIFIED_QUICKLYNKS_RESPONSE }
    }],
    markers: [],
    quicklynksResearch: research
  };
  const csv = sessionToQuicklynksResearchCsv(session);
  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.match(csv, /\r\n6;0\.3\.7;/);
  assert.match(csv, /record_type/);
  assert.match(csv, /sample/);
  assert.match(csv, /pid_probe/);
  assert.match(csv, /02410C/);
  assert.match(csv, /03411580/);
  assert.match(csv, /adapterVoltage;adapterVoltage_unit;adapterVoltage_age_ms/);
  assert.match(csv, /12,44;V;50/);
  assert.doesNotMatch(csv, /12\.44;V/);
  const rows = csv.replace(/^\uFEFF/, "").split("\r\n").map(line => line.split(";").length);
  assert.equal(new Set(rows).size, 1);

  const prompt = buildQuicklynksResearchAiPrompt(session);
  assert.match(prompt, /record_type=pid_probe/);
  assert.match(prompt, /Mode 22-, Toyota Read Data 21-, Active Test-/);
  assert.doesNotMatch(prompt, /probe_group=toyota_read_data_21/);
  assert.match(prompt, /payload-only-muodossa/);
  assert.match(prompt, /Vastaus ei toista pyydettyä tunnistetta/);
  assert.match(prompt, /outcome=response ei vielä todista/);
  assert.match(prompt, /aftertreatment_standard_candidate/);
  assert.match(prompt, /diesel_standard_candidate/);
  assert.match(prompt, /tunnisteet 78–7C/);
  assert.match(prompt, /60-tukibittikysely on poistettu/);
  assert.match(prompt, /desimaaliluvuissa käytetään pilkkua/);
});
