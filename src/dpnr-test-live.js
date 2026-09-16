// Shared by both guided tests. Values come from the existing decoded live state,
// never from rounded display text or a frozen "ms old" label. No transport here.
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

function acceptsPhase(phase, sample, now) {
  return isFreshDpnrTestSample(sample, now) && Number.isFinite(sample.rpm) &&
    Number.isFinite(sample.rpmUpdatedAt) && sample.rpmUpdatedAt <= now &&
    now - sample.rpmUpdatedAt <= DPNR_TEST_MAX_AGE_MS &&
    (phase.rpmMin == null || sample.rpm >= phase.rpmMin) &&
    (phase.rpmMax == null || sample.rpm <= phase.rpmMax);
}

export async function collectDpnrTestPhase(phase, status, {
  adapter = runtime, now = () => Date.now(),
  wait = ms => new Promise(resolve => setTimeout(resolve, ms))
} = {}) {
  if (capturing) throw new Error("Toinen DPNR-mittaus on jo käynnissä. Odota sen valmistumista.");
  if (!adapter?.available()) throw new Error("Yhdistä IS220d:n moottori-ECUun vLinker/ELM-yhteydellä ja avaa DPNR-sivu. Quicklynks-binäärikanava ei käytä tätä 217E-lukupolkua.");
  capturing = true;
  try {
    // start() is idempotent and delegates to the already approved live reader.
    adapter.start();
    const session = adapter.session?.();
    const active = () => adapter.available() && adapter.running() && adapter.session?.() === session;
    status.textContent = "Odotetaan tuoretta Toyota 217E -paine-eroa ja käyttötilaan sopivaa RPM-arvoa…";
    status.className = "inline-message";
    const waitingAt = now();
    let first;
    while (now() - waitingAt < DPNR_TEST_START_TIMEOUT_MS) {
      if (!active()) throw new Error("Mittaus keskeytyi: live-luku, yhteys, ajoneuvo tai aktiivinen näkymä vaihtui.");
      first = adapter.read();
      if (acceptsPhase(phase, first, now())) break;
      await wait(150);
    }
    if (!acceptsPhase(phase, first, now())) throw new Error("Tuoretta 217E-paine-eroa ja käyttötilaan sopivaa RPM-arvoa ei saatu 45 sekunnissa. Tarkista DPNR-live, raakavaste ja moottorin tila.");
    const samples = [];
    const seen = new Set();
    const startedAt = now();
    status.textContent = `${phase.label}: mittaus käynnissä…`;
    while (now() - startedAt < phase.durationMs) {
      if (!active()) throw new Error("Mittaus keskeytyi: DPNR-live tai yhteys katkesi. Mittausta ei tallennettu.");
      const sample = adapter.read();
      if (!acceptsPhase(phase, sample, now())) throw new Error("Mittaus keskeytyi: paine-ero/RPM vanheni tai kierrosluku poistui mittausalueelta. Yritä uudelleen vakaassa käyttötilassa.");
      if (!seen.has(sample.timestamp)) {
        samples.push({ ...sample });
        seen.add(sample.timestamp);
      }
      await wait(150);
    }
    if (!active() || !acceptsPhase(phase, adapter.read(), now())) {
      throw new Error("Mittaus keskeytyi ennen valmistumista. Mittausta ei tallennettu.");
    }
    // A repeated screen value is not multiple ECU samples.
    if (samples.length < 2) throw new Error("Uusia 217E-näytteitä ei saatu riittävästi. Mittausta ei tallennettu.");
    return samples;
  } finally { capturing = false; }
}
