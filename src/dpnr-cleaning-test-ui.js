import {
  DPNR_CLEANING_CONDITIONS,
  DPNR_CLEANING_STAGES,
  addDpnrCleaningCapture,
  analyzeDpnrCleaningTest,
  buildDpnrCleaningAnalysisPrompt,
  buildDpnrCleaningTestReport,
  createDpnrCleaningTestRun
} from "./dpnr-cleaning-test.js";

const STORAGE_KEY = "lexusIs220dDpnrHoseCleaningTestV1";
const APP_VERSION = "0.9.1";
const SAMPLE_COUNT = 6;
const SAMPLE_INTERVAL_MS = 850;
const RPM_WAIT_TIMEOUT_MS = 20000;

const $ = selector => document.querySelector(selector);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function parseNumber(value) {
  const normalized = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".").replace(/[^0-9+\-.]/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function currentPressureKpa() {
  const cards = [...document.querySelectorAll("#dpnrMetricGrid .dpnr-metric")];
  const card = cards.find(item => /paine-ero/i.test(item.querySelector("span")?.textContent || ""));
  return parseNumber(card?.querySelector("strong")?.textContent);
}

function readSnapshot() {
  return {
    timestamp: Date.now(),
    pressureKpa: currentPressureKpa(),
    rpm: parseNumber($("#dpnrRpm")?.textContent),
    mafGs: parseNumber($("#dpnrMaf")?.textContent),
    coolantC: parseNumber($("#dpnrCoolant")?.textContent),
    raw217e: String($("#dpnrRaw217e")?.textContent || "").trim()
  };
}

function loadRun() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return parsed?.schemaVersion === "is220d-dpnr-hose-cleaning-v1" ? parsed : null;
  } catch {
    return null;
  }
}

function saveRun(run) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(run)); } catch {}
}

function clearRun() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

let run = loadRun() || createDpnrCleaningTestRun({ appVersion: APP_VERSION });
let running = false;
let selectedStage = run?.before?.rpm3000 && !run?.after?.rpm3000 ? "after" : "before";

function sourceSummaryText() {
  return "GSIC RM0150 / P1426 ja P2002: testi vertaa paine-eroa KOEO-tilassa, lämpimällä tyhjäkäynnillä ja noin 3000 rpm:ssä ilman kuormaa. 3000 rpm -tulos merkitään heikon varmuuden mittaukseksi, jos MAF jää alle 25 g/s.";
}

function stageComplete(stage) {
  return Object.keys(DPNR_CLEANING_CONDITIONS).every(id => Boolean(run?.[stage]?.[id]?.summary));
}

function format(value, decimals = 2, suffix = "") {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(decimals).replace(".", ",")}${suffix}` : "–";
}

function captureCard(stage, id) {
  const capture = run?.[stage]?.[id];
  const summary = capture?.summary;
  if (!summary) return `<div class="dpnr-clean-row"><strong>${escapeHtml(DPNR_CLEANING_CONDITIONS[id].shortLabel)}</strong><span>Ei mitattu</span></div>`;
  const state = summary.validForComparison ? "OK" : "TARKISTA";
  return `<div class="dpnr-clean-row ${summary.negativeAt3000 ? "bad" : summary.validForComparison ? "good" : "warn"}">
    <strong>${escapeHtml(DPNR_CLEANING_CONDITIONS[id].shortLabel)}</strong>
    <span>${format(summary.pressureKpa, 2, " kPa")} · ${format(summary.rpm, 0, " rpm")} · MAF ${format(summary.mafGs, 1, " g/s")} · ${state}</span>
  </div>`;
}

function comparisonText() {
  const analysis = analyzeDpnrCleaningTest(run);
  if (!analysis.completeBefore && !analysis.completeAfter) return "Kerää ensin ENNEN-mittaukset. Testipari säilyy puhelimessa letkujen puhdistuksen ajan.";
  if (!analysis.completeAfter) return "ENNEN-sarja valmis. Puhdista letkut/putket huolto-ohjeen mukaan ja tee sen jälkeen sama JÄLKEEN-sarja.";
  const parts = [];
  if (analysis.status === "normalized") parts.push("Negatiivinen 3000 rpm paine-ero normalisoitui puhdistuksen jälkeen.");
  else if (analysis.status === "negative-remains") parts.push("Negatiivinen 3000 rpm paine-ero jäi puhdistuksen jälkeen.");
  else parts.push("Ennen/jälkeen-testipari on valmis.");
  if (Number.isFinite(analysis.koeoOffsetBefore) && Number.isFinite(analysis.koeoOffsetAfter)) {
    parts.push(`KOEO |offset| ${format(analysis.koeoOffsetBefore)} → ${format(analysis.koeoOffsetAfter)} kPa.`);
  }
  if (Number.isFinite(analysis.pressure3000DeltaKpa)) parts.push(`3000 rpm muutos ${format(analysis.pressure3000DeltaKpa)} kPa (jälkeen − ennen).`);
  parts.push(...analysis.findings);
  return parts.join(" ");
}

function ensureStyles() {
  if ($("#dpnr-cleaning-test-styles")) return;
  const style = document.createElement("style");
  style.id = "dpnr-cleaning-test-styles";
  style.textContent = `
    .dpnr-clean-test { margin-top:12px; }
    .dpnr-clean-tabs { display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0; }
    .dpnr-clean-tabs button.active { outline:2px solid var(--info); }
    .dpnr-clean-actions { display:grid;gap:8px;margin-top:10px; }
    .dpnr-clean-action { display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:9px;border:1px solid var(--line);border-radius:10px;background:var(--surface-inset); }
    .dpnr-clean-action span { color:var(--muted);font-size:9px;line-height:1.4; }
    .dpnr-clean-action strong { display:block;color:var(--text-strong);font-size:11px; }
    .dpnr-clean-stage-summary { display:grid;gap:5px;margin-top:9px; }
    .dpnr-clean-row { display:flex;justify-content:space-between;gap:8px;padding:6px 8px;border:1px solid var(--line-soft);border-radius:8px;font-size:9px; }
    .dpnr-clean-row span { text-align:right;color:var(--muted); }
    .dpnr-clean-row.good { border-color:var(--success-border); }
    .dpnr-clean-row.warn { border-color:var(--warning-border); }
    .dpnr-clean-row.bad { border-color:var(--danger-border); }
    .dpnr-clean-report-actions { display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:9px; }
  `;
  document.head.append(style);
}

function render() {
  const root = $("#dpnrCleaningTest");
  if (!root) return;
  const stage = selectedStage;
  root.querySelectorAll("[data-dpnr-stage]").forEach(button => button.classList.toggle("active", button.dataset.dpnrStage === stage));
  const status = $("#dpnrCleaningStageStatus");
  status.textContent = stageComplete(stage) ? `${DPNR_CLEANING_STAGES[stage].label}: kaikki kolme mittausta tallennettu.` : `${DPNR_CLEANING_STAGES[stage].label}: tallenna kolme mittaustilaa.`;
  $("#dpnrCleaningStageSummary").innerHTML = Object.keys(DPNR_CLEANING_CONDITIONS).map(id => captureCard(stage, id)).join("");
  $("#dpnrCleaningComparison").textContent = comparisonText();
  $("#dpnrCleaningComparison").className = `inline-message ${analyzeDpnrCleaningTest(run).status === "negative-remains" ? "error" : analyzeDpnrCleaningTest(run).completeAfter ? "" : "warning"}`.trim();
  const afterButton = root.querySelector('[data-dpnr-stage="after"]');
  if (afterButton) afterButton.disabled = !stageComplete("before") && !Object.keys(run.after || {}).length;
  root.querySelectorAll("[data-dpnr-condition]").forEach(button => button.disabled = running);
}

function ensurePanel() {
  const page = $("#page-dpnr");
  if (!page || $("#dpnrCleaningTest")) return;
  ensureStyles();
  const panel = document.createElement("div");
  panel.id = "dpnrCleaningTest";
  panel.className = "card dpnr-clean-test";
  panel.innerHTML = `
    <div class="section-title compact-title"><div><div class="eyebrow">GSIC P1426 / P2002 · VAIN LUKU</div><h3>Paine-eroletkujen ENNEN / JÄLKEEN -testi</h3></div></div>
    <p class="hint">${escapeHtml(sourceSummaryText())}</p>
    <ol class="ct-test-steps">
      <li><strong>KOEO:</strong> virrat päälle, moottori sammuksissa. Tallenna mittaus.</li>
      <li><strong>Tyhjäkäynti:</strong> lämmitä moottori normaalisti ja tallenna vakaa tyhjäkäynti.</li>
      <li><strong>3000 rpm:</strong> vaihde vapaalle, ei kuormaa. Paina mittausnappia ja nosta kierrokset noin 3000 rpm:iin; Flex odottaa oikeaa kierrosaluetta.</li>
      <li>Puhdista paineletkut/pressure pipes GSIC-pohjaisen huolto-ohjeen mukaan ja toista sama JÄLKEEN-sarja.</li>
    </ol>
    <div class="dpnr-clean-tabs">
      <button class="secondary active" type="button" data-dpnr-stage="before">ENNEN</button>
      <button class="secondary" type="button" data-dpnr-stage="after">JÄLKEEN</button>
    </div>
    <div id="dpnrCleaningStageStatus" class="inline-message warning"></div>
    <div class="dpnr-clean-actions">
      <div class="dpnr-clean-action"><div><strong>KOEO</strong><span>Virrat päällä, moottori sammuksissa</span></div><button class="primary compact" type="button" data-dpnr-condition="koeo">Tallenna</button></div>
      <div class="dpnr-clean-action"><div><strong>Lämmin tyhjäkäynti</strong><span>Moottori käy vakaasti ilman kaasua</span></div><button class="primary compact" type="button" data-dpnr-condition="idle">Tallenna</button></div>
      <div class="dpnr-clean-action"><div><strong>Noin 3000 rpm · ei kuormaa</strong><span>Flex odottaa 2700–3300 rpm ja kerää sarjan</span></div><button class="primary compact" type="button" data-dpnr-condition="rpm3000">Mittaa</button></div>
    </div>
    <div id="dpnrCleaningStageSummary" class="dpnr-clean-stage-summary"></div>
    <div id="dpnrCleaningComparison" class="inline-message warning"></div>
    <div class="dpnr-clean-report-actions">
      <button id="dpnrCleaningCopy" class="secondary compact" type="button">Kopioi raportti</button>
      <button id="dpnrCleaningSave" class="secondary compact" type="button">Tallenna .txt</button>
      <button id="dpnrCleaningShare" class="secondary compact" type="button">Jaa analyysiin</button>
    </div>
    <button id="dpnrCleaningReset" class="secondary full compact" type="button">Tyhjennä ENNEN/JÄLKEEN-testipari</button>
  `;
  const rawCard = page.querySelector(".raw-card");
  page.insertBefore(panel, rawCard || page.querySelector(".chart-card") || null);

  panel.querySelectorAll("[data-dpnr-stage]").forEach(button => button.addEventListener("click", () => {
    selectedStage = button.dataset.dpnrStage;
    render();
  }));
  panel.querySelectorAll("[data-dpnr-condition]").forEach(button => button.addEventListener("click", () => capture(button.dataset.dpnrCondition)));
  $("#dpnrCleaningCopy").addEventListener("click", copyReport);
  $("#dpnrCleaningSave").addEventListener("click", saveReport);
  $("#dpnrCleaningShare").addEventListener("click", shareReport);
  $("#dpnrCleaningReset").addEventListener("click", () => {
    if (!confirm("Tyhjennetäänkö koko DPNR ENNEN/JÄLKEEN-testipari?")) return;
    clearRun();
    run = createDpnrCleaningTestRun({ appVersion: APP_VERSION });
    selectedStage = "before";
    saveRun(run);
    render();
  });
  render();
}

function ensureLiveReading() {
  const button = $("#dpnrToggleLiveButton");
  if (!button) return false;
  if (/^Aloita/i.test(button.textContent || "")) button.click();
  return true;
}

async function waitForCondition(conditionId) {
  const condition = DPNR_CLEANING_CONDITIONS[conditionId];
  const started = Date.now();
  while (Date.now() - started < RPM_WAIT_TIMEOUT_MS) {
    const snapshot = readSnapshot();
    const rpm = snapshot.rpm;
    if (conditionId === "koeo") {
      if (Number.isFinite(rpm) && rpm <= condition.rpmMax) return snapshot;
      $("#dpnrCleaningStageStatus").textContent = "KOEO odottaa: sammuta moottori mutta jätä virrat päälle.";
    } else if (Number.isFinite(rpm) && rpm >= condition.rpmMin && rpm <= condition.rpmMax) {
      return snapshot;
    } else {
      $("#dpnrCleaningStageStatus").textContent = conditionId === "rpm3000"
        ? `Odotetaan 2700–3300 rpm… nykyinen ${Number.isFinite(rpm) ? Math.round(rpm) : "–"} rpm.`
        : `Odotetaan vakaata tyhjäkäyntiä… nykyinen ${Number.isFinite(rpm) ? Math.round(rpm) : "–"} rpm.`;
    }
    await delay(350);
  }
  throw new Error("Mittausehto ei täyttynyt 20 sekunnissa. Tarkista moottorin tila ja että DPNR-live päivittyy.");
}

async function capture(conditionId) {
  if (running) return;
  if (!ensureLiveReading()) return;
  running = true;
  render();
  const stage = selectedStage;
  try {
    $("#dpnrCleaningStageStatus").textContent = `Valmistellaan ${DPNR_CLEANING_CONDITIONS[conditionId].label}…`;
    await delay(1200);
    await waitForCondition(conditionId);
    const samples = [];
    for (let index = 0; index < SAMPLE_COUNT; index++) {
      const snapshot = readSnapshot();
      const condition = DPNR_CLEANING_CONDITIONS[conditionId];
      const rpmOkay = Number.isFinite(snapshot.rpm) && snapshot.rpm >= condition.rpmMin && snapshot.rpm <= condition.rpmMax;
      if (rpmOkay && Number.isFinite(snapshot.pressureKpa) && snapshot.raw217e && snapshot.raw217e !== "–") samples.push(snapshot);
      $("#dpnrCleaningStageStatus").textContent = `${DPNR_CLEANING_STAGES[stage].label} · ${DPNR_CLEANING_CONDITIONS[conditionId].shortLabel}: ${index + 1}/${SAMPLE_COUNT} · paine ${format(snapshot.pressureKpa, 2, " kPa")} · RPM ${format(snapshot.rpm, 0)} · MAF ${format(snapshot.mafGs, 1, " g/s")}`;
      if (index < SAMPLE_COUNT - 1) await delay(SAMPLE_INTERVAL_MS);
    }
    if (samples.length < 4) throw new Error(`Kelvollisia näytteitä saatiin vain ${samples.length}/${SAMPLE_COUNT}. Pidä mittausehto vakaana ja yritä uudelleen.`);
    run = addDpnrCleaningCapture(run, stage, conditionId, samples);
    run.meta.appVersion = APP_VERSION;
    saveRun(run);
    if (stage === "before" && stageComplete("before")) selectedStage = "after";
    $("#dpnrCleaningStageStatus").textContent = "Mittaus tallennettu.";
  } catch (error) {
    $("#dpnrCleaningStageStatus").textContent = `Mittaus ei tallentunut: ${error.message}`;
    $("#dpnrCleaningStageStatus").className = "inline-message error";
  } finally {
    running = false;
    render();
  }
}

function report() {
  return buildDpnrCleaningTestReport(run, analyzeDpnrCleaningTest(run));
}

async function copyReport() {
  try {
    await navigator.clipboard.writeText(report());
    $("#dpnrCleaningStageStatus").textContent = "ENNEN/JÄLKEEN-raportti kopioitu.";
  } catch {
    $("#dpnrCleaningStageStatus").textContent = "Raportin kopiointi ei onnistunut.";
  }
}

function saveReport() {
  const blob = new Blob([report()], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Lexus_IS220d_DPNR_ennen-jalkeen_Flex-${APP_VERSION}_${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function shareReport() {
  const analysis = analyzeDpnrCleaningTest(run);
  const text = `${buildDpnrCleaningAnalysisPrompt(run, analysis)}\n\n${report()}`;
  try {
    if (navigator.share) await navigator.share({ title: "Lexus IS220d DPNR ennen/jälkeen", text });
    else await navigator.clipboard.writeText(text);
    $("#dpnrCleaningStageStatus").textContent = navigator.share ? "Avaa analyysisovellus jakovalikosta." : "Raportti ja analyysipyyntö kopioitu.";
  } catch (error) {
    if (error?.name !== "AbortError") $("#dpnrCleaningStageStatus").textContent = `Jakaminen epäonnistui: ${error.message}`;
  }
}

function init() {
  ensurePanel();
  const observer = new MutationObserver(() => ensurePanel());
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
