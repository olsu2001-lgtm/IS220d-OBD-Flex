function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function scopeLabel(scope) {
  return scope === "this-drive-cycle" ? "Tämä ajosykli" : "DTC-poiston jälkeen";
}

function statusLabel(snapshot) {
  if (!snapshot?.sinceClear) return "EI SAATAVILLA";
  return snapshot.overall === "ready" ? "VALMIS" : "EI VALMIS";
}

export function buildImReadinessUiModel(snapshot) {
  const sinceClear = snapshot?.sinceClear || null;
  const driveCycle = snapshot?.driveCycle || null;
  return Object.freeze({
    applicable: Boolean(sinceClear),
    overall: snapshot?.overall || "unavailable",
    statusLabel: statusLabel(snapshot),
    ignitionLabel: sinceClear?.ignitionType === "compression" ? "Diesel / puristussytytys" : sinceClear ? "Kipinäsytytys" : "–",
    warmupsSinceClear: snapshot?.warmupsSinceClear ?? null,
    distanceSinceClearKm: snapshot?.distanceSinceClearKm ?? null,
    scopes: Object.freeze([sinceClear, driveCycle].filter(Boolean).map(scope => Object.freeze({
      scope: scope.scope,
      label: scopeLabel(scope.scope),
      supportedCount: scope.supportedCount,
      completeCount: scope.completeCount,
      incompleteCount: scope.incompleteCount,
      monitors: Object.freeze(scope.monitors.map(monitor => Object.freeze({
        id: monitor.id,
        label: monitor.label,
        complete: monitor.complete
      })))
    })))
  });
}

function buildScopeHtml(scope) {
  const monitors = scope.monitors.length
    ? scope.monitors.map(monitor => `<li class="im-monitor ${monitor.complete ? "ready" : "not-ready"}"><span>${escapeHtml(monitor.label)}</span><strong>${monitor.complete ? "VALMIS" : "EI VALMIS"}</strong></li>`).join("")
    : '<li class="im-monitor empty"><span>ECU ei ilmoittanut tuettuja monitoreita</span></li>';
  return `<section class="im-scope">
    <div class="im-scope-head"><strong>${escapeHtml(scope.label)}</strong><span>${scope.completeCount}/${scope.supportedCount} valmiina</span></div>
    <ul class="im-monitor-list">${monitors}</ul>
  </section>`;
}

export function buildImReadinessUiHtml(model) {
  if (!model?.applicable) {
    return '<div class="im-readiness-empty">I/M readiness -tietoa ei saatu ECU:lta.</div>';
  }
  const resetContext = [
    model.warmupsSinceClear == null ? null : `Lämmityskerrat ${model.warmupsSinceClear}`,
    model.distanceSinceClearKm == null ? null : `Matka ${model.distanceSinceClearKm} km`
  ].filter(Boolean).join(" · ");
  return `<div class="im-readiness-summary ${escapeHtml(model.overall)}">
    <div><span>I/M READINESS</span><strong>${escapeHtml(model.statusLabel)}</strong></div>
    <div><span>Moottorityyppi</span><strong>${escapeHtml(model.ignitionLabel)}</strong></div>
  </div>
  ${resetContext ? `<div class="im-reset-context">DTC-/readiness-nollauksen jälkeen: ${escapeHtml(resetContext)}</div>` : ""}
  <div class="im-scopes">${model.scopes.map(buildScopeHtml).join("")}</div>
  <p class="hint">“EI VALMIS” tarkoittaa, ettei kyseinen päästömonitori ole vielä suorittanut valvontajaksoaan. Se ei yksin tarkoita komponenttivikaa.</p>`;
}

function ensureStyles() {
  if (typeof document === "undefined" || document.querySelector("#im-readiness-styles")) return;
  const style = document.createElement("style");
  style.id = "im-readiness-styles";
  style.textContent = `
    .im-readiness-card { margin-top:10px; }
    .im-readiness-summary { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    .im-readiness-summary > div { padding:10px; border:1px solid var(--line); border-radius:10px; background:var(--surface-inset); }
    .im-readiness-summary span { display:block; color:var(--muted); font-size:8px; font-weight:800; }
    .im-readiness-summary strong { display:block; margin-top:4px; font-size:12px; }
    .im-readiness-summary.ready > div:first-child { border-color:var(--success-border); }
    .im-readiness-summary.not-ready > div:first-child { border-color:var(--warning-border); }
    .im-reset-context { margin-top:8px; color:var(--muted); font-size:9px; }
    .im-scopes { display:grid; gap:9px; margin-top:10px; }
    .im-scope { padding:10px; border:1px solid var(--line); border-radius:11px; background:var(--surface-inset); }
    .im-scope-head { display:flex; justify-content:space-between; gap:8px; font-size:10px; }
    .im-scope-head span { color:var(--muted); }
    .im-monitor-list { display:grid; gap:5px; margin:8px 0 0; padding:0; list-style:none; }
    .im-monitor { display:flex; justify-content:space-between; gap:8px; padding:6px 7px; border-radius:8px; background:var(--surface-2); font-size:9px; }
    .im-monitor strong { font-size:8px; }
    .im-monitor.ready strong { color:var(--success); }
    .im-monitor.not-ready strong { color:var(--warning); }
    .im-readiness-empty { color:var(--muted); font-size:10px; }
  `;
  document.head.append(style);
}

function ensurePanel() {
  if (typeof document === "undefined") return null;
  let card = document.querySelector("#imReadinessCard");
  if (card) return card;
  const page = document.querySelector("#page-dtc");
  const notice = document.querySelector("#dtcNotice");
  if (!page) return null;
  ensureStyles();
  card = document.createElement("section");
  card.id = "imReadinessCard";
  card.className = "card im-readiness-card";
  card.innerHTML = '<div class="section-title compact-title"><div><div class="eyebrow">MODE 01 · PID 01 / 41 / 30 / 31</div><h3>I/M readiness</h3></div></div><div id="imReadinessContent" class="im-readiness-empty">Ei luettu</div>';
  if (notice?.parentNode) notice.parentNode.insertBefore(card, notice.nextSibling);
  else page.append(card);
  return card;
}

export function publishImReadinessToDtcUi(snapshot) {
  const model = buildImReadinessUiModel(snapshot);
  const card = ensurePanel();
  const content = card?.querySelector?.("#imReadinessContent");
  if (content) content.innerHTML = buildImReadinessUiHtml(model);
  return model;
}

ensurePanel();
