// Shared by both guided tests. Values come from the existing decoded live state
// or from an injected, production-approved dedicated capture callback. This
// module never sends vehicle commands by itself.
export const DPNR_TEST_MAX_AGE_MS = 2500;
export const DPNR_TEST_START_TIMEOUT_MS = 45000;
let runtime = null;
let capturing = false;

export function configureDpnrTestLive(adapter) { runtime = adapter; }

export function isFreshDpnrTestSample(sample, now = Date.now()) {
  return Boolean(sample && Number.isFinite(sample.pressureKpa) &&
    Number.isFinite(sample.timestamp) && sample.timestamp <= now &&
    now - sample.timestamp <= DPNR_TEST_MAX_AGE_MS &&
    /617E/.test(String(sample.raw217e || "").replace(/\s/g, "").toUpperCase()));
}

function rpmIsFresh(sample, now) {
  return Number.isFinite(sample?.rpm) &&
    Number.isFinite(sample?.rpmUpdatedAt) && sample.rpmUpdatedAt <= now &&
    now - sample.rpmUpdatedAt <= DPNR_TEST_MAX_AGE_MS;
}

function acceptsPhase(phase, sample, now) {
  if (!isFreshDpnrTestSample(sample, now)) return false;
  const rpmFresh = rpmIsFresh(sample, now);
  const rpmOptional = phase?.id === "koeo" || phase?.requireRpm === false;
  if (!rpmOptional && !rpmFresh) return false;
  if (rpmFresh && phase.rpmMin != null && sample.rpm < phase.rpmMin) return false;
  if (rpmFresh && phase.rpmMax != null && sample.rpm > phase.rpmMax) return false;
  return true;
}

function phaseMismatchIsDefinitive(phase, sample, now) {
  if (!isFreshDpnrTestSample(sample, now) || !rpmIsFresh(sample, now)) return false;
  if (phase.rpmMin != null && sample.rpm < phase.rpmMin) return true;
  if (phase.rpmMax != null && sample.rpm > phase.rpmMax) return true;
  return false;
}

async function readCandidate(adapter, phase) {
  if (typeof adapter?.capture === "function") return adapter.capture(phase);
  return adapter?.read?.();
}

export async function collectDpnrTestPhase(phase, status, {
  adapter = runtime, now = () => Date.now(),
  wait = ms => new Promise(resolve => setTimeout(resolve, ms))
} = {}) {
  if (capturing) throw new Error("Toinen DPNR-mittaus on jo käynnissä. Odota sen valmistumista.");
  if (!adapter?.available()) throw new Error("Yhdistä IS220d:n moottori-ECUun vLinker/ELM-yhteydellä ja avaa DPNR-sivu. Quicklynks-binäärikanava ei käytä tätä 217E-lukupolkua.");
  capturing = true;
  const dedicatedCapture = typeof adapter.capture === "function";
  try {
    if (typeof adapter.prepare === "function") await adapter.prepare(phase);
    if (!dedicatedCapture) {
      const started = adapter.start?.();
      if (started && typeof started.then === "function") await started;
    }

    const session = adapter.session?.();
    const active = () => adapter.available() &&
      (dedicatedCapture || adapter.running()) &&
      adapter.session?.() === session;

    status.textContent = dedicatedCapture
      ? "Luetaan tuore Toyota 217E -paine-ero suoraan ECU:lta ja varmistetaan käyttötila…"
      : "Odotetaan tuoretta Toyota 217E -paine-eroa ja käyttötilaan sopivaa RPM-arvoa…";
    status.className = "inline-message";

    const waitingAt = now();
    let first = null;
    let lastReadError = "";
    while (now() - waitingAt < DPNR_TEST_START_TIMEOUT_MS) {
      if (!active()) throw new Error("Mittaus keskeytyi: yhteys, ajoneuvo tai aktiivinen näkymä vaihtui.");
      try {
        first = await readCandidate(adapter, phase);
        lastReadError = "";
      } catch (error) {
        first = null;
        lastReadError = error?.message || String(error);
      }
      if (acceptsPhase(phase, first, now())) break;
      if (phaseMismatchIsDefinitive(phase, first, now())) {
        throw new Error(`${phase.label}: kierrosluku ${Math.round(first.rpm)} rpm ei ole tämän mittausvaiheen alueella.`);
      }
      await wait(dedicatedCapture ? 250 : 150);
    }

    if (!acceptsPhase(phase, first, now())) {
      const detail = lastReadError ? ` Viimeinen lukuyritys: ${lastReadError}` : "";
      throw new Error(`Tuoretta 217E/617E-paine-eroa ja käyttötilaan sopivaa RPM-arvoa ei saatu 45 sekunnissa.${detail}`);
    }

    const samples = [];
    const seen = new Set();
    const startedAt = now();
    status.textContent = `${phase.label}: mittaus käynnissä…`;

    while (now() - startedAt < phase.durationMs) {
      if (!active()) throw new Error("Mittaus keskeytyi: DPNR-yhteys katkesi. Mittausta ei tallennettu.");
      let sample = null;
      try {
        sample = await readCandidate(adapter, phase);
      } catch (error) {
        lastReadError = error?.message || String(error);
        await wait(dedicatedCapture ? 250 : 150);
        continue;
      }

      if (phaseMismatchIsDefinitive(phase, sample, now())) {
        throw new Error(`Mittaus keskeytyi: kierrosluku ${Math.round(sample.rpm)} rpm poistui mittausalueelta.`);
      }
      if (acceptsPhase(phase, sample, now()) && !seen.has(sample.timestamp)) {
        samples.push({ ...sample });
        seen.add(sample.timestamp);
      }
      await wait(dedicatedCapture ? 250 : 150);
    }

    if (!active()) throw new Error("Mittaus keskeytyi ennen valmistumista. Mittausta ei tallennettu.");
    if (samples.length < 2) {
      const detail = lastReadError ? ` Viimeinen lukuyritys: ${lastReadError}` : "";
      throw new Error(`Uusia 217E/617E-näytteitä ei saatu riittävästi. Mittausta ei tallennettu.${detail}`);
    }
    return samples;
  } finally {
    try { await adapter?.finish?.(phase); } catch {}
    capturing = false;
  }
}
