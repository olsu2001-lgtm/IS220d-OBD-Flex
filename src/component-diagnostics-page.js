import { buildIs220dRepairManualVisualsHtml } from "./is220d-repair-manual-visuals.js";
import { IS220D_DIAGNOSTIC_GROUPS, getIs220dDiagnosticGroupForComponent } from "./is220d-diagnostic-groups.js";

const STORAGE_KEY = "lexusIs220dBomComponentDiagnosticsV2";
const LEGACY_STORAGE_KEY = "lexusIs220dBomComponentDiagnosticsV1";

export const COMPONENT_DIAGNOSTIC_STATUS = Object.freeze({
  observed: Object.freeze({ label: "DATA SAATU", css: "observed" }),
  partial: Object.freeze({ label: "OSITTAIN", css: "partial" }),
  unavailable: Object.freeze({ label: "EI VASTAUSTA", css: "unavailable" }),
  "not-tested": Object.freeze({ label: "EI TESTATTU", css: "not-tested" })
});

export const COMPONENT_ASSESSMENT_STATUS = Object.freeze({
  "normal-pattern": Object.freeze({ label: "OK", css: "normal-pattern" }),
  deviation: Object.freeze({ label: "HUOMIO", css: "deviation" }),
  "strong-deviation": Object.freeze({ label: "TARKISTA", css: "strong-deviation" }),
  inconclusive: Object.freeze({ label: "EI VARMAA TULOSTA", css: "inconclusive" }),
  "not-evaluated": Object.freeze({ label: "EI ARVIOITU", css: "not-evaluated" })
});

const CLASS_LABEL = Object.freeze({ direct: "DIRECT", indirect: "INDIRECT" });
const escapeHtml = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

export function componentDiagnosticStatusLabel(status) { return COMPONENT_DIAGNOSTIC_STATUS[status]?.label || String(status || "TUNTEMATON").toUpperCase(); }
export function componentAssessmentStatusLabel(status) { return COMPONENT_ASSESSMENT_STATUS[status]?.label || String(status || "EI ARVIOITU").toUpperCase(); }

export function observedComponentSignals(component) {
  const signals = [];
  for (const group of component?.groupEvidence || []) for (const signal of group?.signals || []) if (signal?.observed && signal?.command && !signals.includes(signal.command)) signals.push(signal.command);
  return signals;
}

export function attemptedComponentSignals(component) {
  const signals = [];
  for (const group of component?.groupEvidence || []) for (const signal of group?.signals || []) if (signal?.attempted && signal?.command && !signals.includes(signal.command)) signals.push(signal.command);
  return signals;
}

export function filterComponentDiagnostics(coverage, { diagnosticClass = "all", diagnosticGroup = "all", status = "all", assessmentStatus = "all", query = "" } = {}) {
  const needle = String(query || "").trim().toLocaleLowerCase("fi");
  return (coverage?.components || []).filter(component => {
    const group = getIs220dDiagnosticGroupForComponent(component.id);
    if (diagnosticClass !== "all" && component.diagnosticClass !== diagnosticClass) return false;
    if (diagnosticGroup !== "all" && group?.id !== diagnosticGroup) return false;
    if (status !== "all" && component.status !== status) return false;
    if (assessmentStatus !== "all" && component?.assessment?.status !== assessmentStatus) return false;
    if (!needle) return true;
    return [component.label, component.pnc, component.oe, component.symptom, component.id, group?.label, group?.shortLabel, group?.physicalFocus].join(" ").toLocaleLowerCase("fi").includes(needle);
  });
}

function formatAssessmentValue(value) {
  const numeric = Number(value?.value);
  if (!Number.isFinite(numeric)) return "";
  const decimals = Math.abs(numeric) >= 100 ? 0 : Math.abs(numeric) >= 10 ? 1 : 2;
  return `${value.signalKey}: ${numeric.toFixed(decimals)}${value.unit ? ` ${value.unit}` : ""}`;
}

export function buildComponentDiagnosticCardHtml(component) {
  const statusMeta = COMPONENT_DIAGNOSTIC_STATUS[component?.status] || COMPONENT_DIAGNOSTIC_STATUS["not-tested"];
  const assessmentMeta = COMPONENT_ASSESSMENT_STATUS[component?.assessment?.status] || COMPONENT_ASSESSMENT_STATUS["not-evaluated"];
  const group = getIs220dDiagnosticGroupForComponent(component?.id);
  const observed = observedComponentSignals(component);
  const attempted = attemptedComponentSignals(component);
  const required = Math.max(1, Number(component?.requiredGroups || 1));
  const observedGroups = Math.max(0, Number(component?.observedGroups || 0));
  const signalText = observed.length ? `Saatu: ${observed.join(", ")}` : attempted.length ? `Yritetty: ${attempted.join(", ")}` : "Tämän ajon signaaleja ei ole kysytty";
  const values = (component?.assessment?.values || []).map(formatAssessmentValue).filter(Boolean);
  const limitations = (component?.assessment?.limitations || []).filter(Boolean);
  return `<details class="health-component ${escapeHtml(assessmentMeta.css)}">
    <summary>
      <span class="health-component-main"><strong>${escapeHtml(component?.label)}</strong><small>${escapeHtml(group?.shortLabel || "")} · PNC ${escapeHtml(component?.pnc || "–")}</small></span>
      <span class="health-component-state ${escapeHtml(assessmentMeta.css)}">${escapeHtml(assessmentMeta.label)}</span>
    </summary>
    <div class="health-component-body">
      <div class="bom-component-badges"><span class="bom-class ${escapeHtml(component?.diagnosticClass)}">${escapeHtml(CLASS_LABEL[component?.diagnosticClass] || "")}</span><span class="bom-status ${escapeHtml(statusMeta.css)}">${escapeHtml(statusMeta.label)}</span><span class="bom-coverage">${observedGroups}/${required}</span></div>
      <div class="bom-part-numbers"><span>PNC ${escapeHtml(component?.pnc || "–")}</span><span>OE ${escapeHtml(component?.oe || "–")}</span></div>
      ${component?.symptom ? `<p class="bom-symptom"><strong>Oire:</strong> ${escapeHtml(component.symptom)}</p>` : ""}
      <div class="bom-assessment ${escapeHtml(assessmentMeta.css)}"><strong>${escapeHtml(assessmentMeta.label)}</strong><p>${escapeHtml(component?.assessment?.reason || "Komponentille ei ole vielä erillistä arviointisääntöä.")}</p>${values.length ? `<div class="bom-assessment-values">${values.map(v => `<code>${escapeHtml(v)}</code>`).join("")}</div>` : ""}${limitations.length ? `<ul>${limitations.map(v => `<li>${escapeHtml(v)}</li>`).join("")}</ul>` : ""}</div>
      ${buildIs220dRepairManualVisualsHtml(component?.id)}
      <details class="bom-component-details"><summary>Tekninen evidenssi</summary><div class="bom-signal-line">${escapeHtml(signalText)}</div><div class="bom-source">${escapeHtml(component?.bomSource || "")}</div>${component?.note ? `<p class="bom-component-note">${escapeHtml(component.note)}</p>` : ""}</details>
    </div>
  </details>`;
}

export function buildComponentDiagnosticSummary(coverage) {
  const summary = coverage?.summary || {};
  const components = coverage?.components || [];
  return Object.freeze({ total:Number(summary.total||0), direct:Number(summary.direct||0), indirect:Number(summary.indirect||0), observed:Number(summary.observed||0), partial:Number(summary.partial||0), unavailable:Number(summary.unavailable||0), notTested:Number(summary.notTested||0), normalPattern:components.filter(c=>c?.assessment?.status==="normal-pattern").length, deviation:components.filter(c=>["deviation","strong-deviation"].includes(c?.assessment?.status)).length, inconclusive:components.filter(c=>c?.assessment?.status==="inconclusive").length });
}

let latestPayload = null;
function parseStoredPayload(raw) { if (!raw) return null; try { const parsed=JSON.parse(raw); return parsed?.coverage?.applicable ? parsed : null; } catch { return null; } }
function safeStorageGet() { try { return parseStoredPayload(globalThis.localStorage?.getItem(STORAGE_KEY)) || parseStoredPayload(globalThis.localStorage?.getItem(LEGACY_STORAGE_KEY)); } catch { return null; } }
function safeStorageSet(payload) { try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch {} }
function formatTimestamp(value) { if (!Number.isFinite(Number(value))) return ""; try { return new Intl.DateTimeFormat("fi-FI", { dateStyle:"short", timeStyle:"short" }).format(new Date(Number(value))); } catch { return ""; } }

function ensureStyles() {
  if (typeof document === "undefined" || document.querySelector("#obd-health-check-styles")) return;
  const style=document.createElement("style"); style.id="obd-health-check-styles"; style.textContent=`
  .health-intro{margin-bottom:12px}.health-run-card{padding:14px}.health-run-card h3{margin-top:0}.health-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.health-summary>button{appearance:none;color:inherit;padding:12px 6px;border:1px solid var(--line);border-radius:12px;background:var(--surface-inset);text-align:center}.health-summary span{display:block;font-size:9px;font-weight:800;color:var(--muted)}.health-summary strong{display:block;margin-top:4px;font-size:20px}.health-summary .attention strong{color:var(--warning)}.health-summary .check strong{color:var(--danger-text)}
  .health-tools{position:sticky;top:0;z-index:4;padding:9px 0;background:var(--bg)}.health-search-row{display:flex;gap:7px}.health-search-row input{min-width:0;flex:1}.health-filter-toggle{white-space:nowrap}.health-filters{margin-top:8px;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}.health-filter-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.health-filter-grid label{margin-bottom:4px}.health-groups{display:grid;gap:9px}.health-group{border:1px solid var(--line);border-radius:14px;background:var(--surface);overflow:hidden}.health-group>summary{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px;cursor:pointer;list-style:none}.health-group>summary::-webkit-details-marker,.health-component>summary::-webkit-details-marker{display:none}.health-group-title strong{display:block;font-size:14px}.health-group-title small{display:block;margin-top:3px;color:var(--muted);font-size:10px}.health-group-counts{display:flex;gap:5px;align-items:center}.health-pill{padding:4px 7px;border:1px solid var(--line);border-radius:999px;font-size:9px;font-weight:900}.health-pill.attention{border-color:var(--warning-border);color:var(--warning)}.health-pill.check{border-color:var(--danger-border);color:var(--danger-text)}.health-group-body{padding:0 8px 8px;display:grid;gap:6px}.health-component{border:1px solid var(--line-soft);border-radius:11px;background:var(--surface-inset);overflow:hidden}.health-component>summary{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px;cursor:pointer;list-style:none}.health-component-main{min-width:0}.health-component-main strong{display:block;font-size:12px}.health-component-main small{display:block;margin-top:3px;color:var(--muted);font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.health-component-state{flex:none;padding:4px 6px;border:1px solid var(--line);border-radius:999px;font-size:8px;font-weight:900}.health-component-state.normal-pattern{color:var(--success);border-color:var(--success-border)}.health-component-state.deviation,.health-component-state.inconclusive{color:var(--warning);border-color:var(--warning-border)}.health-component-state.strong-deviation{color:var(--danger-text);border-color:var(--danger-border)}.health-component-body{padding:0 11px 11px}.bom-component-badges,.bom-part-numbers,.bom-assessment-values{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}.bom-class,.bom-status,.bom-coverage,.bom-part-numbers span{padding:4px 6px;border:1px solid var(--line);border-radius:7px;font-size:8px}.bom-symptom,.bom-assessment p,.bom-assessment ul,.bom-source,.bom-signal-line,.bom-component-note{font-size:10px;line-height:1.45}.bom-assessment{margin-top:9px;padding:9px;border:1px solid var(--line-soft);border-radius:9px}.bom-assessment-values code{font-size:9px}.bom-component-details{margin-top:9px}.bom-empty{padding:22px;border:1px dashed var(--line);border-radius:13px;color:var(--muted);text-align:center}.bom-run-meta{margin-top:7px;color:var(--muted);font-size:10px}@media(max-width:520px){.health-filter-grid{grid-template-columns:1fr}.health-summary{grid-template-columns:repeat(3,1fr)}}`;
  document.head.append(style);
}

function groupOptionsMarkup(){ return IS220D_DIAGNOSTIC_GROUPS.map(g=>`<option value="${escapeHtml(g.id)}">${escapeHtml(g.shortLabel)}</option>`).join(""); }
function pageMarkup(){ return `<section id="page-component-diagnostics" class="page hidden" data-vehicle-only="is220d" aria-labelledby="nav-component-diagnostics">
  <div class="section-title"><div><div class="eyebrow">IS220d · AUTON YLEISTARKASTUS</div><h2>OBD Health Check</h2></div><span id="bomDiagnosticBadge" class="ct-test-badge neutral">EI AJETTU</span></div>
  <div class="inline-message health-intro">Yksi tarkistus lukee auton käytettävissä olevat OBD- ja Toyota-arvot ja kokoaa löydökset järjestelmittäin. Avaa vain alue tai komponentti, jonka haluat tutkia tarkemmin.</div>
  <div class="card health-run-card"><h3>Tarkista auton tila</h3><label for="bomDiagnosticEngineState">Moottori</label><select id="bomDiagnosticEngineState"><option value="auto">Tunnista automaattisesti</option><option value="running">Moottori käy</option><option value="stopped">Moottori ei käy</option></select><details><summary>Lisää oire tai huomio</summary><textarea id="bomDiagnosticNote" rows="3" placeholder="Esim. lämmin tyhjäkäynti 1100 rpm, dieselin haju, nykii 1300 rpm"></textarea></details><div class="diagnostic-progress"><div class="diagnostic-progress-track"><span id="bomDiagnosticProgressBar"></span></div><div class="diagnostic-progress-meta"><span id="bomDiagnosticProgressText">Valmis tarkistukseen</span><strong id="bomDiagnosticProgressCounts">–</strong></div></div><div class="button-row"><button id="bomDiagnosticRun" class="primary" type="button">Aloita OBD Health Check</button><button id="bomDiagnosticCancel" class="secondary" type="button" disabled>Keskeytä</button></div><div id="bomDiagnosticRunState" class="inline-message hidden"></div><div id="bomRunMeta" class="bom-run-meta"></div></div>
  <div class="health-summary"><button type="button" data-health-assessment="normal-pattern"><span>OK</span><strong id="bomSummaryOk">0</strong></button><button class="attention" type="button" data-health-assessment="deviation"><span>HUOMIO</span><strong id="bomSummaryAttention">0</strong></button><button class="check" type="button" data-health-assessment="strong-deviation"><span>TARKISTA</span><strong id="bomSummaryCheck">0</strong></button></div>
  <div class="health-tools"><div class="health-search-row"><input id="bomSearch" type="search" placeholder="Hae osaa, OE-numeroa tai järjestelmää"><button id="healthFilterToggle" class="secondary compact health-filter-toggle" type="button">Suodata</button></div><div id="healthFilters" class="health-filters hidden"><div class="health-filter-grid"><div><label for="bomGroupFilter">Järjestelmä</label><select id="bomGroupFilter"><option value="all">Kaikki</option>${groupOptionsMarkup()}</select></div><div><label for="bomAssessmentFilter">Tulos</label><select id="bomAssessmentFilter"><option value="all">Kaikki</option><option value="normal-pattern">OK</option><option value="deviation">Huomio</option><option value="strong-deviation">Tarkista</option><option value="inconclusive">Ei varmaa tulosta</option><option value="not-evaluated">Ei arvioitu</option></select></div><div><label for="bomStatusFilter">Data</label><select id="bomStatusFilter"><option value="all">Kaikki</option><option value="observed">Data saatu</option><option value="partial">Osittain</option><option value="unavailable">Ei vastausta</option><option value="not-tested">Ei testattu</option></select></div><div><label for="bomClassFilter">Diagnostiikkatapa</label><select id="bomClassFilter"><option value="all">Kaikki</option><option value="direct">Suora mittaus</option><option value="indirect">Epäsuora päätelmä</option></select></div></div></div></div>
  <div id="bomComponentList" class="health-groups"><div class="bom-empty">Aja OBD Health Check nähdäksesi auton järjestelmät.</div></div>
</section>`; }

function installPage(){ if(typeof document==="undefined"||document.querySelector("#page-component-diagnostics"))return; ensureStyles(); const holder=document.createElement("div"); holder.innerHTML=pageMarkup().trim(); document.querySelector("#main")?.insertBefore(holder.firstElementChild,document.querySelector("#page-dtc")||null); const nav=document.querySelector(".bottom-nav"); if(nav&&!document.querySelector("#nav-component-diagnostics")){const b=document.createElement("button");b.id="nav-component-diagnostics";b.className="nav-item hidden";b.type="button";b.dataset.page="component-diagnostics";b.dataset.vehicleOnly="is220d";b.innerHTML="<span>✓</span>Health";nav.insertBefore(b,document.querySelector("#nav-dtc")||null);} document.querySelector("#bomDiagnosticRun")?.addEventListener("click",startComponentDiagnostic); document.querySelector("#bomDiagnosticCancel")?.addEventListener("click",()=>document.querySelector("#cancelGekoTest")?.click()); document.querySelector("#healthFilterToggle")?.addEventListener("click",()=>document.querySelector("#healthFilters")?.classList.toggle("hidden")); for(const s of ["#bomClassFilter","#bomGroupFilter","#bomStatusFilter","#bomAssessmentFilter","#bomSearch"])document.querySelector(s)?.addEventListener(s==="#bomSearch"?"input":"change",renderLatest); document.querySelectorAll("[data-health-assessment]").forEach(b=>b.addEventListener("click",()=>{const select=document.querySelector("#bomAssessmentFilter");if(select){select.value=select.value===b.dataset.healthAssessment?"all":b.dataset.healthAssessment;document.querySelector("#healthFilters")?.classList.remove("hidden");renderLatest();}})); observeFullDiagnosticUi();latestPayload=safeStorageGet();renderLatest();syncDiagnosticControls(); }

function startComponentDiagnostic(){const source=document.querySelector("#runGekoTest"),state=document.querySelector("#bomDiagnosticRunState");if(!source||source.disabled){document.querySelector("#nav-connection")?.click();if(state){state.textContent="Yhdistä ensin autoon. Health Check avautuu yhteyden jälkeen.";state.className="inline-message warning";}return;} const a=document.querySelector("#diagnosticEngineState"),b=document.querySelector("#bomDiagnosticEngineState"),c=document.querySelector("#diagnosticNote"),d=document.querySelector("#bomDiagnosticNote");if(a&&b)a.value=b.value;if(c&&d)c.value=d.value;if(state){state.textContent="OBD Health Check käynnissä…";state.className="inline-message";}source.click();syncDiagnosticControls();}
function observeFullDiagnosticUi(){if(typeof MutationObserver==="undefined")return;const targets=["#runGekoTest","#cancelGekoTest","#diagnosticProgressText","#diagnosticProgressBar","#diagnosticResultCounts"].map(s=>document.querySelector(s)).filter(Boolean);const o=new MutationObserver(syncDiagnosticControls);targets.forEach(t=>o.observe(t,{attributes:true,childList:true,subtree:true,characterData:true}));}
function syncDiagnosticControls(){if(typeof document==="undefined")return;const sourceRun=document.querySelector("#runGekoTest"),sourceCancel=document.querySelector("#cancelGekoTest"),run=document.querySelector("#bomDiagnosticRun"),cancel=document.querySelector("#bomDiagnosticCancel");const running=/käynnissä/i.test(String(sourceRun?.textContent||""))||sourceCancel?.disabled===false;if(run){run.disabled=Boolean(running);run.textContent=running?"Health Check käynnissä…":"Aloita OBD Health Check";}if(cancel)cancel.disabled=!running;const p=document.querySelector("#bomDiagnosticProgressBar");if(p)p.style.width=document.querySelector("#diagnosticProgressBar")?.style?.width||"0%";const t=document.querySelector("#bomDiagnosticProgressText");if(t)t.textContent=document.querySelector("#diagnosticProgressText")?.textContent||"Valmis tarkistukseen";const c=document.querySelector("#bomDiagnosticProgressCounts");if(c)c.textContent=document.querySelector("#diagnosticResultCounts")?.textContent||"–";}

function buildGroupedHtml(components){const byGroup=new Map();for(const component of components){const group=getIs220dDiagnosticGroupForComponent(component.id);const key=group?.id||"other";if(!byGroup.has(key))byGroup.set(key,{group,components:[]});byGroup.get(key).components.push(component);}return [...byGroup.values()].map(({group,components:list})=>{const attention=list.filter(c=>c?.assessment?.status==="deviation"||c?.assessment?.status==="inconclusive").length;const check=list.filter(c=>c?.assessment?.status==="strong-deviation").length;return `<details class="health-group"><summary><span class="health-group-title"><strong>${escapeHtml(group?.shortLabel||group?.label||"Muut")}</strong><small>${list.length} tarkastuskohdetta</small></span><span class="health-group-counts">${check?`<span class="health-pill check">${check} tarkista</span>`:""}${attention?`<span class="health-pill attention">${attention} huomio</span>`:""}<span class="health-pill">${list.length}</span></span></summary><div class="health-group-body">${list.map(buildComponentDiagnosticCardHtml).join("")}</div></details>`;}).join("");}

function renderLatest(){if(typeof document==="undefined")return;const coverage=latestPayload?.coverage,list=document.querySelector("#bomComponentList");if(!coverage?.applicable||!list){if(list)list.innerHTML='<div class="bom-empty">Aja OBD Health Check nähdäksesi auton järjestelmät.</div>';return;}const summary=buildComponentDiagnosticSummary(coverage);const components=coverage.components||[];const ok=summary.normalPattern,check=components.filter(c=>c?.assessment?.status==="strong-deviation").length,attention=components.filter(c=>["deviation","inconclusive"].includes(c?.assessment?.status)).length;const set=(s,v)=>{const e=document.querySelector(s);if(e)e.textContent=String(v);};set("#bomSummaryOk",ok);set("#bomSummaryAttention",attention);set("#bomSummaryCheck",check);const badge=document.querySelector("#bomDiagnosticBadge");if(badge){badge.textContent=check?`${check} TARKISTA`:attention?`${attention} HUOMIO`:ok?"VALMIS":"EI TULOSTA";badge.className=`ct-test-badge ${check?"attention":attention?"attention":ok?"ready":"neutral"}`;}const meta=document.querySelector("#bomRunMeta");if(meta){const when=formatTimestamp(latestPayload?.endedAt||latestPayload?.startedAt);meta.textContent=[when?`Viimeisin tarkistus ${when}`:"",latestPayload?.runId?`Raportti ${latestPayload.runId}`:""].filter(Boolean).join(" · ");}const filtered=filterComponentDiagnostics(coverage,{diagnosticClass:document.querySelector("#bomClassFilter")?.value||"all",diagnosticGroup:document.querySelector("#bomGroupFilter")?.value||"all",status:document.querySelector("#bomStatusFilter")?.value||"all",assessmentStatus:document.querySelector("#bomAssessmentFilter")?.value||"all",query:document.querySelector("#bomSearch")?.value||""});list.innerHTML=filtered.length?buildGroupedHtml(filtered):'<div class="bom-empty">Näillä hakuehdoilla ei löytynyt tarkastuskohteita.</div>';}

export function publishIs220dComponentDiagnosticCoverage(coverage,meta={}){if(!coverage?.applicable)return null;latestPayload=Object.freeze({coverage,runId:String(meta.runId||""),startedAt:Number.isFinite(Number(meta.startedAt))?Number(meta.startedAt):null,endedAt:Number.isFinite(Number(meta.endedAt))?Number(meta.endedAt):null});safeStorageSet(latestPayload);renderLatest();return latestPayload;}
installPage();
