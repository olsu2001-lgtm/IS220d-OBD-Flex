import { pollSourceForDefinition } from "./poll-scheduler.js";

// Report generation is passive. Comparison reads require a separate explicit action.
let snapshotProvider = () => ({ definitions: [] });
let comparisonReader = null;
export function configureAppDiagnostics(provider, { readComparison = null } = {}) { snapshotProvider = provider; comparisonReader = readComparison; }
const redact = value => String(value ?? "").replace(/\b(?:[0-9A-F]{2}:){5}[0-9A-F]{2}\b/gi, "[MAC]")
  .replace(/\b[A-HJ-NPR-Z0-9]{17}\b/gi, "[VIN]").slice(0, 4096);
const normal = value => String(value || "").replace(/\s+/g, "").toUpperCase();

export function createTrafficRecorder(limit = 400) {
  let entries = [], dropped = 0;
  return {
    reset() { entries = []; dropped = 0; },
    record(entry) {
      const command = normal(entry.command);
      // Keep measurement bytes, not Mode 09 identity or arbitrary adapter text.
      const measurement = entry.binary || /^(01[0-9A-F]{2}|21[0-9A-F]{2}|0221[0-9A-F]{2}0000000000)$/.test(command);
      const payload = String(entry.hex || entry.raw || "");
      const raw = measurement && /^[\dA-Fa-f\s:>?.-]*$/.test(payload)
        ? payload.slice(0, 4096) : payload ? "[Teksti- tai tunnistevastaus piilotettu]" : "";
      const previousTx = entry.direction === "rx" ? [...entries].reverse().find(e => e.direction === "tx" &&
        e.command === command && e.transport === (entry.binary ? "quicklynks-binary" : "elm-ascii") &&
        (!entry.transactionId || e.transactionId === redact(entry.transactionId))) : null;
      entries.push({ direction: entry.direction, command: /^(?:AT|ST)/.test(command) ? "[Adapterikomento]" : command,
        transactionId: redact(entry.transactionId), timestamp: entry.timestamp,
        durationMs: previousTx && Number.isFinite(entry.timestamp) && Number.isFinite(previousTx.timestamp)
          ? Math.max(0, entry.timestamp - previousTx.timestamp) : null,
        transport: entry.binary ? "quicklynks-binary" : "elm-ascii", raw,
        responsePresent: Boolean(payload), error: redact(entry.error),
        responseStatus: /NO DATA|STOPPED|UNABLE TO CONNECT|ERROR|BUS INIT/i.exec(payload)?.[0] || "" });
      if (entries.length > limit) { entries.shift(); dropped++; }
    },
    snapshot() { return { entries: entries.map(entry => ({ ...entry })), dropped }; }
  };
}
export const appTraffic = createTrafficRecorder();

export function buildAppDiagnosticsReport(snapshot, now = Date.now()) {
  const traffic = snapshot.traffic || { entries: [], dropped: 0 };
  const values = (snapshot.definitions || []).map(def => {
    const source = pollSourceForDefinition(def);
    const command = source?.command || null;
    const query = snapshot.binary ? null : traffic.entries.filter(e => e.command === command ||
      (def.toyotaCommand && e.command === `02${def.toyotaCommand}0000000000`)).at(-1);
    const quality = snapshot.poll?.sources?.find(s => s.key === source?.key);
    const discovery = def.toyotaCommand
      ? [...(snapshot.discovery || [])].reverse().find(item => normal(item.command) === normal(def.toyotaCommand))
      : null;
    const value = Number.isFinite(snapshot.values?.[def.id]) ? snapshot.values[def.id] : null;
    const updatedAt = snapshot.updatedAt?.[def.id] ?? null;
    const ageMs = Number.isFinite(updatedAt) ? Math.max(0, now - updatedAt) : null;
    const supported = snapshot.supportedPids instanceof Set
      ? def.derived || def.adapterOnly
        ? null
        : def.toyotaCommand
          ? snapshot.supportedPids.has(def.id)
          : Number.isInteger(def.pid)
            ? snapshot.supportedPids.has(def.pid)
            : snapshot.supportedPids.has(def.id)
      : null;
    const ui = snapshot.ui?.[def.id] || { present: false, text: null, matches: false };
    let status, reason;
    if (value !== null) {
      if (quality?.lastError || query?.error || query?.responseStatus) {
        status = "cached"; reason = "Edellinen arvo säilyy, mutta viimeisin kysely epäonnistui";
      } else if (snapshot.liveActive === false) {
        status = "cached"; reason = "Live-luku on pysäytetty; viimeisin arvo säilyy";
      } else if (!snapshot.connected || ageMs === null || ageMs > Math.max(5000, (source?.intervalMs || 5000) * 3)) {
        status = "cached"; reason = "Tallennettu arvo; ei tuoretta mittausta";
      } else if (!ui.present || !ui.matches) {
        status = "ui-gap"; reason = "Arvo on sovelluksen tilassa, mutta Live-kortti puuttuu tai ei vastaa arvoa";
      } else { status = "displayed"; reason = "Arvo ja Live-kortti täsmäävät"; }
    } else if (snapshot.binary && def.toyotaReadData) {
      status = "unavailable"; reason = "Toyota Read Data ei ole käytettävissä Quicklynks-binääripolulla";
    } else if (!snapshot.binary && def.adapterOnly) {
      status = "unavailable"; reason = "Quicklynks-kohtainen arvo";
    } else if (def.derived) {
      status = "missing"; reason = "Johdetun arvon lähtöarvot puuttuvat";
    } else if (!source && !def.adapterOnly) {
      status = "unavailable"; reason = "Ei varmennettua live-kyselyä tai dekooderia; uusia komentoja ei arvata";
    } else if (quality?.lastError || query?.error || query?.responseStatus) {
      status = "failed"; reason = redact(quality?.lastError || query.error || query.responseStatus);
    } else if (def.toyotaCommand && discovery?.error) {
      status = "field-no-response"; reason = redact(discovery.error);
    } else if (query?.direction === "rx" && query.responsePresent) {
      status = "decode-or-state-gap"; reason = "Vastaus havaittu, mutta tilasta puuttuu arvo; tarkista dekoodaus ja julkaisu";
    } else if (query?.direction === "tx") {
      status = "awaiting-response"; reason = "Lähetys havaittu, vastausta ei vielä tallennettu";
    } else if (supported === false && !def.toyotaCommand) {
      status = "not-advertised"; reason = "Ei Mode 01 -tukilistassa; tämä ei yksin osoita ECU-vikaa";
    } else if (supported === false && def.toyotaCommand) {
      status = "not-observed"; reason = "Toyota-lukupolku ei saanut vahvistettua arvoa tässä yhteydessä";
    } else { status = "not-observed"; reason = "Ei havaittua arvoa; käynnistä Live-luku ja päivitä raportti"; }
    return { id: def.id, name: def.name, unit: def.unit, command,
      path: snapshot.binary ? "quicklynks-binary" : "elm-ascii", supported, status, reason,
      value, updatedAt, ageMs, source: redact(snapshot.valueSources?.[def.id]),
      evidence: def.toyotaReadData ? "Toyota-tulkinta vaatii ajoneuvokohtaisen varmennuksen" : "Nykyinen sovellusdekooderi; ei komponentin kuntotulos",
      ui, lastQuery: query || null, polling: quality || null };
  });
  const missingValues = values.filter(value => value.value === null);
  const missingByStatus = Object.fromEntries(
    [...new Set(missingValues.map(value => value.status))].sort().map(status => [
      status,
      missingValues.filter(value => value.status === status).length
    ])
  );
  return { type: "flex-query-value-diagnostics", schemaVersion: 2, createdAt: new Date(now).toISOString(),
    appVersion: snapshot.appVersion, vehicleKey: snapshot.vehicleKey, simulated: Boolean(snapshot.simulated),
    connected: Boolean(snapshot.connected), liveActive: Boolean(snapshot.liveActive),
    connectionStages: Object.fromEntries(Object.entries(snapshot.connectionStages || {}).map(([key, stage]) =>
      [key, { status: stage.status, message: redact(stage.message) }])),
    scope: "Nykyisen profiilin kaikki live-arvomäärittelyt ja rajattu liikenneloki. Ei uusia kyselyitä eikä ECU-kuntopäätelmää. UI tarkoittaa Live-kortin tekstiä, ei näytön pikselivarmennusta.",
    summary: { total: values.length, displayed: values.filter(v => v.status === "displayed").length,
      cached: values.filter(v => v.status === "cached").length,
      missing: missingValues.length, missingByStatus,
      fieldNoResponse: missingValues.filter(v => v.status === "field-no-response").length,
      unavailable: missingValues.filter(v => v.status === "unavailable").length,
      notAdvertised: missingValues.filter(v => v.status === "not-advertised").length,
      uiGaps: values.filter(v => v.status === "ui-gap").length },
    discovery: (snapshot.discovery || []).map(item => ({ ...item, error: redact(item.error),
      raw: /^[\dA-Fa-f\s:>?.-]*$/.test(item.raw || "") ? String(item.raw || "").slice(0, 4096) : "[Tekstivastaus piilotettu]" })),
    comparison: (snapshot.comparison || []).map(item => ({ ...item, error: redact(item.error),
      raw: /^[\dA-Fa-f\s:>?.-]*$/.test(item.raw || "") ? String(item.raw || "").slice(0, 4096) : "[Tekstivastaus piilotettu]" })),
    values, traffic };
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}

export function buildAppDiagnosticsPage() {
  const page = node("section", "", "page ios-root-page");
  page.id = "page-app-diagnostics";
  page.append(node("h2", "Kyselyt ja arvot"), node("p", "Käynnistä Live-luku, toista ongelma ja luo kopioitava raportti. Raportin luonti ei lähetä komentoja autolle."));
  const generate = node("button", "Luo / päivitä raportti", "primary");
  const copy = node("button", "Kopioi raportti", "secondary");
  generate.type = copy.type = "button";
  copy.disabled = true;
  const status = node("p", "Raporttia ei ole vielä luotu.");
  status.setAttribute("role", "status");
  const list = node("div");
  const details = node("details", "", "card");
  const output = node("textarea");
  output.readOnly = true;
  output.setAttribute("aria-label", "Kopioitava diagnostiikkaraportti");
  details.append(node("summary", "Tekninen raportti ja raakaliikenne"), output);
  generate.addEventListener("click", () => {
    try {
      const report = buildAppDiagnosticsReport(snapshotProvider());
      output.value = JSON.stringify(report, null, 2);
      list.replaceChildren();
      if (report.comparison.length) {
        const card = node("div", "", "card");
        card.append(node("h3", "Vertailulukemat — ei vielä varmennettu autossa"));
        for (const query of report.comparison) {
          for (const field of query.fields) card.append(node("p", `${field.name}: ${field.value ?? "–"} ${field.unit} · ${field.status}`));
          if (query.error) card.append(node("p", query.error));
        }
        list.append(card);
      }
      const missingBreakdown = [
        report.summary.fieldNoResponse ? `${report.summary.fieldNoResponse} kentässä ei vastausta` : "",
        report.summary.notAdvertised ? `${report.summary.notAdvertised} ei Mode 01 -tukilistassa` : "",
        report.summary.unavailable ? `${report.summary.unavailable} ilman varmennettua lukupolkua` : ""
      ].filter(Boolean).join(" · ");
      status.textContent = `${report.summary.displayed}/${report.summary.total} tuoretta arvoa Live-korteissa · ${report.summary.missing} puuttuu${missingBreakdown ? ` (${missingBreakdown})` : ""} · ${report.summary.cached} vanhaa · ${report.summary.uiGaps} näyttöpuutetta. Tilannekuva ${report.createdAt}.`;
      for (const value of report.values) {
        const item = node("details", "", "card");
        item.append(node("summary", `${value.name}: ${value.value ?? "–"} ${value.unit} — ${value.reason}`),
          node("p", `${value.command || "Ei erillistä live-komentoa"} · ${value.path} · ${value.evidence}`));
        list.append(item);
      }
      copy.disabled = false;
    } catch { status.textContent = "Raportin luonti epäonnistui. Yritä uudelleen."; }
  });
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(output.value); status.textContent = "Raportti kopioitu. Voit lähettää sen jatkokehitystä varten."; }
    catch { details.open = true; output.focus(); output.select(); status.textContent = "Automaattinen kopiointi ei onnistunut. Kopioi valittu raporttiteksti käsin."; }
  });
  const comparisonTools = node("details", "", "card");
  comparisonTools.append(node("summary", "Polttoainelämpö, Toyota-rail-paine ja ruiskutusajoitus"),
    node("p", "Pysäytä Live-luku. Erillinen lukukerta käyttää kolmea sallittua kyselyä. Tulokset on verrattava Techstreamiin ennen käyttöä varmennettuina mittauksina. Suutinkorjausten kysely on edelleen estetty."));
  const compare = node("button", "Lue vertailuarvot", "secondary");
  compare.type = "button";
  compare.addEventListener("click", async () => {
    if (!comparisonReader) { status.textContent = "Vertailuluku ei ole käytettävissä."; return; }
    compare.disabled = true;
    status.textContent = "Luetaan kolme vertailukyselyä… Odota lukukerran valmistumista.";
    try { await comparisonReader(); generate.click(); }
    catch (error) { status.textContent = redact(error.message); }
    finally { compare.disabled = false; }
  });
  comparisonTools.append(compare);
  page.append(generate, copy, status, comparisonTools, list, details);
  return page;
}
