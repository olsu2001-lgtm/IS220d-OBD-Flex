import { INJECTOR_TEST_LIMITS } from "./injector-test.js";

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) freeze(nested);
  return value;
}

export const IS220D_LIVE_REFERENCES = freeze({
  rpm: {
    kind: "range",
    context: "warm-idle-candidate",
    min: INJECTOR_TEST_LIMITS.idleRpmMinimum,
    max: INJECTOR_TEST_LIMITS.idleRpmMaximum,
    unit: "rpm",
    label: `${INJECTOR_TEST_LIMITS.idleRpmMinimum}–${INJECTOR_TEST_LIMITS.idleRpmMaximum} rpm`,
    source: "IS220d injector-test / lämmin vakaa tyhjäkäynti",
    note: "Tämä on suutintestin kelpoisuusikkuna, ei yleinen vikakynnys kaikissa käyttötiloissa."
  },
  coolant: {
    kind: "minimum-condition",
    context: "running",
    min: INJECTOR_TEST_LIMITS.minimumCoolantC,
    unit: "°C",
    label: `≥ ${INJECTOR_TEST_LIMITS.minimumCoolantC} °C`,
    source: "IS220d injector-test / lämpimän moottorin ehto",
    note: "Alitus tarkoittaa, ettei lämpimän moottorin vertailuehto vielä täyty; se ei yksin ole vika."
  },
  railPressure: {
    kind: "range",
    context: "warm-idle-candidate",
    min: INJECTOR_TEST_LIMITS.idleRailPressureMinimumMpa * 1000,
    max: INJECTOR_TEST_LIMITS.idleRailPressureMaximumMpa * 1000,
    unit: "kPa",
    label: `${INJECTOR_TEST_LIMITS.idleRailPressureMinimumMpa}–${INJECTOR_TEST_LIMITS.idleRailPressureMaximumMpa} MPa`,
    source: "Lexus-korjaamokäsikirjan Data List / injector-test",
    note: "Viite koskee lämmintä vakaata tyhjäkäyntiä."
  },
  toyotaRailPressure: {
    kind: "range",
    context: "warm-idle-candidate",
    min: INJECTOR_TEST_LIMITS.idleRailPressureMinimumMpa,
    max: INJECTOR_TEST_LIMITS.idleRailPressureMaximumMpa,
    unit: "MPa",
    label: `${INJECTOR_TEST_LIMITS.idleRailPressureMinimumMpa}–${INJECTOR_TEST_LIMITS.idleRailPressureMaximumMpa} MPa`,
    source: "Lexus-korjaamokäsikirjan Data List / injector-test",
    note: "Viite koskee lämmintä vakaata tyhjäkäyntiä."
  },
  voltage: {
    kind: "guide-range",
    context: "running",
    min: 13,
    max: 15,
    unit: "V",
    label: "noin 13–15 V",
    source: "Bom-kaapija / Vikadiag_kohteet, latausjännite",
    note: "Vertailuohje. Poikkeama varmennetaan yleismittarilla akulta ja laturin B+:sta; ECU-jännite ei yksin hyväksy tai hylkää laturia."
  },
  dpnrDifferentialPressure: {
    kind: "target-without-tolerance",
    context: "key-on",
    target: 0,
    unit: "kPa",
    label: "KOEO noin 0 kPa",
    source: "Lexus/Toyota GSIC RM0150 · P1426",
    note: "Lähde antaa nollatasoksi noin 0 kPa, mutta Flex ei keksi numeerista hyväksymistoleranssia."
  },
  injectionFeedback1: {
    kind: "absolute-two-stage",
    context: "warm-idle-candidate",
    typicalAbsolute: INJECTOR_TEST_LIMITS.typicalAbsoluteMm3,
    serviceAbsolute: INJECTOR_TEST_LIMITS.serviceAbsoluteMm3,
    unit: "mm³",
    label: `tavallinen ±${INJECTOR_TEST_LIMITS.typicalAbsoluteMm3.toFixed(1)} · huoltoraja ±${INJECTOR_TEST_LIMITS.serviceAbsoluteMm3.toFixed(1)} mm³`,
    source: "Lexus-korjaamokäsikirjan Data List / injector-test",
    note: "Suutinkorjaus arvioidaan lämpimällä vakaalla tyhjäkäynnillä."
  },
  injectionFeedback2: { alias: "injectionFeedback1" },
  injectionFeedback3: { alias: "injectionFeedback1" },
  injectionFeedback4: { alias: "injectionFeedback1" }
});

export function inferIs220dLiveContext(values = {}) {
  const rpm = Number.isFinite(Number(values.rpm)) ? Number(values.rpm) : null;
  const coolant = Number.isFinite(Number(values.coolant)) ? Number(values.coolant) : null;
  const speed = Number.isFinite(Number(values.speed)) ? Number(values.speed) : null;
  const running = rpm !== null && rpm >= 400;
  const keyOn = rpm !== null && rpm < 80;
  const stationary = speed !== null ? speed <= 3 : false;
  const warm = coolant !== null && coolant >= INJECTOR_TEST_LIMITS.minimumCoolantC;
  const idleCandidate = running && stationary && warm && rpm >= 500 && rpm <= 1600;
  return freeze({ rpm, coolant, speed, running, keyOn, stationary, warm, idleCandidate });
}

function resolveReference(metricId) {
  const raw = IS220D_LIVE_REFERENCES[metricId];
  if (!raw) return null;
  return raw.alias ? IS220D_LIVE_REFERENCES[raw.alias] : raw;
}

function contextApplies(reference, context) {
  if (!reference?.context) return true;
  if (reference.context === "running") return context.running;
  if (reference.context === "key-on") return context.keyOn;
  if (reference.context === "warm-idle-candidate") return context.idleCandidate;
  return false;
}

export function evaluateIs220dLiveReference(metricId, value, contextValues = {}) {
  const reference = resolveReference(metricId);
  const numeric = Number(value);
  if (!reference || !Number.isFinite(numeric)) return null;
  const context = inferIs220dLiveContext(contextValues);
  const applicable = contextApplies(reference, context);
  const base = { metricId, reference, applicable, context };

  if (!applicable) {
    const condition = reference.context === "warm-idle-candidate"
      ? "Vertailu vaatii lämpimän tyhjäkäynnin ja ajonopeuden 0 km/h."
      : reference.context === "running"
        ? "Vertailu tehdään moottorin käydessä."
        : reference.context === "key-on"
          ? "Vertailu tehdään KOEO-tilassa: virrat päällä, moottori sammuksissa."
          : "Vertailuehto ei täyty.";
    return freeze({ ...base, status: "not-applicable", label: "Ei verrata tässä tilassa", detail: condition });
  }

  if (reference.kind === "range" || reference.kind === "guide-range") {
    const within = numeric >= reference.min && numeric <= reference.max;
    return freeze({
      ...base,
      status: within ? "within" : "outside",
      label: within ? "Viitealueella" : "Viitealueen ulkopuolella",
      detail: `Viite ${reference.label}`
    });
  }

  if (reference.kind === "minimum-condition") {
    const within = numeric >= reference.min;
    return freeze({
      ...base,
      status: within ? "within" : "condition-not-met",
      label: within ? "Lämmin" : "Ei vielä lämmin",
      detail: `Vertailuehto ${reference.label}`
    });
  }

  if (reference.kind === "target-without-tolerance") {
    return freeze({
      ...base,
      status: "reference-only",
      label: reference.label,
      detail: "Ei automaattista hyväksyntärajaa"
    });
  }

  if (reference.kind === "absolute-two-stage") {
    const absolute = Math.abs(numeric);
    const status = absolute <= reference.typicalAbsolute
      ? "within"
      : absolute <= reference.serviceAbsolute
        ? "attention"
        : "outside";
    const label = status === "within"
      ? "Tavanomaisella alueella"
      : status === "attention"
        ? "Tavanomaisen alueen yli"
        : "Huoltorajan yli";
    return freeze({ ...base, status, label, detail: `Viite ${reference.label}` });
  }

  return freeze({ ...base, status: "reference-only", label: reference.label, detail: reference.note || "" });
}

export function referenceForIs220dMetric(metricId) {
  return resolveReference(metricId);
}
