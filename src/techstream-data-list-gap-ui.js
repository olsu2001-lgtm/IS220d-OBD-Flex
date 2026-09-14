import {
  TECHSTREAM_DATA_LIST_GAP_TARGETS,
  analyzeTechstreamDataListTrace,
  buildTechstreamDataListCaptureTemplate,
  buildTechstreamDataListGapTextReport
} from "./techstream-data-list-gap.js";
import {
  parseTechstreamDataListExport,
  buildTechstreamDataListExportTextReport
} from "./techstream-data-list-export.js";

const PANEL_ID = "techstreamDataListGap";
const STYLE_ID = "techstream-data-list-gap-styles";
let lastAnalysis = analyzeTechstreamDataListTrace("");
let lastDataListExport = parseTechstreamDataListExport("");

function create(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== "") node.textContent = String(text);
  return node;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = create("style");
  style.id = STYLE_ID;
  style.textContent = `
    .techstream-gap{margin:10px 0;padding:11px;border:1px solid var(--line);border-radius:11px;background:var(--surface)}
    .techstream-gap-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.techstream-gap-head strong{font-size:11px}.techstream-gap-head span{color:var(--warning);font-size:8px;font-weight:850;text-align:right}
    .techstream-gap-note{margin:7px 0;color:var(--muted);font-size:9px;line-height:1.4}.techstream-gap-targets{display:grid;gap:6px;margin-top:8px}.techstream-gap-target{padding:8px;border:1px solid var(--line);border-radius:9px;background:var(--surface-inset)}
    .techstream-gap-target strong{display:block;font-size:10px}.techstream-gap-target small{display:block;margin-top:3px;color:var(--muted);font-size:8px;line-height:1.35}.techstream-gap-target b{display:inline-block;margin-top:5px;color:var(--warning);font-size:8px}
    .techstream-gap details{margin-top:9px;border-top:1px solid var(--line);padding-top:8px}.techstream-gap summary{cursor:pointer;color:var(--info);font-size:9px;font-weight:850}
    .techstream-gap textarea{width:100%;min-height:145px;margin-top:8px;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--surface-inset);color:var(--text-strong);resize:vertical;font:8px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    .techstream-gap-file{width:100%;margin-top:7px;padding:7px;border:1px solid var(--line);border-radius:8px;background:var(--surface-inset);color:var(--muted);font-size:8px}
    .techstream-gap-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px}.techstream-gap-actions button{min-height:34px;font-size:8px}.techstream-gap-results{display:grid;gap:5px;margin-top:8px}.techstream-gap-result{padding:7px;border-radius:8px;background:var(--surface-inset);font-size:8px;line-height:1.4}.techstream-gap-result strong{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.techstream-gap-result.rejected{border-left:3px solid var(--warning)}.techstream-gap-result.complete{border-left:3px solid var(--success)}.techstream-gap-result.partial{border-left:3px solid var(--warning)}
    @media(max-width:420px){.techstream-gap-actions{grid-template-columns:1fr}}
  `;
  document.head.append(style);
}

function renderTargets(root) {
  const list = create("div", "techstream-gap-targets");
  for (const target of TECHSTREAM_DATA_LIST_GAP_TARGETS) {
    const card = create("div", "techstream-gap-target");
    card.append(
      create("strong", "", `${target.label} · ${target.unit}`),
      create("small", "", `${target.dataListPath} · tila ${target.operatingState}`),
      create("small", "", target.note),
      create("b", "", "RAAKATRANSAKTIO PUUTTUU · CAPTURE VAADITAAN")
    );
    list.append(card);
  }
  root.append(list);
}

function renderAnalysis(root, analysis) {
  const results = root.querySelector(".techstream-gap-results.trace-results");
  if (!results) return;
  results.replaceChildren();
  results.append(create("div", "techstream-gap-result", `Pareja ${analysis.pairCount} · uusia kandidaatteja ${analysis.candidateCount} · parittomia vastauksia ${analysis.unmatchedResponseCount}`));
  for (const item of analysis.candidates) {
    results.append(create("div", "techstream-gap-result", `${item.command} → ${item.responsePrefix} · havaintoja ${item.observations} · payload ${item.payloadLengths.join("/") || "–"} B · eri vasteita ${item.distinctPayloadCount}`));
  }
  for (const item of analysis.rejected) {
    results.append(create("div", "techstream-gap-result rejected", `${item.command} → ${item.responsePrefix} · HYLÄTTY KENTTÄEVIDENSSILLÄ · ei kandidaatti`));
  }
  if (!analysis.candidates.length && !analysis.rejected.length) results.append(create("div", "techstream-gap-result", "Ei uusia 21xx→61xx-pareja tästä jäljestä."));
}

function formatValue(value, suffix = "") {
  return Number.isFinite(value) ? `${value}${suffix}` : "–";
}

function renderDataListExport(root, result) {
  const results = root.querySelector(".techstream-gap-results.csv-results");
  if (!results) return;
  results.replaceChildren();
  const feedback = result.values.injectionFeedbackMm3PerStroke;
  results.append(create("div", `techstream-gap-result ${result.complete ? "complete" : "partial"}`, `Kattavuus ${result.completeTargetCount}/3 · suutinkanavia ${result.injectorChannelCount}/4 · ${result.complete ? "KAIKKI TAVOITTEET LÖYTYIVÄT" : "OSITTAINEN EXPORT"}`));
  results.append(create("div", "techstream-gap-result", `Injection Feedback #1–#4: ${feedback.map(value => formatValue(value)).join(" / ")} mm³/st`));
  results.append(create("div", "techstream-gap-result", `Target Common Rail Pressure: ${formatValue(result.values.targetCommonRailPressureKpa, " kPa")}`));
  results.append(create("div", "techstream-gap-result", `Target Pump SCV Current: ${formatValue(result.values.targetPumpScvCurrentMa, " mA")}`));
  results.append(create("div", "techstream-gap-result", `Evidenssirivejä ${result.evidence.length} · offline-importti · ajoneuvotransporttia ei käytetty`));
}

function buildCaptureTool(root) {
  const details = create("details");
  details.append(create("summary", "", "Techstream/J2534-jäljen passiivinen analyysi"));
  details.append(create("p", "techstream-gap-note", "Liitä tähän samalta hetkeltä kerätty 7E0/7E8-liikenne. Flex etsii vain read-only 21xx→61xx-pareja. Se ei lähetä jäljen perusteella mitään autolle eikä päättele tavukaavaa automaattisesti."));
  const textarea = create("textarea");
  textarea.setAttribute("aria-label", "Techstream J2534 trace");
  textarea.placeholder = "Esim.\nTX 7E0 02 21 AB 00 00 00 00 00\nRX 7E8 06 61 AB ...";
  const actions = create("div", "techstream-gap-actions");
  const analyze = create("button", "primary", "Analysoi jälki");
  const template = create("button", "secondary", "Kopioi capture-pohja");
  const report = create("button", "secondary", "Kopioi analyysiraportti");
  analyze.type = template.type = report.type = "button";
  analyze.addEventListener("click", () => {
    lastAnalysis = analyzeTechstreamDataListTrace(textarea.value);
    renderAnalysis(root, lastAnalysis);
  });
  template.addEventListener("click", async () => {
    const text = buildTechstreamDataListCaptureTemplate();
    try { await navigator.clipboard.writeText(text); template.textContent = "Pohja kopioitu"; }
    catch { textarea.value = text; template.textContent = "Pohja kentässä"; }
    setTimeout(() => { template.textContent = "Kopioi capture-pohja"; }, 1600);
  });
  report.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(buildTechstreamDataListGapTextReport(lastAnalysis)); report.textContent = "Raportti kopioitu"; }
    catch { report.textContent = "Kopiointi epäonnistui"; }
    setTimeout(() => { report.textContent = "Kopioi analyysiraportti"; }, 1600);
  });
  actions.append(analyze, template, report);
  const results = create("div", "techstream-gap-results trace-results");
  details.append(textarea, actions, results);
  root.append(details);
  renderAnalysis(root, lastAnalysis);
}

function buildCsvImportTool(root) {
  const details = create("details");
  details.open = true;
  details.append(create("summary", "", "Techstream Data List CSV/text -importti"));
  details.append(create("p", "techstream-gap-note", "Tuo Techstreamin Data List -exportti CSV- tai tekstimuodossa. Importti etsii vain Injection Feedback Val #1–#4-, Target Common Rail Pressure- ja Target Pump SCV Current -kentät. Käsittely tapahtuu paikallisesti eikä lähetä mitään autolle."));

  const file = create("input", "techstream-gap-file");
  file.type = "file";
  file.accept = ".csv,.txt,text/csv,text/plain";
  file.setAttribute("aria-label", "Techstream Data List CSV file");
  const textarea = create("textarea");
  textarea.setAttribute("aria-label", "Techstream Data List CSV text");
  textarea.placeholder = "Liitä CSV/text tähän tai valitse tiedosto yllä.";

  const actions = create("div", "techstream-gap-actions");
  const analyze = create("button", "primary", "Poimi Data List -arvot");
  const report = create("button", "secondary", "Kopioi arvot");
  const clear = create("button", "secondary", "Tyhjennä");
  analyze.type = report.type = clear.type = "button";

  const runImport = text => {
    lastDataListExport = parseTechstreamDataListExport(text);
    renderDataListExport(root, lastDataListExport);
  };

  file.addEventListener("change", async () => {
    const selected = file.files?.[0];
    if (!selected) return;
    try {
      const text = await selected.text();
      textarea.value = text;
      runImport(text);
    } catch {
      textarea.value = "";
      lastDataListExport = parseTechstreamDataListExport("");
      renderDataListExport(root, lastDataListExport);
    }
  });
  analyze.addEventListener("click", () => runImport(textarea.value));
  report.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(buildTechstreamDataListExportTextReport(lastDataListExport)); report.textContent = "Arvot kopioitu"; }
    catch { report.textContent = "Kopiointi epäonnistui"; }
    setTimeout(() => { report.textContent = "Kopioi arvot"; }, 1600);
  });
  clear.addEventListener("click", () => {
    file.value = "";
    textarea.value = "";
    lastDataListExport = parseTechstreamDataListExport("");
    renderDataListExport(root, lastDataListExport);
  });

  actions.append(analyze, report, clear);
  const results = create("div", "techstream-gap-results csv-results");
  details.append(file, textarea, actions, results);
  root.append(details);
  renderDataListExport(root, lastDataListExport);
}

function ensurePanel() {
  if (typeof document === "undefined") return null;
  let root = document.getElementById(PANEL_ID);
  if (root) return root;
  const anchor = document.getElementById("diagnosticSummary");
  if (!anchor?.parentNode) return null;
  ensureStyles();
  root = create("section", "techstream-gap");
  root.id = PANEL_ID;
  const head = create("div", "techstream-gap-head");
  head.append(create("strong", "", "Techstream · puuttuvat Data List -signaalit"), create("span", "", "OFFLINE IMPORT + PASSIIVINEN CAPTURE"));
  root.append(head);
  root.append(create("p", "techstream-gap-note", "Tavoitteena on tunnistaa oikea Techstream-arvo ja myöhemmin sen raakatapahtuma ilman PID-arvausta. Nykyinen Toyota-tuotantoallowlist ei muutu."));
  renderTargets(root);
  buildCsvImportTool(root);
  buildCaptureTool(root);
  anchor.insertAdjacentElement("afterend", root);
  return root;
}

export function publishTechstreamDataListGapUi() {
  return ensurePanel();
}

if (typeof document !== "undefined") queueMicrotask(ensurePanel);
