import { buildEcuSurveyUiModel } from "./ecu-survey-ui.js";

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
.ecu-survey-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-bottom:10px}
.ecu-survey-meta>div{padding:9px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.ecu-survey-meta span{display:block;color:var(--muted);font-size:9px;font-weight:750;text-transform:uppercase}
.ecu-survey-meta strong{display:block;margin-top:4px;font-size:12px}
.ecu-survey-nodes{display:grid;gap:6px}
.ecu-survey-node{display:grid;grid-template-columns:56px minmax(0,1fr) auto;align-items:center;gap:9px;padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.ecu-survey-node.responding{border-color:#286246}
.ecu-survey-node.unmapped{border-color:#67542d}
.ecu-survey-node.attention{border-color:#6c3036}
.ecu-survey-node.muted{opacity:.62}
.ecu-survey-address{color:var(--blue);font:800 12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.ecu-survey-node-main{min-width:0}
.ecu-survey-node-main strong{display:block;overflow:hidden;font-size:11px;text-overflow:ellipsis;white-space:nowrap}
.ecu-survey-node-main small{display:block;margin-top:2px;color:var(--muted);font:9px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.ecu-survey-node-state{color:var(--muted);font-size:9px;font-weight:800;text-align:right}
.ecu-survey-node.responding .ecu-survey-node-state{color:var(--green)}
.ecu-survey-node.unmapped .ecu-survey-node-state{color:var(--yellow)}
.ecu-survey-node.attention .ecu-survey-node-state{color:#ffb4b4}
.ecu-survey-history{margin-top:10px;border-top:1px solid var(--line);padding-top:9px}
.ecu-survey-history summary{cursor:pointer;color:#cbd5df;font-size:11px;font-weight:750}
.ecu-survey-history-list{display:grid;gap:6px;margin-top:8px}
.ecu-survey-history-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:8px 9px;border-radius:9px;background:var(--surface);font-size:10px}
.ecu-survey-history-row span{color:var(--muted)}
.ecu-survey-history-row code{grid-column:1/-1;overflow:hidden;color:#75879b;font-size:8px;text-overflow:ellipsis;white-space:nowrap}
.ecu-survey-boundary{margin:10px 1px 0;color:var(--muted);font-size:10px;line-height:1.4}
@media(max-width:420px){.ecu-survey-meta{grid-template-columns:1fr 1fr}.ecu-survey-meta>div:last-child{grid-column:1/-1}.ecu-survey-node{grid-template-columns:48px minmax(0,1fr)}.ecu-survey-node-state{grid-column:2;text-align:left}}
`;

function appendText(element, text) {
  element.textContent = String(text ?? "");
  return element;
}

function create(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== "") appendText(element, text);
  return element;
}

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
  titleWrap.append(create("div", "eyebrow", "ECU SURVEY · PAIKALLINEN HISTORIA"));
  titleWrap.append(create("h4", "", "CAN-topologia"));
  const badge = create("span", "survey-badge collecting", "Ei dataa");
  badge.id = "ecuSurveyRepeatabilityBadge";
  header.append(titleWrap, badge);

  const meta = create("div", "ecu-survey-meta");
  meta.id = "ecuSurveyMeta";
  const nodes = create("div", "ecu-survey-nodes");
  nodes.id = "ecuSurveyNodes";

  const details = create("details", "ecu-survey-history");
  const detailsSummary = create("summary", "", "Viimeiset survey-ajot");
  const historyList = create("div", "ecu-survey-history-list");
  historyList.id = "ecuSurveyHistoryList";
  details.append(detailsSummary, historyList);

  panel.append(
    header,
    meta,
    nodes,
    details,
    create("p", "ecu-survey-boundary", "Vakaa topologia tarkoittaa kolmea samanlaista yhteensopivaa survey-ajoa. Se ei yksin todista ECU:n identiteettiä tai vikaa.")
  );

  summary.insertAdjacentElement("afterend", panel);
  return panel;
}

function formatTime(timestamp) {
  if (!Number.isFinite(timestamp)) return "–";
  try {
    return new Date(timestamp).toLocaleString("fi-FI", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return new Date(timestamp).toISOString();
  }
}

function renderMeta(model) {
  const root = document.getElementById("ecuSurveyMeta");
  if (!root) return;
  root.replaceChildren();
  const values = [
    ["Vastaavat", `${model.respondingCount}/${model.plannedCount}`],
    ["Historia", `${model.compatibleHistoryRuns}/${model.totalHistoryRuns}`],
    ["Viimeisin", formatTime(model.timestamp)]
  ];
  for (const [label, value] of values) {
    const item = create("div");
    item.append(create("span", "", label), create("strong", "", value));
    root.append(item);
  }
}

function renderNodes(model) {
  const root = document.getElementById("ecuSurveyNodes");
  if (!root) return;
  root.replaceChildren();
  for (const node of model.nodes) {
    const row = create("div", `ecu-survey-node ${node.stateCode}`);
    const address = create("div", "ecu-survey-address", node.requestHeader);
    const main = create("div", "ecu-survey-node-main");
    main.append(
      create("strong", "", node.ecuLabel),
      create("small", "", `${node.requestHeader} → ${node.responseHeader}`)
    );
    row.append(address, main, create("div", "ecu-survey-node-state", node.stateLabel));
    root.append(row);
  }
}

function renderHistory(model) {
  const root = document.getElementById("ecuSurveyHistoryList");
  if (!root) return;
  root.replaceChildren();
  if (!model.history.length) {
    root.append(create("div", "empty-state", "Ei tallennettuja survey-ajoja."));
    return;
  }
  for (const item of model.history) {
    const row = create("div", "ecu-survey-history-row");
    row.append(
      create("span", "", `${formatTime(item.timestamp)}${item.compatible ? " · yhteensopiva" : " · eri profiili"}`),
      create("strong", "", `${item.respondingCount}/${item.plannedCount}`),
      create("code", "", item.topologySignature)
    );
    root.append(row);
  }
}

function render(snapshot, historyResult) {
  ensureStyles();
  const panel = ensurePanel();
  if (!panel) return;
  const current = snapshot || historyResult?.latestSnapshot || historyResult?.snapshots?.[historyResult.snapshots.length - 1] || null;
  const model = buildEcuSurveyUiModel(current, historyResult);
  panel.classList.toggle("hidden", !model.visible);
  if (!model.visible) return;

  const badge = document.getElementById("ecuSurveyRepeatabilityBadge");
  if (badge) {
    badge.className = `survey-badge ${model.repeatability.code}`;
    badge.textContent = model.repeatability.label;
  }
  renderMeta(model);
  renderNodes(model);
  renderHistory(model);
}

export function installEcuSurveyUi({ loadHistory } = {}) {
  if (typeof document === "undefined" || typeof loadHistory !== "function") return false;
  const mount = () => render(null, loadHistory());
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else queueMicrotask(mount);
  document.addEventListener(EVENT_NAME, event => {
    const detail = event?.detail || {};
    render(detail.snapshot || null, detail.historyResult || loadHistory());
  });
  return true;
}

export function notifyEcuSurveyUi(snapshot, historyResult) {
  if (typeof document === "undefined" || typeof CustomEvent === "undefined") return false;
  document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { snapshot, historyResult } }));
  return true;
}
