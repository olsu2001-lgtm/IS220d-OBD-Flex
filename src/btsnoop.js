const BTSNOOP_MAGIC = "btsnoop\0";
const BTSNOOP_EPOCH_OFFSET_US = 0x00dcddb30f2f8000n;
const BTSNOOZ_BEGIN = "--- BEGIN:BTSNOOP_LOG_SUMMARY";
const BTSNOOZ_END = "--- END:BTSNOOP_LOG_SUMMARY";
const BTSNOOZ_DATALINK_TYPE = 1002;

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError("Odotettiin binääristä Bluetooth HCI -aineistoa");
}

function ascii(bytes) {
  return String.fromCharCode(...bytes);
}

function hex(bytes) {
  return [...bytes].map(value => value.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function hexHandle(handle) {
  return `0x${Number(handle).toString(16).toUpperCase().padStart(4, "0")}`;
}

function hexConnectionHandle(handle) {
  return `0x${Number(handle).toString(16).toUpperCase().padStart(3, "0")}`;
}

function readUint64BigEndian(view, offset) {
  if (typeof view.getBigUint64 === "function") return view.getBigUint64(offset, false);
  return (BigInt(view.getUint32(offset, false)) << 32n) | BigInt(view.getUint32(offset + 4, false));
}

function parseAttPacket(packetBytes, flags, recordIndex, timestampUs) {
  const packet = asBytes(packetBytes);
  if (packet.length < 13 || packet[0] !== 0x02) return null;
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  const connectionHandle = view.getUint16(1, true) & 0x0fff;
  const aclPayloadLength = view.getUint16(3, true);
  if (aclPayloadLength + 5 > packet.length) return null;
  const l2capLength = view.getUint16(5, true);
  const cid = view.getUint16(7, true);
  if (cid !== 0x0004 || l2capLength < 3 || 9 + l2capLength > packet.length) return null;

  const opcode = packet[9];
  const supportedOpcodes = new Set([0x12, 0x52, 0xd2, 0x1b, 0x1d]);
  if (!supportedOpcodes.has(opcode)) return null;
  const handle = view.getUint16(10, true);
  const value = packet.slice(12, 9 + l2capLength);
  const write = opcode === 0x12 || opcode === 0x52 || opcode === 0xd2;
  const direction = write ? "tx" : "rx";
  return {
    recordIndex,
    timestampUs,
    flags,
    direction,
    opcode,
    opcodeHex: opcode.toString(16).toUpperCase().padStart(2, "0"),
    connectionHandle,
    connectionHandleHex: hexConnectionHandle(connectionHandle),
    handle,
    handleHex: hexHandle(handle),
    valueHex: hex(value)
  };
}

export function parseBtsnoopHci(value) {
  const bytes = asBytes(value);
  if (bytes.length < 16 || ascii(bytes.slice(0, 8)) !== BTSNOOP_MAGIC) {
    throw new Error("Tiedosto ei ole btsnoop_hci.log-muotoinen Bluetooth HCI -snoop-loki");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(8, false);
  const datalinkType = view.getUint32(12, false);
  let offset = 16;
  let recordIndex = 0;
  let droppedRecords = 0;
  let truncated = false;
  const attEvents = [];
  while (offset + 24 <= bytes.length) {
    const originalLength = view.getUint32(offset, false);
    const includedLength = view.getUint32(offset + 4, false);
    const flags = view.getUint32(offset + 8, false);
    const drops = view.getUint32(offset + 12, false);
    const timestampRaw = readUint64BigEndian(view, offset + 16);
    offset += 24;
    recordIndex += 1;
    droppedRecords = Math.max(droppedRecords, drops);
    if (includedLength > bytes.length - offset) {
      truncated = true;
      break;
    }
    const timestampUs = timestampRaw >= BTSNOOP_EPOCH_OFFSET_US
      ? timestampRaw - BTSNOOP_EPOCH_OFFSET_US
      : timestampRaw;
    const event = parseAttPacket(bytes.slice(offset, offset + includedLength), flags, recordIndex, timestampUs);
    if (event) attEvents.push(event);
    offset += includedLength;
    if (originalLength < includedLength) truncated = true;
  }
  if (offset !== bytes.length && offset + 24 > bytes.length) truncated = true;
  return {
    version,
    datalinkType,
    recordCount: recordIndex,
    droppedRecords,
    truncated,
    byteLength: bytes.length,
    attEvents
  };
}

function looksLikeQuicklynksTableRequest(valueHex) {
  if (!/^[0-9A-F]+$/.test(valueHex) || valueHex.length < 6 || valueHex.length % 2) return false;
  const followingLength = Number.parseInt(valueHex.slice(0, 2), 16);
  const actualFollowingLength = valueHex.length / 2 - 1;
  const group = valueHex.slice(2, 4);
  return followingLength === actualFollowingLength && (group === "41" || group === "61");
}

function classifyRequest(valueHex) {
  if (valueHex === "0D410C0D848005857F8182048683") return "verified-live-table";
  if (/^0241[0-9A-F]{2}$/.test(valueHex)) return "single-read41";
  if (/^0261[0-9A-F]{2}$/.test(valueHex)) return "legacy-read61";
  if (looksLikeQuicklynksTableRequest(valueHex)) return "proprietary-table";
  const byteValues = valueHex.match(/../g)?.map(part => Number.parseInt(part, 16)) || [];
  if (byteValues.length && byteValues.every(value => value === 0x0d || value === 0x0a || (value >= 0x20 && value <= 0x7e))) {
    return "ascii-candidate";
  }
  return "unknown-binary-candidate";
}

function unixMsFromUs(value) {
  const ms = Number(value / 1000n);
  return Number.isSafeInteger(ms) ? ms : null;
}

export function analyzeQuicklynksBtsnoop(value, options = {}) {
  const parsed = parseBtsnoopHci(value);
  const handleStats = new Map();
  for (const event of parsed.attEvents) {
    const key = `${event.connectionHandle}:${event.handle}`;
    const stats = handleStats.get(key) || {
      key,
      connectionHandle: event.connectionHandle,
      handle: event.handle,
      writes: 0,
      notifications: 0,
      signatures: 0
    };
    if (event.direction === "tx") {
      stats.writes += 1;
      if (looksLikeQuicklynksTableRequest(event.valueHex)) stats.signatures += 1;
    } else {
      stats.notifications += 1;
    }
    handleStats.set(key, stats);
  }
  const target = [...handleStats.values()]
    .filter(stats => stats.signatures > 0)
    .sort((a, b) => b.signatures - a.signatures || b.notifications - a.notifications || b.writes - a.writes)[0] || null;
  const targetEvents = target ? parsed.attEvents.filter(event =>
    event.connectionHandle === target.connectionHandle && event.handle === target.handle
  ) : [];
  const firstTimestampUs = targetEvents[0]?.timestampUs ?? 0n;
  const sequences = [];
  let current = null;
  for (const event of targetEvents) {
    const relativeMs = Number((event.timestampUs - firstTimestampUs) / 1000n);
    if (event.direction === "tx") {
      if (current) sequences.push(current);
      current = {
        sequence: sequences.length + 1,
        relativeMs,
        timestampMs: unixMsFromUs(event.timestampUs),
        requestHex: event.valueHex,
        classification: classifyRequest(event.valueHex),
        responseChunks: []
      };
    } else if (current) {
      current.responseChunks.push({ relativeMs, valueHex: event.valueHex });
    }
  }
  if (current) sequences.push(current);

  const uniqueRequestMap = new Map();
  for (const sequence of sequences) {
    const currentCount = uniqueRequestMap.get(sequence.requestHex) || { requestHex: sequence.requestHex, classification: sequence.classification, count: 0 };
    currentCount.count += 1;
    uniqueRequestMap.set(sequence.requestHex, currentCount);
  }
  const uniqueRequests = [...uniqueRequestMap.values()].sort((a, b) => b.count - a.count || a.requestHex.localeCompare(b.requestHex));
  const unknownRequests = uniqueRequests.filter(item => item.classification === "unknown-binary-candidate" || item.classification === "ascii-candidate");
  const toyotaTargetRequests = uniqueRequests.filter(item => /217E|217F|02617E|02617F/.test(item.requestHex));
  const onlyKnownTableProtocol = uniqueRequests.length > 0 && unknownRequests.length === 0 && uniqueRequests.every(item => [
    "verified-live-table", "single-read41", "legacy-read61", "proprietary-table"
  ].includes(item.classification));
  return {
    ...parsed,
    sourceName: options.sourceName || "btsnoop_hci.log",
    sourceEntryName: options.sourceEntryName || "",
    sourceContainer: options.sourceContainer || "btsnoop",
    targetConnectionHandle: target?.connectionHandle ?? null,
    targetConnectionHandleHex: target ? hexConnectionHandle(target.connectionHandle) : "",
    targetHandle: target?.handle ?? null,
    targetHandleHex: target ? hexHandle(target.handle) : "",
    targetEventCount: targetEvents.length,
    targetWrites: target?.writes || 0,
    targetNotifications: target?.notifications || 0,
    sequences,
    uniqueRequests,
    unknownRequests,
    toyotaTargetRequests,
    onlyKnownTableProtocol
  };
}

function findZipEocd(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimum = Math.max(0, bytes.length - 65557);
  for (let offset = bytes.length - 22; offset >= minimum; offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  return -1;
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("Tämä Android WebView ei pysty purkamaan pakattua bugiraporttia; pura btsnoop_hci.log ensin tiedostonhallinnassa");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflateZlib(bytes) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("Tämä Android WebView ei pysty purkamaan bugiraportin btsnooz-aineistoa");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function writeUint64BigEndian(view, offset, value) {
  if (typeof view.setBigUint64 === "function") {
    view.setBigUint64(offset, value, false);
    return;
  }
  view.setUint32(offset, Number((value >> 32n) & 0xffffffffn), false);
  view.setUint32(offset + 4, Number(value & 0xffffffffn), false);
}

function readUint64LittleEndian(view, offset) {
  if (typeof view.getBigUint64 === "function") return view.getBigUint64(offset, true);
  return BigInt(view.getUint32(offset, true)) | (BigInt(view.getUint32(offset + 4, true)) << 32n);
}

function btsnoozTypeToDirection(type) {
  return [0x10, 0x11, 0x12, 0x17].includes(type) ? 1 : 0;
}

function btsnoozTypeToHci(type) {
  if (type === 0x20) return 0x01;
  if (type === 0x11 || type === 0x21) return 0x02;
  if (type === 0x12 || type === 0x22) return 0x03;
  if (type === 0x10) return 0x04;
  if (type === 0x17 || type === 0x2d) return 0x05;
  throw new Error(`tuntematon btsnooz-pakettityyppi 0x${type.toString(16).padStart(2, "0")}`);
}

function decodeBase64(value) {
  const compact = value.replace(/\s+/g, "");
  if (!compact || compact.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) {
    throw new Error("BTSNOOP_LOG_SUMMARY-osion base64-aineisto on virheellinen");
  }
  let decoded;
  try {
    decoded = atob(compact);
  } catch {
    throw new Error("BTSNOOP_LOG_SUMMARY-osion base64-aineisto ei purkautunut");
  }
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}

function extractBtsnoozBlock(text) {
  const begin = text.indexOf(BTSNOOZ_BEGIN);
  if (begin < 0) return null;
  const contentStart = text.indexOf("\n", begin + BTSNOOZ_BEGIN.length);
  const end = text.indexOf(BTSNOOZ_END, contentStart < 0 ? begin + BTSNOOZ_BEGIN.length : contentStart + 1);
  if (contentStart < 0 || end < 0) {
    throw new Error("BTSNOOP_LOG_SUMMARY löytyi, mutta sen alku- tai loppumerkintä oli vajaa");
  }
  return text.slice(contentStart + 1, end);
}

export async function decodeBtsnooz(value) {
  const snooz = asBytes(value);
  if (snooz.length < 9) throw new Error("btsnooz-tiedosto-otsake on liian lyhyt");
  const header = new DataView(snooz.buffer, snooz.byteOffset, snooz.byteLength);
  const version = header.getInt8(0);
  if (version !== 1 && version !== 2) throw new Error(`btsnooz-versiota ${version} ei tueta`);
  const lastTimestampUs = readUint64LittleEndian(header, 1);
  let decompressed;
  try {
    decompressed = await inflateZlib(snooz.slice(9));
  } catch (error) {
    throw new Error(`btsnoozin deflate-purku epäonnistui: ${error.message}`);
  }
  const view = new DataView(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength);
  const records = [];
  let offset = 0;
  let deltaSumUs = 0n;
  while (offset < decompressed.length) {
    const headerLength = version === 1 ? 7 : 9;
    if (offset + headerLength > decompressed.length) throw new Error("btsnoozin viimeinen tietueotsake on katkennut");
    const includedLength = view.getUint16(offset, true);
    const originalLength = version === 1 ? includedLength : view.getUint16(offset + 2, true);
    const deltaOffset = version === 1 ? offset + 2 : offset + 4;
    const typeOffset = version === 1 ? offset + 6 : offset + 8;
    const deltaUs = view.getUint32(deltaOffset, true);
    const type = view.getUint8(typeOffset);
    if (includedLength < 1) throw new Error("btsnooz-tietueen pituus oli nolla");
    if (originalLength < includedLength) throw new Error("btsnooz-tietueen alkuperäinen pituus oli tallennettua pituutta lyhyempi");
    const bodyOffset = offset + headerLength;
    const bodyLength = includedLength - 1;
    if (bodyOffset + bodyLength > decompressed.length) throw new Error("btsnooz-tietueen pakettidata on katkennut");
    records.push({
      includedLength,
      originalLength,
      deltaUs,
      direction: btsnoozTypeToDirection(type),
      hciType: btsnoozTypeToHci(type),
      body: decompressed.slice(bodyOffset, bodyOffset + bodyLength)
    });
    deltaSumUs += BigInt(deltaUs);
    offset = bodyOffset + bodyLength;
  }
  const firstTimestampBase = lastTimestampUs + BTSNOOP_EPOCH_OFFSET_US - deltaSumUs;
  if (firstTimestampBase < 0n) throw new Error("btsnooz-aikaleima oli virheellinen");
  const outputLength = 16 + records.reduce((sum, record) => sum + 24 + record.includedLength, 0);
  const output = new Uint8Array(outputLength);
  const outputView = new DataView(output.buffer);
  output.set(new TextEncoder().encode(BTSNOOP_MAGIC), 0);
  outputView.setUint32(8, 1, false);
  outputView.setUint32(12, BTSNOOZ_DATALINK_TYPE, false);
  let outputOffset = 16;
  let timestampUs = firstTimestampBase;
  for (const record of records) {
    timestampUs += BigInt(record.deltaUs);
    outputView.setUint32(outputOffset, record.originalLength, false);
    outputView.setUint32(outputOffset + 4, record.includedLength, false);
    outputView.setUint32(outputOffset + 8, record.direction, false);
    outputView.setUint32(outputOffset + 12, 0, false);
    writeUint64BigEndian(outputView, outputOffset + 16, timestampUs);
    output[outputOffset + 24] = record.hciType;
    output.set(record.body, outputOffset + 25);
    outputOffset += 24 + record.includedLength;
  }
  return output;
}

function listZipEntries(bytes, eocdOffset) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  let offset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder("utf-8");
  const entries = [];
  for (let index = 0; index < entryCount; index++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("ZIP-paketin keskustiedostohakemisto oli virheellinen");
    }
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    if (nextOffset > bytes.length) throw new Error("ZIP-merkinnän nimi tai lisätiedot olivat katkenneet");
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    if (!name.endsWith("/")) entries.push({ name, method, compressedSize, uncompressedSize, localOffset });
    offset = nextOffset;
  }
  return entries;
}

async function extractZipEntry(bytes, entry) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (entry.localOffset + 30 > bytes.length || view.getUint32(entry.localOffset, true) !== 0x04034b50) {
    throw new Error(`${entry.name}: ZIP-otsake oli virheellinen`);
  }
  const localNameLength = view.getUint16(entry.localOffset + 26, true);
  const localExtraLength = view.getUint16(entry.localOffset + 28, true);
  const dataOffset = entry.localOffset + 30 + localNameLength + localExtraLength;
  if (dataOffset + entry.compressedSize > bytes.length) throw new Error(`${entry.name}: pakattu data oli katkennut`);
  const compressed = bytes.slice(dataOffset, dataOffset + entry.compressedSize);
  let extracted;
  if (entry.method === 0) extracted = compressed;
  else if (entry.method === 8) extracted = await inflateRaw(compressed);
  else throw new Error(`${entry.name}: ZIP-pakkaustapaa ${entry.method} ei tueta`);
  if (entry.uncompressedSize && extracted.length !== entry.uncompressedSize) {
    throw new Error(`${entry.name}: tiedosto purkautui väärän pituisena`);
  }
  return extracted;
}

export async function extractBtsnoopSource(value, sourceName = "") {
  const bytes = asBytes(value);
  if (bytes.length >= 8 && ascii(bytes.slice(0, 8)) === BTSNOOP_MAGIC) {
    return { bytes, entryName: sourceName || "btsnoop_hci.log", container: "btsnoop" };
  }
  if (bytes.length < 4 || !(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    throw new Error("Valitse Android-bugiraportin ZIP tai btsnoop_hci.log");
  }
  const eocdOffset = findZipEocd(bytes);
  if (eocdOffset < 0) throw new Error("ZIP-paketin hakemistoa ei löytynyt");
  const entries = listZipEntries(bytes, eocdOffset);
  const decoder = new TextDecoder("utf-8");
  const directEntries = entries
    .filter(entry => {
      const lower = entry.name.toLowerCase();
      return lower.includes("btsnoop") || lower.includes("bluetooth_hci");
    })
    .sort((a, b) => Number(b.name.toLowerCase().endsWith("btsnoop_hci.log")) - Number(a.name.toLowerCase().endsWith("btsnoop_hci.log")));
  for (const entry of directEntries) {
    const extracted = await extractZipEntry(bytes, entry);
    if (extracted.length >= 8 && ascii(extracted.slice(0, 8)) === BTSNOOP_MAGIC) {
      return { bytes: extracted, entryName: entry.name, container: "zip-btsnoop" };
    }
  }
  const textEntries = entries
    .filter(entry => /(^|\/)(bugreport|dumpstate)[^/]*\.txt$/i.test(entry.name) || entry.name.toLowerCase().endsWith(".txt"))
    .sort((a, b) => {
      const aMain = /(^|\/)bugreport[^/]*\.txt$/i.test(a.name) ? 1 : 0;
      const bMain = /(^|\/)bugreport[^/]*\.txt$/i.test(b.name) ? 1 : 0;
      return bMain - aMain || b.uncompressedSize - a.uncompressedSize;
    });
  for (const entry of textEntries) {
    const text = decoder.decode(await extractZipEntry(bytes, entry));
    let block;
    try {
      block = extractBtsnoozBlock(text);
    } catch (error) {
      throw new Error(`${entry.name}: ${error.message}`);
    }
    if (block == null) continue;
    try {
      const decoded = await decodeBtsnooz(decodeBase64(block));
      return { bytes: decoded, entryName: `${entry.name}#BTSNOOP_LOG_SUMMARY`, container: "zip-btsnooz" };
    } catch (error) {
      throw new Error(`${entry.name}: BTSNOOP_LOG_SUMMARY löytyi, mutta sen purku epäonnistui: ${error.message}`);
    }
  }
  throw new Error("Bugiraportista ei löytynyt erillistä btsnoop_hci.log-tiedostoa eikä pää-TXT:n BTSNOOP_LOG_SUMMARY-osiota; HCI-loki ei ehkä ollut käytössä raporttia luotaessa");
}

function formatRequestClassification(value) {
  return ({
    "verified-live-table": "varmennettu Quicklynks-livekysely",
    "single-read41": "yksittäinen 41-taulukkoluku",
    "legacy-read61": "aiempi 61-taulukkoluku",
    "proprietary-table": "Quicklynks-taulukkokysely",
    "ascii-candidate": "ASCII-komentokandidaatti",
    "unknown-binary-candidate": "tuntematon binäärikuori"
  })[value] || value;
}

export function buildQuicklynksTraceReport(analysis, options = {}) {
  const analyzedAt = options.analyzedAt ?? Date.now();
  const reportId = options.reportId || `QKT-${new Date(analyzedAt).toISOString().replace(/[-:.TZ]/g, "").slice(0, 17)}`;
  const findings = [];
  if (analysis.targetHandle == null) {
    findings.push("Quicklynksin tunnettua 41-taulukkokyselyä ei löytynyt, joten FFF6-kahvaa ei voitu tunnistaa turvallisesti.");
  } else {
    findings.push(`Quicklynks-liikenne eristettiin HCI-yhteydelle ${analysis.targetConnectionHandleHex} ja ATT-kahvalle ${analysis.targetHandleHex}; muun Bluetooth-liikenteen payloadit jätettiin raportista pois.`);
    if (analysis.onlyKnownTableProtocol) findings.push("Kaikki havaitut pyynnöt kuuluivat ennestään tunnettuun Quicklynksin 41/61-taulukkoprotokollaan; erillistä raw-CAN-kuorta ei tässä jäljessä havaittu.");
    if (analysis.unknownRequests.length) findings.push(`Löytyi ${analysis.unknownRequests.length} tuntematonta pyyntömuotoa, jotka ovat raw-CAN-kuoren tutkimuskandidaatteja mutta joita Flex ei vielä lähetä autolle.`);
    if (analysis.toyotaTargetRequests.length) findings.push(`Jäljessä esiintyi ${analysis.toyotaTargetRequests.length} pyyntöä, joissa on 21 7E/21 7F- tai 61 7E/61 7F -kohde.`);
  }
  const lines = [
    "===== BEGIN IS220D OBD FLEX OBD PLUS BLE TRACE REPORT =====",
    "Raporttityyppi: OBD Plus / Quicklynks BLE -liikennejäljen passiivinen analyysi",
    `Raporttitunnus: ${reportId}`,
    "Raporttimuoto: quicklynks-obdplus-btsnoop-readonly-v1",
    `Sovellus: IS220d OBD Flex ${options.appVersion || "0.6.8"}`,
    `Analysoitu: ${new Date(analyzedAt).toISOString()}`,
    `Lähdetiedosto: ${analysis.sourceName}`,
    `ZIP-merkintä: ${analysis.sourceEntryName || "ei ZIP-pakettia"}`,
    `Lähdemuoto: ${analysis.sourceContainer}`,
    `Lähteen koko: ${analysis.byteLength} tavua`,
    `btsnoop-versio: ${analysis.version}`,
    `Datalink-tyyppi: ${analysis.datalinkType}`,
    `HCI-tietueita: ${analysis.recordCount}`,
    `ATT write/notify -tapahtumia: ${analysis.attEvents.length}`,
    `Katkennut loki: ${analysis.truncated ? "kyllä" : "ei"}`,
    `Pudotettuja tietueita: ${analysis.droppedRecords}`,
    "",
    "TURVALLISUUS JA TIETOSUOJA",
    "Analyysi on täysin paikallinen ja passiivinen. Se ei muodosta Bluetooth- tai ECU-yhteyttä eikä lähetä komentoja.",
    "Raporttiin sisällytetään vain sen ATT-kahvan liikenne, jolta löytyi tunnettu Quicklynksin pituus + 41/61 -taulukkokysely.",
    "Muiden Bluetooth-yhteyksien payloadit jätetään pois.",
    "",
    "YHTEENVETO",
    `Quicklynks HCI-yhteys: ${analysis.targetConnectionHandleHex || "ei tunnistettu"}`,
    `Quicklynks ATT-kahva: ${analysis.targetHandleHex || "ei tunnistettu"}`,
    `Kohdekahvan kirjoituksia: ${analysis.targetWrites}`,
    `Kohdekahvan ilmoituksia: ${analysis.targetNotifications}`,
    `Pyyntö-vastausjaksoja: ${analysis.sequences.length}`,
    `Yksilöllisiä pyyntöjä: ${analysis.uniqueRequests.length}`,
    `Tuntemattomia kuorikandidaatteja: ${analysis.unknownRequests.length}`,
    `Toyota 7E/7F -kohdeosumia: ${analysis.toyotaTargetRequests.length}`,
    "",
    "AUTOMAATTISET HAVAINNOT",
    ...(findings.length ? findings.map((item, index) => `${index + 1}. ${item}`) : ["1. Ei havaintoja."]),
    "",
    "YKSILÖLLISET PYYNNÖT",
    ...(analysis.uniqueRequests.length ? analysis.uniqueRequests.map(item => `${item.requestHex}\t${item.count}\t${formatRequestClassification(item.classification)}`) : ["Ei pyyntöjä."]),
    "",
    "PYYNTÖ-VASTAUSJAKSOT",
    ...(analysis.sequences.length ? analysis.sequences.flatMap(sequence => [
      `#${String(sequence.sequence).padStart(3, "0")} +${sequence.relativeMs} ms TX ${sequence.requestHex} (${formatRequestClassification(sequence.classification)})`,
      ...(sequence.responseChunks.length
        ? sequence.responseChunks.map((chunk, index) => `  RX${index + 1} +${chunk.relativeMs} ms ${chunk.valueHex}`)
        : ["  RX: ei ilmoitusta ennen seuraavaa pyyntöä"])
    ]) : ["Ei jaksoja."]),
    "",
    "TSV_BEGIN",
    "sequence\trelative_ms\tclassification\trequest_hex\tresponse_chunk_count\tresponse_chunks_hex",
    ...analysis.sequences.map(sequence => [
      sequence.sequence,
      sequence.relativeMs,
      sequence.classification,
      sequence.requestHex,
      sequence.responseChunks.length,
      sequence.responseChunks.map(chunk => chunk.valueHex).join("|")
    ].join("\t")),
    "TSV_END",
    "===== END IS220D OBD FLEX OBD PLUS BLE TRACE REPORT ====="
  ];
  return lines.join("\n");
}

export function buildQuicklynksTraceAnalysisPrompt(analysis) {
  return [
    "Analysoi liitteenä oleva Flex 0.6.8:n passiivinen OBD Plus / Quicklynks BLE -liikennejälkiraportti.",
    "Selvitä, sisältääkö se tunnetusta 41/61-taulukkoprotokollasta poikkeavan, vain lukemiseen soveltuvan raw-CAN- tai otsakekomentokuoren.",
    "Älä ehdota tuntemattoman kuoren lähettämistä autolle pelkän tavukuvion perusteella.",
    "Toyota-tavoitteet ovat 2AD-FHV/ECD_P3:n 21 7E ja 21 7F, mutta ne saa lisätä Flexiin vasta, kun pyyntökuori, ECU-osoite ja 61 7E/61 7F -vastausrakenne ovat näytöllä varmennettuja.",
    `Raportissa on ${analysis.uniqueRequests.length} yksilöllistä pyyntöä ja ${analysis.unknownRequests.length} tuntematonta kuorikandidaattia.`
  ].join("\n");
}
