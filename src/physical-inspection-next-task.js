import { buildIs220dPhysicalInspectionChecklist } from "./is220d-physical-inspection.js";
import {
  buildPhysicalInspectionWorkQueue,
  readPhysicalInspectionProgress
} from "./physical-inspection-progress.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildPhysicalInspectionNextTaskModel(coverage, progress = { items: {} }) {
  const checklist = buildIs220dPhysicalInspectionChecklist(coverage);
  if (!checklist.applicable) return Object.freeze({ applicable: false, queue: null });
  const queue = buildPhysicalInspectionWorkQueue(checklist.groups, progress);
  return Object.freeze({ applicable: true, checklist, queue });
}

export function buildPhysicalInspectionNextTaskHtml(model) {
  if (!model?.applicable || !model.queue) return "";
  const queue = model.queue;
  if (queue.complete) {
    return `<div class="bom-next-inspection complete"><div><span>TYÖLISTA</span><strong>Kaikki ${queue.total} tarkastuskohdetta merkitty tehdyiksi</strong></div></div>`;
  }
  const next = queue.next;
  if (!next) return "";
  return `<div class="bom-next-inspection ${escapeHtml(next.priorityKey)}">
    <div class="bom-next-inspection-meta"><span>SEURAAVA TARKASTUS · ${escapeHtml(next.priorityLabel)}</span><span>${queue.checked}/${queue.total} tehty · ${queue.remaining} jäljellä</span></div>
    <strong>${escapeHtml(next.label)}</strong>
    <div class="bom-next-inspection-group">${escapeHtml(next.groupShortLabel)}</div>
    <p>${escapeHtml(next.instruction)}</p>
    <button class="secondary compact" type="button" data-bom-jump-inspection="${escapeHtml(next.id)}">Avaa tarkastuskohde</button>
  </div>`;
}

function ensureStyles() {
  if (typeof document === "undefined" || document.querySelector("#bom-next-inspection-styles")) return;
  const style = document.createElement("style");
  style.id = "bom-next-inspection-styles";
  style.textContent = `
    .bom-next-inspection { margin-bottom:10px; padding:11px 12px; border:1px solid var(--info-border); border-radius:12px; background:var(--surface-inset); }
    .bom-next-inspection.deviation { border-color:var(--danger-border); }
    .bom-next-inspection.gap { border-color:var(--warning-border); }
    .bom-next-inspection.complete { border-color:var(--success-border); }
    .bom-next-inspection-meta { display:flex; justify-content:space-between; gap:8px; color:var(--muted); font-size:8px; font-weight:800; letter-spacing:.04em; }
    .bom-next-inspection > strong { display:block; margin-top:7px; color:var(--text-strong); font-size:13px; }
    .bom-next-inspection-group { margin-top:3px; color:var(--info); font-size:9px; font-weight:800; text-transform:uppercase; }
    .bom-next-inspection p { margin:7px 0 0; color:var(--text-strong); font-size:10px; line-height:1.45; }
    .bom-next-inspection button { width:100%; margin-top:8px; }
    .bom-next-inspection.complete strong { margin-top:4px; color:var(--success); }
  `;
  document.head.append(style);
}

let latestCoverage = null;
let listenerInstalled = false;

function render() {
  if (typeof document === "undefined" || !latestCoverage) return null;
  const host = document.querySelector("#bomGroupOverview");
  const grid = document.querySelector("#bomGroupOverviewGrid");
  if (!host || !grid) return null;
  ensureStyles();
  let panel = document.querySelector("#bomNextInspection");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "bomNextInspection";
    host.insertBefore(panel, grid);
  }
  const model = buildPhysicalInspectionNextTaskModel(latestCoverage, readPhysicalInspectionProgress());
  panel.innerHTML = buildPhysicalInspectionNextTaskHtml(model);
  return model;
}

function installListener() {
  if (listenerInstalled || typeof document === "undefined") return;
  listenerInstalled = true;
  document.addEventListener("change", event => {
    if (!event.target?.closest?.("[data-bom-inspection-check]")) return;
    queueMicrotask(render);
  });
  document.addEventListener("click", event => {
    const button = event.target?.closest?.("[data-bom-jump-inspection]");
    if (!button) return;
    const id = button.getAttribute("data-bom-jump-inspection");
    const item = document.querySelector(`[data-bom-inspection-item="${id}"]`);
    if (!item) return;
    const details = item.closest("details");
    if (details) details.open = true;
    item.scrollIntoView?.({ behavior: "smooth", block: "center" });
  });
}

export function publishPhysicalInspectionNextTask(coverage) {
  latestCoverage = coverage?.applicable ? coverage : null;
  installListener();
  return render();
}
