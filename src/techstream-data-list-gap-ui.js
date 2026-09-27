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
import {
  techstreamDataListResearchAvailable,
  runTechstreamDataListResearchCapture,
  evaluate21adInjectorFeedbackFamilyHypothesis,
  buildTechstreamDataListResearchReport
} from "./techstream-data-list-research.js";

const PANEL_ID = "techstreamDataListGap";
const STYLE_ID = "techstream-data-list-gap-styles";
let lastAnalysis = analyzeTechstreamDataListTrace("");
let lastDataListExport = parseTechstreamDataListExport("");
let lastResearchCapture = null;

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
    .techstream-gap-reference-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:8px}.techstream-gap-reference-grid label{display:grid;gap:3px;color:var(--muted);font-size:8px}.techstream-gap-reference-grid input{width:100%;min-height:40px;padding:7px;border:1px solid var(--line);border-radius:8px;background:var(--surface-inset);color:var(--text-strong)}
    .techstream-gap-raw{white-space:pre-wrap;overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    .techstream-gap-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px}.techstream-gap-actions button{min-height:34px;font-size:8px}.techstream-gap-results{display:grid;gap:5px;margin-top:8px}.techstream-gap-result{padding:7px;border-radius:8px;background:var(--surface-inset);font-size:8px;line-height:1.4}.techstream-gap-result strong{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.techstream-gap-result.rejected{border-left:3px solid var(--warning)}.techstream-gap-result.complete{border-left:3px solid var(--success)}.techstream-gap-result.partial{border-left:3px solid var(--warning)}
    @media(max-width:420px){.techstream-gap-actions,.techstream-gap-reference-grid{grid-template-columns:1fr}}
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

function researchReferenceValues(details) {
  const read = name => details.querySelector(`[data-techstream-reference="${name}"]`)?.value || "";
  return {
    injectionFeedback1: read("feedback1"),
    injectionFeedback2: read("feedback2"),
    injectionFeedback3: read("feedback3"),
    injectionFeedback4: read("feedback4"),
    targetCommonRailPressureKpa: read("rail"),
    targetPumpScvCurrentMa: read("scv")
  };
}

function renderResearchCapture(details, result) {
  const results = details.querySelector("[data-techstream-research-results]");
  if (!results) return;
  results.replaceChildren();
  if (!result) {
    results.append(create("div", "techstream-gap-result", "Ei 21AD-tutkimusajoa."));
    return;
  }
  results.append(create(
    "div",
    `techstream-gap-result ${result.positive ? "complete" : "partial"}`,
    `21AD → 61AD · ${result.status} · payload ${result.payloadLength} B · transaction ${result.transactionId || "–"}`
  ));
  results.append(create("div", "techstream-gap-result techstream-gap-raw", `Payload HEX: ${result.payloadHex || "–"}`));
  const hypothesis = evaluate21adInjectorFeedbackFamilyHypothesis(result, researchReferenceValues(details));
  if (hypothesis.hypothesisValuesMm3.length === 4) {
    const values = hypothesis.hypothesisValuesMm3.map(value => value.toFixed(3)).join(" / ");
    const comparison = hypothesis.comparableChannelCount === 4
      ? ` · max ero Techstreamiin ${hypothesis.maxAbsDeltaMm3.toFixed(3)} mm³/st`
      : " · syötä kaikki neljä Techstream-arvoa vertailua varten";
    results.append(create(
      "div",
      "techstream-gap-result",
      `1KD-perheen R/S/T/U-hypoteesi: ${values} mm³/st${comparison} · EI 2AD-DEKOODAUS`
    ));
  }
  results.append(create("div", "techstream-gap-result techstream-gap-raw", `Raakavastaus: ${String(result.raw || "–").replace(/\r/g, "\\r").replace(/\n/g, "\\n")}`));
  results.append(create("div", "techstream-gap-result rejected", "Dekoodaus ei ole hyväksytty: tulos on vain raaka 2AD-FHV-kandidaattievidenssi."));
}

function buildResearchTool(root) {
  const details = create("details");
  details.dataset.techstreamResearch = "1";
  details.append(create("summary", "", "21AD · Injection Feedback -raakakandidaatin kenttäkoe"));
  details.append(create(
    "p",
    "techstream-gap-note",
    "21AD on tässä vain tutkimuskandidaatti Toyota/Denso-dieselperheen vertailuevidenssin perusteella. Se ei kuulu tuotantoallowlistiin, eikä Flex pura siitä suutinkorjausarvoja ennen 2AD-FHV/35360000-korrelaatiota."
  ));

  const grid = create("div", "techstream-gap-reference-grid");
  const fields = [
    ["feedback1", "Techstream IF #1, mm³/st"],
    ["feedback2", "Techstream IF #2, mm³/st"],
    ["feedback3", "Techstream IF #3, mm³/st"],
    ["feedback4", "Techstream IF #4, mm³/st"],
    ["rail", "Target rail, kPa"],
    ["scv", "Target SCV, mA"]
  ];
  for (const [name, labelText] of fields) {
    const label = create("label", "", labelText);
    const input = create("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.dataset.techstreamReference = name;
    input.autocomplete = "off";
    label.append(input);
    grid.append(label);
  }

  const actions = create("div", "techstream-gap-actions");
  const run = create("button", "primary", "Aja 21AD raakakoeluku");
  const copy = create("button", "secondary", "Kopioi tutkimusraportti");
  run.type = copy.type = "button";
  const state = create("span", "inline-message");
  state.setAttribute("aria-live", "polite");

  run.addEventListener("click", async () => {
    if (!techstreamDataListResearchAvailable()) {
      state.textContent = "Tutkimusajo ei ole nyt käytettävissä. Yhdistä IS220d:n moottori-ECU ja pysäytä muut live-/testiajot.";
      state.className = "inline-message warning";
      return;
    }
    run.disabled = true;
    state.textContent = "Luetaan yksi 21AD-pyyntö read-only-tilassa…";
    state.className = "inline-message";
    try {
      lastResearchCapture = await runTechstreamDataListResearchCapture("21AD");
      renderResearchCapture(details, lastResearchCapture);
      state.textContent = lastResearchCapture.positive
        ? "61AD-raakavastaus saatiin. Tallenna raportti korrelaatiota varten."
        : `21AD valmistui ilman positiivista 61AD-vastausta: ${lastResearchCapture.status}.`;
      state.className = `inline-message${lastResearchCapture.positive ? "" : " warning"}`;
    } catch (error) {
      state.textContent = error?.message || String(error);
      state.className = "inline-message warning";
    } finally {
      run.disabled = false;
    }
  });

  copy.addEventListener("click", async () => {
    const report = buildTechstreamDataListResearchReport(lastResearchCapture, researchReferenceValues(details));
    try {
      await navigator.clipboard.writeText(report);
      copy.textContent = "Raportti kopioitu";
    } catch {
      copy.textContent = "Kopiointi epäonnistui";
    }
    setTimeout(() => { copy.textContent = "Kopioi tutkimusraportti"; }, 1600);
  });

  actions.append(run, copy, state);
  const results = create("div", "techstream-gap-results");
  results.dataset.techstreamResearchResults = "1";
  details.append(grid, actions, results);
  root.append(details);
  renderResearchCapture(details, lastResearchCapture);
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
  buildResearchTool(root);
  buildCsvImportTool(root);
  buildCaptureTool(root);
  anchor.insertAdjacentElement("afterend", root);
  return root;
}

export function publishTechstreamDataListGapUi() {
  return ensurePanel();
}

if (typeof document !== "undefined") queueMicrotask(ensurePanel);
