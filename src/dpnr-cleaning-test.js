const SCHEMA_VERSION = "is220d-dpnr-hose-cleaning-v1";

export const DPNR_CLEANING_TEST_SCHEMA = SCHEMA_VERSION;

export const DPNR_CLEANING_STAGES = Object.freeze({
  before: Object.freeze({ id: "before", label: "ENNEN PUHDISTUSTA" }),
  after: Object.freeze({ id: "after", label: "PUHDISTUKSEN JÄLKEEN" })
});

export const DPNR_CLEANING_CONDITIONS = Object.freeze({
  koeo: Object.freeze({
    id: "koeo",
    label: "KOEO · virrat päällä, moottori sammuksissa",
    shortLabel: "KOEO",
    rpmMin: 0,
    rpmMax: 100
  }),
  idle: Object.freeze({
    id: "idle",
    label: "Lämmin tyhjäkäynti",
    shortLabel: "TYHJÄKÄYNTI",
    rpmMin: 400,
    rpmMax: 1600
  }),
  rpm3000: Object.freeze({
    id: "rpm3000",
    label: "Noin 3000 rpm · ei kuormaa",
    shortLabel: "3000 RPM",
    rpmMin: 2700,
    rpmMax: 3300,
    mafMinimumGs: 25
  })
});

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function finite(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function median(values) {
  const valid = values.map(finite).filter(value => value !== null).sort((a, b) => a - b);
  if (!valid.length) return null;
  const middle = Math.floor(valid.length / 2);
  return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
}

function range(values) {
  const valid = values.map(finite).filter(value => value !== null);
  if (!valid.length) return null;
  return Math.max(...valid) - Math.min(...valid);
}

export function createDpnrCleaningTestRun(meta = {}) {
  const now = Date.now();
  return {
    schemaVersion: SCHEMA_VERSION,
    startedAt: now,
    updatedAt: now,
    meta: {
      vehicle: "Lexus IS220d · XE20 · 2AD-FHV",
      sourceBasis: "Toyota/Lexus GSIC RM0150 · P1426, P2002 ja Differential Pressure Sensor -tarkastus",
      ...deepClone(meta)
    },
    before: {},
    after: {}
  };
}

export function summarizeDpnrCleaningCapture(samples = [], conditionId = "") {
  const condition = DPNR_CLEANING_CONDITIONS[conditionId];
  if (!condition) throw new Error(`Unknown DPNR cleaning condition: ${conditionId}`);
  const validPressure = samples.filter(sample => Number.isFinite(Number(sample?.pressureKpa)));
  const pressureKpa = median(validPressure.map(sample => sample.pressureKpa));
  const rpm = median(samples.map(sample => sample?.rpm));
  const mafGs = median(samples.map(sample => sample?.mafGs));
  const coolantC = median(samples.map(sample => sample?.coolantC));
  const pressureSpreadKpa = range(validPressure.map(sample => sample.pressureKpa));
  const enoughSamples = validPressure.length >= 4;
  const rpmInWindow = Number.isFinite(rpm) && rpm >= condition.rpmMin && rpm <= condition.rpmMax;
  const mafValid = conditionId !== "rpm3000" || Number.isFinite(mafGs) && mafGs >= condition.mafMinimumGs;
  const negativeAt3000 = conditionId === "rpm3000" && Number.isFinite(pressureKpa) && pressureKpa < 0;

  const findings = [];
  if (!enoughSamples) findings.push("Paine-erosta saatiin alle neljä kelvollista näytettä.");
  if (!rpmInWindow) findings.push(`Kierrosluku ei pysynyt mittausikkunassa ${condition.rpmMin}–${condition.rpmMax} rpm.`);
  if (conditionId === "rpm3000" && !mafValid) {
    findings.push("MAF jäi alle 25 g/s. GSIC:n 2AD-FHV/P2002-tarkastuslogiikan mukaan paine-eroarvo ei tällöin ole luotettava pakokaasupulsaation vuoksi.");
  }
  if (negativeAt3000) {
    findings.push("Paine-ero oli negatiivinen noin 3000 rpm:n kuormittamattomassa tarkastuksessa. GSIC P1426 ohjaa tarkistamaan ensin letkujen järjestyksen ja sen jälkeen letku-/pressure pipe -tukoksen sekä anturin.");
  }

  return {
    conditionId,
    label: condition.label,
    sampleCount: samples.length,
    validPressureSampleCount: validPressure.length,
    pressureKpa,
    pressureSpreadKpa,
    rpm,
    mafGs,
    coolantC,
    enoughSamples,
    rpmInWindow,
    mafValid,
    negativeAt3000,
    validForComparison: enoughSamples && rpmInWindow && mafValid,
    findings
  };
}

export function addDpnrCleaningCapture(run, stageId, conditionId, samples = []) {
  if (!run || run.schemaVersion !== SCHEMA_VERSION) throw new Error("Invalid DPNR cleaning test run");
  if (!DPNR_CLEANING_STAGES[stageId]) throw new Error(`Unknown DPNR cleaning stage: ${stageId}`);
  if (!DPNR_CLEANING_CONDITIONS[conditionId]) throw new Error(`Unknown DPNR cleaning condition: ${conditionId}`);
  const next = deepClone(run);
  next[stageId][conditionId] = {
    capturedAt: Date.now(),
    samples: deepClone(samples),
    summary: summarizeDpnrCleaningCapture(samples, conditionId)
  };
  next.updatedAt = Date.now();
  return next;
}

function captureSummary(run, stage, condition) {
  return run?.[stage]?.[condition]?.summary || null;
}

export function analyzeDpnrCleaningTest(run) {
  const before3000 = captureSummary(run, "before", "rpm3000");
  const after3000 = captureSummary(run, "after", "rpm3000");
  const beforeKoeo = captureSummary(run, "before", "koeo");
  const afterKoeo = captureSummary(run, "after", "koeo");
  const completeBefore = Object.keys(DPNR_CLEANING_CONDITIONS).every(id => Boolean(captureSummary(run, "before", id)));
  const completeAfter = Object.keys(DPNR_CLEANING_CONDITIONS).every(id => Boolean(captureSummary(run, "after", id)));
  const findings = [];
  let status = "incomplete";

  if (before3000?.negativeAt3000 && after3000?.validForComparison && !after3000.negativeAt3000) {
    status = "normalized";
    findings.push("Ennen puhdistusta 3000 rpm:n paine-ero oli negatiivinen, mutta puhdistuksen jälkeen se muuttui ei-negatiiviseksi kelvollisessa MAF-olosuhteessa.");
  } else if (after3000?.negativeAt3000 && after3000?.validForComparison) {
    status = "negative-remains";
    findings.push("Negatiivinen paine-ero jäi näkyviin puhdistuksen jälkeen noin 3000 rpm:ssä. Tarkista GSIC P1426:n mukaisesti letkujen järjestys, jäljellä oleva tukos/pressure pipe ja anturi.");
  } else if (completeBefore && completeAfter) {
    status = "comparison-ready";
    findings.push("Ennen/jälkeen-testipari on valmis. Positiivisen paine-eron pelkkää pienenemistä ei tulkita automaattisesti parannukseksi, koska itse DPNR:n vastus vaikuttaa arvoon.");
  }

  if (before3000 && !before3000.mafValid) findings.push("Ennen-puolen 3000 rpm -mittauksen MAF jäi alle 25 g/s, joten vertailun varmuus on heikko.");
  if (after3000 && !after3000.mafValid) findings.push("Jälkeen-puolen 3000 rpm -mittauksen MAF jäi alle 25 g/s, joten vertailun varmuus on heikko.");

  const koeoOffsetBefore = Number.isFinite(beforeKoeo?.pressureKpa) ? Math.abs(beforeKoeo.pressureKpa) : null;
  const koeoOffsetAfter = Number.isFinite(afterKoeo?.pressureKpa) ? Math.abs(afterKoeo.pressureKpa) : null;
  const pressure3000DeltaKpa = Number.isFinite(before3000?.pressureKpa) && Number.isFinite(after3000?.pressureKpa)
    ? after3000.pressureKpa - before3000.pressureKpa
    : null;

  return {
    status,
    completeBefore,
    completeAfter,
    findings,
    koeoOffsetBefore,
    koeoOffsetAfter,
    koeoOffsetDelta: Number.isFinite(koeoOffsetBefore) && Number.isFinite(koeoOffsetAfter) ? koeoOffsetAfter - koeoOffsetBefore : null,
    pressure3000DeltaKpa
  };
}

function number(value, decimals = 2, unit = "") {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(decimals)}${unit ? ` ${unit}` : ""}` : "–";
}

function captureLines(run, stageId, conditionId) {
  const capture = run?.[stageId]?.[conditionId];
  if (!capture) return [`${DPNR_CLEANING_CONDITIONS[conditionId].shortLabel}: EI MITATTU`];
  const summary = capture.summary;
  const lines = [
    `${DPNR_CLEANING_CONDITIONS[conditionId].shortLabel}: paine ${number(summary.pressureKpa, 2, "kPa")} · RPM ${number(summary.rpm, 0)} · MAF ${number(summary.mafGs, 1, "g/s")} · jäähdytysneste ${number(summary.coolantC, 0, "°C")}`,
    `Kelvolliset paine-eromittaukset: ${summary.validPressureSampleCount}/${summary.sampleCount} · painehajonta ${number(summary.pressureSpreadKpa, 2, "kPa")}`,
    `Vertailukelpoinen: ${summary.validForComparison ? "KYLLÄ" : "EI"}`
  ];
  for (const finding of summary.findings) lines.push(`Huomio: ${finding}`);
  lines.push("Raaka 217E:");
  for (const sample of capture.samples || []) lines.push(`  ${new Date(sample.timestamp).toISOString()} · ${sample.raw217e || "–"}`);
  return lines;
}

export function buildDpnrCleaningTestReport(run, analysis = analyzeDpnrCleaningTest(run)) {
  const lines = [
    "===== LEXUS IS220d DPNR PAINE-EROLETKUJEN ENNEN/JÄLKEEN -TESTI =====",
    `Schema: ${run?.schemaVersion || "–"}`,
    `Flex: ${run?.meta?.appVersion || "–"}`,
    `Ajoneuvo: ${run?.meta?.vehicle || "Lexus IS220d"}`,
    `Lähdepohja: ${run?.meta?.sourceBasis || "–"}`,
    "",
    "Tulkintarajaus: testi tarkistaa paine-eron mittausketjun käyttäytymistä ennen/jälkeen. Se ei yksin todista DPNR-suodattimen kuntoa.",
    "",
    "--- ENNEN PUHDISTUSTA ---"
  ];
  for (const id of Object.keys(DPNR_CLEANING_CONDITIONS)) lines.push(...captureLines(run, "before", id));
  lines.push("", "--- PUHDISTUKSEN JÄLKEEN ---");
  for (const id of Object.keys(DPNR_CLEANING_CONDITIONS)) lines.push(...captureLines(run, "after", id));
  lines.push(
    "",
    "--- VERTAILU ---",
    `Tila: ${analysis.status}`,
    `KOEO |offset| ennen: ${number(analysis.koeoOffsetBefore, 2, "kPa")}`,
    `KOEO |offset| jälkeen: ${number(analysis.koeoOffsetAfter, 2, "kPa")}`,
    `KOEO offset-muutos: ${number(analysis.koeoOffsetDelta, 2, "kPa")}`,
    `3000 rpm paine-eron muutos (jälkeen − ennen): ${number(analysis.pressure3000DeltaKpa, 2, "kPa")}`
  );
  for (const finding of analysis.findings) lines.push(`Johtopäätös: ${finding}`);
  return lines.join("\n");
}

export function buildDpnrCleaningAnalysisPrompt(run, analysis = analyzeDpnrCleaningTest(run)) {
  return [
    "Analysoi liitteenä oleva Lexus IS220d 2AD-FHV DPNR-paine-eroletkujen ennen/jälkeen-testi.",
    "Perusta arvio Toyota/Lexus GSIC P1426/P2002 -logiikkaan.",
    "Kiinnitä erityisesti huomiota 3000 rpm:n negatiiviseen paine-eroon, MAF >=25 g/s -mittausehtoon, KOEO-offsetiin, raakavasteen 217E johdonmukaisuuteen ja siihen muuttuiko mittausketjun käyttäytyminen puhdistuksen jälkeen.",
    "Älä päättele DPNR-suodattimen kuntoa pelkästä paine-eron pienenemisestä.",
    `Flexin alustava tila: ${analysis.status}.`
  ].join(" ");
}
