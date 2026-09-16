import {
  IS220D_VIKADIAG_OBD_TEST_CATALOG,
  VIKADIAG_TEST_READINESS
} from "./is220d-vikadiag-obd-test-catalog.js";
import { getIs220dDiagnosticSignal } from "./is220d-diagnostic-signals.js";
import { buildIs220dObdDiagnosticVisualHtml } from "./is220d-obd-diagnostic-visuals.js";
import { publishIs220dDiagnosticTestLab } from "./diagnostic-test-lab-ui.js";

const CURRENT_OBD_READINESS = new Set([
  VIKADIAG_TEST_READINESS.IMPLEMENTED_DEDICATED,
  VIKADIAG_TEST_READINESS.READY_EXISTING_SIGNALS,
  VIKADIAG_TEST_READINESS.INDIRECT_EXISTING_SIGNALS
]);

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function isCurrentObdDiagnosticCandidate(candidate) {
  return Boolean(
    candidate &&
    candidate.obdRole !== "physical-only" &&
    CURRENT_OBD_READINESS.has(candidate.readiness) &&
    Array.isArray(candidate.signalKeys) &&
    candidate.signalKeys.length > 0
  );
}

export function getCurrentObdDiagnosticCandidates(catalog = IS220D_VIKADIAG_OBD_TEST_CATALOG) {
  return catalog.filter(isCurrentObdDiagnosticCandidate);
}

function readinessLabel(candidate) {
  if (candidate.readiness === VIKADIAG_TEST_READINESS.IMPLEMENTED_DEDICATED) return "Ohjattu testi käytössä";
  if (candidate.obdRole === "direct") return "Suora OBD-lukema";
  return "Epäsuora OBD-seulonta";
}

function signalLabel(key) {
  const signal = getIs220dDiagnosticSignal(key);
  return signal ? `${signal.label}${signal.unit ? ` (${signal.unit})` : ""}` : key;
}

export function buildVikadiagObdDiagnosticCatalogHtml(catalog = IS220D_VIKADIAG_OBD_TEST_CATALOG) {
  const candidates = getCurrentObdDiagnosticCandidates(catalog);
  const grouped = new Map();
  for (const candidate of candidates) {
    const group = candidate.diagnosticGroup || "Muut";
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(candidate);
  }

  const groupsHtml = [...grouped.entries()].map(([group, items]) => `
    <section class="vikadiag-obd-group">
      <h3>${escapeHtml(group)}</h3>
      ${items.map(candidate => `
        <article class="card vikadiag-obd-card" data-vikadiag-row="${candidate.sourceRow}" data-component-id="${escapeHtml(candidate.componentId)}">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <h4 style="margin:0">${escapeHtml(candidate.label)}</h4>
            <span class="badge">${escapeHtml(readinessLabel(candidate))}</span>
            <small>Drive-rivi ${candidate.sourceRow}</small>
          </div>
          <p><strong>PNC:</strong> ${escapeHtml(candidate.pnc)} · <strong>OE:</strong> ${escapeHtml(candidate.oe)}</p>
          ${buildIs220dObdDiagnosticVisualHtml(candidate.componentId)}
          <p><strong>OBD-tarkistus:</strong> ${escapeHtml(candidate.testMethod)}</p>
          <p><strong>Odotettu käyttäytyminen:</strong> ${escapeHtml(candidate.expectedPattern)}</p>
          <p><strong>Luettavat arvot:</strong> ${candidate.signalKeys.map(key => escapeHtml(signalLabel(key))).join(" · ")}</p>
          ${candidate.physicalFollowUp ? `<p><strong>Varmistus autosta:</strong> ${escapeHtml(candidate.physicalFollowUp)}</p>` : ""}
          ${candidate.limitations?.length ? `<details><summary>Rajaukset</summary><ul>${candidate.limitations.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></details>` : ""}
        </article>`).join("")}
    </section>`).join("");

  return `<section id="vikadiagObdDiagnostics" class="card" style="margin-top:16px">
    <h2>OBD-diagnostiikkakohteet</h2>
    <p>Näissä kohteissa Flexillä on jo tuotantokäyttöön hyväksytty luettava OBD-signaali. Suora mittaus ja epäsuora järjestelmäseulonta on eroteltu toisistaan. Korjaamo-opaskuvat ovat alkuperäisiä RM0150-kuvia.</p>
    <p><strong>${candidates.length} kohdetta</strong> · vain lukutoiminnot · ei Active Testiä, pakotettua regenerointia, vikakoodien nollausta tai ECU-kirjoituksia.</p>
    ${groupsHtml}
  </section>`;
}

export function publishVikadiagObdDiagnosticCatalog() {
  if (typeof document === "undefined" || typeof document.querySelector !== "function") return false;
  const page = document.querySelector("#page-component-diagnostics");
  if (!page) return false;
  const existing = document.querySelector("#vikadiagObdDiagnostics");
  if (existing) existing.remove();
  const host = document.createElement("div");
  host.innerHTML = buildVikadiagObdDiagnosticCatalogHtml();
  const section = host.firstElementChild;
  if (!section) return false;
  const overview = page.querySelector("#bomGroupOverview");
  if (overview?.parentNode) overview.parentNode.insertBefore(section, overview.nextSibling);
  else page.appendChild(section);
  publishIs220dDiagnosticTestLab();
  return true;
}
