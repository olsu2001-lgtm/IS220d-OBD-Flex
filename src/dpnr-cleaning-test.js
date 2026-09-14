import {
  VEHICLE_KEYS,
  decodePidResponse,
  decodeToyotaReadDataResponse,
  isSafeTerminalCommand
} from "./core.js";

const STORAGE_KEY = "lexusIs220dDpnrCleaningComparisonV1";
const SAMPLE_COUNT = 3;
const SAMPLE_PAUSE_MS = 650;
const READ_TIMEOUT_MS = 4500;

export const DPNR_CLEANING_STAGES = Object.freeze([
  Object.freeze({
    id: "koeo",
    label: "1/3 KOEO",
    instruction: "Virrat päälle, moottori sammuksissa. Älä käynnistä moottoria.",
    rpmMin: 0,
    rpmMax: 50
  }),
  Object.freeze({
    id: "idle",
    label: "2/3 Tyhjäkäynti",
    instruction: "Käynnistä moottori ja anna sen käydä vakaalla tyhjäkäynnillä.",
    rpmMin: 550,
    rpmMax: 1400
  }),
  Object.freeze({
    id: "rpm3000",
    label: "3/3 3000 rpm ilman kuormaa",
    instruction: "Pidä kierrosluku vakaasti noin 3000 rpm:ssa auton seistessä paikallaan.",
    rpmMin: 2700,
    rpmMax: 3300
  })
]);

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function round(value, decimals = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(decimals)) : null;
}

export function decodeDpnrCleaningSample({ rpmRaw = "", dpnrRaw = "" } = {}) {
  const rpm = decodePidResponse("rpm", rpmRaw);
  const decoded = decodeToyotaReadDataResponse(dpnrRaw, 0x7e, VEHICLE_KEYS.IS220D);
  const pressure = decoded?.complete ? decoded.values?.dpnrDifferentialPressureKpa : null;
  return Object.freeze({
    rpm: Number.isFinite(rpm) ? rpm : null,
    pressureKpa: Number.isFinite(pressure) ? pressure : null,
    regenerationActive: decoded?.complete ? Boolean(decoded.values?.regenerationActive) : null,
    sulfurRegenerationState: decoded?.complete && Number.isFinite(decoded.values?.sulfurRegenerationState)
      ? decoded.values.sulfurRegenerationState
      : null,
    pmRegenerationState: decoded?.complete && Number.isFinite(decoded.values?.pmRegenerationState)
      ? decoded.values.pmRegenerationState
      : null,
    complete: Boolean(Number.isFinite(rpm) && Number.isFinite(pressure)),
    raw: Object.freeze({ rpm: String(rpmRaw || ""), dpnr: String(dpnrRaw || "") })
  });
}

export function summarizeDpnrCleaningStage(stageId, samples = []) {
  const stage = DPNR_CLEANING_STAGES.find(item => item.id === stageId);
  if (!stage) throw new Error(`Tuntematon DPNR-testivaihe: ${stageId}`);
  const usable = samples.filter(sample => Number.isFinite(sample?.rpm) && Number.isFinite(sample?.pressureKpa));
  const rpm = median(usable.map(sample => sample.rpm));
  const pressureKpa = median(usable.map(sample => sample.pressureKpa));
  const conditionOk = Number.isFinite(rpm) && rpm >= stage.rpmMin && rpm <= stage.rpmMax;
  return Object.freeze({
    stageId,
    label: stage.label,
    sampleCount: usable.length,
    rpm: round(rpm, 0),
    pressureKpa: round(pressureKpa, 2),
    conditionOk,
    regenerationActive: usable.some(sample => sample.regenerationActive === true),
    samples: Object.freeze(usable.slice())
  });
}

export function compareDpnrCleaningRuns(before, after) {
  const result = {
    complete: Boolean(before?.stages?.koeo && before?.stages?.idle && before?.stages?.rpm3000 && after?.stages?.koeo && after?.stages?.idle && after?.stages?.rpm3000),
    findings: [],
    deltas: {}
  };
  if (!result.complete) {
    result.findings.push("Vertailu vaatii kaikki kolme ENNEN- ja JÄLKEEN-vaihetta.");
    return Object.freeze(result);
  }

  for (const id of ["koeo", "idle", "rpm3000"]) {
    const a = Number(before.stages[id].pressureKpa);
    const b = Number(after.stages[id].pressureKpa);
    result.deltas[id] = Number.isFinite(a) && Number.isFinite(b) ? round(b - a, 2) : null;
  }

  const before3000 = Number(before.stages.rpm3000.pressureKpa);
  const after3000 = Number(after.stages.rpm3000.pressureKpa);
  const beforeKoeo = Number(before.stages.koeo.pressureKpa);
  const afterKoeo = Number(after.stages.koeo.pressureKpa);

  if (Number.isFinite(after3000) && after3000 < 0) {
    result.findings.push("GSIC-havainto: paine-ero on edelleen negatiivinen noin 3000 rpm:ssa. Tarkista paineletkujen järjestys sekä tukos letkussa tai transmitting pipe -putkessa.");
  } else if (Number.isFinite(before3000) && before3000 < 0 && Number.isFinite(after3000) && after3000 >= 0) {
    result.findings.push("Selvä parannus: 3000 rpm:n negatiivinen paine-ero muuttui puhdistuksen jälkeen ei-negatiiviseksi.");
  }

  if (Number.isFinite(beforeKoeo) && Number.isFinite(afterKoeo)) {
    const beforeAbs = Math.abs(beforeKoeo);
    const afterAbs = Math.abs(afterKoeo);
    if (afterAbs < beforeAbs) result.findings.push("KOEO-nollapoikkeama siirtyi lähemmäs nollaa puhdistuksen jälkeen.");
    if (afterAbs > beforeAbs) result.findings.push("KOEO-nollapoikkeama kasvoi puhdistuksen jälkeen; mittausketju tai anturin offset kannattaa tarkistaa uudelleen.");
  }

  const afterIdle = Number(after.stages.idle.pressureKpa);
  if (Number.isFinite(afterIdle) && Number.isFinite(after3000)) {
    result.findings.push(after3000 > afterIdle
      ? "Paine-ero kasvaa tyhjäkäynniltä 3000 rpm:iin, eli mittaus reagoi kasvavaan pakokaasuvirtaukseen."
      : "Paine-ero ei kasva tyhjäkäynniltä 3000 rpm:iin; tarkista mittauslinjat ja toista testi." );
  }

  if ([before, after].some(run => Object.values(run.stages || {}).some(stage => stage?.regenerationActive))) {
    result.findings.push("Ainakin yhdessä näytteessä DPNR-regenerointi oli aktiivinen. Toista vertailu ilman aktiivista regenerointia, jos tulokset eivät ole johdonmukaiset.");
  }

  return Object.freeze({
    ...result,
    deltas: Object.freeze(result.deltas),
    findings: Object.freeze(result.findings)
  });
}

export function buildDpnrCleaningReport({ before = null, after = null, appVersion = "", createdAt = Date.now() } = {}) {
  const comparison = compareDpnrCleaningRuns(before, after);
  const lines = [
    "LEXUS IS220d DPNR PAINE-ERO – ENNEN/JÄLKEEN PUHDISTUKSEN",
    `Flex ${appVersion || "–"}`,
    `Aika ${new Date(createdAt).toISOString()}`,
    "Lähdelogiikka: Lexus/Toyota GSIC P1426/P2002 + varmennettu Toyota 217E read-only -mittaus.",
    ""
  ];
  const appendRun = (title, run) => {
    lines.push(title);
    if (!run) {
      lines.push("  Ei tallennettua mittausta.", "");
      return;
    }
    for (const stage of DPNR_CLEANING_STAGES) {
      const value = run.stages?.[stage.id];
      lines.push(`  ${stage.label}: RPM ${Number.isFinite(value?.rpm) ? value.rpm : "–"} · DPNR ${Number.isFinite(value?.pressureKpa) ? value.pressureKpa.toFixed(2) : "–"} kPa · näytteet ${value?.sampleCount ?? 0}${value?.regenerationActive ? " · REGEN AKTIIVINEN" : ""}`);
    }
    lines.push("");
  };
  appendRun("ENNEN", before);
  appendRun("JÄLKEEN", after);
  lines.push("VERTAILU");
  if (!comparison.complete) {
    lines.push("  Vertailu ei ole vielä valmis.");
  } else {
    lines.push(`  Δ KOEO: ${comparison.deltas.koeo?.toFixed?.(2) ?? "–"} kPa`);
    lines.push(`  Δ tyhjäkäynti: ${comparison.deltas.idle?.toFixed?.(2) ?? "–"} kPa`);
    lines.push(`  Δ 3000 rpm: ${comparison.deltas.rpm3000?.toFixed?.(2) ?? "–"} kPa`);
    for (const finding of comparison.findings) lines.push(`  - ${finding}`);
  }
  lines.push("", "Huom: Flex ei päättele DPNR:n tukkeutumisastetta keksityllä kPa-raja-arvolla. Tässä testissä arvioidaan GSIC:n mukaisesti erityisesti negatiivista 3000 rpm -lukemaa, KOEO-offsetia ja ennen/jälkeen-muutosta.");
  return lines.join("\n");
}

function safeLoad() {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) || "null");
    return parsed && typeof parsed === "object" ? parsed : { before: null, after: null };
  } catch {
    return { before: null, after: null };
  }
}

function safeSave(value) {
  try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value)); } catch {}
}

function ensureStyles() {
  if (typeof document === "undefined" || document.querySelector("#dpnr-cleaning-test-styles")) return;
  const style = document.createElement("style");
  style.id = "dpnr-cleaning-test-styles";
  style.textContent = `
    .dpnr-cleaning-card .dpnr-phase-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; }
    .dpnr-cleaning-card .dpnr-stage { margin-top:10px; padding:10px; border:1px solid var(--line); border-radius:11px; background:var(--surface-inset); }
    .dpnr-cleaning-card .dpnr-stage strong { display:block; margin-bottom:5px; }
    .dpnr-cleaning-card .dpnr-results { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; }
    .dpnr-cleaning-card .dpnr-results > div { padding:9px; border:1px solid var(--line); border-radius:10px; background:var(--surface-inset); }
    .dpnr-cleaning-card .dpnr-results span { display:block; color:var(--muted); font-size:9px; font-weight:800; }
    .dpnr-cleaning-card .dpnr-results pre { white-space:pre-wrap; margin:6px 0 0; font:9px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
    .dpnr-cleaning-card .dpnr-findings { margin-top:10px; padding:9px; border:1px solid var(--line); border-radius:10px; background:var(--surface-inset); font-size:10px; line-height:1.45; }
  `;
  document.head.append(style);
}

function stageText(run) {
  if (!run) return "Ei mitattu";
  return DPNR_CLEANING_STAGES.map(stage => {
    const value = run.stages?.[stage.id];
    return `${stage.label}: ${Number.isFinite(value?.pressureKpa) ? value.pressureKpa.toFixed(2) : "–"} kPa @ ${Number.isFinite(value?.rpm) ? value.rpm : "–"} rpm`;
  }).join("\n");
}

export function installDpnrCleaningTest(host = {}) {
  if (typeof document === "undefined") return null;
  const mount = () => {
    if (document.querySelector("#dpnrCleaningCard")) return document.querySelector("#dpnrCleaningCard");
    const anchor = document.querySelector("#elmDiagnosticCard");
    if (!anchor) return null;
    ensureStyles();

    const card = document.createElement("div");
    card.id = "dpnrCleaningCard";
    card.className = "card dpnr-cleaning-card";
    card.innerHTML = `
      <div class="section-title compact-title"><div><div class="eyebrow">IS220d · DPNR 217E · GSIC P1426/P2002 · VAIN LUKU</div><h3>Paineletkujen puhdistus – ennen/jälkeen</h3></div></div>
      <p class="hint">Vakioitu vertailu: KOEO → lämmin/vakaa tyhjäkäynti → noin 3000 rpm ilman kuormaa. Testi lukee vain kierrosluvun ja varmennetun Toyota 217E DPNR-paine-eron.</p>
      <div class="dpnr-phase-row"><button id="dpnrStartBefore" class="secondary" type="button">Aloita ENNEN</button><button id="dpnrStartAfter" class="secondary" type="button">Aloita JÄLKEEN</button></div>
      <div id="dpnrStageBox" class="dpnr-stage hidden"><strong id="dpnrStageTitle"></strong><div id="dpnrStageInstruction" class="hint"></div><button id="dpnrCaptureStage" class="primary full compact" type="button">Mittaa tämä vaihe</button></div>
      <div id="dpnrCleaningNotice" class="inline-message hidden" aria-live="polite"></div>
      <div class="dpnr-results"><div><span>ENNEN</span><pre id="dpnrBeforeSummary">Ei mitattu</pre></div><div><span>JÄLKEEN</span><pre id="dpnrAfterSummary">Ei mitattu</pre></div></div>
      <div id="dpnrComparison" class="dpnr-findings">Vertailu muodostuu, kun molemmat mittaukset on tehty.</div>
      <div class="button-row"><button id="dpnrCopyReport" class="secondary" type="button">Kopioi raportti</button><button id="dpnrReset" class="secondary" type="button">Tyhjennä vertailu</button></div>`;
    anchor.insertAdjacentElement("afterend", card);

    let stored = safeLoad();
    let active = null;
    let stageIndex = 0;
    let running = false;

    const notice = (text, type = "") => {
      const element = card.querySelector("#dpnrCleaningNotice");
      element.textContent = text;
      element.className = `inline-message${type ? ` ${type}` : ""}`;
      element.classList.remove("hidden");
    };

    const render = () => {
      card.querySelector("#dpnrBeforeSummary").textContent = stageText(stored.before);
      card.querySelector("#dpnrAfterSummary").textContent = stageText(stored.after);
      const comparison = compareDpnrCleaningRuns(stored.before, stored.after);
      card.querySelector("#dpnrComparison").innerHTML = comparison.complete
        ? comparison.findings.map(item => `<div>• ${escapeHtml(item)}</div>`).join("") || "Mittauspari valmis."
        : "Vertailu muodostuu, kun molemmat mittaukset on tehty.";
      const box = card.querySelector("#dpnrStageBox");
      if (!active || stageIndex >= DPNR_CLEANING_STAGES.length) {
        box.classList.add("hidden");
      } else {
        const stage = DPNR_CLEANING_STAGES[stageIndex];
        box.classList.remove("hidden");
        card.querySelector("#dpnrStageTitle").textContent = `${active === "before" ? "ENNEN" : "JÄLKEEN"} · ${stage.label}`;
        card.querySelector("#dpnrStageInstruction").textContent = stage.instruction;
      }
      card.querySelector("#dpnrStartBefore").disabled = running;
      card.querySelector("#dpnrStartAfter").disabled = running;
      card.querySelector("#dpnrCaptureStage").disabled = running;
    };

    const start = phase => {
      active = phase;
      stageIndex = 0;
      notice(`${phase === "before" ? "ENNEN" : "JÄLKEEN"}-mittaus aloitettu. Tee kolme vaihetta samassa järjestyksessä.`);
      render();
    };

    const capture = async () => {
      if (!active || running) return;
      const check = typeof host.canRun === "function" ? host.canRun() : { ok: true };
      if (check === false || check?.ok === false) {
        notice(check?.message || "Testiä ei voi ajaa nykyisessä sovellustilassa.", "warning");
        return;
      }
      if (typeof host.readCommand !== "function") {
        notice("Flexin DPNR-testin lukuyhteys ei ole käytettävissä.", "error");
        return;
      }
      const stage = DPNR_CLEANING_STAGES[stageIndex];
      running = true;
      render();
      notice(`${stage.label}: kerätään ${SAMPLE_COUNT} näytettä…`);
      const samples = [];
      try {
        for (const command of ["ATSH7E0", "010C", "217E", "ATSH7DF"]) {
          if (!isSafeTerminalCommand(command)) throw new Error(`Turvallisuussallintalista esti komennon ${command}`);
        }
        await host.readCommand("ATSH7E0", 1800);
        for (let index = 0; index < SAMPLE_COUNT; index++) {
          const rpmRaw = await host.readCommand("010C", READ_TIMEOUT_MS);
          const dpnrRaw = await host.readCommand("217E", READ_TIMEOUT_MS);
          samples.push(decodeDpnrCleaningSample({ rpmRaw, dpnrRaw }));
          if (index + 1 < SAMPLE_COUNT) await delay(SAMPLE_PAUSE_MS);
        }
        const summary = summarizeDpnrCleaningStage(stage.id, samples);
        if (summary.sampleCount < SAMPLE_COUNT) throw new Error(`Kelvollisia näytteitä ${summary.sampleCount}/${SAMPLE_COUNT}`);
        if (!summary.conditionOk) {
          notice(`${stage.label}: kierrosluku ${summary.rpm ?? "–"} rpm ei vastaa tämän vaiheen ehtoa (${stage.rpmMin}–${stage.rpmMax} rpm). Mittausta ei tallennettu.`, "warning");
          return;
        }
        const run = stored[active] || { schemaVersion: 1, startedAt: Date.now(), stages: {} };
        run.stages[stage.id] = summary;
        run.endedAt = stageIndex === DPNR_CLEANING_STAGES.length - 1 ? Date.now() : null;
        stored = { ...stored, [active]: run };
        safeSave(stored);
        notice(`${stage.label}: ${summary.pressureKpa.toFixed(2)} kPa @ ${summary.rpm} rpm${summary.regenerationActive ? " · regenerointi aktiivinen" : ""}.`);
        stageIndex += 1;
        if (stageIndex >= DPNR_CLEANING_STAGES.length) {
          active = null;
          notice(`${run === stored.before ? "ENNEN" : "JÄLKEEN"}-mittaus valmis ja tallennettu paikallisesti.`);
        }
      } catch (error) {
        notice(`Mittaus epäonnistui: ${error?.message || error}`, "error");
      } finally {
        try { await host.readCommand("ATSH7DF", 1200); } catch {}
        running = false;
        render();
      }
    };

    card.querySelector("#dpnrStartBefore").addEventListener("click", () => start("before"));
    card.querySelector("#dpnrStartAfter").addEventListener("click", () => start("after"));
    card.querySelector("#dpnrCaptureStage").addEventListener("click", capture);
    card.querySelector("#dpnrReset").addEventListener("click", () => {
      stored = { before: null, after: null };
      safeSave(stored);
      active = null;
      stageIndex = 0;
      notice("DPNR ennen/jälkeen -vertailu tyhjennetty.");
      render();
    });
    card.querySelector("#dpnrCopyReport").addEventListener("click", async () => {
      const report = buildDpnrCleaningReport({ before: stored.before, after: stored.after, appVersion: host.appVersion || "" });
      try {
        await navigator.clipboard.writeText(report);
        notice("DPNR ennen/jälkeen -raportti kopioitu leikepöydälle.");
      } catch {
        notice("Raportin kopiointi ei onnistunut.", "warning");
      }
    });

    render();
    return card;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
    return null;
  }
  return mount();
}
