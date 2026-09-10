export const INJECTOR_TEST_SCHEMA_VERSION = 1;
export const INJECTOR_TEST_PROFILE_VERSION = "is220d-2ad-fhv-injector-balance-readonly-v1";

export const INJECTOR_TEST_AVAILABILITY = Object.freeze({
  supported: false,
  blockedCommand: "219C",
  calibrationId: "35360000",
  evidenceRuns: 3,
  reason: "Toyota 219C palautti NO DATA -vastauksen kolmessa toistettavassa ajossa tällä ECU-kalibroinnilla."
});

export const INJECTOR_TEST_LIMITS = Object.freeze({
  typicalAbsoluteMm3: 3.0,
  serviceAbsoluteMm3: 4.9,
  minimumCoolantC: 75,
  idleRpmMinimum: 600,
  idleRpmMaximum: 1100,
  maximumRpmRange: 180,
  idleRailPressureMinimumMpa: 37,
  idleRailPressureMaximumMpa: 43,
  minimumValidSamples: 8
});

export const INJECTOR_TEST_COMMANDS = Object.freeze({
  setup: Object.freeze(["ATSP6", "ATCAF1", "ATCFC1", "ATAL", "ATH1", "ATS1", "ATSTFF", "ATSH7E0", "ATCRA7E8"]),
  read: Object.freeze(["010C", "0105", "2193", "2196"]),
  restore: Object.freeze(["ATCRA", "ATAR", "ATH0", "ATS0", "ATAT1", "ATST32", "ATSH7E0"])
});

const finite = value => Number.isFinite(Number(value));
const numberOrNull = value => finite(value) ? Number(value) : null;

function quantile(values, fraction) {
  const sorted = values.filter(finite).map(Number).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = Math.max(0, Math.min(sorted.length - 1, (sorted.length - 1) * fraction));
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function statistics(values) {
  const clean = values.filter(finite).map(Number);
  if (!clean.length) return Object.freeze({ count: 0, minimum: null, maximum: null, mean: null, median: null, standardDeviation: null, p95Absolute: null });
  const mean = clean.reduce((sum, value) => sum + value, 0) / clean.length;
  const variance = clean.reduce((sum, value) => sum + (value - mean) ** 2, 0) / clean.length;
  return Object.freeze({
    count: clean.length,
    minimum: Math.min(...clean),
    maximum: Math.max(...clean),
    mean,
    median: quantile(clean, 0.5),
    standardDeviation: Math.sqrt(variance),
    p95Absolute: quantile(clean.map(Math.abs), 0.95)
  });
}

function statusText(status) {
  return ({ normal: "EI SELVÄÄ POIKKEAMAA", attention: "TARKISTA SUUTINJÄRJESTELMÄ", abnormal: "SELKEÄ POIKKEAMA", incomplete: "TESTI EPÄTÄYDELLINEN" })[status] || "EI TULOSTA";
}

export function analyzeInjectorTest(run = {}) {
  const samples = Array.isArray(run.samples) ? run.samples : [];
  const validFeedbackSamples = samples.filter(sample =>
    Array.isArray(sample?.values?.feedbackMm3) &&
    sample.values.feedbackMm3.length === 4 &&
    sample.values.feedbackMm3.every(finite)
  );
  const cylinderStats = [0, 1, 2, 3].map(index => {
    const values = validFeedbackSamples.map(sample => Number(sample.values.feedbackMm3[index]));
    const stats = statistics(values);
    const beyondTypicalCount = values.filter(value => Math.abs(value) > INJECTOR_TEST_LIMITS.typicalAbsoluteMm3).length;
    const beyondServiceCount = values.filter(value => Math.abs(value) > INJECTOR_TEST_LIMITS.serviceAbsoluteMm3).length;
    return Object.freeze({
      cylinder: index + 1,
      ...stats,
      beyondTypicalCount,
      beyondTypicalRatio: values.length ? beyondTypicalCount / values.length : 0,
      beyondServiceCount,
      beyondServiceRatio: values.length ? beyondServiceCount / values.length : 0
    });
  });
  const coolant = statistics(samples.map(sample => sample?.values?.coolantC));
  const rpm = statistics(samples.map(sample => sample?.values?.rpm));
  const rail = statistics(samples.map(sample => sample?.values?.railPressureMpa));
  const fuelTemperature = statistics(samples.map(sample => sample?.values?.fuelTemperatureC));
  const coolantWarm = finite(coolant.median) && coolant.median >= INJECTOR_TEST_LIMITS.minimumCoolantC;
  const rpmRange = finite(rpm.minimum) && finite(rpm.maximum) ? rpm.maximum - rpm.minimum : null;
  const idleStable = finite(rpm.median) &&
    rpm.median >= INJECTOR_TEST_LIMITS.idleRpmMinimum &&
    rpm.median <= INJECTOR_TEST_LIMITS.idleRpmMaximum &&
    rpmRange <= INJECTOR_TEST_LIMITS.maximumRpmRange;
  const enoughSamples = validFeedbackSamples.length >= INJECTOR_TEST_LIMITS.minimumValidSamples;
  const railInIdleRange = finite(rail.median)
    ? rail.median >= INJECTOR_TEST_LIMITS.idleRailPressureMinimumMpa && rail.median <= INJECTOR_TEST_LIMITS.idleRailPressureMaximumMpa
    : null;
  const persistentServiceDeviation = cylinderStats.some(item => Math.abs(item.median ?? 0) > INJECTOR_TEST_LIMITS.serviceAbsoluteMm3 || item.beyondServiceRatio >= 0.2);
  const attentionDeviation = cylinderStats.some(item =>
    item.p95Absolute > INJECTOR_TEST_LIMITS.typicalAbsoluteMm3 ||
    item.beyondTypicalRatio >= 0.2 ||
    item.beyondServiceCount > 0
  );

  let status = "normal";
  if (!enoughSamples || !coolantWarm || !idleStable) status = "incomplete";
  else if (persistentServiceDeviation) status = "abnormal";
  else if (attentionDeviation) status = "attention";

  const findings = [];
  findings.push(enoughSamples
    ? `Kelvollisia neljän sylinterin näytteitä saatiin ${validFeedbackSamples.length}.`
    : `Kelvollisia neljän sylinterin näytteitä saatiin vain ${validFeedbackSamples.length}/${INJECTOR_TEST_LIMITS.minimumValidSamples}.`);
  findings.push(coolantWarm
    ? `Moottori oli mittauksen perusteella lämmin: jäähdytysnesteen mediaani ${coolant.median.toFixed(1)} °C.`
    : `Lämpimän moottorin ehto ei täyttynyt${finite(coolant.median) ? `: jäähdytysnesteen mediaani ${coolant.median.toFixed(1)} °C` : ": jäähdytysnesteen lämpötilaa ei saatu"}.`);
  findings.push(idleStable
    ? `Tyhjäkäynti oli riittävän vakaa: mediaani ${rpm.median.toFixed(0)} rpm, vaihteluväli ${rpmRange.toFixed(0)} rpm.`
    : `Vakaata tyhjäkäyntiä ei voitu varmistaa${finite(rpm.median) ? `: mediaani ${rpm.median.toFixed(0)} rpm, vaihteluväli ${finite(rpmRange) ? rpmRange.toFixed(0) : "–"} rpm` : ": kierroslukua ei saatu"}.`);
  for (const item of cylinderStats) {
    if (!item.count) {
      findings.push(`Sylinteri ${item.cylinder}: ei kelvollisia korjausarvoja.`);
      continue;
    }
    const severity = Math.abs(item.median) > INJECTOR_TEST_LIMITS.serviceAbsoluteMm3 || item.beyondServiceRatio >= 0.2
      ? "huoltorajan ylittävä jatkuva poikkeama"
      : item.p95Absolute > INJECTOR_TEST_LIMITS.typicalAbsoluteMm3 || item.beyondTypicalCount
        ? "tavanomaisen alueen ylityksiä"
        : "tavanomaisella alueella";
    findings.push(`Sylinteri ${item.cylinder}: mediaani ${item.median.toFixed(2)} mm³, vaihteluväli ${item.minimum.toFixed(2)}…${item.maximum.toFixed(2)} mm³ — ${severity}.`);
  }
  if (railInIdleRange === false) findings.push(`Rail-paineen mediaani ${rail.median.toFixed(1)} MPa oli käsikirjan 37–43 MPa tyhjäkäyntialueen ulkopuolella; tarkista mittausolosuhteet ja polttoainejärjestelmä.`);
  if (railInIdleRange === null) findings.push("Toyota 2196 -rail-painetta ei saatu; tämä rajoittaa polttoainejärjestelmän tulkintaa.");

  return Object.freeze({
    schemaVersion: INJECTOR_TEST_SCHEMA_VERSION,
    status,
    statusText: statusText(status),
    validSampleCount: validFeedbackSamples.length,
    totalSampleCount: samples.length,
    conditions: Object.freeze({ coolantWarm, idleStable, enoughSamples, railInIdleRange, rpmRange }),
    statistics: Object.freeze({ coolant, rpm, rail, fuelTemperature, cylinders: Object.freeze(cylinderStats) }),
    findings: Object.freeze(findings),
    limitations: Object.freeze([
      "Suutinkorjausarvo on moottorinohjauksen tasapainotusmittaus; se ei yksin osoita suuttimen sisäistä tai ulkoista polttoainevuotoa.",
      "Testi ei suorita Techstreamin Test the Fuel Leak -Active Test -toimintoa eikä mitään kirjoittavaa ECU-komentoa.",
      "Varmennus voi vaatia suuttimien paluuvirta-/leak-off-testin, puristusmittauksen ja korkeapainepuolen vuotojen silmämääräisen tarkastuksen."
    ])
  });
}

function reportNumber(value, decimals = 1) {
  return finite(value) ? Number(value).toFixed(decimals) : "–";
}

function reportText(value) {
  return String(value ?? "").replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
}

export function buildInjectorTestReport(run = {}, analysis = analyzeInjectorTest(run)) {
  const meta = run.meta || {};
  const durationMs = Math.max(0, Number(run.endedAt || Date.now()) - Number(run.startedAt || Date.now()));
  const lines = [
    "===== BEGIN LEXUS OBD FLEX INJECTOR CONDITION REPORT =====",
    "Raporttityyppi: IS220d suutinten tasapaino- ja vuotoepäilyseulonta",
    `Raporttiskeema: ${INJECTOR_TEST_SCHEMA_VERSION}`,
    `Testiprofiili: ${INJECTOR_TEST_PROFILE_VERSION}`,
    `Sovellus: Lexus OBD Flex ${meta.appVersion || "tuntematon"}`,
    `Raporttitunnus: ${meta.reportId || "ei tietoa"}`,
    `Ajoneuvo: ${meta.vehicle || "Lexus IS220d · XE20 · 2AD-FHV"}`,
    `Aloitus: ${new Date(run.startedAt || Date.now()).toISOString()}`,
    `Lopetus: ${new Date(run.endedAt || Date.now()).toISOString()}`,
    `Kesto_ms: ${durationMs}`,
    `Keskeytetty: ${run.cancelled ? "kyllä" : "ei"}`,
    `Sisäinen_virhe: ${run.internalError || "–"}`,
    `Mittarilukema_km: ${meta.odometer || "ei ilmoitettu"}`,
    `Käyttäjän huomio: ${meta.note || "–"}`,
    `Adapteri: ${meta.adapter || "ei tietoa"}`,
    `Yhteystapa: ${meta.transport || "ei tietoa"}`,
    "Toimintatapa: vain luku; ei Active Test-, kirjoitus-, poisto- eikä regenerointikomentoja",
    `Lukukomennot: ${INJECTOR_TEST_COMMANDS.read.join(", ")}`,
    "",
    "TULOS",
    `Luokitus: ${analysis.statusText}`,
    `Kelvolliset_näytteet: ${analysis.validSampleCount}/${analysis.totalSampleCount}`,
    `Lämmin_moottori_varmistui: ${analysis.conditions.coolantWarm ? "kyllä" : "ei"}`,
    `Vakaa_tyhjäkäynti_varmistui: ${analysis.conditions.idleStable ? "kyllä" : "ei"}`,
    `Rail_paine_tyhjkäyntialueella: ${analysis.conditions.railInIdleRange === true ? "kyllä" : analysis.conditions.railInIdleRange === false ? "ei" : "ei tietoa"}`,
    "",
    "RAJA-ARVOT JA TULKINTAPERUSTA",
    "Lexus-korjaamokäsikirjan Data List: Injection Feedback Val #1–#4, lämmin moottori, tyhjäkäynti, A/C ja kaikki lisälaitteet pois.",
    `Tavanomainen alue: -${INJECTOR_TEST_LIMITS.typicalAbsoluteMm3.toFixed(1)}…+${INJECTOR_TEST_LIMITS.typicalAbsoluteMm3.toFixed(1)} mm³ / sylinteri.`,
    `Huoltoraja: korjausarvon itseisarvo enintään ${INJECTOR_TEST_LIMITS.serviceAbsoluteMm3.toFixed(1)} mm³.`,
    `Tyhjäkäynnin rail-paineen viitealue: ${INJECTOR_TEST_LIMITS.idleRailPressureMinimumMpa}–${INJECTOR_TEST_LIMITS.idleRailPressureMaximumMpa} MPa.`,
    "Positiivinen korjaus tarkoittaa, että ECU lisää kyseisen sylinterin ruiskutusmäärää palamisen heikkouden tasapainottamiseksi; negatiivinen tarkoittaa vähennystä liiallisen palamispaineen tasapainottamiseksi.",
    "",
    "SYLINTERIKOHTAINEN YHTEENVETO",
    "sylinteri\tn\tmediaani_mm3\tkeskiarvo_mm3\tmin_mm3\tmax_mm3\tkeskihajonta\tp95_itseisarvo\tyli_3.0\tyli_4.9",
    ...analysis.statistics.cylinders.map(item => [
      item.cylinder,
      item.count,
      reportNumber(item.median, 2),
      reportNumber(item.mean, 2),
      reportNumber(item.minimum, 2),
      reportNumber(item.maximum, 2),
      reportNumber(item.standardDeviation, 2),
      reportNumber(item.p95Absolute, 2),
      item.beyondTypicalCount,
      item.beyondServiceCount
    ].join("\t")),
    "",
    "MITTAUSOLOSUHTEET",
    `RPM mediaani/min/max: ${reportNumber(analysis.statistics.rpm.median, 0)} / ${reportNumber(analysis.statistics.rpm.minimum, 0)} / ${reportNumber(analysis.statistics.rpm.maximum, 0)} rpm`,
    `Jäähdytysneste mediaani/min/max: ${reportNumber(analysis.statistics.coolant.median, 1)} / ${reportNumber(analysis.statistics.coolant.minimum, 1)} / ${reportNumber(analysis.statistics.coolant.maximum, 1)} °C`,
    `Polttoainelämpö mediaani/min/max: ${reportNumber(analysis.statistics.fuelTemperature.median, 1)} / ${reportNumber(analysis.statistics.fuelTemperature.minimum, 1)} / ${reportNumber(analysis.statistics.fuelTemperature.maximum, 1)} °C`,
    `Rail-paine mediaani/min/max: ${reportNumber(analysis.statistics.rail.median, 1)} / ${reportNumber(analysis.statistics.rail.minimum, 1)} / ${reportNumber(analysis.statistics.rail.maximum, 1)} MPa`,
    "",
    "AUTOMAATTISET HAVAINNOT",
    ...analysis.findings.map((finding, index) => `${index + 1}. ${finding}`),
    "",
    "RAJOITUKSET",
    ...analysis.limitations.map((limitation, index) => `${index + 1}. ${limitation}`),
    "",
    "CAN-ALUSTUKSEN RAAKALOKI",
    "komento\taika_iso\tvirhe\traakavastaus",
    ...(Array.isArray(run.setup) ? run.setup : []).map(item => [
      item.command || "",
      item.timestamp ? new Date(item.timestamp).toISOString() : "",
      reportText(item.error),
      reportText(item.raw)
    ].join("\t")),
    "",
    "NÄYTEKOHTAINEN RAAKADATA",
    "n\taika_iso\tkulunut_ms\trpm\tjäähdytysneste_c\tpolttoaine_c\trail_mpa\tsuutin1_mm3\tsuutin2_mm3\tsuutin3_mm3\tsuutin4_mm3\traw_010c\traw_0105\traw_2193\traw_2196\traw_219c\tvirheet",
    ...(Array.isArray(run.samples) ? run.samples : []).map(sample => [
      sample.sequence ?? "",
      sample.timestamp ? new Date(sample.timestamp).toISOString() : "",
      sample.elapsedMs ?? "",
      reportNumber(sample?.values?.rpm, 0),
      reportNumber(sample?.values?.coolantC, 1),
      reportNumber(sample?.values?.fuelTemperatureC, 1),
      reportNumber(sample?.values?.railPressureMpa, 1),
      ...[0, 1, 2, 3].map(index => reportNumber(sample?.values?.feedbackMm3?.[index], 2)),
      reportText(sample?.raw?.rpm),
      reportText(sample?.raw?.coolant),
      reportText(sample?.raw?.fuelTemperature),
      reportText(sample?.raw?.railPressure),
      reportText(sample?.raw?.feedback),
      reportText(Object.entries(sample?.errors || {}).map(([key, value]) => `${key}:${value}`).join(" | "))
    ].join("\t")),
    "",
    "TEKOÄLYANALYYSIN OHJE",
    buildInjectorTestAnalysisPrompt(run, analysis),
    "===== END LEXUS OBD FLEX INJECTOR CONDITION REPORT ====="
  ];
  return lines.join("\n");
}

export function buildInjectorTestAnalysisPrompt(run = {}, analysis = analyzeInjectorTest(run)) {
  return [
    "Analysoi liitteenä oleva Lexus IS220d 2AD-FHV -moottorin suutinten tasapainoraportti.",
    "Tarkista ensin näytemäärä, moottorin lämpö ja tyhjäkäynnin vakaus sekä raakavastausten eheys.",
    "Vertaa jokaista sylinteriä Lexus-korjaamokäsikirjan tavanomaiseen -3,0…+3,0 mm³ alueeseen ja 4,9 mm³ itseisarvorajaan.",
    "Etsi jatkuvat poikkeamat, vastakkaissuuntaiset sylinteriparit, yksittäiset piikit ja rail-paineen poikkeamat.",
    "Älä päättele pelkästä korjausarvosta, että suutin varmasti vuotaa tai että se pitää vaihtaa.",
    "Kerro erikseen: 1) mitä data osoittaa, 2) mitä se ei osoita, 3) todennäköiset vaihtoehtoiset syyt, 4) turvallinen seuraava varmennustesti.",
    "Suosittele tarvittaessa paluuvirta-/leak-off-testiä, puristusmittausta, korkeapainepuolen vuototarkastusta tai ammattilaisen Techstream-testiä.",
    `Flexin alustava luokitus on ${analysis.statusText}; arvioi se uudelleen raakadatasta.`
  ].join(" ");
}
