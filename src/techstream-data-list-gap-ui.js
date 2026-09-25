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
  analyzeDpfEgrCaptureBundle,
  buildDpfEgrCaptureTemplate,
  buildDpfEgrCaptureReport
} from "./dpf-egr-capture-analysis.js";

const PANEL_ID = "techstreamDataListGap";
const STYLE_ID = "techstream-data-list-gap-styles";
let lastAnalysis = analyzeTechstreamDataListTrace("");
let lastDataListExport = parseTechstreamDataListExport("");
let lastDpfEgrAnalysis = analyzeDpfEgrCaptureBundle({});

function create(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== "") node.textContent = String(text);
  return node;
}

function buildResearchStatus(root) {
  const strip = create("div", "techstream-research-status");
  for (const [id, label, value, detail] of [
    ["reference", "Techstream", "0/2", "Odottaa vertailuarvoja"],
    ["trace", "J2534", "0", "Ei analysoitua jälkeä"],
    ["correlation", "Vertailu", "–", "Ei analysoitu"]
  ]) {
    const card = create("div", "techstream-status-card");
    card.dataset.researchStatus = id;
    card.dataset.state = "idle";
    card.append(create("span", "", label), create("strong", "", value), create("small", "", detail));
    strip.append(card);
  }
  root.append(strip);
}

function setResearchStatus(root, id, state, value, detail) {
  const card = root.querySelector(`[data-research-status="${id}"]`);
  if (!card) return;
  card.dataset.state = state;
  card.querySelector("strong").textContent = String(value);
  card.querySelector("small").textContent = String(detail);
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = create("style");
  style.id = STYLE_ID;
  style.textContent = `
    .techstream-gap{margin:0;padding:14px;border:1px solid var(--line);border-radius:18px;background:var(--surface)}
    .techstream-gap-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.techstream-gap-head strong{font-size:16px}.techstream-gap-head span{color:var(--warning);font-size:10px;font-weight:800;text-align:right;letter-spacing:.05em}
    .techstream-gap-note{margin:9px 0 12px;color:var(--muted);font-size:13px;line-height:1.45}
    .techstream-research-status{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}
    .techstream-status-card{display:grid;gap:3px;min-height:74px;padding:11px;border:1px solid var(--line);border-radius:14px;background:var(--surface-inset)}
    .techstream-status-card span{color:var(--muted);font-size:10px;font-weight:750;letter-spacing:.06em;text-transform:uppercase}.techstream-status-card strong{font-size:15px}.techstream-status-card small{color:var(--muted);font-size:11px;line-height:1.25}
    .techstream-status-card[data-state="ready"]{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--success) 45%,transparent)}.techstream-status-card[data-state="research"]{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--info) 45%,transparent)}.techstream-status-card[data-state="attention"]{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--warning) 40%,transparent)}
    .techstream-gap-targets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.techstream-gap-target{padding:11px;border:1px solid var(--line);border-radius:13px;background:var(--surface-inset)}
    .techstream-gap-target strong{display:block;font-size:13px}.techstream-gap-target small{display:block;margin-top:4px;color:var(--muted);font-size:11px;line-height:1.35}.techstream-gap-target b{display:inline-block;margin-top:7px;color:var(--warning);font-size:10px}
    .techstream-gap details{margin-top:10px;border-top:1px solid var(--line);padding-top:9px}.techstream-gap summary{min-height:40px;display:flex;align-items:center;cursor:pointer;color:var(--info);font-size:13px;font-weight:750}
    .techstream-gap textarea{width:100%;min-height:132px;margin-top:8px;padding:10px;border:1px solid var(--line);border-radius:11px;background:var(--surface-inset);color:var(--text-strong);resize:vertical;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    .techstream-gap-file{width:100%;margin-top:8px;padding:9px;border:1px solid var(--line);border-radius:11px;background:var(--surface-inset);color:var(--muted);font-size:12px}
    .techstream-gap-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:8px}.techstream-gap-actions button{min-height:42px;font-size:11px}
    .techstream-gap-results{display:grid;gap:6px;margin-top:9px}.techstream-gap-result{padding:9px;border-radius:10px;background:var(--surface-inset);font-size:11px;line-height:1.4;overflow-wrap:anywhere}.techstream-gap-result strong{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.techstream-gap-result.rejected{border-left:3px solid var(--warning)}.techstream-gap-result.complete{border-left:3px solid var(--success)}.techstream-gap-result.partial{border-left:3px solid var(--warning)}.techstream-gap-result.research{border-left:3px solid var(--info)}
    .techstream-capture-protocol{margin:4px 0 0;padding:8px 8px 8px 26px;color:var(--text-strong);font-size:12px;line-height:1.5}.techstream-capture-protocol li+li{margin-top:5px}
    .techstream-secondary-targets .techstream-gap-targets{grid-template-columns:1fr}
    @media(max-width:520px){.techstream-research-status,.techstream-gap-targets{grid-template-columns:1fr}.techstream-status-card{min-height:auto}.techstream-gap-actions{grid-template-columns:1fr}}
`
  document.head.append(style);
}

function targetCard(target) {
  const card = create("div", "techstream-gap-target");
  card.append(
    create("strong", "", `${target.label} · ${target.unit}`),
    create("small", "", target.note),
    create("b", "", "ODOTTAA VARMENNETTUA RAAKATRANSAKTIOTA")
  );
  return card;
}

function renderTargets(root) {
  const primary = create("div", "techstream-gap-targets");
  for (const target of TECHSTREAM_DATA_LIST_GAP_TARGETS.slice(0, 2)) primary.append(targetCard(target));
  root.append(primary);

  const secondaryTargets = TECHSTREAM_DATA_LIST_GAP_TARGETS.slice(2);
  if (!secondaryTargets.length) return;
  const details = create("details", "techstream-secondary-targets");
  details.append(create("summary", "", `Muut Techstream-kohteet (${secondaryTargets.length})`));
  const list = create("div", "techstream-gap-targets");
  secondaryTargets.forEach(target => list.append(targetCard(target)));
  details.append(list);
  root.append(details);
}

function renderCaptureProtocol(root) {
  const details = create("details", "techstream-measurement-guide");
  details.append(create("summary", "", "Mittausohje"));
  const list = create("ol", "techstream-capture-protocol");
  for (const text of [
    "DPF: KOEO, lämmin tyhjäkäynti, 1500, 2000, 2500 ja 3000 rpm. Jokaisessa vaiheessa kirjaa Techstreamin DPF Differential Pressure, RPM ja MAF sekä tallenna samaan aikaan J2534-jälki.",
    "EGR: lämmin moottori. Techstreamin Control the EGR Step Position -testissä käytä erillisiä 20 / 40 / 60 / 80 -vaiheita ja kirjaa EGR Lift Sensor Output sekä saman vaiheen J2534-jälki.",
    "Pidä jokainen vaihe omana lyhyenä capturena. Flex analysoi vain passiivisesti Techstreamin jo tekemät pyynnöt ja vastaukset.",
    "Hyvä korrelaatio tuottaa vain tutkimuskandidaatin. Tuotantoarvo hyväksytään vasta, kun sama request/decoder toistaa Techstreamin arvon Flexillä useassa käyttötilassa."
  ]) list.append(create("li", "", text));
  details.append(list);
  root.append(details);
}

function renderAnalysis(root, analysis) {
  const results = root.querySelector(".techstream-gap-results.trace-results");
  if (!results) return;
  results.replaceChildren();
  const traceState = analysis.pairCount > 0 ? "ready" : analysis.isoTpSequenceErrorCount || analysis.isoTpIncompleteCount ? "attention" : "idle";
  setResearchStatus(root, "trace", traceState, analysis.pairCount, analysis.pairCount > 0 ? `${analysis.candidateCount} uutta read-kandidaattia` : "Ei analysoituja read-pareja");
  results.append(create("div", "techstream-gap-result", `Pareja ${analysis.pairCount} · uusia kandidaatteja ${analysis.candidateCount} · nykyisiä komentoja ${analysis.existing.length} · parittomia vastauksia ${analysis.unmatchedResponseCount}`));
  for (const item of analysis.candidates) {
    results.append(create("div", "techstream-gap-result research", `${item.command} → ${item.responsePrefix} · havaintoja ${item.observations} · payload ${item.payloadLengths.join("/") || "–"} B · eri vasteita ${item.distinctPayloadCount}`));
  }
  for (const item of analysis.existing) {
    results.append(create("div", "techstream-gap-result partial", `${item.command} → ${item.responsePrefix} · NYKYINEN FLEX-KOMENTO · passiivinen havainto ei yksin varmista merkitystä`));
  }
  for (const item of analysis.rejected) {
    results.append(create("div", "techstream-gap-result rejected", `${item.command} → ${item.responsePrefix} · HYLÄTTY KENTTÄEVIDENSSILLÄ · ei kandidaatti`));
  }
  if (!analysis.allPairs.length) results.append(create("div", "techstream-gap-result", "Ei 21/22 read-pareja tästä jäljestä."));
}

function formatValue(value, suffix = "") {
  return Number.isFinite(value) ? `${value}${suffix}` : "–";
}

function renderDataListExport(root, result) {
  const results = root.querySelector(".techstream-gap-results.csv-results");
  if (!results) return;
  results.replaceChildren();
  const referenceState = result.dpfEgrComplete ? "ready" : result.dpfEgrTargetCount > 0 ? "attention" : "idle";
  setResearchStatus(root, "reference", referenceState, `${result.dpfEgrTargetCount}/2`, result.dpfEgrComplete ? "DPF + EGR referenssit löytyivät" : result.dpfEgrTargetCount ? "Referenssi on vielä osittainen" : "Odottaa vertailuarvoja");
  const dpfEgrClass = result.dpfEgrComplete ? "complete" : "partial";
  results.append(create("div", `techstream-gap-result ${dpfEgrClass}`, `DPF/EGR-kattavuus ${result.dpfEgrTargetCount}/2 · aikasarjarivejä ${result.sampleCount} · ${result.dpfEgrComplete ? "MOLEMMAT REFERENSSIT LÖYTYIVÄT" : "OSITTAINEN REFERENSSI"}`));
  results.append(create("div", "techstream-gap-result", `DPF Differential Pressure: ${formatValue(result.values.dpfDifferentialPressureKpa, " kPa")}`));
  results.append(create("div", "techstream-gap-result", `EGR Lift Sensor Output: ${formatValue(result.values.egrLiftSensorPercent, " %")}`));
  results.append(create("div", "techstream-gap-result", `Engine Speed: ${formatValue(result.values.engineSpeedRpm, " rpm")} · MAF: ${formatValue(result.values.mafGps, " g/s")}`));
  const feedback = result.values.injectionFeedbackMm3PerStroke;
  results.append(create("div", "techstream-gap-result", `Muut: Injection Feedback ${feedback.map(value => formatValue(value)).join(" / ")} mm³/st · Target Rail ${formatValue(result.values.targetCommonRailPressureKpa, " kPa")} · Target SCV ${formatValue(result.values.targetPumpScvCurrentMa, " mA")}`));
  results.append(create("div", "techstream-gap-result", `Evidenssirivejä ${result.evidence.length} · offline-importti · ajoneuvotransporttia ei käytetty`));
}

function buildCaptureTool(root) {
  const details = create("details");
  details.append(create("summary", "", "2 · Tarkista J2534-jälki"));
  details.append(create("p", "techstream-gap-note", "Liitä samalta hetkeltä kerätty 7E0/7E8-liikenne. Flex tunnistaa passiivisesti 21→61- ja 22→62-lukuparit. Se ei lähetä jäljen perusteella mitään autolle eikä muuta sallintalistaa."));
  const textarea = create("textarea");
  textarea.setAttribute("aria-label", "Techstream J2534 trace");
  textarea.placeholder = "TX 7E0 02 21 AB ...\nRX 7E8 06 61 AB ...\n\nMyös J2534 data = { 00 00 07 E0 ... } -muoto käy.";
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
  details.append(create("summary", "", "1 · Tuo Techstream-arvot"));
  details.append(create("p", "techstream-gap-note", "Tuo Techstreamin Data List -exportti. DPF/EGR-tutkimus poimii DPF Differential Pressure-, EGR Lift Sensor Output / EGR Lift Position-, Engine Speed- ja MAF-arvot sekä säilyttää CSV:n aikasarjarivit myöhempää korrelaatiota varten. Vanhojen polttoainekohteiden importti säilyy ennallaan."));

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

function candidateText(candidate, unit) {
  const current = candidate.currentProductionCommand ? " · nykyinen Flex-komento" : "";
  return `${candidate.command} · ${candidate.featureKey} · n=${candidate.phaseCount} · R² ${candidate.r2.toFixed(5)} · RMSE ${candidate.rmse.toFixed(3)} ${unit} · ${candidate.formula} · ${candidate.strength}${current}`;
}

function renderBundleAnalysis(root, result) {
  const results = root.querySelector(".techstream-gap-results.bundle-results");
  if (!results) return;
  results.replaceChildren();
  if (!result.bundle?.valid) {
    setResearchStatus(root, "correlation", "idle", "–", "Odottaa mittausbundlea");
    results.append(create("div", "techstream-gap-result partial", "Lisää mittausbundle vasta, kun usean käyttötilan Techstream-arvot ja J2534-jäljet ovat valmiina."));
    return;
  }
  const dpfCount = result.dpf?.candidates?.length || 0;
  const egrCount = result.egr?.candidates?.length || 0;
  const total = dpfCount + egrCount;
  setResearchStatus(root, "correlation", total ? "research" : "attention", total || "0", total ? `DPF ${dpfCount} · EGR ${egrCount} tutkimuskandidaattia` : "Ei vielä riittävää korrelaatiota");
  for (const [label, section, unit] of [["DPF", result.dpf, "kPa"], ["EGR", result.egr, "%"]]) {
    results.append(create("div", `techstream-gap-result ${section.status === "research-candidates" ? "research" : "partial"}`, `${label}: ${section.status} · käyttökelpoisia vaiheita ${section.usablePhases} · kandidaatteja ${section.candidates.length}`));
    for (const candidate of section.candidates.slice(0, 5)) results.append(create("div", "techstream-gap-result", candidateText(candidate, unit)));
  }
  results.append(create("div", "techstream-gap-result partial", "Tulokset ovat tutkimuskandidaatteja. Flex ei muuta näiden perusteella live-dekooderia tai sallintalistaa automaattisesti."));
}

function buildDpfEgrBundleTool(root) {
  const details = create("details");
  details.append(create("summary", "", "3 · Vertaa kaikki mittausvaiheet"));
  details.append(create("p", "techstream-gap-note", "Tämä työkalu yhdistää useiden Techstream-vaiheiden referenssiarvot saman vaiheen passiivisiin J2534-vastauksiin. Se kokeilee vain raakadatasta 8- ja 16-bittisiä kanavia ja lineaarista sovitusta löytääkseen tutkittavat byte-offsetit. Tulos ei ole vielä tuotantodekooderi."));
  const file = create("input", "techstream-gap-file");
  file.type = "file";
  file.accept = ".json,.txt,application/json,text/plain";
  file.setAttribute("aria-label", "DPF EGR passive capture bundle file");
  const textarea = create("textarea");
  textarea.setAttribute("aria-label", "DPF EGR passive capture bundle");
  textarea.placeholder = "Kopioi ensin bundle-pohja. Täytä jokaisen vaiheen Techstream-arvot ja liitä saman vaiheen J2534-jälki trace-kenttään.";

  const actions = create("div", "techstream-gap-actions");
  const template = create("button", "secondary", "Kopioi bundle-pohja");
  const analyze = create("button", "primary", "Analysoi DPF/EGR");
  const report = create("button", "secondary", "Kopioi korrelaatio");
  template.type = analyze.type = report.type = "button";

  const run = text => {
    lastDpfEgrAnalysis = analyzeDpfEgrCaptureBundle(text);
    renderBundleAnalysis(root, lastDpfEgrAnalysis);
  };
  file.addEventListener("change", async () => {
    const selected = file.files?.[0];
    if (!selected) return;
    try { textarea.value = await selected.text(); run(textarea.value); }
    catch { textarea.value = ""; }
  });
  template.addEventListener("click", async () => {
    const text = buildDpfEgrCaptureTemplate();
    try { await navigator.clipboard.writeText(text); template.textContent = "Pohja kopioitu"; }
    catch { textarea.value = text; template.textContent = "Pohja kentässä"; }
    setTimeout(() => { template.textContent = "Kopioi bundle-pohja"; }, 1600);
  });
  analyze.addEventListener("click", () => run(textarea.value));
  report.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(buildDpfEgrCaptureReport(lastDpfEgrAnalysis)); report.textContent = "Korrelaatio kopioitu"; }
    catch { report.textContent = "Kopiointi epäonnistui"; }
    setTimeout(() => { report.textContent = "Kopioi korrelaatio"; }, 1600);
  });
  actions.append(template, analyze, report);
  const results = create("div", "techstream-gap-results bundle-results");
  details.append(file, textarea, actions, results);
  root.append(details);
  renderBundleAnalysis(root, lastDpfEgrAnalysis);
}

function ensurePanel() {
  if (typeof document === "undefined") return null;
  let root = document.getElementById(PANEL_ID);
  if (root) return root;
  const mount = document.getElementById("dpfEgrResearchMount");
  const fallback = document.getElementById("page-connection");
  const host = mount || fallback;
  if (!host) return null;
  ensureStyles();
  root = create("section", "techstream-gap");
  root.id = PANEL_ID;
  const head = create("div", "techstream-gap-head");
  head.append(create("strong", "", "Techstream + J2534"), create("span", "", "OFFLINE · PASSIIVINEN"));
  root.append(head);
  root.append(create("p", "techstream-gap-note", "Tuo ensin Techstreamin vertailuarvot ja sen jälkeen saman mittausvaiheen J2534-liikenne. Flex etsii vastaavan raakakanavan ilman uusia autolle lähetettäviä komentoja."));
  buildResearchStatus(root);
  renderCaptureProtocol(root);
  renderTargets(root);
  buildCsvImportTool(root);
  buildCaptureTool(root);
  buildDpfEgrBundleTool(root);
  host.append(root);
  return root;
}

export function publishTechstreamDataListGapUi() {
  return ensurePanel();
}

if (typeof document !== "undefined") queueMicrotask(ensurePanel);
