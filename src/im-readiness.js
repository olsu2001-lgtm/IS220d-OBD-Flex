export const IM_READINESS_SCHEMA_VERSION = 1;

const COMMON_MONITORS = Object.freeze([
  Object.freeze({ id: "misfire", label: "Sytytyskatkos / misfire", supportByte: 1, supportBit: 0, incompleteByte: 1, incompleteBit: 4 }),
  Object.freeze({ id: "fuel_system", label: "Polttoainejärjestelmä", supportByte: 1, supportBit: 1, incompleteByte: 1, incompleteBit: 5 }),
  Object.freeze({ id: "comprehensive_components", label: "Kattavat komponentit", supportByte: 1, supportBit: 2, incompleteByte: 1, incompleteBit: 6 })
]);

const SPARK_MONITORS = Object.freeze([
  Object.freeze({ id: "catalyst", label: "Katalysaattori", bit: 0 }),
  Object.freeze({ id: "heated_catalyst", label: "Lämmitetty katalysaattori", bit: 1 }),
  Object.freeze({ id: "evap", label: "Haihtumispäästöt / EVAP", bit: 2 }),
  Object.freeze({ id: "secondary_air", label: "Toisioilma", bit: 3 }),
  Object.freeze({ id: "gpf", label: "Bensiinin hiukkassuodatin / GPF", bit: 4 }),
  Object.freeze({ id: "oxygen_sensor", label: "Happianturi", bit: 5 }),
  Object.freeze({ id: "oxygen_sensor_heater", label: "Happianturin lämmitin", bit: 6 }),
  Object.freeze({ id: "egr_vvt", label: "EGR / VVT", bit: 7 })
]);

const COMPRESSION_MONITORS = Object.freeze([
  Object.freeze({ id: "nmhc_catalyst", label: "NMHC-katalysaattori", bit: 0 }),
  Object.freeze({ id: "nox_scr", label: "NOx / SCR", bit: 1 }),
  Object.freeze({ id: "boost_pressure", label: "Ahtopainejärjestelmä", bit: 3 }),
  Object.freeze({ id: "exhaust_gas_sensor", label: "Pakokaasuanturi", bit: 5 }),
  Object.freeze({ id: "pm_filter", label: "PM-/hiukkassuodatin", bit: 6 }),
  Object.freeze({ id: "egr_vvt", label: "EGR / VVT", bit: 7 })
]);

const compactHex = value => String(value || "").replace(/[^0-9a-f]/gi, "").toUpperCase();
const byteHex = value => Number(value).toString(16).padStart(2, "0").toUpperCase();

function modePidBytes(raw, responseMode, pid) {
  const target = `${byteHex(responseMode)}${byteHex(pid)}`;
  for (const line of String(raw || "").replace(/>/g, "\n").split(/[\r\n]+/)) {
    const hex = compactHex(line);
    const index = hex.indexOf(target);
    if (index < 0) continue;
    const payload = hex.slice(index + target.length);
    return payload.match(/../g)?.map(byte => Number.parseInt(byte, 16)) || [];
  }
  return null;
}

function freezeMonitors(monitors) {
  return Object.freeze(monitors.map(monitor => Object.freeze(monitor)));
}

function decodeMonitorSet(bytes) {
  const ignitionType = bytes[1] & 0x08 ? "compression" : "spark";
  const engineSpecific = ignitionType === "compression" ? COMPRESSION_MONITORS : SPARK_MONITORS;
  const monitors = [];

  for (const definition of COMMON_MONITORS) {
    const supported = Boolean(bytes[definition.supportByte] & (1 << definition.supportBit));
    if (!supported) continue;
    monitors.push({
      id: definition.id,
      label: definition.label,
      category: "common",
      supported: true,
      complete: !(bytes[definition.incompleteByte] & (1 << definition.incompleteBit))
    });
  }

  for (const definition of engineSpecific) {
    const supported = Boolean(bytes[2] & (1 << definition.bit));
    if (!supported) continue;
    monitors.push({
      id: definition.id,
      label: definition.label,
      category: ignitionType,
      supported: true,
      complete: !(bytes[3] & (1 << definition.bit))
    });
  }

  return { ignitionType, monitors: freezeMonitors(monitors) };
}

/**
 * Decode standard OBD-II Service 01 readiness PIDs.
 * pid 0x01 = monitor status since DTCs cleared
 * pid 0x41 = monitor status this drive cycle
 */
export function parseImReadiness(raw, pid = 0x01) {
  const normalizedPid = Number(pid) & 0xff;
  if (![0x01, 0x41].includes(normalizedPid)) throw new Error(`Unsupported I/M readiness PID: ${byteHex(normalizedPid)}`);
  const bytes = modePidBytes(raw, 0x41, normalizedPid);
  if (!bytes || bytes.length < 4) return null;

  const decoded = decodeMonitorSet(bytes);
  const sinceClear = normalizedPid === 0x01;
  const incomplete = decoded.monitors.filter(monitor => !monitor.complete);
  return Object.freeze({
    schemaVersion: IM_READINESS_SCHEMA_VERSION,
    pid: normalizedPid,
    scope: sinceClear ? "since-dtc-clear" : "this-drive-cycle",
    ignitionType: decoded.ignitionType,
    milOn: sinceClear ? Boolean(bytes[0] & 0x80) : null,
    dtcCount: sinceClear ? bytes[0] & 0x7f : null,
    monitors: decoded.monitors,
    supportedCount: decoded.monitors.length,
    completeCount: decoded.monitors.length - incomplete.length,
    incompleteCount: incomplete.length,
    ready: decoded.monitors.length > 0 && incomplete.length === 0,
    rawBytes: Object.freeze(bytes.slice(0, 4))
  });
}

export function parseWarmupsSinceDtcClear(raw) {
  const bytes = modePidBytes(raw, 0x41, 0x30);
  return bytes?.length ? bytes[0] : null;
}

export function parseDistanceSinceDtcClear(raw) {
  const bytes = modePidBytes(raw, 0x41, 0x31);
  return bytes?.length >= 2 ? bytes[0] * 256 + bytes[1] : null;
}

export function buildImReadinessSnapshot({ sinceClearRaw = "", driveCycleRaw = "", warmupsRaw = "", distanceRaw = "" } = {}) {
  const sinceClear = parseImReadiness(sinceClearRaw, 0x01);
  const driveCycle = parseImReadiness(driveCycleRaw, 0x41);
  const warmupsSinceClear = parseWarmupsSinceDtcClear(warmupsRaw);
  const distanceSinceClearKm = parseDistanceSinceDtcClear(distanceRaw);
  return Object.freeze({
    schemaVersion: IM_READINESS_SCHEMA_VERSION,
    sinceClear,
    driveCycle,
    warmupsSinceClear,
    distanceSinceClearKm,
    overall: !sinceClear || sinceClear.supportedCount === 0
      ? "unavailable"
      : sinceClear.incompleteCount > 0
        ? "not-ready"
        : "ready"
  });
}

function monitorLine(monitor) {
  return `${monitor.complete ? "VALMIS" : "EI VALMIS"} · ${monitor.label}`;
}

export function buildImReadinessTextReport(snapshot, { vehicle = "", timestamp = Date.now() } = {}) {
  const lines = [
    "===== I/M READINESS =====",
    vehicle ? `Ajoneuvo: ${vehicle}` : null,
    `Aika: ${new Date(timestamp).toISOString()}`,
    `Tulos: ${snapshot?.overall === "ready" ? "VALMIS" : snapshot?.overall === "not-ready" ? "EI VALMIS" : "EI SAATAVILLA"}`
  ].filter(Boolean);

  if (snapshot?.sinceClear) {
    lines.push(`Moottorityyppi: ${snapshot.sinceClear.ignitionType === "compression" ? "puristussytytys / diesel" : "kipinäsytytys"}`);
    lines.push(`MIL: ${snapshot.sinceClear.milOn ? "PÄÄLLÄ" : "POIS"} · vahvistettuja päästö-DTC:itä ${snapshot.sinceClear.dtcCount}`);
    lines.push(`DTC-poiston jälkeen: ${snapshot.sinceClear.completeCount}/${snapshot.sinceClear.supportedCount} tuetusta monitorista valmiina`);
    for (const monitor of snapshot.sinceClear.monitors) lines.push(`- ${monitorLine(monitor)}`);
  }
  if (snapshot?.driveCycle) {
    lines.push(`Tämä ajosykli: ${snapshot.driveCycle.completeCount}/${snapshot.driveCycle.supportedCount} tuetusta monitorista valmiina`);
    for (const monitor of snapshot.driveCycle.monitors) lines.push(`- ${monitorLine(monitor)}`);
  } else {
    lines.push("Tämä ajosykli: PID 0141 ei saatavilla / ei vastannut");
  }
  lines.push(`Lämmityskertoja DTC-poiston jälkeen: ${snapshot?.warmupsSinceClear ?? "–"}`);
  lines.push(`Matka DTC-poiston jälkeen: ${snapshot?.distanceSinceClearKm ?? "–"} km`);
  return `${lines.join("\n")}\n`;
}
