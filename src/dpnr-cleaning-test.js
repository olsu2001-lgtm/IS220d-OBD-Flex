import { buildIs220dRepairManualVisualsHtml } from "./is220d-repair-manual-visuals.js";
export const DPNR_CLEANING_TEST_STORAGE_KEY = "lexusIs220dDpnrCleaningTestV1";

export const DPNR_CLEANING_PHASES = Object.freeze({
  koeo: Object.freeze({ id: "koeo", label: "KOEO · virrat päällä, moottori sammuksissa", durationMs: 5000, instruction: "Virrat päälle, moottori sammuksissa. Aloita DPNR-live ja tallenna nollataso.", rpmMin: null, rpmMax: 80 }),
  idle: Object.freeze({ id: "idle", label: "Tyhjäkäynti", durationMs: 6000, instruction: "Käynnistä moottori ja anna sen käydä vakaata tyhjäkäyntiä ilman kaasua.", rpmMin: 500, rpmMax: 1600 }),
  rpm3000: Object.freeze({ id: "rpm3000", label: "3000 rpm · ei kuormaa", durationMs: 6000, instruction: "Vaihde vapaalle. Pidä kierrokset mahdollisimman tasaisesti noin 3000 rpm:ssa mittauksen ajan.", rpmMin: 2700, rpmMax: 3300 })
});

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) freeze(nested);
  return value;
}

export function parseFlexNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const text = String(value ?? "").replace(/\s+/g, "").replace(",", ".").replace(/[^0-9+\-.]/g, "");
  if (!text || text === "-" || text === ".") return NaN;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function median(values) {
  const numbers = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!numbers.length) return NaN;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2 ? numbers[middle] : (numbers[middle - 1] + numbers[middle]) / 2;
}

export function summarizeDpnrCleaningSamples(samples = [], phaseId = "") {
  const valid = (Array.isArray(samples) ? samples : []).filter(sample => Number.isFinite(Number(sample?.pressureKpa)));
  const pressures = valid.map(sample => Number(sample.pressureKpa));
  const rpms = valid.map(sample => Number(sample.rpm)).filter(Number.isFinite);
  const coolant = valid.map(sample => Number(sample.coolantC)).filter(Number.isFinite);
  return freeze({
    phaseId,
    sampleCount: valid.length,
    pressureMedianKpa: median(pressures),
    pressureMinKpa: pressures.length ? Math.min(...pressures) : NaN,
    pressureMaxKpa: pressures.length ? Math.max(...pressures) : NaN,
    rpmMedian: median(rpms),
    coolantMedianC: median(coolant),
    raw217eLast: valid.at(-1)?.raw217e || "",
    startedAt: valid[0]?.timestamp || null,
    endedAt: valid.at(-1)?.timestamp || null
  });
}

export function assessDpnrCleaningPhase(phaseId, summary) {
  const pressure = Number(summary?.pressureMedianKpa);
  if (!Number.isFinite(pressure)) return freeze({ status: "no-data", label: "EI DATAA", message: "217E-paine-eroa ei saatu mittausjaksolta." });
  if (phaseId === "rpm3000" && pressure < 0) {
    return freeze({ status: "strong-deviation", label: "NEGATIIVINEN 3000 RPM", message: "GSIC P1426 -diagnostiikan mukaan negatiivinen DPNR-paine-ero noin 3000 rpm:ssa ilman kuormaa on epälooginen. Tarkista paineletkujen järjestys, tukos ja pressure transmitting pipe -linjat." });
  }
  if (phaseId === "idle" && pressure < 0) {
    return freeze({ status: "deviation", label: "NEGATIIVINEN", message: "Paine-ero on negatiivinen myös tyhjäkäynnillä. Vertaa KOEO-nollatasoon ja 3000 rpm -mittaukseen ennen osien vaihtamista." });
  }
  if (phaseId === "koeo") {
    return freeze({ status: "observed", label: "NOLLATASO TALLENNETTU", message: "GSIC:n vertailussa KOEO-paine-eron tulee olla noin 0 kPa. Flex ei aseta tälle omaa keksittyä hyväksymisrajaa, vaan tallentaa arvon ennen/jälkeen-vertailuun." });
  }
  return freeze({ status: "observed", label: "DATA TALLENNETTU", message: phaseId === "rpm3000" ? "Paine-eron merkki on positiivinen tässä mittauksessa. Tämä ei yksin todista DPNR:n kuntoa tai tukkeutumattomuutta." : "Mittaus tallennettu vertailua varten." });
}

export function compareDpnrCleaningRuns(before = null, after = null) {
  const b3 = Number(before?.phases?.rpm3000?.pressureMedianKpa);
  const a3 = Number(after?.phases?.rpm3000?.pressureMedianKpa);
  const bk = Number(before?.phases?.koeo?.pressureMedianKpa);
  const ak = Number(after?.phases?.koeo?.pressureMedianKpa);
  const has3000 = Number.isFinite(b3) && Number.isFinite(a3);
  const hasKoeo = Number.isFinite(bk) && Number.isFinite(ak);
  let outcome = "incomplete";
  let message = "Tee sekä ENNEN- että JÄLKEEN-sarjasta vähintään KOEO- ja 3000 rpm -mittaus.";
  if (has3000) {
    if (b3 < 0 && a3 >= 0) {
      outcome = "improved";
      message = "3000 rpm -paine-ero vaihtui negatiivisesta ei-negatiiviseksi puhdistuksen jälkeen. Mittausketjun käyttäytyminen parani selvästi.";
    } else if (a3 < 0) {
      outcome = "still-negative";
      message = "3000 rpm -paine-ero on puhdistuksen jälkeen edelleen negatiivinen. Tarkista letkujen järjestys, jäljelle jäänyt tukos, transmitting pipe -linjat ja paine-eroanturi.";
    } else {
      outcome = "comparable";
      message = "Molempien 3000 rpm -mittausten paine-eron merkki on ei-negatiivinen. Vertaa arvoja, raakavastetta ja KOEO-nollatasoa; tämä testi ei määritä DPNR:n tukkeutumisrajaa.";
    }
  }
  return freeze({
    outcome,
    message,
    before3000Kpa: Number.isFinite(b3) ? b3 : NaN,
    after3000Kpa: Number.isFinite(a3) ? a3 : NaN,
    delta3000Kpa: has3000 ? a3 - b3 : NaN,
    beforeKoeoKpa: Number.isFinite(bk) ? bk : NaN,
    afterKoeoKpa: Number.isFinite(ak) ? ak : NaN,
    koeoAbsoluteMovedTowardZero: hasKoeo ? Math.abs(ak) < Math.abs(bk) : null
  });
}

function formatNumber(value, decimals = 2) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(decimals).replace(".", ",") : "–";
}

export function buildDpnrCleaningReport(record) {
  const lines = [
    "===== BEGIN LEXUS IS220D DPNR CLEANING COMPARISON =====",
    "Testi: DPNR/DPF-paine-eroanturin letkut · ennen/jälkeen puhdistuksen",
    "Perusta: Lexus/Toyota GSIC RM0150 · P1426, P2002 ja Differential Pressure Sensor inspection",
    "Lukupolku: Toyota 217E + OBD RPM · vain luku",
    ""
  ];
  for (const mode of ["before", "after"]) {
    const run = record?.[mode];
    lines.push(mode === "before" ? "ENNEN PUHDISTUSTA" : "PUHDISTUKSEN JÄLKEEN");
    if (!run) {
      lines.push("  Ei tallennettua sarjaa", "");
      continue;
    }
    for (const phaseId of ["koeo", "idle", "rpm3000"]) {
      const phase = run.phases?.[phaseId];
      const label = DPNR_CLEANING_PHASES[phaseId]?.label || phaseId;
      lines.push(`  ${label}`);
      lines.push(`    paine-ero mediaani: ${formatNumber(phase?.pressureMedianKpa)} kPa`);
      lines.push(`    min/max: ${formatNumber(phase?.pressureMinKpa)} / ${formatNumber(phase?.pressureMaxKpa)} kPa`);
      lines.push(`    RPM mediaani: ${formatNumber(phase?.rpmMedian, 0)}`);
      lines.push(`    näytteitä: ${Number(phase?.sampleCount || 0)}`);
      if (phase?.raw217eLast) lines.push(`    217E viimeinen raakavaste: ${phase.raw217eLast}`);
    }
    lines.push("");
  }
  const comparison = compareDpnrCleaningRuns(record?.before, record?.after);
  lines.push("VERTAILU", `  ${comparison.message}`);
  if (Number.isFinite(comparison.delta3000Kpa)) lines.push(`  3000 rpm muutos: ${formatNumber(comparison.delta3000Kpa)} kPa`);
  if (comparison.koeoAbsoluteMovedTowardZero !== null) lines.push(`  KOEO siirtyi lähemmäs nollaa: ${comparison.koeoAbsoluteMovedTowardZero ? "kyllä" : "ei"}`);
  lines.push("", "Huom: testi ei suorita DPF-regenerointia, Active Test -toimintoja, vikakoodien poistoa tai ECU-kirjoituksia.", "===== END LEXUS IS220D DPNR CLEANING COMPARISON =====");
  return lines.join("\n");
}

function safeReadRecord() {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(DPNR_CLEANING_TEST_STORAGE_KEY) || "null");
    return parsed && typeof parsed === "object" ? parsed : { before: null, after: null };
  } catch {
    return { before: null, after: null };
  }
}

function safeWriteRecord(record) {
  try { globalThis.localStorage?.setItem(DPNR_CLEANING_TEST_STORAGE_KEY, JSON.stringify(record)); } catch {}
}

function query(root, selector) {
  return typeof root?.querySelector === "function" ? root.querySelector(selector) : null;
}

function queryAll(root, selector) {
  return typeof root?.querySelectorAll === "function" ? [...root.querySelectorAll(selector)] : [];
}

function pressureElement() {
  const cards = queryAll(globalThis.document, "#dpnrMetricGrid .dpnr-metric");
  return cards.find(card => /paine|pressure/i.test(query(card, "span")?.textContent || "")) || cards[0] || null;
}

function readLiveSample() {
  const documentObject = globalThis.document;
  if (!documentObject) return null;
  const pressure = parseFlexNumber(query(pressureElement(), "strong")?.textContent);
  return {
    timestamp: Date.now(),
    pressureKpa: pressure,
    rpm: parseFlexNumber(query(documentObject, "#dpnrRpm")?.textContent),
    coolantC: parseFlexNumber(query(documentObject, "#dpnrCoolant")?.textContent),
    raw217e: String(query(documentObject, "#dpnrRaw217e")?.textContent || "").trim()
  };
}

function phaseAcceptsSample(phase, sample) {
  if (!Number.isFinite(sample?.pressureKpa)) return false;
  if (!Number.isFinite(sample?.rpm)) return phase.id === "koeo";
  if (phase.rpmMin != null && sample.rpm < phase.rpmMin) return false;
  if (phase.rpmMax != null && sample.rpm > phase.rpmMax) return false;
  return true;
}

function stylePanel() {
  const documentObject = globalThis.document;
  if (!documentObject || query(documentObject, "#dpnr-cleaning-test-styles") || typeof documentObject.createElement !== "function") return;
  const style = documentObject.createElement("style");
  style.id = "dpnr-cleaning-test-styles";
  style.textContent = `.dpnr-cleaning-test{border-color:var(--info-border)}.dpnr-cleaning-test .phase-grid{display:grid;gap:8px;margin-top:10px}.dpnr-cleaning-phase{padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--surface-inset)}.dpnr-cleaning-phase strong{display:block;font-size:11px}.dpnr-cleaning-phase small{display:block;margin:4px 0 8px;color:var(--muted);line-height:1.4}.dpnr-cleaning-phase .result{margin-top:7px;font-size:10px;color:var(--text-strong)}.dpnr-cleaning-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.dpnr-cleaning-comparison{margin-top:10px}`;
  if (documentObject.head && typeof documentObject.head.append === "function") documentObject.head.append(style);
}

function modeLabel(mode) { return mode === "after" ? "JÄLKEEN" : "ENNEN"; }

function renderSavedResults(panel, record) {
  const mode = query(panel, "#dpnrCleaningMode")?.value || "before";
  const run = record?.[mode];
  for (const phaseId of Object.keys(DPNR_CLEANING_PHASES)) {
    const target = query(panel, `[data-dpnr-result="${phaseId}"]`);
    const phase = run?.phases?.[phaseId];
    if (!target) continue;
    if (!phase) { target.textContent = "Ei tallennettu"; continue; }
    const assessment = assessDpnrCleaningPhase(phaseId, phase);
    target.textContent = `${assessment.label} · ${formatNumber(phase.pressureMedianKpa)} kPa · ${Number(phase.sampleCount || 0)} näytettä`;
  }
  const comparisonTarget = query(panel, "#dpnrCleaningComparison");
  if (comparisonTarget) {
    const comparison = compareDpnrCleaningRuns(record?.before, record?.after);
    comparisonTarget.textContent = comparison.message;
    comparisonTarget.className = `inline-message dpnr-cleaning-comparison ${comparison.outcome === "still-negative" ? "warning" : ""}`.trim();
  }
}

async function capturePhase(panel, phaseId) {
  const phase = DPNR_CLEANING_PHASES[phaseId];
  const mode = query(panel, "#dpnrCleaningMode")?.value || "before";
  const status = query(panel, "#dpnrCleaningStatus");
  const button = query(panel, `[data-dpnr-capture="${phaseId}"]`);
  if (!phase || !button || !status) return;
  if (!Number.isFinite(readLiveSample()?.pressureKpa)) {
    status.textContent = "DPNR 217E -dataa ei vielä näy. Yhdistä autoon ja käynnistä tämän sivun DPNR-live ensin.";
    status.className = "inline-message warning";
    return;
  }
  button.disabled = true;
  status.textContent = `${modeLabel(mode)} · ${phase.label}: mittaus käynnissä…`;
  status.className = "inline-message";
  const samples = [];
  const start = Date.now();
  while (Date.now() - start < phase.durationMs) {
    const sample = readLiveSample();
    if (phaseAcceptsSample(phase, sample)) samples.push(sample);
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  button.disabled = false;
  const summary = summarizeDpnrCleaningSamples(samples, phaseId);
  if (!summary.sampleCount) {
    status.textContent = phaseId === "rpm3000" ? "Mittaus ei saanut kelvollista 217E-dataa 2700–3300 rpm mittausikkunassa. Pidä kierrokset lähempänä 3000 rpm:ää ja yritä uudelleen." : "Mittaus ei saanut kelvollista 217E-dataa valitussa käyttötilassa. Tarkista live-yhteys ja moottorin tila.";
    status.className = "inline-message warning";
    return;
  }
  const record = safeReadRecord();
  const run = record[mode] || { capturedAt: Date.now(), phases: {} };
  run.capturedAt = Date.now();
  run.phases = { ...(run.phases || {}), [phaseId]: summary };
  record[mode] = run;
  safeWriteRecord(record);
  const assessment = assessDpnrCleaningPhase(phaseId, summary);
  status.textContent = `${modeLabel(mode)} · ${assessment.message}`;
  status.className = `inline-message ${assessment.status === "strong-deviation" || assessment.status === "deviation" ? "warning" : ""}`.trim();
  renderSavedResults(panel, record);
}

async function copyReport(panel) {
  try {
    await globalThis.navigator?.clipboard?.writeText?.(buildDpnrCleaningReport(safeReadRecord()));
    const status = query(panel, "#dpnrCleaningStatus");
    if (status) { status.textContent = "Ennen/jälkeen-raportti kopioitu leikepöydälle."; status.className = "inline-message"; }
  } catch {}
}

function ensurePanel() {
  const documentObject = globalThis.document;
  if (!documentObject || query(documentObject, "#dpnrCleaningTest")) return;
  const page = query(documentObject, "#page-dpnr");
  if (!page || typeof documentObject.createElement !== "function") return;
  stylePanel();
  const panel = documentObject.createElement("div");
  panel.id = "dpnrCleaningTest";
  panel.className = "card dpnr-cleaning-test";
  panel.innerHTML = `<h3>Paineletkujen puhdistus · ennen / jälkeen</h3><p class="hint">Vakioitu vertailu GSIC RM0150:n P1426/P2002-logiikan ympärille. Testi lukee vain jo varmennettua 217E-paine-eroa ja RPM:ää. Ei Active Testiä, pakkopolttoa tai vikakoodien poistoa.</p><ol class="ct-test-steps"><li>Tee ensin kaikki kolme mittausta tilassa <strong>ENNEN puhdistusta</strong>.</li><li>Puhdista paine-eroanturin letkut/putket huolto-ohjeen mukaan ja asenna ne samoihin anturin portteihin.</li><li>Tee samat mittaukset uudelleen tilassa <strong>JÄLKEEN puhdistuksen</strong>.</li><li>Vertaa erityisesti 3000 rpm ilman kuormaa -arvoa. GSIC:n mukaan negatiivinen arvo on epälooginen ja ohjaa tarkistamaan letkujen järjestyksen/tukoksen sekä transmitting pipe -linjat.</li></ol><label for="dpnrCleaningMode">Mittauskierros</label><select id="dpnrCleaningMode"><option value="before">ENNEN puhdistusta</option><option value="after">JÄLKEEN puhdistuksen</option></select><div class="phase-grid">${Object.values(DPNR_CLEANING_PHASES).map(phase => `<div class="dpnr-cleaning-phase"><strong>${phase.label}</strong><small>${phase.instruction}</small><button class="secondary full compact" type="button" data-dpnr-capture="${phase.id}">Tallenna ${Math.round(phase.durationMs / 1000)} s</button><div class="result" data-dpnr-result="${phase.id}">Ei tallennettu</div></div>`).join("")}</div><div id="dpnrCleaningStatus" class="inline-message hidden" aria-live="polite"></div><div id="dpnrCleaningComparison" class="inline-message dpnr-cleaning-comparison"></div><div class="dpnr-cleaning-actions"><button id="dpnrCleaningCopy" class="secondary" type="button">Kopioi vertailuraportti</button><button id="dpnrCleaningReset" class="secondary" type="button">Nollaa vertailu</button></div>`;

  panel.innerHTML += buildIs220dRepairManualVisualsHtml("engine.dpnr_differential_pressure_sensor");

  if (typeof page.insertBefore === "function") {
    const rawCard = query(page, ".raw-card") || query(documentObject, "#page-dpnr .raw-card");
    page.insertBefore(panel, rawCard || null);
  } else if (typeof page.appendChild === "function") {
    page.appendChild(panel);
  } else if (typeof page.append === "function") {
    page.append(panel);
  } else {
    return;
  }

  for (const button of queryAll(panel, "[data-dpnr-capture]")) button.addEventListener?.("click", () => capturePhase(panel, button.dataset.dpnrCapture));
  query(panel, "#dpnrCleaningMode")?.addEventListener?.("change", () => renderSavedResults(panel, safeReadRecord()));
  query(panel, "#dpnrCleaningCopy")?.addEventListener?.("click", () => copyReport(panel));
  query(panel, "#dpnrCleaningReset")?.addEventListener?.("click", () => {
    safeWriteRecord({ before: null, after: null });
    renderSavedResults(panel, safeReadRecord());
    const status = query(panel, "#dpnrCleaningStatus");
    if (status) { status.textContent = "Ennen/jälkeen-vertailu nollattu."; status.className = "inline-message"; }
  });
  renderSavedResults(panel, safeReadRecord());
}

export function initializeDpnrCleaningTestUi() { ensurePanel(); }

if (typeof document !== "undefined") {
  if (document.readyState === "loading" && typeof document.addEventListener === "function") document.addEventListener("DOMContentLoaded", ensurePanel, { once: true });
  else queueMicrotask(ensurePanel);
}
