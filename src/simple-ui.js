const $ = selector => document.querySelector(selector);

function wrapAdvanced(nodes, title) {
  const existing = nodes.find(node => node?.closest?.("details.simple-advanced"));
  if (existing) return existing.closest("details.simple-advanced");
  const valid = nodes.filter(Boolean);
  if (!valid.length) return null;
  const details = document.createElement("details");
  details.className = "card simple-advanced";
  const summary = document.createElement("summary");
  summary.innerHTML = `<span><strong>${title}</strong><small>Tarvittaessa</small></span>`;
  details.append(summary);
  valid[0].parentNode.insertBefore(details, valid[0]);
  for (const node of valid) details.append(node);
  return details;
}

function previousLabel(control) {
  if (!control?.id) return null;
  return document.querySelector(`label[for="${control.id}"]`);
}

function simplifyConnectionPage() {
  const page = $("#page-connection");
  if (!page || page.dataset.simpleUi === "1") return;
  page.dataset.simpleUi = "1";

  const hero = page.querySelector(".hero-card");
  if (hero) {
    hero.querySelector("h2").textContent = "Yhdistä autoon";
    const text = hero.querySelector("p");
    if (text) text.textContent = "Valitse OBD-lukija ja paina Yhdistä. Auto ja protokolla tunnistetaan automaattisesti.";
  }

  const card = $("#deviceSelect")?.closest(".card");
  if (card) {
    card.classList.add("simple-connect-card");
    const vehicle = $("#vehicleSelect");
    const protocol = $("#protocolSelect");
    const detect = $("#detectVehicleButton");
    const vehicleDetection = $("#vehicleDetection");
    const bleCopy = $("#copyBleDiagnostics");
    const bleDiagnostic = $("#bleDiagnostic");
    const advanced = document.createElement("details");
    advanced.className = "simple-inline-advanced";
    advanced.innerHTML = '<summary>Yhteyden lisäasetukset</summary><div class="simple-inline-advanced-body"></div>';
    const body = advanced.lastElementChild;
    for (const node of [previousLabel(vehicle), vehicle, vehicle?.nextElementSibling?.classList?.contains("hint") ? vehicle.nextElementSibling : null, vehicleDetection, detect, previousLabel(protocol), protocol, bleDiagnostic, bleCopy]) {
      if (node && !body.contains(node)) body.append(node);
    }
    const stages = $("#connectionStages");
    if (stages) card.insertBefore(advanced, stages);

    const connect = $("#connectButton");
    if (connect) connect.textContent = "Yhdistä autoon";
  }

  const theme = page.querySelector(".theme-card");
  const identity = $("#adapterIdentity")?.closest(".card");
  const checklist = page.querySelector(".checklist");
  wrapAdvanced([theme, identity, checklist], "Asetukset ja yhteystiedot");

  const elm = $("#elmDiagnosticCard");
  const quick = $("#quicklynksDiagnosticCard");
  const trace = $("#obdPlusTraceCard");
  wrapAdvanced([elm, quick, trace], "Kehittäjä- ja tutkimustyökalut");
}

function simplifyNavigation() {
  const nav = document.querySelector(".bottom-nav");
  if (!nav || nav.dataset.simpleUi === "1") return;
  nav.dataset.simpleUi = "1";
  const secondaryIds = ["nav-injector-test", "nav-dpnr", "nav-power", "nav-sessions", "nav-terminal"];
  for (const id of secondaryIds) $("#" + id)?.classList.add("simple-secondary-nav");

  const more = document.createElement("button");
  more.id = "nav-more";
  more.className = "nav-item";
  more.type = "button";
  more.innerHTML = "<span>•••</span>Lisää";
  nav.append(more);

  const sheet = document.createElement("div");
  sheet.id = "simpleMoreSheet";
  sheet.className = "simple-more-sheet hidden";
  sheet.innerHTML = `<button class="simple-sheet-backdrop" type="button" aria-label="Sulje"></button><div class="simple-sheet-panel"><div class="simple-sheet-head"><strong>Lisää toimintoja</strong><button id="simpleMoreClose" class="secondary compact" type="button">Sulje</button></div><div id="simpleMoreActions" class="simple-more-actions"></div></div>`;
  document.body.append(sheet);
  const actions = $("#simpleMoreActions");
  for (const id of secondaryIds) {
    const original = $("#" + id);
    if (!original) continue;
    const clone = document.createElement("button");
    clone.type = "button";
    clone.className = "secondary full simple-more-action";
    clone.dataset.targetNav = id;
    clone.textContent = original.textContent.trim();
    actions.append(clone);
  }
  const toggle = show => sheet.classList.toggle("hidden", !show);
  more.addEventListener("click", () => toggle(true));
  $("#simpleMoreClose")?.addEventListener("click", () => toggle(false));
  sheet.querySelector(".simple-sheet-backdrop")?.addEventListener("click", () => toggle(false));
  actions.addEventListener("click", event => {
    const button = event.target.closest("[data-target-nav]");
    if (!button) return;
    toggle(false);
    $("#" + button.dataset.targetNav)?.click();
  });
}

function addStyles() {
  if ($("#simple-ui-styles")) return;
  const style = document.createElement("style");
  style.id = "simple-ui-styles";
  style.textContent = `
    .simple-connect-card > label[for="deviceSelect"] { font-size:12px; color:var(--text-strong); }
    .simple-connect-card #deviceHelp { margin-bottom:10px; }
    .simple-inline-advanced { margin:8px 0 14px; border-top:1px solid var(--line-soft); border-bottom:1px solid var(--line-soft); }
    .simple-inline-advanced > summary { min-height:44px; padding:12px 2px; cursor:pointer; color:var(--muted); font-size:12px; font-weight:800; list-style:none; }
    .simple-inline-advanced > summary::-webkit-details-marker { display:none; }
    .simple-inline-advanced > summary::after { content:"⌄"; float:right; }
    .simple-inline-advanced[open] > summary::after { transform:rotate(180deg); }
    .simple-inline-advanced-body { padding:4px 0 2px; }
    .simple-advanced { padding:0; overflow:hidden; }
    .simple-advanced > summary { display:flex; min-height:58px; align-items:center; padding:14px 16px; cursor:pointer; list-style:none; }
    .simple-advanced > summary::-webkit-details-marker { display:none; }
    .simple-advanced > summary::after { content:"⌄"; margin-left:auto; color:var(--muted); font-size:18px; }
    .simple-advanced[open] > summary::after { transform:rotate(180deg); }
    .simple-advanced > summary span { display:grid; gap:2px; }
    .simple-advanced > summary small { color:var(--muted); font-size:10px; font-weight:600; }
    .simple-advanced > .card, .simple-advanced > details.card { margin:0; border:0; border-top:1px solid var(--line-soft); border-radius:0; box-shadow:none; }
    .bottom-nav .simple-secondary-nav { display:none !important; }
    .simple-more-sheet { position:fixed; z-index:80; inset:0; display:grid; align-items:end; }
    .simple-sheet-backdrop { position:absolute; inset:0; width:100%; height:100%; border:0; border-radius:0; background:var(--overlay); }
    .simple-sheet-panel { position:relative; z-index:1; max-height:78vh; padding:16px 14px calc(16px + env(safe-area-inset-bottom)); overflow:auto; border:1px solid var(--line); border-radius:20px 20px 0 0; background:var(--surface); }
    .simple-sheet-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }
    .simple-sheet-head strong { font-size:18px; }
    .simple-more-actions { display:grid; gap:9px; }
    .simple-more-action { min-height:52px; text-align:left; }
    @media (min-width:760px) { .simple-sheet-panel { width:min(560px,100%); margin:0 auto; border-radius:20px 20px 0 0; } }
  `;
  document.head.append(style);
}

function installSimpleUi() {
  addStyles();
  simplifyConnectionPage();
  simplifyNavigation();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installSimpleUi, { once:true });
  else installSimpleUi();
}

export { installSimpleUi };
