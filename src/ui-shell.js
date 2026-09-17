const UI_STYLE_ID = "flex-ios-health-ui";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("data-")) node.setAttribute(key, value);
    else node[key] = value;
  }
  for (const child of [].concat(children)) node.append(child);
  return node;
}

const TEST_LINKS = [
  ["dtc", "Vikakoodit", "MODE 03 / 07 / 0A", "exclamationmark.triangle"],
  ["injector-test", "Suuttimet", "45 s tasapainotesti", "injector"],
  ["dpnr", "DPNR", "Paine, lämpötilat ja regenerointi", "filter"],
  ["drive", "Koeajo", "Tallenna diagnostiikkadata", "road"],
  ["power", "Tehotesti", "GPS-pohjainen mittaus", "speedometer"],
  ["ct-test", "CT 200h ostotesti", "Hybridijärjestelmän tarkistus", "battery"]
];

const MORE_LINKS = [
  ["connection", "Yhteys ja ajoneuvo", "Adapteri, protokolla ja ECU"],
  ["sessions", "Tallennetut ajot", "Raportit ja aiemmat mittaukset"],
  ["component-diagnostics", "Komponenttidiagnostiikka", "BOM ja tarkastuskohteet"],
  ["terminal", "Raakaterminaali", "Asiantuntijatyökalut"]
];

function linkRow(page, title, subtitle) {
  const button = el("button", { class: "ios-list-row", type: "button" });
  button.dataset.go = page;
  button.append(
    el("span", { class: "ios-list-copy" }, [el("strong", { text: title }), el("small", { text: subtitle })]),
    el("span", { class: "ios-chevron", text: "›" })
  );
  return button;
}

function healthRow(id, title, subtitle) {
  const row = el("button", { class: "health-row", type: "button" });
  row.dataset.healthId = id;
  row.append(
    el("span", { class: "health-symbol", text: "•" }),
    el("span", { class: "ios-list-copy" }, [el("strong", { text: title }), el("small", { text: subtitle })]),
    el("span", { class: "health-state", text: "Ei tarkistettu" }),
    el("span", { class: "ios-chevron", text: "›" })
  );
  return row;
}

function buildStatusPage() {
  const section = el("section", { id: "page-status", class: "page ios-root-page active" });
  const title = el("div", { class: "ios-large-title" }, [
    el("div", { class: "eyebrow", text: "LEXUS HEALTH CHECK" }),
    el("h2", { text: "Tila" }),
    el("p", { id: "healthVehicleLine", text: "Ajoneuvoa ei ole yhdistetty" })
  ]);
  const hero = el("div", { class: "health-hero health-idle" }, [
    el("div", { class: "health-hero-orb", text: "L" }),
    el("div", { class: "health-hero-copy" }, [
      el("span", { text: "AJONEUVON TILA" }),
      el("strong", { id: "healthHeadline", text: "Yhdistä autoon" }),
      el("small", { id: "healthSubline", text: "Health Check muodostuu vain mitatusta diagnostiikkatiedosta." })
    ])
  ]);
  const actions = el("div", { class: "ios-action-grid" }, [
    linkRow("connection", "Yhdistä", "OBD-adapteri"),
    linkRow("live", "Live-data", "Reaaliaikaiset arvot")
  ]);
  const systems = el("div", { class: "ios-group" }, [
    el("div", { class: "ios-group-title", text: "Järjestelmät" }),
    healthRow("engine", "Moottori / OBD", "ECU-yhteys ja vikakoodit"),
    healthRow("air", "Ilma, ahto ja EGR", "MAF, MAP ja EGR-arvot"),
    healthRow("fuel", "Polttoaine ja suuttimet", "Rail-paine ja suutintiedot"),
    healthRow("dpnr", "DPNR / pakokaasut", "Paine, lämpötila ja regenerointi"),
    healthRow("electrical", "Sähköjärjestelmä", "Jännite ja lataus"),
    healthRow("coverage", "Diagnostiikan kattavuus", "Saatavilla oleva ECU-data")
  ]);
  section.append(title, hero, actions, systems);
  return section;
}

function buildHub(id, eyebrow, title, links) {
  const section = el("section", { id: `page-${id}`, class: "page ios-root-page" });
  section.append(el("div", { class: "ios-large-title" }, [el("div", { class: "eyebrow", text: eyebrow }), el("h2", { text: title })]));
  const group = el("div", { class: "ios-group ios-hub-list" });
  links.forEach(([page, name, sub]) => group.append(linkRow(page, name, sub)));
  section.append(group);
  return section;
}

function installPages() {
  const main = document.querySelector("main");
  if (!main || document.querySelector("#page-status")) return;
  document.querySelectorAll("main > .page").forEach(page => page.classList.remove("active"));
  main.prepend(buildStatusPage());
  main.append(buildHub("tests", "OHJATUT DIAGNOSTIIKAT", "Testit", TEST_LINKS));
  main.append(buildHub("more", "ASETUKSET JA TYÖKALUT", "Lisää", MORE_LINKS));
}

function installNavigation() {
  const old = document.querySelector(".bottom-nav");
  if (!old || document.querySelector(".ios-tabbar")) return;
  old.classList.add("legacy-nav");
  const nav = el("nav", { class: "ios-tabbar", ariaLabel: "Päänavigaatio" });
  [["status","Tila","●"],["live","Live","⌁"],["tests","Testit","✓"],["more","Lisää","•••"]].forEach(([page,label,icon]) => {
    const button = el("button", { class: `ios-tab ${page === "status" ? "active" : ""}`, type: "button" });
    button.dataset.iosPage = page;
    button.append(el("span", { class: "ios-tab-icon", text: icon }), el("span", { text: label }));
    nav.append(button);
  });
  old.after(nav);
}

function showPage(page) {
  const target = document.querySelector(`#page-${page}`);
  if (!target) return false;
  document.querySelectorAll("main > .page").forEach(p => p.classList.toggle("active", p === target));
  document.querySelectorAll(".ios-tab").forEach(tab => {
    const direct = tab.dataset.iosPage === page;
    const tests = tab.dataset.iosPage === "tests" && TEST_LINKS.some(([p]) => p === page);
    const more = tab.dataset.iosPage === "more" && MORE_LINKS.some(([p]) => p === page);
    tab.classList.toggle("active", direct || tests || more);
  });
  window.scrollTo({ top: 0, behavior: "instant" });
  return true;
}

function installRouting() {
  document.addEventListener("click", event => {
    const tab = event.target.closest("[data-ios-page]");
    if (tab) { event.preventDefault(); event.stopImmediatePropagation(); showPage(tab.dataset.iosPage); return; }
    const link = event.target.closest("#page-status [data-go], #page-tests [data-go], #page-more [data-go]");
    if (link && showPage(link.dataset.go)) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
}

function status(row, kind, label, subtitle) {
  if (!row) return;
  row.dataset.state = kind;
  row.querySelector(".health-state").textContent = label;
  if (subtitle) row.querySelector("small").textContent = subtitle;
}

function finiteText(selector) {
  const text = document.querySelector(selector)?.textContent?.trim();
  if (!text || text === "–" || /ei luettu|ei testattu/i.test(text)) return null;
  const value = Number(String(text).replace(",", ".").match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(value) ? value : null;
}

function syncHealth() {
  const connected = document.querySelector("#connectionBadge")?.classList.contains("online");
  const ecu = document.querySelector("#stageEcu")?.classList.contains("connected");
  const vehicle = document.querySelector("#vehicleIdentity")?.textContent?.trim();
  const headline = document.querySelector("#healthHeadline");
  const subline = document.querySelector("#healthSubline");
  const hero = document.querySelector(".health-hero");
  const vehicleLine = document.querySelector("#healthVehicleLine");
  if (vehicleLine) vehicleLine.textContent = connected ? (vehicle || "Lexus · OBD yhdistetty") : "Ajoneuvoa ei ole yhdistetty";

  const rows = Object.fromEntries([...document.querySelectorAll("[data-health-id]")].map(r => [r.dataset.healthId, r]));
  if (!connected) {
    Object.values(rows).forEach(r => status(r, "idle", "Ei tarkistettu"));
    if (headline) headline.textContent = "Yhdistä autoon";
    if (subline) subline.textContent = "Health Check muodostuu vain mitatusta diagnostiikkatiedosta.";
    if (hero) hero.className = "health-hero health-idle";
    return;
  }

  status(rows.engine, ecu ? "ok" : "attention", ecu ? "ECU vastaa" : "Tarkista yhteys");
  const maf = finiteText('[data-metric-id="maf"] strong, #metric-maf strong');
  const map = finiteText('[data-metric-id="map"] strong, #metric-map strong');
  status(rows.air, maf !== null || map !== null ? "ok" : "unavailable", maf !== null || map !== null ? "Dataa saatavilla" : "Ei mittausdataa");
  const rail = finiteText('[data-metric-id="fuelRailPressure"] strong, [data-metric-id="railPressure"] strong');
  status(rows.fuel, rail !== null ? "ok" : "unavailable", rail !== null ? "Rail-data saatavilla" : "Ei mittausdataa");
  const dp = finiteText("#dpnrDifferentialPressure, [data-metric-id=\"dpnrDifferentialPressure\"] strong");
  status(rows.dpnr, dp !== null ? "ok" : "unavailable", dp !== null ? "DPNR-data saatavilla" : "Ei DPNR-dataa");
  const volts = finiteText('[data-metric-id="controlModuleVoltage"] strong, [data-metric-id="voltage"] strong, #dpnrVoltage');
  status(rows.electrical, volts !== null ? "ok" : "unavailable", volts !== null ? `${String(volts).replace(".", ",")} V` : "Ei jännitedataa");
  const available = [maf, map, rail, dp, volts].filter(v => v !== null).length;
  status(rows.coverage, available >= 3 ? "ok" : "attention", available ? `${available}/5 ydinarvoa näkyvissä` : "Aja Live tai testi");

  const stored = document.querySelector("#storedDtc")?.textContent || "";
  const pending = document.querySelector("#pendingDtc")?.textContent || "";
  const dtcFinding = !/ei luettu|ei vikakoodeja|ei koodeja/i.test(stored + pending) && /P[0-9A-F]{4}|C[0-9A-F]{4}|U[0-9A-F]{4}|B[0-9A-F]{4}/i.test(stored + pending);
  if (dtcFinding) status(rows.engine, "fault", "Vikakoodi havaittu", "Avaa Vikakoodit nähdäksesi löydöksen");
  if (headline) headline.textContent = dtcFinding ? "Tarkistettavaa löytyi" : (ecu ? "Yhteys kunnossa" : "OBD yhdistetty");
  if (subline) subline.textContent = dtcFinding ? "Health Checkissä on vahvistettu vikakoodilöydös." : "Aja Live ja ohjatut testit kattavuuden täydentämiseksi.";
  if (hero) hero.className = `health-hero ${dtcFinding ? "health-fault" : "health-ok"}`;
}

function enhanceLive() {
  const page = document.querySelector("#page-live");
  if (!page || page.dataset.iosEnhanced) return;
  page.dataset.iosEnhanced = "true";
  page.classList.add("ios-live-page");
  const grid = page.querySelector("#metricGrid");
  if (grid) {
    const heading = el("div", { class: "ios-section-heading" }, [el("strong", { text: "Kiinnitetyt arvot" }), el("small", { text: "Tuetut mittarit päivittyvät automaattisesti" })]);
    grid.before(heading);
  }
}

function installStyle() {
  if (document.getElementById(UI_STYLE_ID)) return;
  const link = document.createElement("link");
  link.id = UI_STYLE_ID;
  link.rel = "stylesheet";
  link.href = "ios-health-ui.css";
  document.head.append(link);
}

installStyle();
installPages();
installNavigation();
installRouting();
enhanceLive();
new MutationObserver(() => syncHealth()).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class"] });
setInterval(syncHealth, 1500);
queueMicrotask(syncHealth);
