import { buildEcuSurveyUiModel } from "./ecu-survey-ui.js";
import { buildFieldValidationTextReport } from "./field-validation.js";

const STYLE_ID = "ecu-survey-ui-style";
const PANEL_ID = "ecuSurveyTopologyCard";
const EVENT_NAME = "is220d:ecu-survey-history-updated";

const styles = `
.ecu-survey-panel{margin:0 0 14px;padding:13px;border:1px solid var(--line);border-radius:13px;background:#0a0e13}
.ecu-survey-header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px}
.ecu-survey-header h4{margin:1px 0 0;font-size:15px}
.survey-badge{flex:0 0 auto;padding:6px 9px;border:1px solid var(--line);border-radius:999px;font-size:10px;font-weight:850;letter-spacing:.02em}
.survey-badge.collecting{border-color:#67542d;background:#2d2616;color:var(--yellow)}
.survey-badge.stable{border-color:#286246;background:#10271d;color:var(--green)}
.survey-badge.changed{border-color:#6c3036;background:#2c171a;color:#ffb4b4}
.ecu-survey-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-bottom:10px}
.ecu-survey-meta>div{padding:9px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.ecu-survey-meta span{display:block;color:var(--muted);font-size:9px;font-weight:750;text-transform:uppercase}
.ecu-survey-meta strong{display:block;margin-top:4px;overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}
.ecu-identity{margin:0 0 11px;padding:10px;border:1px solid var(--line);border-radius:11px;background:var(--surface)}
.ecu-identity-header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.ecu-identity-header strong{font-size:11px}.identity-overall{font-size:9px;font-weight:850}.identity-overall.match{color:var(--green)}.identity-overall.mismatch{color:#ffb4b4}.identity-overall.partial{color:var(--yellow)}.identity-overall.not-observed{color:var(--muted)}
.ecu-identity-fields{display:grid;gap:6px}.ecu-identity-row{display:grid;grid-template-columns:100px minmax(0,1fr) auto;gap:8px;align-items:center;font-size:10px}.ecu-identity-row span:first-child{color:var(--muted)}.ecu-identity-row code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d7e1eb}.identity-state{font-size:9px;font-weight:850}.identity-state.match{color:var(--green)}.identity-state.mismatch{color:#ffb4b4}.identity-state.observed{color:var(--blue)}.identity-state.parse-error{color:var(--yellow)}.identity-state.not-observed{color:var(--muted)}
.ecu-identity-expected{grid-column:2/-1;color:var(--muted);font-size:8px}
.field-validation{margin:0 0 11px;padding:10px;border:1px solid var(--line);border-radius:11px;background:var(--surface)}
.field-validation-header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.field-validation-header strong{font-size:11px}
.field-validation-badge{font-size:9px;font-weight:850}.field-validation-badge.collecting{color:var(--yellow)}.field-validation-badge.ready{color:var(--green)}.field-validation-badge.attention{color:#ffb4b4}
.field-validation-meta{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}.field-validation-meta code,.field-validation-meta span{padding:4px 6px;border-radius:7px;background:#0a0e13;color:var(--muted);font-size:9px}
.field-validation-checks{display:grid;gap:5px}.field-validation-check{display:grid;grid-template-columns:52px minmax(0,1fr);gap:7px;align-items:start;font-size:9px}.field-validation-check b{font-size:8px}.field-validation-check.pass b{color:var(--green)}.field-validation-check.pending b{color:var(--yellow)}.field-validation-check span{color:#d7e1eb}.field-validation-check small{grid-column:2;color:var(--muted);font-size:8px}
.field-validation-external{margin:8px 0 0;color:var(--muted);font-size:9px;line-height:1.35}.field-validation-copy{width:100%;min-height:34px;margin-top:9px;padding:0 10px;border:1px solid var(--line);border-radius:9px;background:#0a0e13;color:#d7e1eb;font-size:10px;font-weight:800}
.ecu-survey-nodes{display:grid;gap:6px}
.ecu-survey-node{display:grid;grid-template-columns:56px minmax(0,1fr) auto;align-items:center;gap:9px;padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.ecu-survey-node.responding{border-color:#286246}.ecu-survey-node.unmapped{border-color:#67542d}.ecu-survey-node.attention{border-color:#6c3036}.ecu-survey-node.muted{opacity:.62}
.ecu-survey-address{color:var(--blue);font:800 12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.ecu-survey-node-main{min-width:0}.ecu-survey-node-main strong{display:block;overflow:hidden;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.ecu-survey-node-main small{display:block;margin-top:2px;color:var(--muted);font:9px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.ecu-survey-node-state{color:var(--muted);font-size:9px;font-weight:800;text-align:right}.ecu-survey-node.responding .ecu-survey-node-state{color:var(--green)}.ecu-survey-node.unmapped .ecu-survey-node-state{color:var(--yellow)}.ecu-survey-node.attention .ecu-survey-node-state{color:#ffb4b4}
.ecu-survey-history{margin-top:10px;border-top:1px solid var(--line);padding-top:9px}.ecu-survey-history summary{cursor:pointer;color:#cbd5df;font-size:11px;font-weight:750}.ecu-survey-history-list{display:grid;gap:6px;margin-top:8px}.ecu-survey-history-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:8px 9px;border-radius:9px;background:var(--surface);font-size:10px}.ecu-survey-history-row span{color:var(--muted)}.ecu-survey-history-row code{grid-column:1/-1;overflow:hidden;color:#75879b;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.ecu-survey-boundary{margin:10px 1px 0;color:var(--muted);font-size:10px;line-height:1.4}
@media(max-width:420px){.ecu-survey-meta{grid-template-columns:1fr 1fr}.ecu-identity-row{grid-template-columns:82px minmax(0,1fr)}.identity-state{grid-column:2}.ecu-survey-node{grid-template-columns:48px minmax(0,1fr)}.ecu-survey-node-state{grid-column:2;text-align:left}}
`;

function appendText(element, text) { element.textContent = String(text ?? ""); return element; }
function create(tag, className = "", text = "") { const element = document.createElement(tag); if (className) element.className = className; if (text !== "") appendText(element, text); return element; }

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = styles;
  document.head.append(style);
}

function ensurePanel() {
  let panel = document.getElementById(PANEL_ID);
  if (panel) return panel;
  const summary = document.getElementById("diagnosticSummary");
  if (!summary?.parentNode) return null;

  panel = create("div", "ecu-survey-panel hidden");
  panel.id = PANEL_ID;
  panel.setAttribute("aria-live", "polite");

  const header = create("div", "ecu-survey-header");
  const titleWrap = create("div");
  titleWrap.append(create("div", "eyebrow", "ECU SURVEY · PAIKALLINEN HISTORIA"), create("h4", "", "CAN-topologia"));
  const badge = create("span", "survey-badge collecting", "Ei dataa");
  badge.id = "ecuSurveyRepeatabilityBadge";
  header.append(titleWrap, badge);

  const meta = create("div", "ecu-survey-meta"); meta.id = "ecuSurveyMeta";
  const identity = create("div", "ecu-identity hidden"); identity.id = "ecuSurveyIdentity";
  const validation = create("div", "field-validation hidden"); validation.id = "ecuSurveyFieldValidation";
  const nodes = create("div", "ecu-survey-nodes"); nodes.id = "ecuSurveyNodes";
  const details = create("details", "ecu-survey-history");
  const historyList = create("div", "ecu-survey-history-list"); historyList.id = "ecuSurveyHistoryList";
  details.append(create("summary", "", "Viimeiset survey-ajot"), historyList);

  panel.append(header, meta, identity, validation, nodes, details, create("p", "ecu-survey-boundary", "Vakaa topologia tarkoittaa kolmea samanlaista yhteensopivaa survey-ajoa. Mode 09 -poikkeama on evidenssihavainto, ei itsessään ECU-vika."));
  summary.insertAdjacentElement("afterend", panel);
  return panel;
}

function formatTime(timestamp) {
  if (!Number.isFinite(timestamp)) return "–";
  try { return new Date(timestamp).toLocaleString("fi-FI", { dateStyle: "short", timeStyle: "short" }); }
  catch { return new Date(timestamp).toISOString(); }
}

function renderMeta(model) {
  const root = document.getElementById("ecuSurveyMeta"); if (!root) return;
  root.replaceChildren();
  for (const [label, value] of [
    ["Vastaavat", `${model.respondingCount}/${model.plannedCount}`],
    ["Historia", `${model.compatibleHistoryRuns}/${model.totalHistoryRuns}`],
    ["Build", model.buildSha || "–"],
    ["Viimeisin", formatTime(model.timestamp)]
  ]) {
    const item = create("div"); item.append(create("span", "", label), create("strong", "", value)); root.append(item);
  }
}

function renderIdentity(model) {
  const root = document.getElementById("ecuSurveyIdentity"); if (!root) return;
  root.replaceChildren();
  root.classList.toggle("hidden", !model.identity?.visible);
  if (!model.identity?.visible) return;
  const header = create("div", "ecu-identity-header");
  header.append(create("strong", "", "Mode 09 · ajoneuvon identiteetti"), create("span", `identity-overall ${model.identity.overallCode}`, model.identity.overallLabel));
  const fields = create("div", "ecu-identity-fields");
  for (const field of model.identity.fields) {
    const row = create("div", "ecu-identity-row");
    row.append(create("span", "", field.label), create("code", "", field.value || "–"), create("span", `identity-state ${field.stateCode}`, field.stateLabel));
    if (field.expected && field.stateCode === "mismatch") row.append(create("small", "ecu-identity-expected", `Odotettu evidenssi: ${field.expected}`));
    fields.append(row);
  }
  root.append(header, fields);
}

function renderFieldValidation(model, session) {
  const root = document.getElementById("ecuSurveyFieldValidation"); if (!root) return;
  root.replaceChildren();
  root.classList.toggle("hidden", !model.fieldValidation?.visible);
  if (!model.fieldValidation?.visible) return;

  const header = create("div", "field-validation-header");
  header.append(
    create("strong", "", "Kenttävalidointi · 0.8.0-portti"),
    create("span", `field-validation-badge ${model.fieldValidation.code}`, model.fieldValidation.label)
  );
  const meta = create("div", "field-validation-meta");
  meta.append(
    create("code", "", `build ${model.fieldValidation.buildSha || "–"}`),
    create("span", "", `moottori ${model.fieldValidation.engineState || "–"}`)
  );
  const checks = create("div", "field-validation-checks");
  for (const item of model.fieldValidation.checks) {
    const row = create("div", `field-validation-check ${item.pass ? "pass" : "pending"}`);
    row.append(create("b", "", item.pass ? "PASS" : "PUUTTUU"), create("span", "", item.label), create("small", "", item.detail));
    checks.append(row);
  }
  root.append(header, meta, checks);
  if (model.fieldValidation.pendingExternal.length) {
    root.append(create("p", "field-validation-external", `Ulkoinen evidenssi vielä: ${model.fieldValidation.pendingExternal.join(", ")}.`));
  }
  const copy = create("button", "field-validation-copy", "Kopioi validointiyhteenveto");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(buildFieldValidationTextReport(session));
      copy.textContent = "Validointiyhteenveto kopioitu";
    } catch {
      copy.textContent = "Kopiointi epäonnistui";
    }
    setTimeout(() => { copy.textContent = "Kopioi validointiyhteenveto"; }, 1800);
  });
  root.append(copy);
}

function renderNodes(model) {
  const root = document.getElementById("ecuSurveyNodes"); if (!root) return;
  root.replaceChildren();
  for (const node of model.nodes) {
    const row = create("div", `ecu-survey-node ${node.stateCode}`);
    const main = create("div", "ecu-survey-node-main");
    main.append(create("strong", "", node.ecuLabel), create("small", "", `${node.requestHeader} → ${node.responseHeader}`));
    row.append(create("div", "ecu-survey-address", node.requestHeader), main, create("div", "ecu-survey-node-state", node.stateLabel));
    root.append(row);
  }
}

function renderHistory(model) {
  const root = document.getElementById("ecuSurveyHistoryList"); if (!root) return;
  root.replaceChildren();
  if (!model.history.length) { root.append(create("div", "empty-state", "Ei tallennettuja survey-ajoja.")); return; }
  for (const item of model.history) {
    const identitySuffix = item.identityOverall && item.identityOverall !== "not-observed" ? ` · ID ${item.identityOverall}` : "";
    const buildSuffix = item.buildSha ? ` · ${item.buildSha}` : "";
    const row = create("div", "ecu-survey-history-row");
    row.append(create("span", "", `${formatTime(item.timestamp)}${item.compatible ? " · yhteensopiva" : " · eri profiili"}${identitySuffix}${buildSuffix}`), create("strong", "", `${item.respondingCount}/${item.plannedCount}`), create("code", "", item.topologySignature));
    root.append(row);
  }
}

function render(snapshot, historyResult) {
  ensureStyles();
  const panel = ensurePanel(); if (!panel) return;
  const current = snapshot || historyResult?.latestSnapshot || historyResult?.snapshots?.[historyResult.snapshots.length - 1] || null;
  const model = buildEcuSurveyUiModel(current, historyResult);
  panel.classList.toggle("hidden", !model.visible); if (!model.visible) return;
  const badge = document.getElementById("ecuSurveyRepeatabilityBadge");
  if (badge) { badge.className = `survey-badge ${model.repeatability.code}`; badge.textContent = model.repeatability.label; }
  renderMeta(model);
  renderIdentity(model);
  renderFieldValidation(model, historyResult?.fieldValidation || null);
  renderNodes(model);
  renderHistory(model);
}

export function installEcuSurveyUi({ loadHistory } = {}) {
  if (typeof document === "undefined" || typeof loadHistory !== "function") return false;
  const mount = () => render(null, loadHistory());
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true }); else queueMicrotask(mount);
  document.addEventListener(EVENT_NAME, event => { const detail = event?.detail || {}; render(detail.snapshot || null, detail.historyResult || loadHistory()); });
  return true;
}

export function notifyEcuSurveyUi(snapshot, historyResult) {
  if (typeof document === "undefined" || typeof CustomEvent === "undefined") return false;
  document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { snapshot, historyResult } }));
  return true;
}

