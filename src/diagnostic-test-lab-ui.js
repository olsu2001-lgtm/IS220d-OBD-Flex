import { buildDiagnosticTestLabModel } from "./is220d-diagnostic-test-lab.js";
import { buildIs220dObdDiagnosticVisualHtml } from "./is220d-obd-diagnostic-visuals.js";

const COVERAGE_STORAGE_KEY = "lexusIs220dBomComponentDiagnosticsV2";
const ROOT_ID = "is220dDiagnosticTestLab";
const STYLE_ID = "is220dDiagnosticTestLabStyles";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseCoverageFromStorage(storage = globalThis.localStorage) {
  if (!storage?.getItem) return null;
  try {
    const payload = JSON.parse(storage.getItem(COVERAGE_STORAGE_KEY) || "null");
    return payload?.coverage?.applicable ? payload.coverage : null;
  } catch {
    return null;
  }
}

function stageLabel(status) {
  return {
    ok: "OK",
    warning: "TARKISTA",
    failed: "KATKESI",
    idle: "EI AJETTU",
    blocked: "ESTETTY"
  }[status] || String(status || "").toUpperCase();
}

function signalStateLabel(signal) {
  if (signal.observed) return "VASTAUS SAATU";
  if (signal.attempted) return "YRITETTY / EI POSITIIVISTA";
  if (!signal.productionAuthorized) return "EI TUOTANTOKÄYTTÖÖN";
  return "EI AJETTU";
}

function buildPipelineHtml(item) {
  return `<div class="test-lab-pipeline" role="list" aria-label="Dataketju">
    ${item.pipeline.map((stage, index) => `
      <div class="test-lab-stage ${escapeHtml(stage.status)}" role="listitem">
        <div class="test-lab-stage-top"><span class="test-lab-stage-index">${index + 1}</span><strong>${escapeHtml(stage.label)}</strong><span class="test-lab-stage-state">${escapeHtml(stageLabel(stage.status))}</span></div>
        <p>${escapeHtml(stage.detail)}</p>
      </div>`).join("")}
  </div>`;
}

function buildSignalHtml(signal) {
  const commands = signal.commands.length ? signal.commands.map(command => `<code>${escapeHtml(command)}</code>`).join(" ") : "–";
  return `<div class="test-lab-signal ${signal.observed ? "observed" : signal.attempted ? "attempted" : "idle"}">
    <div class="test-lab-signal-head"><strong>${escapeHtml(signal.label)}</strong><span>${escapeHtml(signalStateLabel(signal))}</span></div>
    <div class="test-lab-signal-grid">
      <span>Pyyntö</span><div>${commands}</div>
      <span>Odotettu RX</span><code>${escapeHtml(signal.expectedResponsePrefix || "–")}</code>
      <span>Dekooderi</span><code>${escapeHtml(signal.decoder || "–")}</code>
      <span>Evidenssi</span><div>${escapeHtml(signal.evidence)} · ${escapeHtml(signal.authorization)}</div>
      <span>Yrityksiä</span><div>${signal.attempts}</div>
    </div>
  </div>`;
}

function buildRecipeHtml(recipe) {
  const states = (recipe.operatingStates || []).join(" · ") || "ei määritelty";
  return `<li>
    <strong>${escapeHtml(recipe.instruction)}</strong>
    <div class="test-lab-recipe-meta">${escapeHtml(recipe.kind || "testi")} · ${escapeHtml(states)}</div>
    ${recipe.expectedPattern ? `<p>Odotettu: ${escapeHtml(recipe.expectedPattern)}</p>` : ""}
  </li>`;
}

function buildItemHtml(item) {
  const searchText = [item.label, item.componentId, item.pnc, item.oe, item.diagnosticGroup, item.readinessLabel, ...item.signals.map(signal => signal.label)].join(" ").toLocaleLowerCase("fi");
  const canOpenDpnr = item.componentId === "engine.dpnr_differential_pressure_sensor";
  return `<article class="test-lab-item" data-test-lab-item data-group="${escapeHtml(item.diagnosticGroup)}" data-readiness="${escapeHtml(item.readiness)}" data-search="${escapeHtml(searchText)}" data-runnable="${item.runnable ? "1" : "0"}">
    <header class="test-lab-item-head">
      <div class="test-lab-title-block">
        <div class="test-lab-kickers"><span>Drive-rivi ${item.sourceRow}</span><span>${escapeHtml(item.obdRole.toUpperCase())}</span><span>${escapeHtml(item.readinessLabel)}</span></div>
        <h3>${escapeHtml(item.label)}</h3>
        <p>PNC ${escapeHtml(item.pnc || "–")} · OE ${escapeHtml(item.oe || "–")}</p>
      </div>
      <div class="test-lab-diagnosis ${escapeHtml(item.diagnosis.code)}">
        <strong>${escapeHtml(item.diagnosis.label)}</strong>
        <span>${escapeHtml(item.diagnosis.detail)}</span>
      </div>
    </header>

    ${buildPipelineHtml(item)}

    <div class="test-lab-columns">
      <section>
        <h4>Signaaliketju</h4>
        ${item.signals.length ? item.signals.map(buildSignalHtml).join("") : `<p class="test-lab-muted">Ei tuotantoon määriteltyjä signaaleja.</p>`}
      </section>
      <section>
        <h4>Testimääritys</h4>
        <p><strong>Menetelmä:</strong> ${escapeHtml(item.testMethod || "Ei vielä määritelty.")}</p>
        <p><strong>Odotettu käyttäytyminen:</strong> ${escapeHtml(item.expectedPattern || "Ei vielä määritelty.")}</p>
        ${item.operatingStates.length ? `<p><strong>Käyttötilat:</strong> ${escapeHtml(item.operatingStates.join(" · "))}</p>` : ""}
        ${item.missingSignals.length ? `<div class="test-lab-gap"><strong>Puuttuva evidenssi</strong><ul>${item.missingSignals.map(value => `<li>${escapeHtml(value)}</li>`).join("")}</ul></div>` : ""}
        ${item.recipes.length ? `<details><summary>Ohjatut vaiheet (${item.recipes.length})</summary><ol class="test-lab-recipes">${item.recipes.map(buildRecipeHtml).join("")}</ol></details>` : ""}
        ${item.physicalFollowUp ? `<p><strong>Fyysinen varmistus:</strong> ${escapeHtml(item.physicalFollowUp)}</p>` : ""}
      </section>
    </div>

    ${buildIs220dObdDiagnosticVisualHtml(item.componentId)}

    ${item.limitations.length ? `<details class="test-lab-limitations"><summary>Rajaukset</summary><ul>${item.limitations.map(value => `<li>${escapeHtml(value)}</li>`).join("")}</ul></details>` : ""}

    <footer class="test-lab-actions">
      ${canOpenDpnr ? `<button type="button" class="secondary compact" data-test-lab-open-dpnr>Avaa nykyinen DPNR-testi</button>` : ""}
      <span>${item.runnable ? "Tuotantoon hyväksyttyjen lukusignaalien varassa" : "Ei lähetä pyyntöjä tässä tilassa"}</span>
    </footer>
  </article>`;
}

function buildSummaryHtml(summary) {
  return `<div class="test-lab-summary" aria-label="Test Lab yhteenveto">
    <div><strong>${summary.total}</strong><span>OBD-kohdetta</span></div>
    <div><strong>${summary.runnable}</strong><span>ajettavissa</span></div>
    <div><strong>${summary.observed}</strong><span>data saatu</span></div>
    <div><strong>${summary.partial}</strong><span>osittain</span></div>
    <div><strong>${summary.unavailable}</strong><span>ei vastausta</span></div>
    <div><strong>${summary.evidenceGap + summary.blocked}</strong><span>evidenssi/esto</span></div>
  </div>`;
}

export function buildDiagnosticTestLabHtml({ coverage = null } = {}) {
  const model = buildDiagnosticTestLabModel({ coverage });
  const groups = [...new Set(model.items.map(item => item.diagnosticGroup))].sort((a, b) => a.localeCompare(b, "fi"));
  return `<section id="${ROOT_ID}" class="card test-lab-root" style="margin-top:16px">
    <div class="test-lab-intro">
      <div>
        <p class="eyebrow">VISUAALINEN TESTAUSMODUULI · VAIN LUKU</p>
        <h2>Diagnostic Test Lab</h2>
        <p>Drive/Vikadiag-kohteiden OBD-dataketju näkyy vaihe vaiheelta. Näkymä ei lisää omia PIDejä eikä lähetä uusia komentoja: se käyttää hyväksyttyä signaalirekisteriä ja jo kerättyä diagnoosievidenssiä.</p>
      </div>
      <div class="test-lab-coverage-state ${model.coverageAvailable ? "available" : "missing"}">
        <strong>${model.coverageAvailable ? "Nykyisen diagnoosin data ladattu" : "Ei tallennettua diagnoosikattavuutta"}</strong>
        <span>${model.coverageAvailable ? "Pyyntö- ja vastausvaiheet perustuvat viimeisimpään BOM-diagnostiikan kattavuuteen." : "Testimääritykset näkyvät, mutta pyyntö/vastaus pysyy EI AJETTU -tilassa."}</span>
      </div>
    </div>

    ${buildSummaryHtml(model.summary)}

    <form class="test-lab-filters" data-test-lab-filters>
      <label>Haku<input type="search" data-test-lab-search placeholder="osa, OE, PNC, signaali…" autocomplete="off"></label>
      <label>Ryhmä<select data-test-lab-group><option value="all">Kaikki ryhmät</option>${groups.map(group => `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`).join("")}</select></label>
      <label>Tila<select data-test-lab-readiness>
        <option value="all">Kaikki OBD-kohteet</option>
        <option value="runnable">Ajettavissa</option>
        <option value="implemented-dedicated">Ohjattu testi</option>
        <option value="ready-existing-signals">OBD-testi valmis</option>
        <option value="indirect-existing-signals">Epäsuora seulonta</option>
        <option value="needs-signal-verification">Signaalivarmennus puuttuu</option>
        <option value="blocked">Estetty</option>
      </select></label>
      <button type="button" class="secondary compact" data-test-lab-refresh>Päivitä tila</button>
    </form>
    <p class="test-lab-result-count" data-test-lab-count>${model.items.length} kohdetta näkyvissä</p>

    <div class="test-lab-items">
      ${model.items.map(buildItemHtml).join("")}
    </div>
  </section>`;
}

function installStyles(documentObject) {
  if (!documentObject?.head || documentObject.querySelector(`#${STYLE_ID}`)) return;
  const style = documentObject.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .test-lab-root{display:block}.test-lab-intro{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(220px,.7fr);gap:14px;align-items:start}.test-lab-intro h2{margin:.1rem 0 .45rem}.test-lab-coverage-state{border:1px solid currentColor;border-radius:12px;padding:12px;display:grid;gap:5px;opacity:.85}.test-lab-coverage-state span{font-size:.88rem}.test-lab-summary{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin:14px 0}.test-lab-summary>div{border:1px solid rgba(127,127,127,.28);border-radius:10px;padding:10px;display:grid;gap:2px}.test-lab-summary strong{font-size:1.35rem}.test-lab-summary span{font-size:.78rem;opacity:.75}.test-lab-filters{display:grid;grid-template-columns:minmax(170px,1.3fr) minmax(150px,1fr) minmax(150px,1fr) auto;gap:10px;align-items:end}.test-lab-filters label{display:grid;gap:4px;font-size:.82rem}.test-lab-filters input,.test-lab-filters select{width:100%;min-height:42px}.test-lab-result-count{font-size:.82rem;opacity:.72}.test-lab-items{display:grid;gap:14px}.test-lab-item{border:1px solid rgba(127,127,127,.3);border-radius:14px;padding:14px;min-width:0}.test-lab-item[hidden]{display:none}.test-lab-item-head{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(220px,.8fr);gap:12px}.test-lab-kickers{display:flex;gap:6px;flex-wrap:wrap}.test-lab-kickers span{font-size:.72rem;border:1px solid rgba(127,127,127,.35);border-radius:999px;padding:3px 7px}.test-lab-title-block h3{margin:.35rem 0 .2rem}.test-lab-title-block p{margin:0;opacity:.72}.test-lab-diagnosis{border-left:4px solid currentColor;padding:8px 10px;display:grid;gap:3px;align-content:start}.test-lab-diagnosis span{font-size:.84rem;opacity:.82}.test-lab-pipeline{display:grid;grid-template-columns:repeat(6,minmax(120px,1fr));gap:7px;margin:14px 0;overflow-x:auto;padding-bottom:4px}.test-lab-stage{border:1px solid rgba(127,127,127,.3);border-radius:10px;padding:9px;min-width:120px}.test-lab-stage.ok{border-width:2px}.test-lab-stage.failed,.test-lab-stage.blocked{border-style:dashed}.test-lab-stage-top{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 6px;align-items:center}.test-lab-stage-index{width:22px;height:22px;border:1px solid currentColor;border-radius:50%;display:grid;place-items:center;font-size:.72rem}.test-lab-stage-state{grid-column:2;font-size:.68rem;opacity:.72}.test-lab-stage p{font-size:.76rem;line-height:1.3;margin:.45rem 0 0;opacity:.8}.test-lab-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.test-lab-columns h4{margin:.2rem 0 .6rem}.test-lab-signal{border:1px solid rgba(127,127,127,.25);border-radius:10px;padding:10px;margin-bottom:8px}.test-lab-signal-head{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.test-lab-signal-head span{font-size:.7rem;opacity:.7}.test-lab-signal-grid{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:4px 10px;margin-top:8px;font-size:.78rem}.test-lab-signal-grid>span{opacity:.65}.test-lab-signal code{overflow-wrap:anywhere}.test-lab-gap{border-left:3px solid currentColor;padding-left:10px}.test-lab-gap ul,.test-lab-limitations ul{padding-left:20px}.test-lab-recipes{padding-left:22px}.test-lab-recipes li{margin:.55rem 0}.test-lab-recipe-meta{font-size:.74rem;opacity:.65;margin-top:2px}.test-lab-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}.test-lab-actions span{font-size:.76rem;opacity:.68}.test-lab-muted{opacity:.68}.test-lab-empty{padding:12px;border:1px dashed currentColor;border-radius:10px}
    @media(max-width:760px){.test-lab-intro,.test-lab-item-head,.test-lab-columns{grid-template-columns:1fr}.test-lab-summary{grid-template-columns:repeat(3,minmax(0,1fr))}.test-lab-filters{grid-template-columns:1fr 1fr}.test-lab-filters label:first-child{grid-column:1/-1}.test-lab-pipeline{grid-template-columns:repeat(6,minmax(150px,1fr))}}
    @media(max-width:430px){.test-lab-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.test-lab-filters{grid-template-columns:1fr}.test-lab-filters label:first-child{grid-column:auto}.test-lab-actions button{width:100%}}
  `;
  documentObject.head.appendChild(style);
}

function attachFiltering(root) {
  const form = root.querySelector("[data-test-lab-filters]");
  const search = root.querySelector("[data-test-lab-search]");
  const group = root.querySelector("[data-test-lab-group]");
  const readiness = root.querySelector("[data-test-lab-readiness]");
  const count = root.querySelector("[data-test-lab-count]");
  if (!form || !search || !group || !readiness) return;
  form.addEventListener("submit", event => event.preventDefault());
  const apply = () => {
    const needle = search.value.trim().toLocaleLowerCase("fi");
    let visible = 0;
    root.querySelectorAll("[data-test-lab-item]").forEach(item => {
      const groupMatch = group.value === "all" || item.dataset.group === group.value;
      const readinessMatch = readiness.value === "all" ||
        (readiness.value === "runnable" ? item.dataset.runnable === "1" : item.dataset.readiness === readiness.value);
      const searchMatch = !needle || (item.dataset.search || "").includes(needle);
      const show = groupMatch && readinessMatch && searchMatch;
      item.hidden = !show;
      if (show) visible += 1;
    });
    if (count) count.textContent = `${visible} kohdetta näkyvissä`;
  };
  search.addEventListener("input", apply);
  group.addEventListener("change", apply);
  readiness.addEventListener("change", apply);
  apply();
}

function attachActions(root, documentObject) {
  root.querySelectorAll("[data-test-lab-open-dpnr]").forEach(button => {
    button.addEventListener("click", () => {
      const nav = documentObject.querySelector("#nav-dpnr");
      if (nav && !nav.classList.contains("hidden")) nav.click();
    });
  });
  const refresh = root.querySelector("[data-test-lab-refresh]");
  refresh?.addEventListener("click", () => publishIs220dDiagnosticTestLab({ documentObject, storage: globalThis.localStorage }));
}

export function publishIs220dDiagnosticTestLab({
  coverage = undefined,
  documentObject = globalThis.document,
  storage = globalThis.localStorage
} = {}) {
  if (!documentObject?.querySelector) return false;
  const page = documentObject.querySelector("#page-component-diagnostics");
  if (!page) return false;
  const resolvedCoverage = coverage === undefined ? parseCoverageFromStorage(storage) : coverage;
  const host = documentObject.createElement("div");
  host.innerHTML = buildDiagnosticTestLabHtml({ coverage: resolvedCoverage });
  const next = host.firstElementChild;
  if (!next) return false;
  documentObject.querySelector(`#${ROOT_ID}`)?.remove();
  const catalog = page.querySelector("#vikadiagObdDiagnostics");
  if (catalog?.parentNode) catalog.parentNode.insertBefore(next, catalog.nextSibling);
  else page.appendChild(next);
  installStyles(documentObject);
  attachFiltering(next);
  attachActions(next, documentObject);
  return true;
}

export { parseCoverageFromStorage };
