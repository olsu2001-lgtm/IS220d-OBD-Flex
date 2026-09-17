import {
  evaluateIs220dLiveReference,
  referenceForIs220dMetric
} from "./is220d-live-reference-values.js";

const REFERENCE_METRIC_IDS = Object.freeze([
  "rpm",
  "coolant",
  "railPressure",
  "toyotaRailPressure",
  "voltage",
  "dpnrDifferentialPressure",
  "injectionFeedback1",
  "injectionFeedback2",
  "injectionFeedback3",
  "injectionFeedback4"
]);

const NO_FIXED_REFERENCE = Object.freeze({
  maf: "Ei kiinteää yksittäisarvoa · arvioi MAF suhteessa MAP-, RPM- ja EGR-vasteeseen.",
  boostPressure: "Ei kiinteää yksittäisarvoa · arvioi ahtopaine kuormituksen, MAFin, BAROn ja RPM:n kanssa."
});

function detectedVehicleKey() {
  const text=(document.querySelector("#vehicleIdentity")?.textContent||"").toLowerCase();
  if(text.includes("is220d")||text.includes("2ad-fhv")) return "is220d";
  if(text.includes("ct 200h")||text.includes("zwa10")) return "ct200h";
  return "";
}

function metricCard(id) {
  return document.querySelector(`#metric-${id}`);
}

function metricValue(id) {
  const card=metricCard(id);
  if(!card||card.classList.contains("unsupported")) return null;
  const text=card.querySelector(".metric-value")?.textContent?.trim()||"";
  if(!text||text==="–") return null;
  const numeric=Number(text.replace(",",".").match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(numeric)?numeric:null;
}

function liveContextValues() {
  return {
    rpm: metricValue("rpm"),
    coolant: metricValue("coolant"),
    speed: metricValue("speed")
  };
}

function stateLabel(status) {
  return ({
    within:"Viitealueella",
    outside:"Viitealueen ulkopuolella",
    attention:"Tarkista",
    "condition-not-met":"Vertailuehto ei täyty",
    "not-applicable":"Ei verrata tässä tilassa",
    "reference-only":"Viite käytettävissä"
  })[status]||"Viite";
}

function ensureNode(parent, className) {
  let node=parent?.querySelector(`.${className}`);
  if(node||!parent) return node;
  node=document.createElement("div");
  node.className=className;
  parent.append(node);
  return node;
}

function setNode(node, text, state="idle", title="") {
  if(!node)return;
  if(node.textContent!==text)node.textContent=text;
  if(node.dataset.referenceState!==state)node.dataset.referenceState=state;
  if(title&&node.title!==title)node.title=title;
}

function referenceTitle(reference) {
  return [reference?.source,reference?.note].filter(Boolean).join(" · ");
}

function renderReference(metricId, value, context) {
  const reference=referenceForIs220dMetric(metricId);
  if(!reference)return null;
  if(value===null){
    return {
      status:"idle",
      text:`Viite: ${reference.label}`,
      title:referenceTitle(reference),
      applicable:false
    };
  }
  const evaluation=evaluateIs220dLiveReference(metricId,value,context);
  if(!evaluation)return null;
  if(evaluation.status==="not-applicable"){
    return {
      ...evaluation,
      text:`Viite: ${reference.label} · ${evaluation.detail}`,
      title:referenceTitle(reference)
    };
  }
  return {
    ...evaluation,
    text:`${stateLabel(evaluation.status)} · ${evaluation.detail}`,
    title:referenceTitle(reference)
  };
}

function annotateCoreCards() {
  const is220d=detectedVehicleKey()==="is220d";
  const context=liveContextValues();
  document.querySelectorAll("[data-core-metric]").forEach(card=>{
    const metricId=card.dataset.coreMetric;
    const node=ensureNode(card,"ios-live-reference");
    if(!is220d){
      setNode(node,"Ajoneuvokohtaista viitettä ei valittu","idle");
      return;
    }
    const comparison=renderReference(metricId,metricValue(metricId),context);
    if(comparison){
      setNode(node,comparison.text,comparison.status,comparison.title);
      card.dataset.referenceState=comparison.status;
      return;
    }
    const hint=NO_FIXED_REFERENCE[metricId];
    setNode(node,hint||"Ei varmennettua kiinteää viitearvoa","reference-only");
    card.dataset.referenceState="reference-only";
  });
}

function annotateRawMetricCards() {
  if(detectedVehicleKey()!=="is220d"){
    document.querySelectorAll(".ios-metric-reference").forEach(node=>node.remove());
    return;
  }
  const context=liveContextValues();
  for(const metricId of REFERENCE_METRIC_IDS){
    const card=metricCard(metricId);
    if(!card)continue;
    const node=ensureNode(card,"ios-metric-reference");
    const comparison=renderReference(metricId,metricValue(metricId),context);
    if(!comparison)continue;
    setNode(node,comparison.text,comparison.status,comparison.title);
    card.dataset.referenceState=comparison.status;
  }
}

function ensureReferenceSummary() {
  const statusPage=document.querySelector("#page-status");
  if(!statusPage)return null;
  let box=statusPage.querySelector("#iosReferenceSummary");
  if(box)return box;
  box=document.createElement("div");
  box.id="iosReferenceSummary";
  box.className="ios-reference-summary";
  box.innerHTML='<div><span>VIITEVERTAILU</span><strong id="iosReferenceSummaryTitle">Ei vertailukelpoista dataa</strong></div><small id="iosReferenceSummaryDetail">Vertailu huomioi käyttötilan eikä käytä plausibility-rajoja normaalialueina.</small>';
  const strip=statusPage.querySelector(".health-summary-strip");
  strip?.after(box);
  return box;
}

function comparisonSnapshot() {
  if(detectedVehicleKey()!=="is220d")return [];
  const context=liveContextValues();
  return REFERENCE_METRIC_IDS.map(metricId=>{
    const value=metricValue(metricId);
    if(value===null)return null;
    const evaluation=evaluateIs220dLiveReference(metricId,value,context);
    return evaluation?{metricId,value,...evaluation}:null;
  }).filter(Boolean);
}

function updateReferenceSummary() {
  const box=ensureReferenceSummary();
  if(!box)return;
  const title=box.querySelector("#iosReferenceSummaryTitle");
  const detail=box.querySelector("#iosReferenceSummaryDetail");
  if(detectedVehicleKey()!=="is220d"){
    setNode(title,"IS220d-viitteet eivät ole käytössä","idle");
    if(detail)detail.textContent="Viitteet aktivoituvat, kun IS220d / 2AD-FHV on tunnistettu.";
    box.dataset.state="idle";
    return;
  }
  const comparisons=comparisonSnapshot();
  const applicable=comparisons.filter(item=>item.applicable);
  const deviations=applicable.filter(item=>["outside","attention"].includes(item.status));
  const within=applicable.filter(item=>item.status==="within");
  const waiting=comparisons.filter(item=>item.status==="not-applicable");
  if(!applicable.length){
    if(title)title.textContent="Ei vielä vertailukelpoista käyttötilaa";
    if(detail)detail.textContent=waiting.length?"Arvoja on saatu, mutta niiden viite koskee eri käyttötilaa.":"Käynnistä Live-data viitevertailua varten.";
    box.dataset.state="idle";
    return;
  }
  if(title)title.textContent=deviations.length?`${deviations.length} viitepoikkeamaa`:`${within.length}/${applicable.length} numeerista vertailua alueella`;
  if(detail){
    const labels=deviations.map(item=>referenceForIs220dMetric(item.metricId)?.label).filter(Boolean);
    detail.textContent=deviations.length
      ? `Tarkista: ${labels.join(" · ")}. Käyttötila huomioitu.`
      : "Saatavilla olevat soveltuvat numeeriset vertailut ovat viitealueella. Viite ei yksin muodosta komponenttituomiota.";
  }
  box.dataset.state=deviations.length?"attention":"within";
}

function updateHealthRowsFromReferences() {
  if(detectedVehicleKey()!=="is220d")return;
  const context=liveContextValues();
  const fuelRow=document.querySelector('[data-health-id="fuel"]');
  const electricalRow=document.querySelector('[data-health-id="electrical"]');
  const rail=metricValue("railPressure");
  const volts=metricValue("voltage");
  const railEvaluation=rail===null?null:evaluateIs220dLiveReference("railPressure",rail,context);
  const voltageEvaluation=volts===null?null:evaluateIs220dLiveReference("voltage",volts,context);

  if(fuelRow&&railEvaluation?.applicable){
    const state=railEvaluation.status==="within"?"ok":"attention";
    fuelRow.dataset.state=state;
    const status=fuelRow.querySelector(".health-state");
    const subtitle=fuelRow.querySelector("small");
    if(status)status.textContent=railEvaluation.status==="within"?"Rail viitealueella":"Rail poikkeaa viitteestä";
    if(subtitle)subtitle.textContent=`${(rail/1000).toFixed(1).replace(".",",")} MPa · viite ${referenceForIs220dMetric("railPressure").label}`;
  }

  if(electricalRow&&voltageEvaluation?.applicable){
    const state=voltageEvaluation.status==="outside"?"attention":"available";
    electricalRow.dataset.state=state;
    const status=electricalRow.querySelector(".health-state");
    const subtitle=electricalRow.querySelector("small");
    if(status)status.textContent=voltageEvaluation.status==="outside"?"Poikkeaa latausohjeesta":"Latausohjeen alueella";
    if(subtitle)subtitle.textContent=`${volts.toFixed(2).replace(".",",")} V · vertailu noin 13–15 V`;
  }
}

let scheduled=false;
function syncReferences(){
  scheduled=false;
  annotateCoreCards();
  annotateRawMetricCards();
  updateReferenceSummary();
  updateHealthRowsFromReferences();
}
function schedule(){
  if(scheduled)return;
  scheduled=true;
  const run=()=>syncReferences();
  if(typeof requestAnimationFrame==="function")requestAnimationFrame(run);else setTimeout(run,0);
}

new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["class"]});
setInterval(schedule,1700);
queueMicrotask(schedule);
