const STORAGE_KEY = "lexusIs220dBomComponentDiagnosticsV1";

export const COMPONENT_DIAGNOSTIC_STATUS = Object.freeze({
  observed: Object.freeze({ label: "DATA SAATU", css: "observed" }),
  partial: Object.freeze({ label: "OSITTAIN", css: "partial" }),
  unavailable: Object.freeze({ label: "EI VASTAUSTA", css: "unavailable" }),
  "not-tested": Object.freeze({ label: "EI TESTATTU", css: "not-tested" })
});

const CLASS_LABEL = Object.freeze({ direct: "DIRECT", indirect: "INDIRECT" });

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function componentDiagnosticStatusLabel(status) {
  return COMPONENT_DIAGNOSTIC_STATUS[status]?.label || String(status || "TUNTEMATON").toUpperCase();
}

export function observedComponentSignals(component) {
  if (!Array.isArray(component?.groupEvidence)) return [];
  const signals = [];
  for (const group of component.groupEvidence) {
    for (const signal of group?.signals || []) {
      if (signal?.observed && signal?.command && !signals.includes(signal.command)) signals.push(signal.command);
    }
  }
  return signals;
}

export function attemptedComponentSignals(component) {
  if (!Array.isArray(component?.groupEvidence)) return [];
  const signals = [];
  for (const group of component.groupEvidence) {
    for (const signal of group?.signals || []) {
      if (signal?.attempted && signal?.command && !signals.includes(signal.command)) signals.push(signal.command);
    }
  }
  return signals;
}

export function filterComponentDiagnostics(coverage, {
  diagnosticClass = "all",
  status = "all",
  query = ""
} = {}) {
  const needle = String(query || "").trim().toLocaleLowerCase("fi");
  const components = Array.isArray(coverage?.components) ? coverage.components : [];
  return components.filter(component => {
    if (diagnosticClass !== "all" && component.diagnosticClass !== diagnosticClass) return false;
    if (status !== "all" && component.status !== status) return false;
    if (!needle) return true;
    const haystack = [component.label, component.pnc, component.oe, component.symptom, component.id]
      .join(" ")
      .toLocaleLowerCase("fi");
    return haystack.includes(needle);
  });
}

export function buildComponentDiagnosticCardHtml(component) {
  const statusMeta = COMPONENT_DIAGNOSTIC_STATUS[component?.status] || { label: "TUNTEMATON", css: "not-tested" };
  const classLabel = CLASS_LABEL[component?.diagnosticClass] || String(component?.diagnosticClass || "").toUpperCase();
  const observed = observedComponentSignals(component);
  const attempted = attemptedComponentSignals(component);
  const required = Math.max(1, Number(component?.requiredGroups || 1));
  const observedGroups = Math.max(0, Number(component?.observedGroups || 0));
  const signalText = observed.length
    ? `Saatu: ${observed.join(", ")}`
    : attempted.length
      ? `Yritetty: ${attempted.join(", ")}`
      : "Tämän ajon signaaleja ei ole kysytty";
  const excluded = Array.isArray(component?.excludedSignals) && component.excludedSignals.length
    ? `<div class="bom-component-excluded">Ei käytetä evidenssinä: <code>${escapeHtml(component.excludedSignals.join(", "))}</code></div>`
    : "";
  const note = component?.note ? `<p class="bom-component-note">${escapeHtml(component.note)}</p>` : "";

  return `<article class="bom-component-card ${escapeHtml(statusMeta.css)}" data-component-class="${escapeHtml(component?.diagnosticClass)}" data-component-status="${escapeHtml(component?.status)}">
    <div class="bom-component-head">
      <div>
        <div class="bom-component-badges"><span class="bom-class ${escapeHtml(component?.diagnosticClass)}">${escapeHtml(classLabel)}</span><span class="bom-status ${escapeHtml(statusMeta.css)}">${escapeHtml(statusMeta.label)}</span></div>
        <h3>${escapeHtml(component?.label)}</h3>
      </div>
      <strong class="bom-coverage">${observedGroups}/${required}</strong>
    </div>
    <div class="bom-part-numbers"><span>PNC ${escapeHtml(component?.pnc || "–")}</span><span>OE ${escapeHtml(component?.oe || "–")}</span></div>
    <p class="bom-symptom">${escapeHtml(component?.symptom || "")}</p>
    <details class="bom-component-details">
      <summary>Diagnoosievidenssi</summary>
      <div class="bom-signal-line">${escapeHtml(signalText)}</div>
      <div class="bom-source">${escapeHtml(component?.bomSource || "")}</div>
      ${excluded}
      ${note}
    </details>
  </article>`;
}

export function buildComponentDiagnosticSummary(coverage) {
  const summary = coverage?.summary || {};
  return Object.freeze({
    total: Number(summary.total || 0),
    direct: Number(summary.direct || 0),
    indirect: Number(summary.indirect || 0),
    observed: Number(summary.observed || 0),
    partial: Number(summary.partial || 0),
    unavailable: Number(summary.unavailable || 0),
    notTested: Number(summary.notTested || 0)
  });
}

let latestPayload = null;

function safeStorageGet() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.coverage?.applicable) return null;
    return parsed;
  } catch {
    return null;
  }
}

function safeStorageSet(payload) {
  try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch {}
}

function formatTimestamp(value) {
  if (!Number.isFinite(Number(value))) return "";
  try {
    return new Intl.DateTimeFormat("fi-FI", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(Number(value)));
  } catch {
    return "";
  }
}

function ensureStyles() {
  if (typeof document === "undefined" || document.querySelector("#bom-component-diagnostics-styles")) return;
  const style = document.createElement("style");
  style.id = "bom-component-diagnostics-styles";
  style.textContent = `
    .bom-summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:7px; margin-bottom:14px; }
    .bom-summary-grid > div { padding:10px 5px; border:1px solid var(--line); border-radius:11px; background:var(--surface-inset); text-align:center; }
    .bom-summary-grid span { display:block; color:var(--muted); font-size:9px; font-weight:800; text-transform:uppercase; }
    .bom-summary-grid strong { display:block; margin-top:5px; font-size:18px; }
    .bom-filter-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
    .bom-filter-grid label { margin-bottom:5px; }
    .bom-search { margin-top:10px; }
    .bom-component-list { display:grid; gap:9px; }
    .bom-component-card { padding:14px; border:1px solid var(--line); border-radius:14px; background:var(--surface); }
    .bom-component-card.observed { border-color:var(--success-border); }
    .bom-component-card.partial { border-color:var(--warning-border); }
    .bom-component-card.unavailable { border-color:var(--danger-border-soft); }
    .bom-component-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
    .bom-component-head h3 { margin:7px 0 0; font-size:15px; line-height:1.3; }
    .bom-component-badges { display:flex; flex-wrap:wrap; gap:5px; }
    .bom-class,.bom-status { display:inline-block; padding:4px 7px; border:1px solid var(--line); border-radius:999px; font-size:8px; font-weight:900; letter-spacing:.05em; }
    .bom-class.direct { border-color:var(--info-border); background:var(--info-bg); color:var(--info); }
    .bom-class.indirect { border-color:var(--warning-border); background:var(--warning-bg); color:var(--warning); }
    .bom-status.observed { border-color:var(--success-border); background:var(--success-bg); color:var(--success); }
    .bom-status.partial { border-color:var(--warning-border); background:var(--warning-bg); color:var(--warning); }
    .bom-status.unavailable { border-color:var(--danger-border); background:var(--danger-bg); color:var(--danger-text); }
    .bom-status.not-tested { color:var(--muted); }
    .bom-coverage { min-width:42px; padding:6px 7px; border:1px solid var(--line); border-radius:10px; background:var(--surface-inset); text-align:center; font-size:12px; }
    .bom-part-numbers { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
    .bom-part-numbers span { padding:4px 6px; border-radius:7px; background:var(--surface-2); color:var(--muted); font:9px/1.3 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
    .bom-symptom { margin:10px 0 0; color:var(--text-strong); font-size:12px; line-height:1.45; }
    .bom-component-details { margin-top:10px; border-top:1px solid var(--line-soft); padding-top:9px; }
    .bom-component-details summary { color:var(--info); cursor:pointer; font-size:11px; font-weight:800; }
    .bom-signal-line,.bom-source,.bom-component-excluded,.bom-component-note { margin-top:8px; color:var(--muted); font-size:10px; line-height:1.45; overflow-wrap:anywhere; }
    .bom-signal-line { color:var(--text-strong); font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
    .bom-component-note { color:var(--warning-text); }
    .bom-empty { padding:22px; border:1px dashed var(--line); border-radius:13px; color:var(--muted); text-align:center; font-size:13px; }
    .bom-run-meta { margin:7px 0 0; color:var(--muted); font-size:10px; }
    @media (max-width:520px) { .bom-summary-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
  `;
  document.head.append(style);
}

function pageMarkup() {
  return `<section id="page-component-diagnostics" class="page hidden" data-vehicle-only="is220d" aria-labelledby="nav-component-diagnostics">
    <div class="section-title">
      <div><div class="eyebrow">IS220d · BOM · DIRECT / INDIRECT</div><h2>BOM-diagnoosi</h2></div>
      <span id="bomDiagnosticBadge" class="ct-test-badge neutral">EI AJETTU</span>
    </div>
    <div class="inline-message">
      Flex kohdistaa jo kerätyn ECU/OBD-datan BOM-osille. <strong>DATA SAATU</strong> tarkoittaa, että komponentin diagnostiikkaan tarvittava signaalikattavuus saatiin — se ei yksin tarkoita, että osa on ehjä tai viallinen.
    </div>
    <div class="card">
      <h3>Aja komponenttipohjainen diagnoosi</h3>
      <p class="hint ct-hint">Sama varmennettu vain luku -testisarja kuin laajassa ELM/Toyota-diagnostiikassa. BOM ei lisää omia ECU-komentoja eikä ohita ajoneuvoprofiilin sallintalistaa.</p>
      <label for="bomDiagnosticEngineState">Moottorin tila testissä</label>
      <select id="bomDiagnosticEngineState">
        <option value="auto">Varmista kierrosluvusta automaattisesti</option>
        <option value="running">Moottori käy</option>
        <option value="stopped">Moottori ei käy</option>
      </select>
      <label for="bomDiagnosticNote">Oire tai huomio</label>
      <textarea id="bomDiagnosticNote" rows="3" placeholder="Esim. lämmin tyhjäkäynti 1100 rpm, palamattoman dieselin haju, nykii 1300 rpm"></textarea>
      <div class="diagnostic-progress" aria-live="polite">
        <div class="diagnostic-progress-track"><span id="bomDiagnosticProgressBar"></span></div>
        <div class="diagnostic-progress-meta"><span id="bomDiagnosticProgressText">Ei ajettu</span><strong id="bomDiagnosticProgressCounts">Odottamassa laajaa diagnostiikkaa</strong></div>
      </div>
      <div class="button-row">
        <button id="bomDiagnosticRun" class="primary" type="button">Aja BOM-komponenttidiagnoosi</button>
        <button id="bomDiagnosticCancel" class="secondary" type="button" disabled>Keskeytä</button>
      </div>
      <div id="bomDiagnosticRunState" class="inline-message hidden" aria-live="polite"></div>
      <div id="bomRunMeta" class="bom-run-meta"></div>
    </div>
    <div id="bomDiagnosticSummary" class="bom-summary-grid">
      <div><span>DIRECT</span><strong id="bomSummaryDirect">0</strong></div>
      <div><span>INDIRECT</span><strong id="bomSummaryIndirect">0</strong></div>
      <div><span>DATA SAATU</span><strong id="bomSummaryObserved">0</strong></div>
      <div><span>KESKEN</span><strong id="bomSummaryIncomplete">0</strong></div>
    </div>
    <div class="card">
      <div class="bom-filter-grid">
        <div><label for="bomClassFilter">Luokka</label><select id="bomClassFilter"><option value="all">Kaikki</option><option value="direct">DIRECT</option><option value="indirect">INDIRECT</option></select></div>
        <div><label for="bomStatusFilter">Kattavuus</label><select id="bomStatusFilter"><option value="all">Kaikki</option><option value="observed">Data saatu</option><option value="partial">Osittain</option><option value="unavailable">Ei vastausta</option><option value="not-tested">Ei testattu</option></select></div>
      </div>
      <div class="bom-search"><label for="bomSearch">Hae osaa / OE / PNC</label><input id="bomSearch" type="text" placeholder="Esim. EGR, 89480, turbo, SCV"></div>
    </div>
    <div id="bomComponentList" class="bom-component-list"><div class="bom-empty">Komponenttidiagnoosia ei ole vielä ajettu tällä asennuksella.</div></div>
  </section>`;
}

function installPage() {
  if (typeof document === "undefined") return;
  if (document.querySelector("#page-component-diagnostics")) return;
  ensureStyles();
  const main = document.querySelector("#main");
  if (!main) return;
  const holder = document.createElement("div");
  holder.innerHTML = pageMarkup().trim();
  const page = holder.firstElementChild;
  const beforePage = document.querySelector("#page-dtc");
  main.insertBefore(page, beforePage || null);

  const nav = document.querySelector(".bottom-nav");
  if (nav && !document.querySelector("#nav-component-diagnostics")) {
    const button = document.createElement("button");
    button.id = "nav-component-diagnostics";
    button.className = "nav-item hidden";
    button.type = "button";
    button.dataset.page = "component-diagnostics";
    button.dataset.vehicleOnly = "is220d";
    button.innerHTML = "<span>BOM</span>Diag.";
    nav.insertBefore(button, document.querySelector("#nav-dtc") || null);
  }

  document.querySelector("#bomDiagnosticRun")?.addEventListener("click", startComponentDiagnostic);
  document.querySelector("#bomDiagnosticCancel")?.addEventListener("click", () => document.querySelector("#cancelGekoTest")?.click());
  for (const selector of ["#bomClassFilter", "#bomStatusFilter", "#bomSearch"]) {
    document.querySelector(selector)?.addEventListener(selector === "#bomSearch" ? "input" : "change", renderLatest);
  }

  observeFullDiagnosticUi();
  latestPayload = safeStorageGet();
  renderLatest();
  syncDiagnosticControls();
}

function startComponentDiagnostic() {
  const sourceButton = document.querySelector("#runGekoTest");
  const runState = document.querySelector("#bomDiagnosticRunState");
  if (!sourceButton || sourceButton.disabled) {
    document.querySelector("#nav-connection")?.click();
    if (runState) {
      runState.textContent = "Yhdistä IS220d ELM/vLinker-yhteydellä ja palaa BOM-diagnoosiin.";
      runState.className = "inline-message warning";
    }
    return;
  }
  const sourceEngineState = document.querySelector("#diagnosticEngineState");
  const sourceNote = document.querySelector("#diagnosticNote");
  const engineState = document.querySelector("#bomDiagnosticEngineState");
  const note = document.querySelector("#bomDiagnosticNote");
  if (sourceEngineState && engineState) sourceEngineState.value = engineState.value;
  if (sourceNote && note) sourceNote.value = note.value;
  if (runState) {
    runState.textContent = "BOM-komponenttidiagnoosi käynnissä. Tulokset päivittyvät automaattisesti testin valmistuttua.";
    runState.className = "inline-message";
  }
  sourceButton.click();
  syncDiagnosticControls();
}

function observeFullDiagnosticUi() {
  if (typeof MutationObserver === "undefined") return;
  const targets = ["#runGekoTest", "#cancelGekoTest", "#diagnosticProgressText", "#diagnosticProgressBar", "#diagnosticResultCounts"]
    .map(selector => document.querySelector(selector))
    .filter(Boolean);
  if (!targets.length) return;
  const observer = new MutationObserver(syncDiagnosticControls);
  for (const target of targets) observer.observe(target, { attributes: true, childList: true, subtree: true, characterData: true });
}

function syncDiagnosticControls() {
  if (typeof document === "undefined") return;
  const sourceRun = document.querySelector("#runGekoTest");
  const sourceCancel = document.querySelector("#cancelGekoTest");
  const runButton = document.querySelector("#bomDiagnosticRun");
  const cancelButton = document.querySelector("#bomDiagnosticCancel");
  const sourceText = String(sourceRun?.textContent || "");
  const running = /käynnissä/i.test(sourceText) || sourceCancel?.disabled === false;
  if (runButton) {
    runButton.disabled = Boolean(running);
    runButton.textContent = running ? "BOM-diagnoosi käynnissä…" : "Aja BOM-komponenttidiagnoosi";
  }
  if (cancelButton) cancelButton.disabled = !running;
  const sourceProgress = document.querySelector("#diagnosticProgressBar");
  const progress = document.querySelector("#bomDiagnosticProgressBar");
  if (progress) progress.style.width = sourceProgress?.style?.width || "0%";
  const progressText = document.querySelector("#bomDiagnosticProgressText");
  if (progressText) progressText.textContent = document.querySelector("#diagnosticProgressText")?.textContent || "Ei ajettu";
  const counts = document.querySelector("#bomDiagnosticProgressCounts");
  if (counts) counts.textContent = document.querySelector("#diagnosticResultCounts")?.textContent || "Odottamassa laajaa diagnostiikkaa";
}

function renderLatest() {
  if (typeof document === "undefined") return;
  const coverage = latestPayload?.coverage;
  const list = document.querySelector("#bomComponentList");
  if (!coverage?.applicable || !list) {
    if (list) list.innerHTML = '<div class="bom-empty">Komponenttidiagnoosia ei ole vielä ajettu tällä asennuksella.</div>';
    return;
  }
  const summary = buildComponentDiagnosticSummary(coverage);
  const setText = (selector, value) => { const element = document.querySelector(selector); if (element) element.textContent = String(value); };
  setText("#bomSummaryDirect", summary.direct);
  setText("#bomSummaryIndirect", summary.indirect);
  setText("#bomSummaryObserved", summary.observed);
  setText("#bomSummaryIncomplete", summary.partial + summary.unavailable + summary.notTested);

  const badge = document.querySelector("#bomDiagnosticBadge");
  if (badge) {
    badge.textContent = `${summary.observed}/${summary.total} DATA`;
    badge.className = `ct-test-badge ${summary.observed === summary.total ? "ready" : summary.observed > 0 ? "attention" : "neutral"}`;
  }
  const meta = document.querySelector("#bomRunMeta");
  if (meta) {
    const when = formatTimestamp(latestPayload?.endedAt || latestPayload?.startedAt);
    meta.textContent = [when ? `Viimeisin ajo ${when}` : "", latestPayload?.runId ? `Raportti ${latestPayload.runId}` : ""].filter(Boolean).join(" · ");
  }

  const filtered = filterComponentDiagnostics(coverage, {
    diagnosticClass: document.querySelector("#bomClassFilter")?.value || "all",
    status: document.querySelector("#bomStatusFilter")?.value || "all",
    query: document.querySelector("#bomSearch")?.value || ""
  });
  list.innerHTML = filtered.length
    ? filtered.map(buildComponentDiagnosticCardHtml).join("")
    : '<div class="bom-empty">Suodattimilla ei löytynyt komponentteja.</div>';
}

export function publishIs220dComponentDiagnosticCoverage(coverage, meta = {}) {
  if (!coverage?.applicable) return null;
  latestPayload = Object.freeze({
    coverage,
    runId: String(meta.runId || ""),
    startedAt: Number.isFinite(Number(meta.startedAt)) ? Number(meta.startedAt) : null,
    endedAt: Number.isFinite(Number(meta.endedAt)) ? Number(meta.endedAt) : null
  });
  safeStorageSet(latestPayload);
  renderLatest();
  return latestPayload;
}

installPage();
