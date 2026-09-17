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
  ["dtc", "Vikakoodit", "MODE 03 / 07 / 0A"],
  ["injector-test", "Suuttimet", "45 s tasapainotesti", "is220d"],
  ["dpnr", "DPNR", "Paine, lämpötilat ja regenerointi", "is220d"],
  ["drive", "Koeajo", "Tallenna diagnostiikkadata"],
  ["power", "Tehotesti", "GPS-pohjainen mittaus"],
  ["ct-test", "CT 200h ostotesti", "Hybridijärjestelmän tarkistus", "ct200h"]
];

const MORE_LINKS = [
  ["connection", "Yhteys ja ajoneuvo", "Adapteri, protokolla ja ECU"],
  ["appearance", "Ulkoasu", "Teema ja näyttö"],
  ["sessions", "Tallennetut ajot", "Raportit ja aiemmat mittaukset"],
  ["component-diagnostics", "Komponenttidiagnostiikka", "BOM ja tarkastuskohteet", "is220d"],
  ["trace-tools", "BLE-jälkianalyysi", "Quicklynks / OBD Plus -asiantuntijatyökalu"],
  ["terminal", "Raakaterminaali", "Asiantuntijatyökalut"]
];

const HUB_ICONS = {
  connection: "⌁", appearance: "Aa", live: "⌁", dtc: "!", "injector-test": "INJ", dpnr: "DPF",
  drive: "●", power: "↗", "ct-test": "HV", sessions: "▤", "trace-tools":"BLE",
  "component-diagnostics": "◫", terminal: ">_"
};

const HEALTH_TARGETS = { engine:"dtc", air:"live", fuel:"live", dpnr:"dpnr", electrical:"live", coverage:"connection" };
const LIVE_CORE = [
  ["rpm", "RPM"],
  ["coolant", "Jäähdytysneste"],
  ["maf", "MAF"],
  ["boostPressure", "Ahtopaine"],
  ["railPressure", "Rail-paine"],
  ["voltage", "ECU-jännite"]
];

function iconFor(page) {
  return el("span", { class:"ios-row-icon", text:HUB_ICONS[page] || "•" });
}

function linkRow(page, title, subtitle, vehicleOnly="") {
  const button = el("button", { class:"ios-list-row", type:"button" });
  button.dataset.go = page;
  if (vehicleOnly) button.dataset.vehicleOnly = vehicleOnly;
  button.setAttribute("aria-label", `${title}. ${subtitle}`);
  button.append(
    iconFor(page),
    el("span", { class:"ios-list-copy" }, [el("strong", { text:title }), el("small", { text:subtitle })]),
    el("span", { class:"ios-chevron", text:"›" })
  );
  return button;
}

function healthRow(id, title, subtitle) {
  const row = el("button", { class:"health-row", type:"button" });
  row.dataset.healthId = id;
  row.dataset.go = HEALTH_TARGETS[id];
  row.dataset.title = title;
  row.append(
    el("span", { class:"health-symbol", text:"•" }),
    el("span", { class:"ios-list-copy" }, [el("strong", { text:title }), el("small", { text:subtitle })]),
    el("span", { class:"health-state", text:"Ei tarkistettu" }),
    el("span", { class:"ios-chevron", text:"›" })
  );
  return row;
}

function buildStatusPage() {
  const section = el("section", { id:"page-status", class:"page ios-root-page active" });
  const orb = el("div", { class:"health-hero-orb" }, [
    el("strong", { id:"healthOrbValue", text:"–" }),
    el("small", { text:"data" })
  ]);
  const hero = el("div", { class:"health-hero health-idle" }, [
    orb,
    el("div", { class:"health-hero-copy" }, [
      el("span", { text:"AJONEUVON TILA" }),
      el("strong", { id:"healthHeadline", text:"Yhdistä autoon" }),
      el("small", { id:"healthSubline", text:"Tulos muodostuu vain ECU:lta saadusta tiedosta." }),
      el("small", { id:"healthUpdated", class:"health-updated", text:"Ei mittaustietoa" })
    ])
  ]);
  hero.setAttribute("role", "status");
  hero.setAttribute("aria-live", "polite");
  const summary = el("div", { class:"health-summary-strip" }, [
    el("div", {}, [el("span", { text:"YHTEYS" }), el("strong", { id:"healthConnectionSummary", text:"Ei yhteyttä" })]),
    el("div", {}, [el("span", { text:"LÖYDÖKSET" }), el("strong", { id:"healthFindingSummary", text:"–" })]),
    el("div", {}, [el("span", { text:"KATTAVUUS" }), el("strong", { id:"healthCoverageSummary", text:"–" })])
  ]);
  section.append(
    el("div", { class:"ios-large-title" }, [
      el("div", { class:"eyebrow", text:"LEXUS HEALTH CHECK" }),
      el("h2", { text:"Tila" }),
      el("p", { id:"healthVehicleLine", text:"Ajoneuvoa ei ole yhdistetty" })
    ]),
    hero,
    summary,
    el("div", { class:"ios-action-grid" }, [linkRow("connection","Yhdistä","OBD-adapteri"), linkRow("live","Live-data","Reaaliaikaiset arvot")]),
    el("div", { class:"ios-group" }, [
      el("div", { class:"ios-group-title", text:"Järjestelmät" }),
      healthRow("engine","Moottori / OBD","ECU-yhteys ja vikakoodit"),
      healthRow("air","Ilma, ahto ja EGR","MAF, MAP ja EGR-arvot"),
      healthRow("fuel","Polttoaine ja suuttimet","Rail-paine ja suutintiedot"),
      healthRow("dpnr","DPNR / pakokaasut","Paine, lämpötila ja regenerointi"),
      healthRow("electrical","Sähköjärjestelmä","Jännite ja lataus"),
      healthRow("coverage","Diagnostiikan kattavuus","Saatavilla oleva ECU-data")
    ])
  );
  return section;
}

function buildHub(id, eyebrow, title, links) {
  const section = el("section", { id:`page-${id}`, class:"page ios-root-page" });
  section.append(el("div", { class:"ios-large-title" }, [el("div", { class:"eyebrow", text:eyebrow }), el("h2", { text:title })]));
  const group = el("div", { class:"ios-group ios-hub-list" });
  links.forEach(args => group.append(linkRow(...args)));
  section.append(group);
  return section;
}

function buildMovedPage(id, eyebrow, title, source) {
  const section=el("section",{id:`page-${id}`,class:"page ios-root-page"});
  section.append(el("div",{class:"ios-large-title"},[el("div",{class:"eyebrow",text:eyebrow}),el("h2",{text:title})]));
  if(source){source.classList.add("ios-relocated-card");section.append(source);}
  else section.append(el("div",{class:"inline-message",text:"Työkalua ei löytynyt tästä lähteestä."}));
  return section;
}

function installPages() {
  const main=document.querySelector("main");
  if(!main||document.querySelector("#page-status")) return;
  const themeCard=document.querySelector("#page-connection .theme-card");
  const traceCard=document.querySelector("#obdPlusTraceCard");
  document.querySelectorAll("main > .page").forEach(p=>p.classList.remove("active"));
  main.prepend(buildStatusPage());
  main.append(buildHub("tests","OHJATUT DIAGNOSTIIKAT","Testit",TEST_LINKS));
  main.append(buildHub("more","ASETUKSET JA TYÖKALUT","Lisää",MORE_LINKS));
  main.append(buildMovedPage("appearance","ULKOASU","Ulkoasu",themeCard));
  main.append(buildMovedPage("trace-tools","ASIANTUNTIJATYÖKALU","BLE-jälkianalyysi",traceCard));
  document.querySelector("#page-connection")?.classList.add("ios-connection-page");
}

function installNavigation() {
  const old=document.querySelector(".bottom-nav");
  if(!old||document.querySelector(".ios-tabbar")) return;
  old.classList.add("legacy-nav");
  const nav=el("nav", { class:"ios-tabbar" });
  nav.setAttribute("aria-label","Päänavigaatio");
  [["status","Tila","●"],["live","Live","⌁"],["tests","Testit","✓"],["more","Lisää","•••"]].forEach(([page,label,icon])=>{
    const b=el("button", { class:`ios-tab ${page==="status"?"active":""}`, type:"button" });
    b.dataset.iosPage=page;
    b.setAttribute("aria-label", label);
    if(page==="status") b.setAttribute("aria-current", "page");
    b.append(el("span", { class:"ios-tab-icon", text:icon }),el("span", { text:label }));
    nav.append(b);
  });
  old.after(nav);
}

function parentHub(page) {
  if (TEST_LINKS.some(([p])=>p===page)) return "tests";
  if (MORE_LINKS.some(([p])=>p===page)) return "more";
  return "";
}

function showPage(page) {
  const target=document.querySelector(`#page-${page}`);
  if(!target) return false;
  document.querySelectorAll("main > .page").forEach(p=>p.classList.toggle("active",p===target));
  document.querySelectorAll(".ios-tab").forEach(tab=>{
    const direct=tab.dataset.iosPage===page;
    const tests=tab.dataset.iosPage==="tests"&&TEST_LINKS.some(([p])=>p===page);
    const more=tab.dataset.iosPage==="more"&&MORE_LINKS.some(([p])=>p===page);
    const active=direct||tests||more;
    tab.classList.toggle("active",active);
    if(active) tab.setAttribute("aria-current","page"); else tab.removeAttribute("aria-current");
  });
  window.scrollTo({top:0,behavior:"instant"});
  return true;
}

function installSubpageBackButtons() {
  [...TEST_LINKS, ...MORE_LINKS].forEach(([page])=>{
    const section=document.querySelector(`#page-${page}`);
    if(!section||section.querySelector(":scope > .ios-back")) return;
    const hub=parentHub(page);
    const label=hub==="tests"?"Testit":"Lisää";
    const button=el("button", { class:"ios-back", type:"button", text:`‹ ${label}` });
    button.dataset.go=hub;
    button.setAttribute("aria-label", `Takaisin: ${label}`);
    section.prepend(button);
  });
}

function installRouting() {
  document.addEventListener("click",e=>{
    const tab=e.target.closest("[data-ios-page]");
    if(tab){e.preventDefault();e.stopImmediatePropagation();showPage(tab.dataset.iosPage);return;}
    const link=e.target.closest("[data-go]");
    if(link&&showPage(link.dataset.go)){e.preventDefault();e.stopImmediatePropagation();}
  },true);
}

function status(row,kind,label,subtitle){
  if(!row)return;
  row.dataset.state=kind;
  row.querySelector(".health-state").textContent=label;
  if(subtitle)row.querySelector("small").textContent=subtitle;
  row.setAttribute("aria-label", `${row.dataset.title || "Järjestelmä"}: ${label}. ${subtitle || ""}`.trim());
}

function finiteText(selector){
  const text=document.querySelector(selector)?.textContent?.trim();
  if(!text||text==="–"||/ei luettu|ei testattu|ei tuettu|no data/i.test(text))return null;
  const value=Number(String(text).replace(",",".").match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(value)?value:null;
}

function detectedVehicleKey(){
  const identity=(document.querySelector("#vehicleIdentity")?.textContent||"").toLowerCase();
  if(identity.includes("ct 200h")||identity.includes("zwa10")) return "ct200h";
  if(identity.includes("is220d")||identity.includes("2ad-fhv")) return "is220d";
  return "";
}

function syncVehicleVisibility(){
  const key=detectedVehicleKey();
  document.querySelectorAll("#page-tests [data-vehicle-only],#page-more [data-vehicle-only]").forEach(n=>{
    n.classList.toggle("hidden", !key || n.dataset.vehicleOnly!==key);
  });
}

function dtcEvidence(){
  const ids=["storedDtc","pendingDtc","permanentDtc"];
  const texts=ids.map(id=>(document.querySelector(`#${id}`)?.textContent||"").trim());
  const read=texts.every(text=>text&&!/ei luettu/i.test(text));
  const matches=texts.join(" ").match(/\b[PCUB][0-9A-F]{4}\b/gi)||[];
  return { read, codes:[...new Set(matches.map(code=>code.toUpperCase()))] };
}

function latestMetricUpdate(){
  const times=[...document.querySelectorAll("#metricGrid .metric-time")]
    .map(node=>node.textContent?.trim()||"")
    .map(text=>text.match(/Päivitetty\s+(\d{1,2}:\d{2}(?::\d{2})?)/i)?.[1])
    .filter(Boolean);
  if(!times.length)return "";
  const score=time=>time.split(":").map(Number).reduce((sum,value,index)=>sum+value*[3600,60,1][index],0);
  return times.sort((a,b)=>score(b)-score(a))[0];
}

function syncHealth(){
  syncVehicleVisibility();
  const connected=document.querySelector("#connectionBadge")?.classList.contains("online");
  const ecu=document.querySelector("#stageEcu")?.classList.contains("connected");
  const vehicle=document.querySelector("#vehicleIdentity")?.textContent?.trim();
  const headline=document.querySelector("#healthHeadline");
  const subline=document.querySelector("#healthSubline");
  const updated=document.querySelector("#healthUpdated");
  const hero=document.querySelector(".health-hero");
  const orbValue=document.querySelector("#healthOrbValue");
  const vehicleLine=document.querySelector("#healthVehicleLine");
  const connectionSummary=document.querySelector("#healthConnectionSummary");
  const findingSummary=document.querySelector("#healthFindingSummary");
  const coverageSummary=document.querySelector("#healthCoverageSummary");
  if(vehicleLine)vehicleLine.textContent=connected?(vehicle||"Lexus · OBD yhdistetty"):"Ajoneuvoa ei ole yhdistetty";
  if(connectionSummary)connectionSummary.textContent=connected?(ecu?"ECU online":"OBD online"):"Ei yhteyttä";
  const rows=Object.fromEntries([...document.querySelectorAll("[data-health-id]")].map(r=>[r.dataset.healthId,r]));
  if(!connected){
    Object.values(rows).forEach(r=>status(r,"idle","Ei tarkistettu"));
    if(headline)headline.textContent="Yhdistä autoon";
    if(subline)subline.textContent="Tulos muodostuu vain ECU:lta saadusta tiedosta.";
    if(updated)updated.textContent="Ei mittaustietoa";
    if(hero){hero.className="health-hero health-idle";hero.style.setProperty("--coverage-angle","0deg");}
    if(orbValue)orbValue.textContent="–";
    if(findingSummary)findingSummary.textContent="–";
    if(coverageSummary)coverageSummary.textContent="–";
    return;
  }

  const maf=finiteText('#metric-maf .metric-value');
  const boost=finiteText('#metric-boostPressure .metric-value,#metric-map .metric-value');
  const rail=finiteText('#metric-railPressure .metric-value');
  const dp=finiteText('#metric-dpnrDifferentialPressure .metric-value,#dpnrDifferentialPressure');
  const volts=finiteText('#metric-voltage .metric-value,#dpnrVoltage');
  const available=[maf,boost,rail,dp,volts].filter(value=>value!==null).length;
  const dtc=dtcEvidence();

  if(!ecu) status(rows.engine,"attention","Tarkista yhteys","Moottori-ECU ei ole vahvistunut");
  else if(dtc.codes.length) status(rows.engine,"fault",`${dtc.codes.length} vikakoodia","Avaa Vikakoodit nähdäksesi löydökset");
  else if(dtc.read) status(rows.engine,"ok","Ei vikakoodeja","ECU vastaa ja DTC-luku on tehty");
  else status(rows.engine,"available","ECU vastaa","Vikakoodit ovat vielä lukematta");

  status(rows.air,maf!==null||boost!==null?"available":"unavailable",maf!==null||boost!==null?"Dataa saatavilla":"Ei mittausdataa");
  status(rows.fuel,rail!==null?"available":"unavailable",rail!==null?"Rail-data saatavilla":"Ei mittausdataa");
  status(rows.dpnr,dp!==null?"available":"unavailable",dp!==null?"DPNR-data saatavilla":"Ei DPNR-dataa");
  status(rows.electrical,volts!==null?"available":"unavailable",volts!==null?`${String(volts).replace(".",",")} V mitattu`:"Ei jännitedataa");
  status(rows.coverage,available?"available":"attention",available?`${available}/5 ydinarvoa näkyvissä`:"Aja Live tai testi");

  const complete=ecu&&dtc.read&&!dtc.codes.length&&available===5;
  if(headline)headline.textContent=dtc.codes.length?"Tarkistettavaa löytyi":complete?"Health Check valmis":ecu?"Dataa kerätty":"OBD yhdistetty";
  if(subline)subline.textContent=dtc.codes.length
    ? `${dtc.codes.length} vahvistettua vikakooditunnistetta näkyvissä.`
    : complete
      ? "Vikakoodiluku ja kaikki ydinarvot ovat saatavilla."
      : dtc.read
        ? "Vikakoodiluku valmis. Jatka Live-datalla kattavuuden täydentämiseksi."
        : "ECU-yhteys toimii. Lue vikakoodit ja käynnistä Live-data.";
  const latest=latestMetricUpdate();
  if(updated)updated.textContent=latest?`Viimeisin mittaus ${latest}`:"Live-dataa ei ole vielä mitattu";
  if(hero){
    hero.className=`health-hero ${dtc.codes.length?"health-fault":complete?"health-ok":"health-available"}`;
    hero.style.setProperty("--coverage-angle",`${Math.round(available/5*360)}deg`);
  }
  if(orbValue)orbValue.textContent=`${available}/5`;
  if(findingSummary)findingSummary.textContent=dtc.read?String(dtc.codes.length):"–";
  if(coverageSummary)coverageSummary.textContent=`${available}/5`;
}

function metricCard(id){return document.querySelector(`#metric-${id}`);}
function metricParts(id){
  const card=metricCard(id);
  if(!card)return null;
  return {
    value:card.querySelector(".metric-value")?.textContent?.trim()||"–",
    unit:card.querySelector(".metric-unit")?.textContent?.trim()||"",
    time:card.querySelector(".metric-time")?.textContent?.trim()||"",
    unsupported:card.classList.contains("unsupported")
  };
}

function buildLiveCoreGrid(){
  const grid=el("div",{id:"iosLiveCore",class:"ios-live-core"});
  LIVE_CORE.forEach(([id,label])=>{
    const card=el("div",{class:"ios-live-core-card"});
    card.dataset.coreMetric=id;
    card.append(el("span",{text:label}),el("strong",{text:"–"}),el("small",{text:"Odottaa dataa"}));
    grid.append(card);
  });
  return grid;
}

function syncLiveCore(){
  document.querySelectorAll("[data-core-metric]").forEach(node=>{
    const parts=metricParts(node.dataset.coreMetric);
    const strong=node.querySelector("strong"),small=node.querySelector("small");
    if(!parts||parts.unsupported){
      strong.textContent="–";
      small.textContent=parts?.unsupported?"Ei tuettu":"Odottaa dataa";
      node.dataset.state="unavailable";
      return;
    }
    strong.textContent=`${parts.value}${parts.unit?` ${parts.unit}`:""}`;
    small.textContent=parts.time||"Odottaa päivitystä";
    node.dataset.state=parts.value!=="–"?"live":"idle";
  });
}

function syncLiveStatus(){
  const stateNode=document.querySelector("#iosLiveState");
  const detailNode=document.querySelector("#iosLiveDetail");
  if(!stateNode||!detailNode)return;
  const connected=document.querySelector("#connectionBadge")?.classList.contains("online");
  const running=/lopeta/i.test(document.querySelector("#toggleLiveButton")?.textContent||"");
  const available=LIVE_CORE.reduce((count,[id])=>{
    const parts=metricParts(id);
    return count+(parts&&!parts.unsupported&&parts.value!=="–"?1:0);
  },0);
  stateNode.textContent=!connected?"Ei yhteyttä":running?"Live käynnissä":"Live pysäytetty";
  stateNode.dataset.state=!connected?"offline":running?"running":"idle";
  detailNode.textContent=connected?`${available}/${LIVE_CORE.length} ydinarvoa saatavilla`:"Yhdistä autoon nähdäksesi mittausarvot";
}

function applyLiveMetricFilter(){
  const grid=document.querySelector("#metricGrid");
  if(!grid)return;
  const panel=document.querySelector("#iosLiveExplorer");
  const expanded=panel?.dataset.expanded==="true";
  const showUnsupported=panel?.dataset.showUnsupported==="true";
  const query=(document.querySelector("#iosMetricSearch")?.value||"").trim().toLowerCase();
  grid.classList.toggle("ios-metrics-collapsed",!expanded);
  grid.querySelectorAll(".metric-card").forEach(card=>{
    const unsupported=card.classList.contains("unsupported");
    const name=(card.querySelector(".metric-name")?.textContent||"").toLowerCase();
    const matches=!query||name.includes(query);
    card.classList.toggle("ios-filter-hidden",!expanded||!matches||(unsupported&&!showUnsupported));
  });
  const toggle=document.querySelector("#iosMetricToggle");
  if(toggle)toggle.textContent=expanded?"Piilota mittarilista":"Näytä kaikki mittarit";
  const unsupportedButton=document.querySelector("#iosUnsupportedToggle");
  if(unsupportedButton){unsupportedButton.disabled=!expanded;unsupportedButton.textContent=showUnsupported?"Piilota ei-tuetut":"Näytä ei-tuetut";}
  const search=document.querySelector("#iosMetricSearch");
  if(search)search.disabled=!expanded;
}

function enhanceLive(){
  const page=document.querySelector("#page-live");
  if(!page||page.dataset.iosEnhanced)return;
  page.dataset.iosEnhanced="true";
  page.classList.add("ios-live-page");
  const grid=page.querySelector("#metricGrid");
  if(!grid)return;
  const chart=page.querySelector(".chart-card");
  const liveStatus=el("div",{class:"ios-live-status"},[
    el("strong",{id:"iosLiveState",text:"Ei yhteyttä"}),
    el("small",{id:"iosLiveDetail",text:"Yhdistä autoon nähdäksesi mittausarvot"})
  ]);
  const coreHeading=el("div",{class:"ios-section-heading"},[el("strong",{text:"Ydinarvot"}),el("small",{text:"Yhdellä silmäyksellä"})]);
  const core=buildLiveCoreGrid();
  grid.before(liveStatus,coreHeading,core);
  if(chart)grid.before(chart);
  const explorer=el("div",{id:"iosLiveExplorer",class:"ios-live-explorer"});
  explorer.dataset.expanded="false";
  explorer.dataset.showUnsupported="false";
  const header=el("div",{class:"ios-section-heading"},[el("strong",{text:"Kaikki mittarit"}),el("small",{text:"Raakadata ja lisäarvot"})]);
  const search=el("input",{id:"iosMetricSearch",type:"search",placeholder:"Hae mittaria",disabled:true});
  search.setAttribute("aria-label","Hae Live-mittaria");
  const controls=el("div",{class:"ios-live-controls"},[
    search,
    el("button",{id:"iosUnsupportedToggle",class:"secondary compact",type:"button",text:"Näytä ei-tuetut",disabled:true}),
    el("button",{id:"iosMetricToggle",class:"secondary compact",type:"button",text:"Näytä kaikki mittarit"})
  ]);
  explorer.append(header,controls);
  grid.before(explorer);
  explorer.addEventListener("click",event=>{
    if(event.target.id==="iosMetricToggle"){
      explorer.dataset.expanded=explorer.dataset.expanded==="true"?"false":"true";
      applyLiveMetricFilter();
    }
    if(event.target.id==="iosUnsupportedToggle"){
      explorer.dataset.showUnsupported=explorer.dataset.showUnsupported==="true"?"false":"true";
      applyLiveMetricFilter();
    }
  });
  search.addEventListener("input",applyLiveMetricFilter);
  applyLiveMetricFilter();
}

function installStyle(){
  if(document.getElementById(UI_STYLE_ID))return;
  const link=document.createElement("link");
  link.id=UI_STYLE_ID;
  link.rel="stylesheet";
  link.href="ios-health-ui.css";
  document.head.append(link);
}

let syncScheduled=false;
function syncAll(){
  syncHealth();
  syncLiveCore();
  syncLiveStatus();
  applyLiveMetricFilter();
}
function scheduleSync(){
  if(syncScheduled)return;
  syncScheduled=true;
  const run=()=>{syncScheduled=false;syncAll();};
  if(typeof requestAnimationFrame==="function")requestAnimationFrame(run);else setTimeout(run,0);
}

installStyle();
installPages();
installNavigation();
installSubpageBackButtons();
installRouting();
enhanceLive();
new MutationObserver(scheduleSync).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["class"]});
setInterval(scheduleSync,1500);
queueMicrotask(scheduleSync);
