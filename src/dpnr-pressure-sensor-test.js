import { collectDpnrTestPhase } from "./dpnr-test-live.js";
import { buildIs220dRepairManualVisualsHtml } from "./is220d-repair-manual-visuals.js";
export const DPNR_PRESSURE_SENSOR_TEST_STORAGE_KEY = "lexusIs220dDpnrPressureSensorTestV1";

export const DPNR_PRESSURE_SENSOR_PHASES = Object.freeze({
  koeo: Object.freeze({
    id: "koeo",
    label: "1 · KOEO-nollataso",
    durationMs: 5000,
    instruction: "Virrat päälle, moottori sammuksissa. DPNR-paine-eron pitäisi GSIC-vertailussa olla noin 0 kPa; Flex tallentaa arvon eikä keksi sille omaa hyväksymisrajaa.",
    rpmMin: null,
    rpmMax: 80
  }),
  idle: Object.freeze({
    id: "idle",
    label: "2 · Vakaa tyhjäkäynti",
    durationMs: 6000,
    instruction: "Käynnistä moottori ja anna sen käydä vakaata tyhjäkäyntiä ilman kaasua.",
    rpmMin: 500,
    rpmMax: 1600
  }),
  rpm3000: Object.freeze({
    id: "rpm3000",
    label: "3 · 3000 rpm ilman kuormaa",
    durationMs: 6000,
    instruction: "Vaihde vapaalle. Pidä kierrokset mahdollisimman tasaisesti noin 3000 rpm:ssa mittauksen ajan.",
    rpmMin: 2700,
    rpmMax: 3300
  })
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

export function parseDpnrTestNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const text = String(value ?? "").replace(/\s+/g, "").replace(",", ".").replace(/[^0-9+\-.]/g, "");
  if (!text || text === "-" || text === ".") return NaN;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function medianDpnrTestValue(values) {
  const numbers = (Array.isArray(values) ? values : [])
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!numbers.length) return NaN;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2 ? numbers[middle] : (numbers[middle - 1] + numbers[middle]) / 2;
}

export function summarizeDpnrPressureSensorSamples(samples = [], phaseId = "") {
  const valid = (Array.isArray(samples) ? samples : []).filter(sample => Number.isFinite(Number(sample?.pressureKpa)));
  const pressures = valid.map(sample => Number(sample.pressureKpa));
  const rpms = valid.map(sample => Number(sample.rpm)).filter(Number.isFinite);
  const coolant = valid.map(sample => Number(sample.coolantC)).filter(Number.isFinite);
  return deepFreeze({
    phaseId,
    sampleCount: valid.length,
    pressureMedianKpa: medianDpnrTestValue(pressures),
    pressureMinKpa: pressures.length ? Math.min(...pressures) : NaN,
    pressureMaxKpa: pressures.length ? Math.max(...pressures) : NaN,
    rpmMedian: medianDpnrTestValue(rpms),
    coolantMedianC: medianDpnrTestValue(coolant),
    raw217eLast: valid.at(-1)?.raw217e || "",
    startedAt: valid[0]?.timestamp || null,
    endedAt: valid.at(-1)?.timestamp || null
  });
}

export function assessDpnrPressureSensorTest(run = null) {
  const phases = run?.phases || {};
  const koeo = phases.koeo?.pressureMedianKpa;
  const idle = phases.idle?.pressureMedianKpa;
  const rpm3000 = phases.rpm3000?.pressureMedianKpa;
  const complete = Number.isFinite(koeo) && Number.isFinite(idle) && Number.isFinite(rpm3000);

  if (!complete) {
    return deepFreeze({
      status: "incomplete",
      label: "KESKEN",
      message: "Tallenna KOEO-, tyhjäkäynti- ja 3000 rpm -mittaukset. Flex tekee arvion vasta, kun kaikki kolme käyttötilaa on mitattu.",
      koeoKpa: Number.isFinite(koeo) ? koeo : NaN,
      idleKpa: Number.isFinite(idle) ? idle : NaN,
      rpm3000Kpa: Number.isFinite(rpm3000) ? rpm3000 : NaN,
      idleDeltaFromKoeoKpa: Number.isFinite(koeo) && Number.isFinite(idle) ? idle - koeo : NaN,
      rpm3000DeltaFromKoeoKpa: Number.isFinite(koeo) && Number.isFinite(rpm3000) ? rpm3000 - koeo : NaN
    });
  }

  const common = {
    koeoKpa: koeo,
    idleKpa: idle,
    rpm3000Kpa: rpm3000,
    idleDeltaFromKoeoKpa: idle - koeo,
    rpm3000DeltaFromKoeoKpa: rpm3000 - koeo
  };

  if (rpm3000 < 0) {
    return deepFreeze({
      status: "strong-deviation",
      label: "SELKEÄ POIKKEAMA",
      message: "DPNR-paine-ero on negatiivinen noin 3000 rpm:ssa ilman kuormaa. GSIC P1426 -diagnostiikka pitää tätä epäloogisena: tarkista ensin paineletkujen järjestys ja tukokset, pressure transmitting pipe -linjat sekä vasta sen jälkeen itse paine-eroanturi.",
      ...common
    });
  }

  if (idle < 0) {
    return deepFreeze({
      status: "deviation",
      label: "POIKKEAVA SUUNTA",
      message: "Paine-ero on negatiivinen tyhjäkäynnillä, vaikka 3000 rpm -mittaus ei ole negatiivinen. Vertaa KOEO-nollatasoon ja raakavasteeseen sekä tarkista paineletkut ennen anturipäätelmää.",
      ...common
    });
  }

  return deepFreeze({
    status: "observed",
    label: "SIGNAALI HAVAITTU",
    message: "217E-paine-erosignaali saatiin kolmessa käyttötilassa ja 3000 rpm -arvon merkki on GSIC P1426 -tarkistuksen kannalta looginen. Tämä ei yksin todista anturia ehjäksi eikä määritä DPNR/DPF-tukkeutumisrajaa; vertaa KOEO-nollatasoa, muutosta ja raakavastetta.",
    ...common
  });
}

function formatNumber(value, decimals = 2) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(decimals).replace(".", ",") : "–";
}

export function buildDpnrPressureSensorTestReport(run = null) {
  const assessment = assessDpnrPressureSensorTest(run);
  const lines = [
    "===== BEGIN LEXUS IS220D DPNR PRESSURE SENSOR TEST =====",
    "Testi: DPF/DPNR paine-eroanturin toimintatarkistus",
    "Perusta: Lexus/Toyota GSIC RM0150 · P1426 / Differential Pressure Sensor -diagnostiikka",
    "Lukupolku: Toyota 217E + OBD RPM · vain luku",
    "",
    `Tulos: ${assessment.label}`,
    assessment.message,
    ""
  ];

  for (const phaseId of ["koeo", "idle", "rpm3000"]) {
    const phase = run?.phases?.[phaseId];
    const label = DPNR_PRESSURE_SENSOR_PHASES[phaseId]?.label || phaseId;
    lines.push(label);
    lines.push(`  paine-ero mediaani: ${formatNumber(phase?.pressureMedianKpa)} kPa`);
    lines.push(`  min/max: ${formatNumber(phase?.pressureMinKpa)} / ${formatNumber(phase?.pressureMaxKpa)} kPa`);
    lines.push(`  RPM mediaani: ${formatNumber(phase?.rpmMedian, 0)}`);
    lines.push(`  näytteitä: ${Number(phase?.sampleCount || 0)}`);
    if (phase?.raw217eLast) lines.push(`  217E viimeinen raakavaste: ${phase.raw217eLast}`);
  }

  lines.push("");
  lines.push(`Tyhjäkäynti − KOEO: ${formatNumber(assessment.idleDeltaFromKoeoKpa)} kPa`);
  lines.push(`3000 rpm − KOEO: ${formatNumber(assessment.rpm3000DeltaFromKoeoKpa)} kPa`);
  lines.push("");
  lines.push("Tulkintaraja: Flex ei keksi paine-eroanturille omaa kPa-hyväksymisrajaa eikä ilmoita anturia ehjäksi pelkän tämän testin perusteella.");
  lines.push("Toiminto ei suorita Active Testiä, DPF/DPNR-regenerointia, vikakoodien poistoa tai ECU-kirjoituksia.");
  lines.push("===== END LEXUS IS220D DPNR PRESSURE SENSOR TEST =====");
  return lines.join("\n");
}

function query(root, selector) {
  return typeof root?.querySelector === "function" ? root.querySelector(selector) : null;
}

function queryAll(root, selector) {
  return typeof root?.querySelectorAll === "function" ? [...root.querySelectorAll(selector)] : [];
}



function readRecord() {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(DPNR_PRESSURE_SENSOR_TEST_STORAGE_KEY) || "null");
    return parsed && typeof parsed === "object" ? parsed : { capturedAt: null, phases: {} };
  } catch {
    return { capturedAt: null, phases: {} };
  }
}

function writeRecord(record) {
  try { globalThis.localStorage?.setItem(DPNR_PRESSURE_SENSOR_TEST_STORAGE_KEY, JSON.stringify(record)); } catch {}
}

function installStyles() {
  const documentObject = globalThis.document;
  if (!documentObject || query(documentObject, "#dpnr-pressure-sensor-test-styles") || typeof documentObject.createElement !== "function") return;
  const style = documentObject.createElement("style");
  style.id = "dpnr-pressure-sensor-test-styles";
  style.textContent = `.dpnr-pressure-sensor-test{border-color:var(--info-border)}.dpnr-pressure-sensor-test .sensor-phase-grid{display:grid;gap:8px;margin-top:10px}.dpnr-pressure-sensor-test .sensor-phase{padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--surface-inset)}.dpnr-pressure-sensor-test .sensor-phase strong{display:block;font-size:11px}.dpnr-pressure-sensor-test .sensor-phase small{display:block;margin:4px 0 8px;color:var(--muted);line-height:1.4}.dpnr-pressure-sensor-test .sensor-result{margin-top:7px;font-size:10px;color:var(--text-strong)}.dpnr-pressure-sensor-test .sensor-summary{margin-top:10px}.dpnr-pressure-sensor-test .sensor-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}`;
  documentObject.head?.append?.(style);
}

function render(panel, record = readRecord()) {
  for (const phaseId of Object.keys(DPNR_PRESSURE_SENSOR_PHASES)) {
    const target = query(panel, `[data-dpnr-sensor-result="${phaseId}"]`);
    const phase = record?.phases?.[phaseId];
    if (!target) continue;
    target.textContent = phase
      ? `${formatNumber(phase.pressureMedianKpa)} kPa · ${Number(phase.sampleCount || 0)} näytettä`
      : "Ei tallennettu";
  }
  const assessment = assessDpnrPressureSensorTest(record);
  const summary = query(panel, "#dpnrPressureSensorSummary");
  if (summary) {
    summary.textContent = `${assessment.label} · ${assessment.message}`;
    summary.className = `inline-message sensor-summary ${assessment.status === "strong-deviation" || assessment.status === "deviation" ? "warning" : ""}`.trim();
  }
  const delta = query(panel, "#dpnrPressureSensorDelta");
  if (delta) {
    delta.textContent = `Δ tyhjäkäynti−KOEO ${formatNumber(assessment.idleDeltaFromKoeoKpa)} kPa · Δ 3000−KOEO ${formatNumber(assessment.rpm3000DeltaFromKoeoKpa)} kPa`;
  }
}

async function capturePhase(panel, phaseId) {
  const phase = DPNR_PRESSURE_SENSOR_PHASES[phaseId];
  const status = query(panel, "#dpnrPressureSensorStatus");
  const button = query(panel, `[data-dpnr-sensor-capture="${phaseId}"]`);
  if (!phase || !status || !button) return;

  const controls = queryAll(panel, "button, select").map(control => [control, control.disabled]);
  for (const [control] of controls) control.disabled = true;
  try {
    const samples = await collectDpnrTestPhase(phase, status);

    const summary = summarizeDpnrPressureSensorSamples(samples, phaseId);
    if (!summary.sampleCount) {
      status.textContent = phaseId === "rpm3000"
        ? "Tuore 217E-data löytyi, mutta kelvollista dataa ei saatu 2700–3300 rpm mittausikkunassa. Pidä kierrokset lähempänä 3000 rpm:ää ja yritä uudelleen."
        : "Tuore 217E-data löytyi, mutta mittaus ei vastannut tämän käyttötilan RPM-ehtoja. Tarkista moottorin tila ja yritä uudelleen.";
      status.className = "inline-message warning";
      return;
    }

    const record = readRecord();
    record.capturedAt = Date.now();
    record.phases = { ...(record.phases || {}), [phaseId]: summary };
    writeRecord(record);
    render(panel, record);
    status.textContent = `${phase.label} tallennettu: ${formatNumber(summary.pressureMedianKpa)} kPa · tuore 617E-vastaus varmennettu.`;
    status.className = "inline-message";
  } catch (error) {
    status.textContent = error.message;
    status.className = "inline-message warning";
  } finally {
    for (const [control, disabled] of controls) control.disabled = disabled;
  }
}

async function copyReport(panel) {
  const status = query(panel, "#dpnrPressureSensorStatus");
  try {
    await globalThis.navigator?.clipboard?.writeText?.(buildDpnrPressureSensorTestReport(readRecord()));
    if (status) {
      status.textContent = "Paine-eroanturin testiraportti kopioitu leikepöydälle.";
      status.className = "inline-message";
    }
  } catch {
    if (status) {
      status.textContent = "Raportin kopiointi ei onnistunut tässä WebView-ympäristössä.";
      status.className = "inline-message warning";
    }
  }
}

function ensurePanel() {
  const documentObject = globalThis.document;
  if (!documentObject || query(documentObject, "#dpnrPressureSensorTest")) return;
  const page = query(documentObject, "#page-dpnr");
  if (!page || typeof documentObject.createElement !== "function") return;
  installStyles();

  const panel = documentObject.createElement("div");
  panel.id = "dpnrPressureSensorTest";
  panel.className = "card dpnr-pressure-sensor-test";
  panel.innerHTML = `<div class="section-title compact-title"><div><div class="eyebrow">217E · GSIC P1426 · VAIN LUKU</div><h3>DPF/DPNR paine-eroanturin testi</h3></div></div><p class="hint">Kolmen käyttötilan toimintatarkistus jo varmennetulla Toyota 217E -paine-erolla. Flex käynnistää DPNR-liven automaattisesti tarvittaessa ja hyväksyy mittaukseen vain tuoreen 617E-vastauksen. Testi etsii erityisesti epäloogisen negatiivisen paine-eron noin 3000 rpm:ssa ja näyttää KOEO-nollatason sekä signaalin muutoksen. Se ei keksi omaa kPa-hyväksymisrajaa eikä päättele anturia ehjäksi pelkästä yhdestä arvosta.</p><div class="sensor-phase-grid">${Object.values(DPNR_PRESSURE_SENSOR_PHASES).map(phase => `<div class="sensor-phase"><strong>${phase.label}</strong><small>${phase.instruction}</small><button class="secondary full compact" type="button" data-dpnr-sensor-capture="${phase.id}">Mittaa ${Math.round(phase.durationMs / 1000)} s</button><div class="sensor-result" data-dpnr-sensor-result="${phase.id}">Ei tallennettu</div></div>`).join("")}</div><div id="dpnrPressureSensorStatus" class="inline-message hidden" aria-live="polite"></div><div id="dpnrPressureSensorSummary" class="inline-message sensor-summary"></div><div id="dpnrPressureSensorDelta" class="hint"></div><div class="sensor-actions"><button id="dpnrPressureSensorCopy" class="secondary" type="button">Kopioi raportti</button><button id="dpnrPressureSensorReset" class="secondary" type="button">Nollaa testi</button></div>`;

  panel.innerHTML += buildIs220dRepairManualVisualsHtml("engine.dpnr_differential_pressure_sensor");

  const rawCard = query(page, ".raw-card");
  if (typeof page.insertBefore === "function") page.insertBefore(panel, rawCard || null);
  else page.append?.(panel);

  for (const button of queryAll(panel, "[data-dpnr-sensor-capture]")) {
    button.addEventListener?.("click", () => capturePhase(panel, button.dataset.dpnrSensorCapture));
  }
  query(panel, "#dpnrPressureSensorCopy")?.addEventListener?.("click", () => copyReport(panel));
  query(panel, "#dpnrPressureSensorReset")?.addEventListener?.("click", () => {
    writeRecord({ capturedAt: null, phases: {} });
    render(panel, readRecord());
    const status = query(panel, "#dpnrPressureSensorStatus");
    if (status) {
      status.textContent = "Paine-eroanturin testi nollattu.";
      status.className = "inline-message";
    }
  });
  render(panel, readRecord());
}

export function initializeDpnrPressureSensorTestUi() {
  ensurePanel();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading" && typeof document.addEventListener === "function") {
    document.addEventListener("DOMContentLoaded", ensurePanel, { once: true });
  } else {
    queueMicrotask(ensurePanel);
  }
}
