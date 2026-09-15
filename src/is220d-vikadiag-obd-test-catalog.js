import { getIs220dRepairManualVisuals } from "./is220d-repair-manual-visuals.js";
import {
  getIs220dDiagnosticSignal,
  isProductionAuthorizedIs220dSignal
} from "./is220d-diagnostic-signals.js";

/**
 * Source-only roadmap from the current Drive sheet:
 * Bom-kaapija / Vikadiag_kohteet.
 *
 * This module never sends vehicle commands. It records which reviewed Drive rows
 * can be implemented using signals that already exist in Flex, which rows still
 * need evidence, and which repair-manual visual should later be extracted for the
 * guided test UI.
 */

export const IS220D_VIKADIAG_OBD_TEST_CATALOG_SCHEMA_VERSION = 1;
export const IS220D_VIKADIAG_OBD_TEST_SOURCE = "Bom-kaapija / Vikadiag_kohteet";
export const IS220D_VIKADIAG_OBD_TEST_SOURCE_BATCH = "Drive rows 2-68; latest review 2026-09-15";

export const VIKADIAG_TEST_READINESS = Object.freeze({
  IMPLEMENTED_DEDICATED: "implemented-dedicated",
  READY_EXISTING_SIGNALS: "ready-existing-signals",
  INDIRECT_EXISTING_SIGNALS: "indirect-existing-signals",
  NEEDS_SIGNAL_VERIFICATION: "needs-signal-verification",
  PHYSICAL_ONLY: "physical-only",
  BLOCKED: "blocked"
});

const READY_WITHOUT_NEW_SIGNAL = new Set([
  VIKADIAG_TEST_READINESS.IMPLEMENTED_DEDICATED,
  VIKADIAG_TEST_READINESS.READY_EXISTING_SIGNALS,
  VIKADIAG_TEST_READINESS.INDIRECT_EXISTING_SIGNALS
]);

const ALLOWED_OBD_ROLES = new Set(["direct", "indirect", "physical-only"]);
const ALLOWED_VISUAL_STATES = new Set(["pending-extract", "source-identified", "available"]);
const ALLOWED_EXCLUSIONS = new Set([
  "active-test",
  "forced-regeneration",
  "dtc-clear",
  "ecu-write"
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function manualVisual(searchTerms, extra = {}) {
  return {
    required: true,
    status: "pending-extract",
    source: "Lexus IS250/220D repair manual",
    searchTerms,
    assetPath: null,
    manualReference: null,
    ...extra
  };
}

export function validateVikadiagObdTestCandidate(candidate) {
  if (!Number.isInteger(candidate?.sourceRow) || candidate.sourceRow < 2) {
    throw new Error(`Invalid Vikadiag source row: ${candidate?.sourceRow}`);
  }
  if (!ALLOWED_OBD_ROLES.has(candidate.obdRole)) {
    throw new Error(`Invalid OBD role at Vikadiag row ${candidate.sourceRow}: ${candidate.obdRole}`);
  }
  if (!Object.values(VIKADIAG_TEST_READINESS).includes(candidate.readiness)) {
    throw new Error(`Invalid readiness at Vikadiag row ${candidate.sourceRow}: ${candidate.readiness}`);
  }
  if (!Array.isArray(candidate.signalKeys)) {
    throw new Error(`Missing signalKeys at Vikadiag row ${candidate.sourceRow}`);
  }
  for (const signalKey of candidate.signalKeys) {
    const signal = getIs220dDiagnosticSignal(signalKey);
    if (!signal) throw new Error(`Unknown signal ${signalKey} at Vikadiag row ${candidate.sourceRow}`);
    if (signal.authorization === "field-rejected") {
      throw new Error(`Field-rejected signal ${signalKey} cannot be used at Vikadiag row ${candidate.sourceRow}`);
    }
    if (READY_WITHOUT_NEW_SIGNAL.has(candidate.readiness) && !isProductionAuthorizedIs220dSignal(signalKey)) {
      throw new Error(`Unverified signal ${signalKey} cannot mark Vikadiag row ${candidate.sourceRow} ready`);
    }
  }
  for (const signalKey of candidate.blockedSignalKeys || []) {
    if (!getIs220dDiagnosticSignal(signalKey)) {
      throw new Error(`Unknown blocked signal ${signalKey} at Vikadiag row ${candidate.sourceRow}`);
    }
  }
  if (candidate.readiness === VIKADIAG_TEST_READINESS.IMPLEMENTED_DEDICATED && !candidate.existingImplementation) {
    throw new Error(`Implemented Vikadiag row ${candidate.sourceRow} needs existingImplementation metadata`);
  }
  if (!candidate.manualVisual?.required || !ALLOWED_VISUAL_STATES.has(candidate.manualVisual?.status)) {
    throw new Error(`Repair-manual visual metadata missing at Vikadiag row ${candidate.sourceRow}`);
  }
  if (!Array.isArray(candidate.manualVisual.searchTerms) || candidate.manualVisual.searchTerms.length === 0) {
    throw new Error(`Repair-manual search terms missing at Vikadiag row ${candidate.sourceRow}`);
  }
  for (const exclusion of candidate.excludedActions || []) {
    if (!ALLOWED_EXCLUSIONS.has(exclusion)) {
      throw new Error(`Unknown excluded action ${exclusion} at Vikadiag row ${candidate.sourceRow}`);
    }
  }
  if (candidate.sourceRow >= 11) {
    for (const field of ["componentId", "pnc", "oe", "label", "symptom", "testMethod", "expectedPattern", "physicalFollowUp"]) {
      if (!String(candidate[field] || "").trim()) throw new Error(`Missing ${field} at row ${candidate.sourceRow}`);
    }
    if (candidate.source?.row !== candidate.sourceRow || candidate.source?.range !== `A${candidate.sourceRow}:O${candidate.sourceRow}`) {
      throw new Error(`Source provenance mismatch at row ${candidate.sourceRow}`);
    }
    if (!candidate.operatingStates?.length || !candidate.limitations?.length || !Array.isArray(candidate.missingSignals)) {
      throw new Error(`Incomplete review at row ${candidate.sourceRow}`);
    }
    if (candidate.obdRole === "physical-only" && (candidate.signalKeys.length || candidate.readiness !== VIKADIAG_TEST_READINESS.PHYSICAL_ONLY)) {
      throw new Error(`Physical-only row ${candidate.sourceRow} cannot claim OBD evidence`);
    }
    if (candidate.readiness === VIKADIAG_TEST_READINESS.NEEDS_SIGNAL_VERIFICATION && !candidate.missingSignals.length) {
      throw new Error(`Pending row ${candidate.sourceRow} needs an evidence gap`);
    }
    const recipeIds = new Set();
    for (const recipe of candidate.recipes || []) {
      if (!recipe.id || recipeIds.has(recipe.id)) throw new Error(`Duplicate or missing recipe id at row ${candidate.sourceRow}`);
      recipeIds.add(recipe.id);
      if (!recipe.operatingStates?.length || !recipe.instruction || !recipe.expectedPattern || !recipe.physicalFollowUp) {
        throw new Error(`Incomplete recipe ${recipe.id}`);
      }
      for (const key of recipe.signalKeys || []) {
        if (!candidate.signalKeys.includes(key)) throw new Error(`Recipe signal outside reviewed evidence: ${key}`);
      }
      if (recipe.kind === "physical" && recipe.signalKeys.length) throw new Error(`Physical recipe cannot require OBD`);
    }
    // Metadata cannot become a hidden transport or numeric fault rule.
    const forbidden = new Set(["command", "commands", "rawCommand", "service", "requestHeader", "responseHeader", "threshold", "passThreshold", "failThreshold"]);
    const walk = value => {
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (forbidden.has(key)) throw new Error(`Forbidden catalog field: ${key}`);
        walk(child);
      }
    };
    walk(candidate);
  }
  return candidate;
}

const firstBatch = [
  {
    sourceRow: 2,
    diagnosticGroup: "3. Ilma, alipaine, EGR ja pakokaasu",
    componentId: "engine.egr_valve",
    pnc: "25620",
    oe: "25620-26101",
    label: "EGR-venttiili",
    obdRole: "direct",
    readiness: VIKADIAG_TEST_READINESS.READY_EXISTING_SIGNALS,
    signalKeys: ["engine.egr_position_toyota", "engine.maf", "engine.map"],
    excludedActions: ["active-test"],
    manualVisual: manualVisual(["EGR valve", "25620-26101", "2AD-FHV EGR"]),
    note: "Drive-rivin active test -maininta on vain lähde-evidenssiä; Flexin testiin tulee pelkkä luku ja järjestelmävasteen vertailu."
  },
  {
    sourceRow: 3,
    diagnosticGroup: "3. Ilma, alipaine, EGR ja pakokaasu",
    componentId: "engine.egr_no2_exhaust_gas_door",
    pnc: "25630",
    oe: "25630-26010",
    label: "EGR No.2 / pakokaasuläppä",
    obdRole: "indirect",
    readiness: VIKADIAG_TEST_READINESS.NEEDS_SIGNAL_VERIFICATION,
    signalKeys: ["engine.egr_position_toyota", "engine.maf", "engine.dpnr_differential_pressure", "engine.egt_inlet", "engine.egt_outlet"],
    excludedActions: ["active-test"],
    manualVisual: manualVisual(["EGR No.2", "exhaust gas door", "25630-26010"]),
    note: "Nykyiset signaalit voivat antaa järjestelmäkontekstin, mutta erilliselle läpälle ei ole vielä ajoneuvovarmennettua omaa asento-/komentosignaalia."
  },
  {
    sourceRow: 4,
    diagnosticGroup: "3. Ilma, alipaine, EGR ja pakokaasu",
    componentId: "engine.maf_sensor",
    pnc: "22204",
    oe: "22204-30010",
    label: "MAF / ilmamäärämittari",
    obdRole: "direct",
    readiness: VIKADIAG_TEST_READINESS.READY_EXISTING_SIGNALS,
    signalKeys: ["engine.maf", "engine.map", "engine.egr_position_toyota"],
    manualVisual: manualVisual(["mass air flow meter", "22204-30010", "air cleaner MAF"]),
    note: "Ensimmäinen toteutus voi käyttää nykyistä MAF-vastetta ja MAP/EGR-ristivertailua ilman uusia ECU-pyyntöjä."
  },
  {
    sourceRow: 5,
    diagnosticGroup: "3. Ilma, alipaine, EGR ja pakokaasu",
    componentId: "engine.dpnr_differential_pressure_sensor",
    pnc: "89480A",
    oe: "89480-53010",
    label: "DPF/DPNR paine-eroanturi",
    obdRole: "direct",
    readiness: VIKADIAG_TEST_READINESS.IMPLEMENTED_DEDICATED,
    signalKeys: ["engine.dpnr_differential_pressure", "engine.rpm"],
    existingImplementation: "Flex 0.9.4 DPNR differential-pressure sensor guided test",
    manualVisual: manualVisual(["differential pressure sensor", "89480-53010", "P1426", "DPNR pressure transmitting hose"], {
      status: "source-identified",
      manualReference: "Korjaamo-oppaasta poimittava anturi/paineletkujen kuva; Driveen on jo tallennettu DPNR-paineletkujen kuvallinen ohje vertailuksi."
    }),
    note: "Tämä rivi toimii mallina muiden Vikadiag-rivien ohjatuille testeille kenttävalidoinnin jälkeen."
  },
  {
    sourceRow: 6,
    diagnosticGroup: "3. Ilma, alipaine, EGR ja pakokaasu",
    componentId: "engine.exhaust_gas_temperature_sensor_1",
    pnc: "89425",
    oe: "89425-53010",
    label: "Pakokaasun lämpötila-anturi 1",
    obdRole: "direct",
    readiness: VIKADIAG_TEST_READINESS.READY_EXISTING_SIGNALS,
    signalKeys: ["engine.egt_inlet", "engine.coolant_temperature", "engine.rpm"],
    manualVisual: manualVisual(["exhaust gas temperature sensor", "89425-53010", "DPNR inlet temperature sensor"]),
    note: "Ohjattu testi voidaan tehdä kylmävertailuna ja lämpenemisvasteena nykyisestä varmennetusta 217F-datasta."
  },
  {
    sourceRow: 7,
    diagnosticGroup: "3. Ilma, alipaine, EGR ja pakokaasu",
    componentId: "engine.exhaust_gas_temperature_sensor_2",
    pnc: "89425A",
    oe: "89425-53020",
    label: "Pakokaasun lämpötila-anturi 2",
    obdRole: "direct",
    readiness: VIKADIAG_TEST_READINESS.READY_EXISTING_SIGNALS,
    signalKeys: ["engine.egt_outlet", "engine.egt_inlet", "engine.coolant_temperature", "engine.rpm"],
    manualVisual: manualVisual(["exhaust gas temperature sensor no.2", "89425-53020", "DPNR outlet temperature sensor"]),
    note: "Toteutus vertaa antureita keskenään ja kuormituksen muutokseen eikä päättele vikaa yhdestä lämpötilasta."
  },
  {
    sourceRow: 8,
    diagnosticGroup: "4. Polttoainejärjestelmä",
    componentId: "engine.main_injectors",
    pnc: "23670",
    oe: "23670-29105",
    label: "Common rail -pääsuuttimet",
    obdRole: "indirect",
    readiness: VIKADIAG_TEST_READINESS.INDIRECT_EXISTING_SIGNALS,
    signalKeys: ["engine.rail_pressure_obd", "engine.rpm"],
    blockedSignalKeys: ["engine.injection_feedback_rejected"],
    manualVisual: manualVisual(["injector assy", "23670-29105", "injection nozzle", "leak-off"]),
    note: "Flex voi tehdä nyt vain epäsuoran rail/RPM-seulonnan. 219C-suutinkorjaus on kentässä hylätty eikä sitä saa käyttää ennen uuden Techstream-transaktion varmennusta."
  },
  {
    sourceRow: 9,
    diagnosticGroup: "4. Polttoainejärjestelmä",
    componentId: "engine.exhaust_fuel_addition_injector",
    pnc: "23710B",
    oe: "23710-26011",
    label: "DPF/DPNR lisäpolttoainesuutin",
    obdRole: "indirect",
    readiness: VIKADIAG_TEST_READINESS.INDIRECT_EXISTING_SIGNALS,
    signalKeys: ["engine.dpnr_differential_pressure", "engine.egt_inlet", "engine.egt_outlet", "engine.rail_pressure_obd"],
    excludedActions: ["active-test", "forced-regeneration"],
    manualVisual: manualVisual(["exhaust fuel addition injector", "23710-26011", "5th injector", "DPNR"]),
    note: "Flexin alustava testi voi seurata paine- ja lämpöketjua, mutta ei komentaa lisäsuutinta eikä käynnistää regenerointia."
  },
  {
    sourceRow: 10,
    diagnosticGroup: "4. Polttoainejärjestelmä",
    componentId: "engine.scv",
    pnc: "04226",
    oe: "04226-0L040",
    label: "SCV / imuohjausventtiili korkeapainepumpulla",
    obdRole: "indirect",
    readiness: VIKADIAG_TEST_READINESS.INDIRECT_EXISTING_SIGNALS,
    signalKeys: ["engine.rail_pressure_obd", "engine.rpm"],
    manualVisual: manualVisual(["suction control valve", "04226-0L040", "supply pump", "SCV"]),
    note: "Nykyinen turvallinen toteutus voi näyttää rail-paineen käyttäytymisen. Täysi target-vs-actual/SCV-duty-testi odottaa ajoneuvovarmennettua signaalipolkua."
  }
];

// Reviewed continuation: source-only metadata, not a new execution engine.
const reviewedContinuation = [
  {
    "sourceRow": 11,
    "diagnosticGroup": "6. Laturi, startti ja 12 V sähkö",
    "componentId": "engine.alternator",
    "pnc": "27020",
    "oe": "27060-26030",
    "label": "Laturi",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Akkuvalo, akun tyhjeneminen, himmenevät valot, alijännite-DTC:t, vinkuna/laakeriääni, lataus katoaa kuormalla.",
    "signalKeys": [
      "engine.ecu_voltage"
    ],
    "operatingStates": [
      "key-on",
      "running"
    ],
    "testMethod": "Vertaa ECU-jännitettä ennen käynnistystä, käynnissä ja sähkökuorman muuttuessa.",
    "expectedPattern": "ECU-jännite reagoi käyntiin ja sähkökuormaan uskottavasti; vertaa yleismittariin.",
    "physicalFollowUp": "Mittaa akkujännite levossa ja käynnissä, latausjännite n. 13-15 V, jännitehäviöt plus/maapuolella, hihnan kunto, AC-ripple diodivikaan.",
    "limitations": [
      "ECU-jännite ei mittaa laturin virtaa, rippleä tai B+-jännitehäviötä.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [
      "Laturin ohjaus/palaute ja latausvirta"
    ],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A11:O11",
      "row": 11,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 1035-1036, PNC 27020, OE 27060-26030",
      "sourceConfidence": "Vahva",
      "sourceStatus": "Erä 1 valmis",
      "externalSource": "DENSO alternator troubleshooting / TechTip: tarkista akku, hihna, johdot, jännitehäviöt ja ripple ennen laturin vaihtoa",
      "sourceNote": "Alaosat kannattaa purkaa myöhemmin: hihnapyörä, hiilet, laakeri, säätimen/tasasuuntaajan osuus jos tunnistettavissa."
    },
    "sourceObdText": "OBD voi näyttää ECU-syöttöjännitteen, mutta varmistus tehdään yleismittarilla/kuormituksella. Tarkista DTC:t ja freeze frame alijännitteestä.",
    "existingInspectionPoints": [
      {
        "file": "src/is220d-starting-charging-inspection-points.js",
        "pointId": "alternator-physical-baseline"
      },
      {
        "file": "src/is220d-starting-charging-inspection-points.js",
        "pointId": "alternator-running-voltage"
      }
    ],
    "existingImplementation": "src/is220d-starting-charging-inspection-points.js",
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "ALTERNATOR ASSY",
        "27020",
        "27060-26030"
      ],
      "system": "ALTERNATOR",
      "componentName": "ALTERNATOR ASSY",
      "pnc": "27020",
      "oe": "27060-26030",
      "likelySection": "ALTERNATOR / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "connector view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "ECU-jännite ei mittaa laturin virtaa, rippleä tai B+-jännitehäviötä.",
    "recipes": []
  },
  {
    "sourceRow": 12,
    "diagnosticGroup": "6. Laturi, startti ja 12 V sähkö",
    "componentId": "engine.starter",
    "pnc": "28100",
    "oe": "28100-0R010",
    "label": "Starttimoottori",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Ei pyöritä, vain naksahdus, hidas pyöritys, satunnainen starttaamattomuus, kuumakäynnistyksen ongelma.",
    "signalKeys": [
      "engine.ecu_voltage",
      "engine.rpm"
    ],
    "operatingStates": [
      "cranking"
    ],
    "testMethod": "Tallenna jännite ja RPM normaalin starttausyrityksen aikana; kirjaa pyörikö startti.",
    "expectedPattern": "Havaittu RPM tukee mekaanista pyöritystä; jännite ja pyöritys tulkitaan yhdessä.",
    "physicalFollowUp": "Mittaa akun kunto, startin solenoidille tuleva jännite, päävirtakaapelin ja maadoituksen jännitehäviö startatessa. Kuuntele solenoidi.",
    "limitations": [
      "Hidas OBD-pollaus voi ohittaa jännitekuopan; NO DATA ei ole nolla RPM.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [
      "Kytkinstarttikytkimen ja starttipyynnön varmennettu tilatieto"
    ],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A12:O12",
      "row": 12,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 1067-1068, PNC 28100, OE 28100-0R010",
      "sourceConfidence": "Todennäköinen",
      "sourceStatus": "Erä 1 valmis",
      "externalSource": "DENSO starter/alternator system diagnosis -periaate; käyttäjän auton start/interlock-havainnot",
      "sourceNote": "Erotettava kytkinpolkimen käynnistysehdosta."
    },
    "sourceObdText": "DTC:t ja ECU-jännite voivat auttaa, mutta käynnistyspiiri pitää mitata yleismittarilla starttaushetkellä.",
    "existingInspectionPoints": [
      {
        "file": "src/is220d-starting-charging-inspection-points.js",
        "pointId": "starter-permission-and-circuit"
      },
      {
        "file": "src/is220d-starting-charging-inspection-points.js",
        "pointId": "starter-cranking-voltage-rpm"
      }
    ],
    "existingImplementation": "src/is220d-starting-charging-inspection-points.js",
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "STARTER ASSY",
        "28100",
        "28100-0R010"
      ],
      "system": "STARTER",
      "componentName": "STARTER ASSY",
      "pnc": "28100",
      "oe": "28100-0R010",
      "likelySection": "STARTER / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "connector view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "Hidas OBD-pollaus voi ohittaa jännitekuopan; NO DATA ei ole nolla RPM.",
    "recipes": []
  },
  {
    "sourceRow": 13,
    "diagnosticGroup": "7. Kytkin ja manuaalivaihteisto",
    "componentId": "drivetrain.clutch_master_cylinder",
    "pnc": "31410",
    "oe": "31420-53020",
    "label": "Kytkimen pääsylinteri",
    "obdRole": "physical-only",
    "readiness": "physical-only",
    "symptom": "Pehmeä/sienimäinen tai hitaasti vajoava kytkinpoljin, vaikea vaihteiden kytkentä, kytkin ei irrota kunnolla, nestevuoto.",
    "signalKeys": [],
    "operatingStates": [
      "physical"
    ],
    "testMethod": "Tarkista nestepinta, vuodot ja polkimen vajoaminen paikallaan.",
    "expectedPattern": "Vuoto tai vajoaminen ohjaa hydrauliikan tarkastukseen; OBD ei mittaa sisäistä ohivuotoa.",
    "physicalFollowUp": "Tarkista nestepinta, vuodot polkimen/firewallin ja letkujen luota, polkimen vajoaminen pidettynä pohjassa, ilmaus ja nesteen väri.",
    "limitations": [
      "Kytkinstarttikytkin on eri kohde kuin pääsylinteri.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A13:O13",
      "row": 13,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 1411-1412, PNC 31410, OE 31420-53020",
      "sourceConfidence": "Todennäköinen",
      "sourceStatus": "Erä 1 valmis",
      "externalSource": "Yleiset clutch master cylinder -diagnoosilähteet; BOM + käyttäjän ilmaushavainto",
      "sourceNote": "Käyttäjällä kytkimen ilmaus paransi tuntumaa, joten pää/työsylinterin vuoto tai ilma jää seurattavaksi."
    },
    "sourceObdText": "OBD-rooli pieni. Kytkinpolkimen start interlock / clutch switch tarkistetaan erikseen, jos starttiviesti puuttuu.",
    "existingInspectionPoints": [],
    "existingImplementation": null,
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "CYLINDER ASSY, CLUTCH MASTER",
        "31410",
        "31420-53020"
      ],
      "system": "CLUTCH MASTER CYLINDER",
      "componentName": "CYLINDER ASSY, CLUTCH MASTER",
      "pnc": "31410",
      "oe": "31420-53020",
      "likelySection": "CLUTCH MASTER CYLINDER / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "Kytkinstarttikytkin on eri kohde kuin pääsylinteri.",
    "recipes": [
      {
        "id": "vikadiag-13-physical",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "signalKeys": [],
        "instruction": "Tarkista nestepinta, vuodot polkimen/firewallin ja letkujen luota, polkimen vajoaminen pidettynä pohjassa, ilmaus ja nesteen väri.",
        "expectedPattern": "Vuoto tai vajoaminen ohjaa hydrauliikan tarkastukseen; OBD ei mittaa sisäistä ohivuotoa.",
        "physicalFollowUp": "Tarkista nestepinta, vuodot polkimen/firewallin ja letkujen luota, polkimen vajoaminen pidettynä pohjassa, ilmaus ja nesteen väri."
      }
    ]
  },
  {
    "sourceRow": 14,
    "diagnosticGroup": "8. Kardaani, perä, akselit ja navat",
    "componentId": "drivetrain.propeller_shaft",
    "pnc": "37100",
    "oe": "37100-53081",
    "label": "Kardaani keskilaakereineen",
    "obdRole": "physical-only",
    "readiness": "physical-only",
    "symptom": "Kolahdus liikkeellelähdössä/peruutuksessa, tärinä kuormalla, jyrinä/hurina lattiassa, ravistus tietyssä nopeudessa.",
    "signalKeys": [],
    "operatingStates": [
      "physical"
    ],
    "testMethod": "Tarkista tuetun auton kardaanin rättinivelet, kumituet, välykset ja kiinnitys.",
    "expectedPattern": "Halkeamat ja välykset ovat fyysisiä löydöksiä; pyöränopeus ei mittaa rättiniveltä.",
    "physicalFollowUp": "Nosta auto, tarkista rättinivelet halkeamien varalta, keskilaakerin kumituen repeämät, akselin välys ja pulttien kunto.",
    "limitations": [
      "Flexillä ei ole suoraa kardaanin kunnon mittausta.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A14:O14",
      "row": 14,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 1938-1939, PNC 37100, OE 37100-53081",
      "sourceConfidence": "Vahva",
      "sourceStatus": "Erä 1 valmis",
      "externalSource": "Propshaft centre bearing / driveline symptom -lähteet; käyttäjän oma havainto: taaempi rättinivel halkeillut ja peruuttaessa kolahdus",
      "sourceNote": "Tässä oire on käyttäjän autossa jo läsnä; prioriteetti korkea."
    },
    "sourceObdText": "Ei suoraa OBD-tarkistusta. ABS-pyöränopeuksista voi vain erottaa pyörä-/napapuolen häiriöitä.",
    "existingInspectionPoints": [],
    "existingImplementation": null,
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "SHAFT ASSY, PROPELLER W/CENTER BEARING",
        "37100",
        "37100-53081"
      ],
      "system": "PROPELLER SHAFT UNIVERSAL JOINT",
      "componentName": "SHAFT ASSY, PROPELLER W/CENTER BEARING",
      "pnc": "37100",
      "oe": "37100-53081",
      "likelySection": "PROPELLER SHAFT UNIVERSAL JOINT / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "Flexillä ei ole suoraa kardaanin kunnon mittausta.",
    "recipes": [
      {
        "id": "vikadiag-14-physical",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "signalKeys": [],
        "instruction": "Nosta auto, tarkista rättinivelet halkeamien varalta, keskilaakerin kumituen repeämät, akselin välys ja pulttien kunto.",
        "expectedPattern": "Halkeamat ja välykset ovat fyysisiä löydöksiä; pyöränopeus ei mittaa rättiniveltä.",
        "physicalFollowUp": "Nosta auto, tarkista rättinivelet halkeamien varalta, keskilaakerin kumituen repeämät, akselin välys ja pulttien kunto."
      }
    ]
  },
  {
    "sourceRow": 15,
    "diagnosticGroup": "8. Kardaani, perä, akselit ja navat",
    "componentId": "drivetrain.propeller_center_bearing",
    "pnc": "37230",
    "oe": "37230-30181",
    "label": "Kardaanin keskilaakeri",
    "obdRole": "physical-only",
    "readiness": "physical-only",
    "symptom": "Jyrinä/hurina, tärinä lattiassa, kolahdus kaasunvaihdossa tai peruuttaessa, kardaanin linjauksen muuttuminen.",
    "signalKeys": [],
    "operatingStates": [
      "physical"
    ],
    "testMethod": "Tarkista keskilaakerin kumituki, välys ja pyöritystuntuma.",
    "expectedPattern": "Repeämä, välys tai karhea pyörintä ohjaa laakerin tarkastukseen.",
    "physicalFollowUp": "Visuaalinen tarkastus kumituen repeämille, käsin välys, pyöritystuntuma, kuormituksen alla syntyvä ääni/tärinä.",
    "limitations": [
      "Lattiavärinä ei yksin paikanna keskilaakeria.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A15:O15",
      "row": 15,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 1952-1953, PNC 37230, OE 37230-30181",
      "sourceConfidence": "Todennäköinen",
      "sourceStatus": "Erä 1 valmis",
      "externalSource": "Propshaft centre bearing symptom/diagnosis -lähteet",
      "sourceNote": "Tutkitaan samalla kuin taaempi rättinivel."
    },
    "sourceObdText": "Ei suoraa OBD-tarkistusta.",
    "existingInspectionPoints": [],
    "existingImplementation": null,
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "BEARING ASSY, CENTER SUPPORT, NO.1",
        "37230",
        "37230-30181"
      ],
      "system": "PROPELLER SHAFT UNIVERSAL JOINT",
      "componentName": "BEARING ASSY, CENTER SUPPORT, NO.1",
      "pnc": "37230",
      "oe": "37230-30181",
      "likelySection": "PROPELLER SHAFT UNIVERSAL JOINT / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "Lattiavärinä ei yksin paikanna keskilaakeria.",
    "recipes": [
      {
        "id": "vikadiag-15-physical",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "signalKeys": [],
        "instruction": "Visuaalinen tarkastus kumituen repeämille, käsin välys, pyöritystuntuma, kuormituksen alla syntyvä ääni/tärinä.",
        "expectedPattern": "Repeämä, välys tai karhea pyörintä ohjaa laakerin tarkastukseen.",
        "physicalFollowUp": "Visuaalinen tarkastus kumituen repeämille, käsin välys, pyöritystuntuma, kuormituksen alla syntyvä ääni/tärinä."
      }
    ]
  },
  {
    "sourceRow": 16,
    "diagnosticGroup": "1. ECU/OBD-ohjatut moottori- ja sähköosat",
    "componentId": "engine.cam_position_sensor",
    "pnc": "11301K",
    "oe": "90919-05029",
    "label": "Nokka-akselin asentotunnistin / sylinterintunnistusanturi",
    "obdRole": "indirect",
    "readiness": "needs-signal-verification",
    "symptom": "P0340/P034x, pitkä startti, ei-startti tai cam/crank sync puuttuu. DENSOn IS220d 2AD-FHV -bulletin tunnistaa OE 90919-05029:n Cylinder Recognition Sensoriksi; Japanparts-kaavinnan CRANK POSITION -nimitys on tässä harhaanjohtava.",
    "signalKeys": [
      "engine.rpm"
    ],
    "operatingStates": [
      "cranking"
    ],
    "testMethod": "Kirjaa starttausoire ja RPM vain kampipuolen kontekstiksi; nokka-anturin testi odottaa synkronointievidenssiä.",
    "expectedPattern": "Normaali RPM on mahdollinen myös nokkasignaalin puuttuessa; nokka-anturin johtopäätös jää avoimeksi.",
    "physicalFollowUp": "Tarkista liitin/johdotus, kiinnitys, anturin kärki ja signaali oskilloskoopilla kampisignaalin rinnalla.",
    "limitations": [
      "90919-05029 on auditin korjaama nokka-/sylinterintunnistusanturi, ei toinen kampianturi.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [
      "Ajoneuvovarmennettu cam/crank sync/correlation"
    ],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A16:O16",
      "row": 16,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 194-195, PNC 11301K, OE 90919-05029",
      "sourceConfidence": "Vahva",
      "sourceStatus": "Korjattu erässä 24",
      "externalSource": "DENSO IS220d 2AD-FHV CRS bulletin 00400556E: Cylinder Recognition Sensor 90919-05029.",
      "sourceNote": "Korjaus aiempaan: 90919-05029 = cylinder recognition/camshaft position. Kampianturi on BOMin 90919-05069-rivi; DENSO 2006 bulletinissa aiempi kampianturin OE oli 90919-05064."
    },
    "sourceObdText": "Techstream: cam/crank sync/correlation, DTC + freeze frame. Cranking RPM voi näkyä normaalina vaikka cam-signaali puuttuu.",
    "existingInspectionPoints": [],
    "existingImplementation": null,
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "CYLINDER RECOGNITION SENSOR / CAMSHAFT POSITION SENSOR",
        "11301K",
        "90919-05029"
      ],
      "system": "TIMING GEAR COVER REAR END PLATE",
      "componentName": "CYLINDER RECOGNITION SENSOR / CAMSHAFT POSITION SENSOR",
      "pnc": "11301K",
      "oe": "90919-05029",
      "likelySection": "TIMING GEAR COVER REAR END PLATE / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "connector view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "90919-05029 on auditin korjaama nokka-/sylinterintunnistusanturi, ei toinen kampianturi.",
    "recipes": [
      {
        "id": "vikadiag-16-physical",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "signalKeys": [],
        "instruction": "Tarkista liitin/johdotus, kiinnitys, anturin kärki ja signaali oskilloskoopilla kampisignaalin rinnalla.",
        "expectedPattern": "Normaali RPM on mahdollinen myös nokkasignaalin puuttuessa; nokka-anturin johtopäätös jää avoimeksi.",
        "physicalFollowUp": "Tarkista liitin/johdotus, kiinnitys, anturin kärki ja signaali oskilloskoopilla kampisignaalin rinnalla."
      },
      {
        "id": "vikadiag-16-context",
        "kind": "cross-check",
        "operatingStates": [
          "cranking"
        ],
        "signalKeys": [
          "engine.rpm"
        ],
        "instruction": "Kirjaa starttausoire ja RPM vain kampipuolen kontekstiksi; nokka-anturin testi odottaa synkronointievidenssiä.",
        "expectedPattern": "Normaali RPM on mahdollinen myös nokkasignaalin puuttuessa; nokka-anturin johtopäätös jää avoimeksi.",
        "physicalFollowUp": "Tarkista liitin/johdotus, kiinnitys, anturin kärki ja signaali oskilloskoopilla kampisignaalin rinnalla."
      }
    ]
  },
  {
    "sourceRow": 17,
    "diagnosticGroup": "1. ECU/OBD-ohjatut moottori- ja sähköosat",
    "componentId": "engine.crank_position_sensor",
    "pnc": "11401G",
    "oe": "90919-05069",
    "label": "Kampiakselin asentotunnistin",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Samat kuin toisella asentotunnistimella: käynnistymättömyys, sammuminen, nykiminen, kierroslukusignaalin katkeaminen.",
    "signalKeys": [
      "engine.rpm",
      "engine.ecu_voltage"
    ],
    "operatingStates": [
      "cranking",
      "hot-restart"
    ],
    "testMethod": "Vertaa RPM:n saatavuutta tavallisessa ja oireilevassa startissa.",
    "expectedPattern": "RPM:n puuttuminen todellisen pyörityksen aikana ohjaa piirin tarkastukseen; saatavuus ei todista aaltomuotoa.",
    "physicalFollowUp": "Varmista sijainti Japanparts-kuvasta ja manuaalista; vastus, signaali, liitin, johdotus.",
    "limitations": [
      "RPM on ECU:n tulkinta; tiedonsiirtokatkos erotetaan anturikatkoksesta.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [
      "Ajoneuvovarmennettu cam/crank sync/correlation"
    ],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A17:O17",
      "row": 17,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 133-134, PNC 11401G, OE 90919-05069",
      "sourceConfidence": "Vahva",
      "sourceStatus": "Tarkennettu erässä 24",
      "externalSource": "BOM + käyttäjän aiempi P0340/kampianturikeskustelu; mallikohtainen lähde täydennettävä",
      "sourceNote": "90919-05069 on nykyisen BOMin kampiakselin asentotunnistin. DENSOn varhaisessa IS220d-bulletinissa kampianturin OE oli 90919-05064, joten 05069 tulkitaan myöhemmäksi BOM-versioksi/supersessioksi; fyysinen versio varmistetaan autosta."
    },
    "sourceObdText": "Techstream: RPM startatessa, DTC, freeze frame, mahdollinen cam/crank correlation.",
    "existingInspectionPoints": [
      {
        "file": "src/is220d-starting-charging-inspection-points.js",
        "pointId": "crank-sensor-physical-baseline"
      },
      {
        "file": "src/is220d-starting-charging-inspection-points.js",
        "pointId": "crank-sensor-cranking-rpm"
      }
    ],
    "existingImplementation": "src/is220d-starting-charging-inspection-points.js",
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "SENSOR, CRANK POSITION",
        "11401G",
        "90919-05069"
      ],
      "system": "CYLINDER BLOCK",
      "componentName": "SENSOR, CRANK POSITION",
      "pnc": "11401G",
      "oe": "90919-05069",
      "likelySection": "CYLINDER BLOCK / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "connector view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "RPM on ECU:n tulkinta; tiedonsiirtokatkos erotetaan anturikatkoksesta.",
    "recipes": []
  },
  {
    "sourceRow": 18,
    "diagnosticGroup": "3. Ilma, alipaine, EGR ja pakokaasu",
    "componentId": "engine.air_cleaner_housing",
    "pnc": "17700",
    "oe": "17700-26350",
    "label": "Ilmansuodatinkotelo kokonaisuutena",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Halkeama, väärin sulkeutuva kansi tai vuotava MAF-liitos voi päästää likaa MAFille, aiheuttaa resonanssia, väärää ilmamäärää, savutusta tai tehonpuutetta.",
    "signalKeys": [
      "engine.maf",
      "engine.map"
    ],
    "operatingStates": [
      "running",
      "acceleration"
    ],
    "testMethod": "Tarkista kotelo ensin, sitten vertaa ilmamassan ja MAP:n vastetta samalla ajoprofiililla.",
    "expectedPattern": "Arvot reagoivat kuormaan loogisesti; pölyjälki voi osoittaa vuodon vaikka arvot näyttävät uskottavilta.",
    "physicalFollowUp": "Tarkista salvat, tiivistepinnat, MAFin tiiviste, puhtaan puolen pölyjäljet, kotelon pohjan roskat ja kiinnikkeet.",
    "limitations": [
      "MAF/MAP ei todista kotelon tiiviyttä.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A18:O18",
      "row": 18,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 923-924, PNC 17700, OE 17700-26350",
      "sourceConfidence": "Todennäköinen",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "DENSO MAF-tiedot; LexusOwners IS220d EGR/MAF-ketju",
      "sourceNote": "Liittyy custom intake -projektiin ja MAFin puhtaana pysymiseen."
    },
    "sourceObdText": "MAF g/s ja MAP/boost kuormalla; OBD ei yksin todista kotelon tiiviyttä, jos puhtaan puolen pölyä löytyy.",
    "existingInspectionPoints": [],
    "existingImplementation": null,
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "CLEANER ASSY, AIR",
        "17700",
        "17700-26350"
      ],
      "system": "AIR CLEANER",
      "componentName": "CLEANER ASSY, AIR",
      "pnc": "17700",
      "oe": "17700-26350",
      "likelySection": "AIR CLEANER / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "MAF/MAP ei todista kotelon tiiviyttä.",
    "recipes": [
      {
        "id": "vikadiag-18-physical",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "signalKeys": [],
        "instruction": "Tarkista salvat, tiivistepinnat, MAFin tiiviste, puhtaan puolen pölyjäljet, kotelon pohjan roskat ja kiinnikkeet.",
        "expectedPattern": "Arvot reagoivat kuormaan loogisesti; pölyjälki voi osoittaa vuodon vaikka arvot näyttävät uskottavilta.",
        "physicalFollowUp": "Tarkista salvat, tiivistepinnat, MAFin tiiviste, puhtaan puolen pölyjäljet, kotelon pohjan roskat ja kiinnikkeet."
      },
      {
        "id": "vikadiag-18-context",
        "kind": "cross-check",
        "operatingStates": [
          "running",
          "acceleration"
        ],
        "signalKeys": [
          "engine.maf",
          "engine.map"
        ],
        "instruction": "Tarkista kotelo ensin, sitten vertaa ilmamassan ja MAP:n vastetta samalla ajoprofiililla.",
        "expectedPattern": "Arvot reagoivat kuormaan loogisesti; pölyjälki voi osoittaa vuodon vaikka arvot näyttävät uskottavilta.",
        "physicalFollowUp": "Tarkista salvat, tiivistepinnat, MAFin tiiviste, puhtaan puolen pölyjäljet, kotelon pohjan roskat ja kiinnikkeet."
      }
    ]
  },
  {
    "sourceRow": 19,
    "diagnosticGroup": "3. Ilma, alipaine, EGR ja pakokaasu",
    "componentId": "engine.air_filter",
    "pnc": "17801",
    "oe": "17801-26010",
    "label": "Moottorin ilmansuodatin",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Tukkeutuminen voi aiheuttaa tehonpuutetta, mustaa savua, kulutuksen nousua, turbon imupuolen alipainetta ja MAF-arvojen vääristymistä.",
    "signalKeys": [
      "engine.maf",
      "engine.map"
    ],
    "operatingStates": [
      "running",
      "acceleration"
    ],
    "testMethod": "Vertaa lokia ennen ja jälkeen suodattimen tarkastuksen/vaihdon samalla ajoprofiililla.",
    "expectedPattern": "Ilmamassan ja paineen muutokset arvioidaan suhteessa kuormaan, ei yhdellä hyväksymisrajalla.",
    "physicalFollowUp": "Tarkista suodattimen lika, kosteus, väärä asennussuunta, tiivisteen painuminen ja kotelon puhtaan puolen pöly.",
    "limitations": [
      "EGR, sää ja ajoprofiili voivat muuttaa vertailua.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A19:O19",
      "row": 19,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 931-932, PNC 17801, OE 17801-26010",
      "sourceConfidence": "Vahva",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "Garrett turbo diagnostics; DENSO MAF/air cleaner -tiedot",
      "sourceNote": "Käyttäjällä vaihdettu 15.6.2026, mutta seurataan custom intake -muutoksen jälkeen."
    },
    "sourceObdText": "Seuraa MAF-arvoa, MAP/boostia ja savutusta ennen/jälkeen vaihdon; tee vertailu samalla ajoprofiililla.",
    "existingInspectionPoints": [],
    "existingImplementation": null,
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "ELEMENT SUB-ASSY, AIR CLEANER FILTER",
        "17801",
        "17801-26010"
      ],
      "system": "AIR CLEANER",
      "componentName": "ELEMENT SUB-ASSY, AIR CLEANER FILTER",
      "pnc": "17801",
      "oe": "17801-26010",
      "likelySection": "AIR CLEANER / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "EGR, sää ja ajoprofiili voivat muuttaa vertailua.",
    "recipes": [
      {
        "id": "vikadiag-19-physical",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "signalKeys": [],
        "instruction": "Tarkista suodattimen lika, kosteus, väärä asennussuunta, tiivisteen painuminen ja kotelon puhtaan puolen pöly.",
        "expectedPattern": "Ilmamassan ja paineen muutokset arvioidaan suhteessa kuormaan, ei yhdellä hyväksymisrajalla.",
        "physicalFollowUp": "Tarkista suodattimen lika, kosteus, väärä asennussuunta, tiivisteen painuminen ja kotelon puhtaan puolen pöly."
      },
      {
        "id": "vikadiag-19-context",
        "kind": "cross-check",
        "operatingStates": [
          "running",
          "acceleration"
        ],
        "signalKeys": [
          "engine.maf",
          "engine.map"
        ],
        "instruction": "Vertaa lokia ennen ja jälkeen suodattimen tarkastuksen/vaihdon samalla ajoprofiililla.",
        "expectedPattern": "Ilmamassan ja paineen muutokset arvioidaan suhteessa kuormaan, ei yhdellä hyväksymisrajalla.",
        "physicalFollowUp": "Tarkista suodattimen lika, kosteus, väärä asennussuunta, tiivisteen painuminen ja kotelon puhtaan puolen pöly."
      }
    ]
  },
  {
    "sourceRow": 20,
    "diagnosticGroup": "3. Ilma, alipaine, EGR ja pakokaasu",
    "componentId": "engine.air_cleaner_hose",
    "pnc": "17881/17881A/17882A",
    "oe": "17880-26010; 96111-10850; 96111-10710",
    "label": "Ilmaputki ja kiristimet MAFin/turbon imupuolella",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Halkeama, löysä klemmari tai putken painuminen voi aiheuttaa imuääntä, MAF-poikkeamaa, tehonpuutetta, savutusta tai öljyistä pölyä liitoksissa.",
    "signalKeys": [
      "engine.maf",
      "engine.map"
    ],
    "operatingStates": [
      "running",
      "acceleration"
    ],
    "testMethod": "Tarkista letku ja kiristimet, vertaa MAF/MAP-vastetta ennen/jälkeen korjauksen.",
    "expectedPattern": "Ilmamassa ja paine muuttuvat kuorman kanssa loogisesti.",
    "physicalFollowUp": "Taivuta letkua käsin ja etsi hiushalkeamat; tarkista klemmarit, öljyiset pölyjäljet ja MAFin jälkeinen vuoto.",
    "limitations": [
      "Epäsuora poikkeama ei paikanna yksittäistä klemmaria.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A20:O20",
      "row": 20,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 933-938, PNC 17881/17881A/17882A",
      "sourceConfidence": "Todennäköinen",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "Garrett turbo diagnostics; DENSO MAF-konteksti",
      "sourceNote": "Tämä on halpa tarkistus ennen MAF/turbo-osien vaihtoa."
    },
    "sourceObdText": "MAF/MAP-suhde ja boostin nousu kuormalla; vuoto voi näkyä epäloogisena ilmamassana tai hitaana ahtopaineena.",
    "existingInspectionPoints": [
      {
        "file": "src/is220d-air-exhaust-inspection-points.js",
        "pointId": "air-cleaner-hose-baseline"
      },
      {
        "file": "src/is220d-air-exhaust-inspection-points.js",
        "pointId": "air-cleaner-hose-airflow-response"
      }
    ],
    "existingImplementation": "src/is220d-air-exhaust-inspection-points.js",
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "HOSE, AIR CLEANER, NO.1 + CLAMPS",
        "17881/17881A/17882A",
        "17880-26010; 96111-10850; 96111-10710"
      ],
      "system": "AIR CLEANER",
      "componentName": "HOSE, AIR CLEANER, NO.1 + CLAMPS",
      "pnc": "17881/17881A/17882A",
      "oe": "17880-26010; 96111-10850; 96111-10710",
      "likelySection": "AIR CLEANER / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "Epäsuora poikkeama ei paikanna yksittäistä klemmaria.",
    "recipes": []
  },
  {
    "sourceRow": 21,
    "diagnosticGroup": "3. Ilma, alipaine, EGR ja pakokaasu",
    "componentId": "engine.intercooler",
    "pnc": "17940D",
    "oe": "17940-26010",
    "label": "Välijäähdytin",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Ahtovuoto aiheuttaa tehonpuutetta, sihinää, mustaa savua, öljysumua vuotokohdassa ja todellisen ahtopaineen jäämistä pyynnistä.",
    "signalKeys": [
      "engine.map",
      "engine.maf",
      "engine.barometric_pressure"
    ],
    "operatingStates": [
      "running",
      "acceleration"
    ],
    "testMethod": "Tarkista vuodot fyysisesti ja tallenna MAP/MAF kuormituksen muuttuessa.",
    "expectedPattern": "Paine ja ilmamassa reagoivat loogisesti; vuoto varmistetaan erillisellä kokeella.",
    "physicalFollowUp": "Paine-/savukoe imupuolelle, tarkista päädyt, kennon halkeamat, letkuliitokset ja öljyiset pölyjäljet.",
    "limitations": [
      "MAP on absoluuttinen paine; target/actual-vertailu ei ole nykyisillä signaaleilla mahdollinen.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [
      "Ajoneuvovarmennettu ahtopaineen tavoite"
    ],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A21:O21",
      "row": 21,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 939-940, PNC 17940D, OE 17940-26010",
      "sourceConfidence": "Vahva",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "Garrett turbo diagnostics: check hoses, pipes, intercooler leaks/cracks",
      "sourceNote": "Ahtovuoto voi matkia turbo-, EGR- tai MAF-vikaa."
    },
    "sourceObdText": "Techstream/Flex: MAP tai boost actual vs target kuormalla; MAF ja EGR-komento huomioitava tulkinnassa.",
    "existingInspectionPoints": [
      {
        "file": "src/is220d-air-exhaust-inspection-points.js",
        "pointId": "intercooler-leak-baseline"
      },
      {
        "file": "src/is220d-air-exhaust-inspection-points.js",
        "pointId": "intercooler-load-response"
      }
    ],
    "existingImplementation": "src/is220d-air-exhaust-inspection-points.js",
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "INTERCOOLER ASSY",
        "17940D",
        "17940-26010"
      ],
      "system": "AIR CLEANER",
      "componentName": "INTERCOOLER ASSY",
      "pnc": "17940D",
      "oe": "17940-26010",
      "likelySection": "AIR CLEANER / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "MAP on absoluuttinen paine; target/actual-vertailu ei ole nykyisillä signaaleilla mahdollinen.",
    "recipes": []
  },
  {
    "sourceRow": 22,
    "diagnosticGroup": "3. Ilma, alipaine, EGR ja pakokaasu",
    "componentId": "engine.intake_manifold",
    "pnc": "17111",
    "oe": "17101-26110",
    "label": "Imusarja",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Karstoittuminen voi kaventaa kanavia, heikentää alakierrosvääntöä, lisätä savutusta ja nostaa kulutusta; EGR/MAF-puhdistuksen jälkeen auto voi tuntua selvästi pirteämmältä.",
    "signalKeys": [
      "engine.maf",
      "engine.map",
      "engine.egr_position_toyota"
    ],
    "operatingStates": [
      "running",
      "acceleration"
    ],
    "testMethod": "Vertaa MAF/MAP/EGR-asentoa samalla ajoprofiililla ennen/jälkeen fyysisen puhdistuksen.",
    "expectedPattern": "Ilmamassa, paine ja ilmoitettu EGR-asento muodostavat loogisen ketjun.",
    "physicalFollowUp": "Irrotus/boreskooppi EGR-aukon kautta; tarkista kanavien kaventuma, märkä öljykarsta ja läppien/kanavien esteet.",
    "limitations": [
      "EGR-asento ei ole EGR-komento; OBD ei mittaa karstan määrää.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [
      "Ajoneuvovarmennettu EGR-tavoite"
    ],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A22:O22",
      "row": 22,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 806-807, PNC 17111, OE 17101-26110",
      "sourceConfidence": "Vahva",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "LexusOwners IS220d EGR and Mass Air Flow Sensor -ketju",
      "sourceNote": "Foorumihavainto: EGR-portti kaventunut n. 35-40 mm -> 5-6 mm ja puhdistus paransi vetoa/mpg:tä."
    },
    "sourceObdText": "MAF/MAP/EGR-komennon vertailu ennen/jälkeen puhdistuksen; OBD ei yksin mittaa karstan määrää.",
    "existingInspectionPoints": [
      {
        "file": "src/is220d-air-exhaust-inspection-points.js",
        "pointId": "intake-manifold-carbon-baseline"
      },
      {
        "file": "src/is220d-air-exhaust-inspection-points.js",
        "pointId": "intake-manifold-airflow-crosscheck"
      }
    ],
    "existingImplementation": "src/is220d-air-exhaust-inspection-points.js",
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "MANIFOLD, INTAKE",
        "17111",
        "17101-26110"
      ],
      "system": "MANIFOLD",
      "componentName": "MANIFOLD, INTAKE",
      "pnc": "17111",
      "oe": "17101-26110",
      "likelySection": "MANIFOLD / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "EGR-asento ei ole EGR-komento; OBD ei mittaa karstan määrää.",
    "recipes": []
  },
  {
    "sourceRow": 23,
    "diagnosticGroup": "3. Ilma, alipaine, EGR ja pakokaasu",
    "componentId": "engine.intake_manifold_gasket",
    "pnc": "17177",
    "oe": "17171-26010",
    "label": "Imusarjan tiiviste",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Vuoto voi aiheuttaa imupuolen/ahtopuolen suhinaa, öljyistä pölyä, epäloogista MAF/MAP-suhdetta, huonoa vetoa tai savutusta.",
    "signalKeys": [
      "engine.map",
      "engine.maf"
    ],
    "operatingStates": [
      "running",
      "acceleration"
    ],
    "testMethod": "Etsi vuotojäljet ja vertaa MAP/MAF-vastetta kuormalla.",
    "expectedPattern": "Vuotoepäily vahvistetaan fyysisesti myös ilman DTC:tä.",
    "physicalFollowUp": "Tarkista tiivistepinta, öljyiset vuotojäljet, pulttien kireys, savukoe/painekoe imupuolelle.",
    "limitations": [
      "Tavoitepainetta ei ole; loki ei yksilöi tiivistevuotoa.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [
      "Ajoneuvovarmennettu ahtopaineen tavoite"
    ],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A23:O23",
      "row": 23,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 826-827, PNC 17177, OE 17171-26010",
      "sourceConfidence": "Todennäköinen",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "Garrett turbo diagnostics; LexusOwners imusarja/EGR-kokemukset",
      "sourceNote": "Vaihdettava aina imusarjan irrotuksessa, jos tiiviste on painunut/kova."
    },
    "sourceObdText": "MAP/boost todellinen vs tavoite; MAF-suhteen muutos kuormalla. Ei anna aina DTC:tä.",
    "existingInspectionPoints": [],
    "existingImplementation": null,
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "GASKET, INTAKE MANIFOLD TO HEAD, NO.1",
        "17177",
        "17171-26010"
      ],
      "system": "MANIFOLD",
      "componentName": "GASKET, INTAKE MANIFOLD TO HEAD, NO.1",
      "pnc": "17177",
      "oe": "17171-26010",
      "likelySection": "MANIFOLD / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "Tavoitepainetta ei ole; loki ei yksilöi tiivistevuotoa.",
    "recipes": [
      {
        "id": "vikadiag-23-physical",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "signalKeys": [],
        "instruction": "Tarkista tiivistepinta, öljyiset vuotojäljet, pulttien kireys, savukoe/painekoe imupuolelle.",
        "expectedPattern": "Vuotoepäily vahvistetaan fyysisesti myös ilman DTC:tä.",
        "physicalFollowUp": "Tarkista tiivistepinta, öljyiset vuotojäljet, pulttien kireys, savukoe/painekoe imupuolelle."
      },
      {
        "id": "vikadiag-23-context",
        "kind": "cross-check",
        "operatingStates": [
          "running",
          "acceleration"
        ],
        "signalKeys": [
          "engine.map",
          "engine.maf"
        ],
        "instruction": "Etsi vuotojäljet ja vertaa MAP/MAF-vastetta kuormalla.",
        "expectedPattern": "Vuotoepäily vahvistetaan fyysisesti myös ilman DTC:tä.",
        "physicalFollowUp": "Tarkista tiivistepinta, öljyiset vuotojäljet, pulttien kireys, savukoe/painekoe imupuolelle."
      }
    ]
  },
  {
    "sourceRow": 24,
    "diagnosticGroup": "3. Ilma, alipaine, EGR ja pakokaasu",
    "componentId": "engine.exhaust_manifold_gasket",
    "pnc": "17141/17173",
    "oe": "17141-26110; 17173-0R010",
    "label": "Pakosarja ja pakosarjan tiiviste",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Vuoto voi aiheuttaa pakokaasun hajua konehuoneessa, tikittävää/chuffaavaa ääntä kylmänä, nokijälkiä, hitaampaa turbon heräämistä ja EGT/DPF-tulkinnan sotkeutumista.",
    "signalKeys": [
      "engine.map",
      "engine.egt_inlet",
      "engine.egt_outlet",
      "engine.dpnr_differential_pressure"
    ],
    "operatingStates": [
      "running",
      "acceleration"
    ],
    "testMethod": "Etsi nokijäljet kylmänä; tarkastele paine- ja lämpöketjua normaalin ajon lokista.",
    "expectedPattern": "Kuormitus muuttaa paineita ja lämpöjä loogisesti; vuotokohta paikannetaan fyysisesti.",
    "physicalFollowUp": "Tarkista nokijäljet laippojen ympäriltä, kuuntele kylmäkäynnistyksessä, käytä peiliä/valoa ja tarkista pultit sekä lämpösuojan irtoaminen.",
    "limitations": [
      "EGT-anturit eivät ole pakosarjan lämpömittareita; DPNR-paine-ero ei mittaa pakosarjavuotoa.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A24:O24",
      "row": 24,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 818-825, PNC 17141/17173",
      "sourceConfidence": "Todennäköinen",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "Garrett turbo diagnostics; yleinen dieselpakovuodon diagnoosi",
      "sourceNote": "Tärkeä hajuoireen takia, mutta erotettava EGR- ja DPF-hajusta."
    },
    "sourceObdText": "Epäsuora: boostin hidas nousu, EGT-poikkeamat ja DPF/paine-erodata. Pakovuoto varmistetaan fyysisesti.",
    "existingInspectionPoints": [],
    "existingImplementation": null,
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "MANIFOLD, EXHAUST + GASKET",
        "17141/17173",
        "17141-26110; 17173-0R010"
      ],
      "system": "MANIFOLD",
      "componentName": "MANIFOLD, EXHAUST + GASKET",
      "pnc": "17141/17173",
      "oe": "17141-26110; 17173-0R010",
      "likelySection": "MANIFOLD / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "EGT-anturit eivät ole pakosarjan lämpömittareita; DPNR-paine-ero ei mittaa pakosarjavuotoa.",
    "recipes": [
      {
        "id": "vikadiag-24-physical",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "signalKeys": [],
        "instruction": "Tarkista nokijäljet laippojen ympäriltä, kuuntele kylmäkäynnistyksessä, käytä peiliä/valoa ja tarkista pultit sekä lämpösuojan irtoaminen.",
        "expectedPattern": "Kuormitus muuttaa paineita ja lämpöjä loogisesti; vuotokohta paikannetaan fyysisesti.",
        "physicalFollowUp": "Tarkista nokijäljet laippojen ympäriltä, kuuntele kylmäkäynnistyksessä, käytä peiliä/valoa ja tarkista pultit sekä lämpösuojan irtoaminen."
      },
      {
        "id": "vikadiag-24-context",
        "kind": "cross-check",
        "operatingStates": [
          "running",
          "acceleration"
        ],
        "signalKeys": [
          "engine.map",
          "engine.egt_inlet",
          "engine.egt_outlet",
          "engine.dpnr_differential_pressure"
        ],
        "instruction": "Etsi nokijäljet kylmänä; tarkastele paine- ja lämpöketjua normaalin ajon lokista.",
        "expectedPattern": "Kuormitus muuttaa paineita ja lämpöjä loogisesti; vuotokohta paikannetaan fyysisesti.",
        "physicalFollowUp": "Tarkista nokijäljet laippojen ympäriltä, kuuntele kylmäkäynnistyksessä, käytä peiliä/valoa ja tarkista pultit sekä lämpösuojan irtoaminen."
      }
    ]
  },
  {
    "sourceRow": 25,
    "diagnosticGroup": "3. Ilma, alipaine, EGR ja pakokaasu",
    "componentId": "engine.turbocharger",
    "pnc": "17201",
    "oe": "17201-26011",
    "label": "Turboahdin",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Tehonpuute, hidas ahtopaineen nousu, yli-/aliahto, limp mode/P1251-tyyppinen turboactuator-ongelma, vihellys/ujellus, öljynkulutus tai musta/sininen savu.",
    "signalKeys": [
      "engine.map",
      "engine.maf",
      "engine.barometric_pressure",
      "engine.egr_position_toyota"
    ],
    "operatingStates": [
      "running",
      "acceleration"
    ],
    "testMethod": "Tarkista imu- ja pakopuolen perusta, sitten tarkastele MAP/MAF/EGR-asentoa kuormalla.",
    "expectedPattern": "Paine ja ilmamassa reagoivat loogisesti ajotilaan.",
    "physicalFollowUp": "Ennen vaihtoa tarkista ilmansuodatin, imu-/ahtoputket, välijäähdytin, pakopuolen tukos, öljynsyöttö/paluu, akselivälys ja siipien vauriot.",
    "limitations": [
      "Ei target/actual-testiä eikä turbon ohjaustavan oletusta yleisestä D-4D-lähteestä.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [
      "Ajoneuvovarmennettu ahtopaineen tavoite ja turbon toimilaitteen palaute"
    ],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A25:O25",
      "row": 25,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 828-829, PNC 17201, OE 17201-26011",
      "sourceConfidence": "Vahva",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "Garrett Turbo Diagnostics; ToyotaOwners D-4D P1251 turbo/vacuum-ketjut",
      "sourceNote": "Turbo on usein seurausvio; ensin imu, pakopuoli, alipaine ja öljykierto."
    },
    "sourceObdText": "Techstream/Flex: MAP/boost actual vs target, MAF, EGR-komento, DTC/freeze frame. Vakuumiohjatussa turbossa testaa myös alipaine.",
    "existingInspectionPoints": [
      {
        "file": "src/is220d-air-exhaust-inspection-points.js",
        "pointId": "turbo-preconditions"
      },
      {
        "file": "src/is220d-air-exhaust-inspection-points.js",
        "pointId": "turbo-airflow-pressure-response"
      }
    ],
    "existingImplementation": "src/is220d-air-exhaust-inspection-points.js",
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "TURBOCHARGER SUB-ASSY",
        "17201",
        "17201-26011"
      ],
      "system": "MANIFOLD",
      "componentName": "TURBOCHARGER SUB-ASSY",
      "pnc": "17201",
      "oe": "17201-26011",
      "likelySection": "MANIFOLD / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "Ei target/actual-testiä eikä turbon ohjaustavan oletusta yleisestä D-4D-lähteestä.",
    "recipes": []
  },
  {
    "sourceRow": 26,
    "diagnosticGroup": "5. Jäähdytys, öljy ja hihnakäyttö",
    "componentId": "engine.turbo_oil_pipes",
    "pnc": "15474/15474A/15481/15482",
    "oe": "15474-26020; 15491-26010; 15481-0R010/26010; 15482-26010",
    "label": "Turbon öljynsyöttö- ja paluuputket/letkut",
    "obdRole": "physical-only",
    "readiness": "physical-only",
    "symptom": "Vuoto aiheuttaa öljyn hajua, öljytahroja ja savua kuumilla osilla; tukos tai huono paluu voi aiheuttaa turbon öljyämistä, savutusta ja laakerivaurion.",
    "signalKeys": [],
    "operatingStates": [
      "physical"
    ],
    "testMethod": "Tarkista öljyvuodot, koksaantuminen ja paluuputken/letkun painuminen jäähtyneestä moottorista.",
    "expectedPattern": "Vuoto tai virtauseste todetaan fyysisesti.",
    "physicalFollowUp": "Tarkista vuodot, koksaantuminen, painunut paluuletku, väärä tiivistemassa, banjopultit/tiivisteet ja öljyn paluun vapaa lasku.",
    "limitations": [
      "MAP ei mittaa turbon öljynsyöttöä tai paluuvirtausta.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A26:O26",
      "row": 26,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 760-787, PNC 15474/15481/15482 ym.",
      "sourceConfidence": "Vahva",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "Garrett turbo diagnostics/oil leakage troubleshooting",
      "sourceNote": "Hyvä tarkistaa, jos turbon ympärillä on öljyä tai pakokaasun haju kuumana."
    },
    "sourceObdText": "Ei suoraa OBD-arvoa. Epäsuorasti savutus, öljynkulutus ja ahtopaineen heikkeneminen.",
    "existingInspectionPoints": [],
    "existingImplementation": null,
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "TURBO OIL OUTLET / TURBO OIL PIPES",
        "15474/15474A/15481/15482",
        "15474-26020; 15491-26010; 15481-0R010/26010; 15482-26010"
      ],
      "system": "MANIFOLD",
      "componentName": "TURBO OIL OUTLET / TURBO OIL PIPES",
      "pnc": "15474/15474A/15481/15482",
      "oe": "15474-26020; 15491-26010; 15481-0R010/26010; 15482-26010",
      "likelySection": "MANIFOLD / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "MAP ei mittaa turbon öljynsyöttöä tai paluuvirtausta.",
    "recipes": [
      {
        "id": "vikadiag-26-physical",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "signalKeys": [],
        "instruction": "Tarkista vuodot, koksaantuminen, painunut paluuletku, väärä tiivistemassa, banjopultit/tiivisteet ja öljyn paluun vapaa lasku.",
        "expectedPattern": "Vuoto tai virtauseste todetaan fyysisesti.",
        "physicalFollowUp": "Tarkista vuodot, koksaantuminen, painunut paluuletku, väärä tiivistemassa, banjopultit/tiivisteet ja öljyn paluun vapaa lasku."
      }
    ]
  },
  {
    "sourceRow": 27,
    "diagnosticGroup": "3. Ilma, alipaine, EGR ja pakokaasu",
    "componentId": "engine.turbo_exhaust_gaskets",
    "pnc": "17278/17279/04175",
    "oe": "17278-26010; 17279-0R010; 04175-0R071",
    "label": "Turbon ja pakosarjan tiivisteet / turbon tiivistesarja",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Pakovuoto ennen turboahdinta voi aiheuttaa nokijälkiä, tikitystä, pakokaasun hajua, vihellystä ja heikompaa ahtopaineen nousua.",
    "signalKeys": [
      "engine.map",
      "engine.egt_inlet",
      "engine.egt_outlet"
    ],
    "operatingStates": [
      "running",
      "acceleration"
    ],
    "testMethod": "Tarkista laippojen nokijäljet ja vuotoääni; käytä normaalia ajolokia järjestelmäkontekstina.",
    "expectedPattern": "Paine- ja lämpövaste arvioidaan suhteessa kuormaan, vuoto paikannetaan fyysisesti.",
    "physicalFollowUp": "Tarkista noki laipoissa, pulttien löysyys/katkeamat, kylmänä kuuluva vuotoääni ja lämpösuojien jäljet.",
    "limitations": [
      "EGT-poikkeama ei yksilöi vuotavaa laippaa.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A27:O27",
      "row": 27,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 758-759 ja 828-833, PNC 04175/17278/17279",
      "sourceConfidence": "Todennäköinen",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "Garrett turbo diagnostics",
      "sourceNote": "Oire voi muistuttaa turbon tai ahtovuodon vikaa."
    },
    "sourceObdText": "Epäsuora: MAP/boost nousee hitaasti; EGT ja DPF-data voivat näyttää oudoilta. Varmistus fyysisesti.",
    "existingInspectionPoints": [],
    "existingImplementation": null,
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "TURBO/EXHAUST MANIFOLD GASKETS",
        "17278/17279/04175",
        "17278-26010; 17279-0R010; 04175-0R071"
      ],
      "system": "MANIFOLD",
      "componentName": "TURBO/EXHAUST MANIFOLD GASKETS",
      "pnc": "17278/17279/04175",
      "oe": "17278-26010; 17279-0R010; 04175-0R071",
      "likelySection": "MANIFOLD / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "EGT-poikkeama ei yksilöi vuotavaa laippaa.",
    "recipes": [
      {
        "id": "vikadiag-27-physical",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "signalKeys": [],
        "instruction": "Tarkista noki laipoissa, pulttien löysyys/katkeamat, kylmänä kuuluva vuotoääni ja lämpösuojien jäljet.",
        "expectedPattern": "Paine- ja lämpövaste arvioidaan suhteessa kuormaan, vuoto paikannetaan fyysisesti.",
        "physicalFollowUp": "Tarkista noki laipoissa, pulttien löysyys/katkeamat, kylmänä kuuluva vuotoääni ja lämpösuojien jäljet."
      },
      {
        "id": "vikadiag-27-context",
        "kind": "cross-check",
        "operatingStates": [
          "running",
          "acceleration"
        ],
        "signalKeys": [
          "engine.map",
          "engine.egt_inlet",
          "engine.egt_outlet"
        ],
        "instruction": "Tarkista laippojen nokijäljet ja vuotoääni; käytä normaalia ajolokia järjestelmäkontekstina.",
        "expectedPattern": "Paine- ja lämpövaste arvioidaan suhteessa kuormaan, vuoto paikannetaan fyysisesti.",
        "physicalFollowUp": "Tarkista noki laipoissa, pulttien löysyys/katkeamat, kylmänä kuuluva vuotoääni ja lämpösuojien jäljet."
      }
    ]
  },
  {
    "sourceRow": 28,
    "diagnosticGroup": "3. Ilma, alipaine, EGR ja pakokaasu",
    "componentId": "engine.vacuum_hoses",
    "pnc": "25760/25770/25780/25736/25761",
    "oe": "25760-26021; 25760-26060; 25770-26020; 25770-26040; 25780-26011; 25736-31010; 25761-26040",
    "label": "Alipaineletkut ja -putket",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Haljennut tai väärin kytketty alipaineletku aiheuttaa turbon/EGR:n väärän ohjauksen: tehonpuute, yli-/aliahto, nykiminen ja limp mode/P1251.",
    "signalKeys": [
      "engine.map",
      "engine.maf",
      "engine.egr_position_toyota"
    ],
    "operatingStates": [
      "running",
      "acceleration"
    ],
    "testMethod": "Varmista letkujen reititys manuaalista ja tarkista tiiviys; vertaa järjestelmävastetta normaalissa ajossa.",
    "expectedPattern": "Fyysinen alipainemittaus ja järjestelmävaste tulkitaan yhdessä.",
    "physicalFollowUp": "Tarkista letkujen reititys, halkeamat päistä, kovettuminen, öljy/nokijäljet, takaiskuventtiilit ja alipaine käsipumpulla.",
    "limitations": [
      "Varmista mikä laite käyttää kutakin alipainehaaraa; ei automaattista turbo/EGR-kytkentäoletusta.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [
      "Varmennettu alipainehaaran paine ja siihen liitetyn toimilaitteen palaute"
    ],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A28:O28",
      "row": 28,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 974-987 ja 945-948, PNC 25760/25770/25780/25736/25761",
      "sourceConfidence": "Vahva",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "ToyotaOwners D-4D P1251 E-VRV/vacuum tubing -ketju",
      "sourceNote": "Tämä on halpa ja tärkeä tarkistus nykyisen nykimisen/tehonpuutteen tutkimuksessa."
    },
    "sourceObdText": "MAP/boost actual vs target kuormalla, EGR-komennon vaste; active test jos Techstream tukee kyseistä venttiiliä.",
    "existingInspectionPoints": [],
    "existingImplementation": null,
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "VACUUM TRANSMITTING HOSES/PIPES",
        "25760/25770/25780/25736/25761",
        "25760-26021; 25760-26060; 25770-26020; 25770-26040; 25780-26011; 25736-31010; 25761-26040"
      ],
      "system": "VACUUM PIPING / AIR CLEANER",
      "componentName": "VACUUM TRANSMITTING HOSES/PIPES",
      "pnc": "25760/25770/25780/25736/25761",
      "oe": "25760-26021; 25760-26060; 25770-26020; 25770-26040; 25780-26011; 25736-31010; 25761-26040",
      "likelySection": "VACUUM PIPING / AIR CLEANER / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "Varmista mikä laite käyttää kutakin alipainehaaraa; ei automaattista turbo/EGR-kytkentäoletusta.",
    "excludedActions": [
      "active-test"
    ],
    "recipes": [
      {
        "id": "vikadiag-28-physical",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "signalKeys": [],
        "instruction": "Tarkista letkujen reititys, halkeamat päistä, kovettuminen, öljy/nokijäljet, takaiskuventtiilit ja alipaine käsipumpulla.",
        "expectedPattern": "Fyysinen alipainemittaus ja järjestelmävaste tulkitaan yhdessä.",
        "physicalFollowUp": "Tarkista letkujen reititys, halkeamat päistä, kovettuminen, öljy/nokijäljet, takaiskuventtiilit ja alipaine käsipumpulla."
      },
      {
        "id": "vikadiag-28-context",
        "kind": "cross-check",
        "operatingStates": [
          "running",
          "acceleration"
        ],
        "signalKeys": [
          "engine.map",
          "engine.maf",
          "engine.egr_position_toyota"
        ],
        "instruction": "Varmista letkujen reititys manuaalista ja tarkista tiiviys; vertaa järjestelmävastetta normaalissa ajossa.",
        "expectedPattern": "Fyysinen alipainemittaus ja järjestelmävaste tulkitaan yhdessä.",
        "physicalFollowUp": "Tarkista letkujen reititys, halkeamat päistä, kovettuminen, öljy/nokijäljet, takaiskuventtiilit ja alipaine käsipumpulla."
      }
    ]
  },
  {
    "sourceRow": 29,
    "diagnosticGroup": "3. Ilma, alipaine, EGR ja pakokaasu",
    "componentId": "engine.vacuum_regulating_valve",
    "pnc": "25819",
    "oe": "25819-0R011",
    "label": "Alipaineen säätöventtiili",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Väärä alipaineen säätö voi aiheuttaa turbon/EGR:n liian hitaan tai liian suuren liikkeen: tehonpuute, yli-/aliahto, nykäisy ja limp.",
    "signalKeys": [
      "engine.map",
      "engine.maf",
      "engine.egr_position_toyota"
    ],
    "operatingStates": [
      "running",
      "acceleration"
    ],
    "testMethod": "Tarkista kytkentäkaavio ja alipaine sisään/ulos; vertaa normaalia MAP/MAF/EGR-asentokontekstia.",
    "expectedPattern": "Järjestelmän looginen vaste ei yksin todista säätöventtiiliä ehjäksi.",
    "physicalFollowUp": "Tarkista alipaine sisään/ulos, venttiilin vuodottomuus, sähköliitin, johdot ja ohjauksen vaikutus alipaineeseen.",
    "limitations": [
      "Venttiilin tarkka järjestelmäkytkentä varmistettava ennen komponenttikohtaista johtopäätöstä.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [
      "Venttiilin oma varmennettu palaute/alipainemittaus"
    ],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A29:O29",
      "row": 29,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 988-989, PNC 25819, OE 25819-0R011",
      "sourceConfidence": "Todennäköinen",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "ToyotaOwners D-4D P1251 E-VRV/vacuum-ketjut",
      "sourceNote": "Varmista kytkentäkaavio ennen venttiilin nimeämistä EGR- tai turbo-ohjaukseksi."
    },
    "sourceObdText": "Techstream/Flex: MAP target/actual, EGR-komento ja DTC/freeze frame; active test jos käytettävissä.",
    "existingInspectionPoints": [
      {
        "file": "src/is220d-air-exhaust-inspection-points.js",
        "pointId": "vacuum-regulator-baseline"
      },
      {
        "file": "src/is220d-air-exhaust-inspection-points.js",
        "pointId": "vacuum-regulator-system-response"
      }
    ],
    "existingImplementation": "src/is220d-air-exhaust-inspection-points.js",
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "VALVE ASSY, VACUUM REGULATING",
        "25819",
        "25819-0R011"
      ],
      "system": "VACUUM PIPING",
      "componentName": "VALVE ASSY, VACUUM REGULATING",
      "pnc": "25819",
      "oe": "25819-0R011",
      "likelySection": "VACUUM PIPING / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "connector view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "Venttiilin tarkka järjestelmäkytkentä varmistettava ennen komponenttikohtaista johtopäätöstä.",
    "excludedActions": [
      "active-test"
    ],
    "recipes": []
  },
  {
    "sourceRow": 30,
    "diagnosticGroup": "3. Ilma, alipaine, EGR ja pakokaasu",
    "componentId": "engine.vacuum_switching_valve",
    "pnc": "25860",
    "oe": "25860-0R010",
    "label": "Alipaineen vaihtoventtiili / VSV",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Jumiutuva VSV voi aiheuttaa turboactuatorin/EGR:n väärän asennon, tehonpuutteen, yli-/aliahdon, P1251-tyyppisen limp moden tai satunnaisen nykäisyn.",
    "signalKeys": [
      "engine.map",
      "engine.maf",
      "engine.egr_position_toyota"
    ],
    "operatingStates": [
      "running",
      "acceleration"
    ],
    "testMethod": "Tarkista letkut ja liitin moottori sammuksissa; havainnoi normaalia ajolokia ilman venttiilin ohjaamista.",
    "expectedPattern": "Järjestelmävaste voi nostaa tarkastustarpeen, mutta ei todista VSV:n liikettä.",
    "physicalFollowUp": "Tarkista että venttiili naksuu ohjattaessa, alipaine kulkee oikeasta portista, suodatin/letkut eivät ole tukossa ja sähkövastus/johdot ovat ehjät.",
    "limitations": [
      "Lähteen naksautus/Active Test ei ole Flexin testivaihe.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [
      "VSV:n varmennettu tila ja tarkka alipainekytkentä"
    ],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A30:O30",
      "row": 30,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 990-991, PNC 25860, OE 25860-0R010",
      "sourceConfidence": "Vahva",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "ToyotaOwners D-4D P1251 turbo vacuum valve -ketjut",
      "sourceNote": "Ei kannata vaihtaa ennen letkujen ja alipaineen mittausta."
    },
    "sourceObdText": "Techstream active test jos saatavilla; muuten MAP/boost target/actual ja freeze frame silloin kun vika tulee.",
    "existingInspectionPoints": [
      {
        "file": "src/is220d-air-exhaust-inspection-points.js",
        "pointId": "vacuum-switch-baseline"
      },
      {
        "file": "src/is220d-air-exhaust-inspection-points.js",
        "pointId": "vacuum-switch-system-response"
      }
    ],
    "existingImplementation": "src/is220d-air-exhaust-inspection-points.js",
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "VALVE ASSY, VACUUM SWITCHING, NO.1",
        "25860",
        "25860-0R010"
      ],
      "system": "VACUUM PIPING",
      "componentName": "VALVE ASSY, VACUUM SWITCHING, NO.1",
      "pnc": "25860",
      "oe": "25860-0R010",
      "likelySection": "VACUUM PIPING / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "connector view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "Lähteen naksautus/Active Test ei ole Flexin testivaihe.",
    "excludedActions": [
      "active-test"
    ],
    "recipes": []
  },
  {
    "sourceRow": 31,
    "diagnosticGroup": "3. Ilma, alipaine, EGR ja pakokaasu",
    "componentId": "engine.vacuum_gas_filter",
    "pnc": "23265C",
    "oe": "90917-11036",
    "label": "Alipaine-/kaasusuodatin ohjausjärjestelmässä",
    "obdRole": "indirect",
    "readiness": "needs-signal-verification",
    "symptom": "Tukkeutuessaan voi hidastaa alipaineohjauksen vastetta ja aiheuttaa turbon/EGR:n satunnaista toimintaa, nykimistä tai tehonpuutetta.",
    "signalKeys": [
      "engine.map",
      "engine.egr_position_toyota"
    ],
    "operatingStates": [
      "running"
    ],
    "testMethod": "Varmista ensin suodattimen sijainti ja tehtävä alipainekaaviosta; MAP/EGR on vain taustakonteksti.",
    "expectedPattern": "Komponentin johtopäätös ei ole mahdollinen ennen kytkentäkaavion varmennusta.",
    "physicalFollowUp": "Tarkista virtaussuunta, läpäisevyys ja ettei suodatin ole öljystä/nokesta tukossa; vertaa uuteen osaan.",
    "limitations": [
      "Drive merkitsee osan tehtävän epävarmaksi; sitä ei nimetä varmistetuksi turbon suodattimeksi.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [
      "Suodattimen kytkentäkaavio ja sen haaran varmennettu vaste"
    ],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A31:O31",
      "row": 31,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 966-967, PNC 23265C, OE 90917-11036",
      "sourceConfidence": "Epävarma",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "ToyotaOwners D-4D vacuum/E-VRV -ketju; Toyota alipainejärjestelmän rakenne",
      "sourceNote": "Tarkka tehtävä pitää varmistaa alipainekaaviosta."
    },
    "sourceObdText": "Ei suoraa OBD-arvoa; vaikutus näkyy vain alipaineohjatun laitteen hitaana vasteena MAP/EGR-datassa.",
    "existingInspectionPoints": [],
    "existingImplementation": null,
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "FILTER, GAS",
        "23265C",
        "90917-11036"
      ],
      "system": "VACUUM PIPING",
      "componentName": "FILTER, GAS",
      "pnc": "23265C",
      "oe": "90917-11036",
      "likelySection": "VACUUM PIPING / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "Drive merkitsee osan tehtävän epävarmaksi; sitä ei nimetä varmistetuksi turbon suodattimeksi.",
    "recipes": [
      {
        "id": "vikadiag-31-physical",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "signalKeys": [],
        "instruction": "Tarkista virtaussuunta, läpäisevyys ja ettei suodatin ole öljystä/nokesta tukossa; vertaa uuteen osaan.",
        "expectedPattern": "Komponentin johtopäätös ei ole mahdollinen ennen kytkentäkaavion varmennusta.",
        "physicalFollowUp": "Tarkista virtaussuunta, läpäisevyys ja ettei suodatin ole öljystä/nokesta tukossa; vertaa uuteen osaan."
      },
      {
        "id": "vikadiag-31-context",
        "kind": "cross-check",
        "operatingStates": [
          "running"
        ],
        "signalKeys": [
          "engine.map",
          "engine.egr_position_toyota"
        ],
        "instruction": "Varmista ensin suodattimen sijainti ja tehtävä alipainekaaviosta; MAP/EGR on vain taustakonteksti.",
        "expectedPattern": "Komponentin johtopäätös ei ole mahdollinen ennen kytkentäkaavion varmennusta.",
        "physicalFollowUp": "Tarkista virtaussuunta, läpäisevyys ja ettei suodatin ole öljystä/nokesta tukossa; vertaa uuteen osaan."
      }
    ]
  },
  {
    "sourceRow": 32,
    "diagnosticGroup": "4. Polttoainejärjestelmä",
    "componentId": "engine.fuel_filter",
    "pnc": "23300/23303",
    "oe": "23300-26100; 23390-0L010",
    "label": "Polttoainesuodatin ja suodatinelementti",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Tukkeutuminen tai ilma suodatinpesässä aiheuttaa pitkän startin, tehonpuutteen kuormalla, nykimisen, sammumisen, low rail pressure -oireen ja joskus fuel filter -varoituksen.",
    "signalKeys": [
      "engine.rail_pressure_obd",
      "engine.rpm"
    ],
    "operatingStates": [
      "cranking",
      "running",
      "acceleration"
    ],
    "testMethod": "Tarkista suodatin/tiivisteet ja vertaa rail-paineen nousua sekä kuormavastetta.",
    "expectedPattern": "Rail-paineen havaittu vaste suhteutetaan starttiin ja kuormaan.",
    "physicalFollowUp": "Vaihda/tarkista elementti, tiivisteet ja priming; tarkista vesi/roska, käsipumpun tuntuma ja ilmavuodot suodatinpesässä.",
    "limitations": [
      "Tavoite puuttuu; hidas paineennousu ei yksin todista suodatinta.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [
      "Ajoneuvovarmennettu rail-paineen tavoite"
    ],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A32:O32",
      "row": 32,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 1256-1259, PNC 23300/23303, OE 23300-26100/23390-0L010",
      "sourceConfidence": "Vahva",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "ToyotaOwners 2AD-FHV fuel filter/check battery -ketju; DENSO/Delphi common rail -ohjeet",
      "sourceNote": "Ensimmäinen tarkistus ennen pumpun, SCV:n tai suutinten epäilyä rail pressure -oireessa."
    },
    "sourceObdText": "Techstream/Flex: rail pressure target vs actual startissa ja kuormalla; DTC/freeze frame P0087/P0093-tyyppisissä.",
    "existingInspectionPoints": [
      {
        "file": "src/is220d-fuel-inspection-points.js",
        "pointId": "fuel-filter-baseline"
      },
      {
        "file": "src/is220d-fuel-inspection-points.js",
        "pointId": "fuel-filter-rail-build"
      }
    ],
    "existingImplementation": "src/is220d-fuel-inspection-points.js",
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "FILTER ASSY, FUEL / ELEMENT SUB-ASSY",
        "23300/23303",
        "23300-26100; 23390-0L010"
      ],
      "system": "FUEL FILTER",
      "componentName": "FILTER ASSY, FUEL / ELEMENT SUB-ASSY",
      "pnc": "23300/23303",
      "oe": "23300-26100; 23390-0L010",
      "likelySection": "FUEL FILTER / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "Tavoite puuttuu; hidas paineennousu ei yksin todista suodatinta.",
    "recipes": []
  },
  {
    "sourceRow": 33,
    "diagnosticGroup": "4. Polttoainejärjestelmä",
    "componentId": "engine.fuel_sedimenter",
    "pnc": "23930",
    "oe": "23930-26010",
    "label": "Polttoaineen vedenerotin/sedimenttiyksikkö",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Vesi tai lika polttoaineessa voi aiheuttaa fuel filter -varoituksen, ruostetta, käyntihäiriöitä, suutinvaurioita, rail pressure -häiriöitä ja huonoa käynnistymistä.",
    "signalKeys": [
      "engine.rail_pressure_obd",
      "engine.rpm"
    ],
    "operatingStates": [
      "cranking",
      "running"
    ],
    "testMethod": "Tarkista polttoainenäyte ja tiivisteet; käytä rail/RPM-lokia käyntihäiriön kontekstina.",
    "expectedPattern": "Näytteestä havaittu vesi/lika on fyysinen löydös; rail-vaste ei tunnista kontaminaatiota.",
    "physicalFollowUp": "Tyhjennä/ota näyte alhaalta, tarkista veden/roskan määrä, tiivisteet, anturi ja mahdollinen vuoto.",
    "limitations": [
      "Flex ei mittaa veden määrää tai polttoaineen puhtautta.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [
      "Ajoneuvovarmennettu vedenerottimen varoitustila ja rail-tavoite"
    ],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A33:O33",
      "row": 33,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 1270-1271, PNC 23930, OE 23930-26010",
      "sourceConfidence": "Vahva",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "Delphi common rail fuel/water contamination -ohjeet; ToyotaOwners 2AD-FHV fuel filter -ketju",
      "sourceNote": "Tärkeä erityisesti, jos suodattimen vaihdon jälkeen tulee varoituksia."
    },
    "sourceObdText": "Rail pressure target/actual, fuel filter/water warning jos ECU näyttää, DTC:t; ei korvaa näytteen tarkistusta.",
    "existingInspectionPoints": [],
    "existingImplementation": null,
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "SEDIMENTER ASSY, FUEL",
        "23930",
        "23930-26010"
      ],
      "system": "FUEL FILTER",
      "componentName": "SEDIMENTER ASSY, FUEL",
      "pnc": "23930",
      "oe": "23930-26010",
      "likelySection": "FUEL FILTER / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "Flex ei mittaa veden määrää tai polttoaineen puhtautta.",
    "recipes": [
      {
        "id": "vikadiag-33-physical",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "signalKeys": [],
        "instruction": "Tyhjennä/ota näyte alhaalta, tarkista veden/roskan määrä, tiivisteet, anturi ja mahdollinen vuoto.",
        "expectedPattern": "Näytteestä havaittu vesi/lika on fyysinen löydös; rail-vaste ei tunnista kontaminaatiota.",
        "physicalFollowUp": "Tyhjennä/ota näyte alhaalta, tarkista veden/roskan määrä, tiivisteet, anturi ja mahdollinen vuoto."
      },
      {
        "id": "vikadiag-33-context",
        "kind": "cross-check",
        "operatingStates": [
          "cranking",
          "running"
        ],
        "signalKeys": [
          "engine.rail_pressure_obd",
          "engine.rpm"
        ],
        "instruction": "Tarkista polttoainenäyte ja tiivisteet; käytä rail/RPM-lokia käyntihäiriön kontekstina.",
        "expectedPattern": "Näytteestä havaittu vesi/lika on fyysinen löydös; rail-vaste ei tunnista kontaminaatiota.",
        "physicalFollowUp": "Tyhjennä/ota näyte alhaalta, tarkista veden/roskan määrä, tiivisteet, anturi ja mahdollinen vuoto."
      }
    ]
  },
  {
    "sourceRow": 34,
    "diagnosticGroup": "4. Polttoainejärjestelmä",
    "componentId": "engine.injection_pump",
    "pnc": "22100",
    "oe": "22100-0R031",
    "label": "Common rail -korkeapainepumppu / syöttöpumppu",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Ei rail-painetta startissa, sammuminen, limp mode, tehon katoaminen kuormalla, metallihile polttoaineessa tai rail pressure target/actual -ero.",
    "signalKeys": [
      "engine.rail_pressure_obd",
      "engine.rpm"
    ],
    "operatingStates": [
      "cranking",
      "running",
      "acceleration"
    ],
    "testMethod": "Sulje pois suodatin, ilma ja paluuvuodot ennen pumpun arviointia; tallenna rail/RPM.",
    "expectedPattern": "Rail-paine reagoi starttiin/kuormaan loogisesti, mutta poikkeama voi tulla useasta osasta.",
    "physicalFollowUp": "Ennen pumpun tuomiota tarkista tankin puoli, suodatin, ilmavuodot, SCV, paluuvuodot ja polttoainenäyte metallihileelle.",
    "limitations": [
      "Ei pumpun Active Testiä eikä pumpputuomiota pelkän rail-arvon perusteella.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [
      "Ajoneuvovarmennettu rail-tavoite ja SCV-palaute"
    ],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A34:O34",
      "row": 34,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 1139-1140, PNC 22100, OE 22100-0R031",
      "sourceConfidence": "Vahva",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "DENSO common rail SCV/pump-tiedot; Delphi common rail diagnostic -ohjeet",
      "sourceNote": "Kallis osa; diagnoosin pitää erottaa pumppu, SCV, suodatin, ilmavuoto ja suuttimen paluuvuoto."
    },
    "sourceObdText": "Techstream: rail pressure target/actual startissa, tyhjäkäynnillä ja kuormalla; fuel leak test / pump test jos saatavilla.",
    "existingInspectionPoints": [
      {
        "file": "src/is220d-fuel-inspection-points.js",
        "pointId": "pump-preconditions"
      },
      {
        "file": "src/is220d-fuel-inspection-points.js",
        "pointId": "pump-rail-build"
      }
    ],
    "existingImplementation": "src/is220d-fuel-inspection-points.js",
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "PUMP ASSY, INJECTION OR SUPPLY",
        "22100",
        "22100-0R031"
      ],
      "system": "INJECTION PUMP ASSEMBLY",
      "componentName": "PUMP ASSY, INJECTION OR SUPPLY",
      "pnc": "22100",
      "oe": "22100-0R031",
      "likelySection": "INJECTION PUMP ASSEMBLY / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "Ei pumpun Active Testiä eikä pumpputuomiota pelkän rail-arvon perusteella.",
    "excludedActions": [
      "active-test"
    ],
    "recipes": []
  },
  {
    "sourceRow": 35,
    "diagnosticGroup": "4. Polttoainejärjestelmä",
    "componentId": "engine.injection_high_pressure_pipes",
    "pnc": "23701/23702/23703/23704",
    "oe": "23701-26040/26050; 23702-26040/26050; 23703-26040/26050; 23704-26010",
    "label": "Korkeapaineputket suuttimille",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Vuoto tai halkeama voi aiheuttaa dieselin hajua, rail pressure -laskua, käyntihäiriötä, huonoa käynnistymistä tai vikakoodin polttoainepaineesta.",
    "signalKeys": [
      "engine.rail_pressure_obd",
      "engine.rpm"
    ],
    "operatingStates": [
      "cranking",
      "running"
    ],
    "testMethod": "Tarkista vuotojäljet moottori sammuksissa; aiempi rail/RPM-loki antaa vain painekontekstin.",
    "expectedPattern": "Fyysinen vuotolöydös ratkaisee putkiston tarkastustarpeen.",
    "physicalFollowUp": "Tarkista visuaalisesti märkyys/valumat ja liitosten jäljet; älä tunnustele kädellä käyvän common rail -putken vuotoa.",
    "limitations": [
      "Käyvän korkeapaineputken vuotoa ei tunnustella kädellä; ei vuotoa provosoivaa ajokoetta.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [
      "Ajoneuvovarmennettu rail-paineen tavoite"
    ],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A35:O35",
      "row": 35,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 1168-1178, PNC 23701-23704",
      "sourceConfidence": "Vahva",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "Delphi common rail high-pressure lines/leak-off -ohjeet",
      "sourceNote": "Korkeapaineputket ovat yleensä kertakiristettäviä valmistajan ohjeen mukaan; tarkista manuaali ennen uudelleenkäyttöä."
    },
    "sourceObdText": "Rail pressure target/actual ja fuel leak / pressure leak -DTC:t; vuodon varmistus fyysisesti.",
    "existingInspectionPoints": [],
    "existingImplementation": null,
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "PIPE SUB-ASSY, INJECTION NO.1-4",
        "23701/23702/23703/23704",
        "23701-26040/26050; 23702-26040/26050; 23703-26040/26050; 23704-26010"
      ],
      "system": "INJECTION PUMP ASSEMBLY",
      "componentName": "PIPE SUB-ASSY, INJECTION NO.1-4",
      "pnc": "23701/23702/23703/23704",
      "oe": "23701-26040/26050; 23702-26040/26050; 23703-26040/26050; 23704-26010",
      "likelySection": "INJECTION PUMP ASSEMBLY / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "Käyvän korkeapaineputken vuotoa ei tunnustella kädellä; ei vuotoa provosoivaa ajokoetta.",
    "recipes": [
      {
        "id": "vikadiag-35-physical",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "signalKeys": [],
        "instruction": "Tarkista visuaalisesti märkyys/valumat ja liitosten jäljet; älä tunnustele kädellä käyvän common rail -putken vuotoa.",
        "expectedPattern": "Fyysinen vuotolöydös ratkaisee putkiston tarkastustarpeen.",
        "physicalFollowUp": "Tarkista visuaalisesti märkyys/valumat ja liitosten jäljet; älä tunnustele kädellä käyvän common rail -putken vuotoa."
      },
      {
        "id": "vikadiag-35-context",
        "kind": "cross-check",
        "operatingStates": [
          "cranking",
          "running"
        ],
        "signalKeys": [
          "engine.rail_pressure_obd",
          "engine.rpm"
        ],
        "instruction": "Tarkista vuotojäljet moottori sammuksissa; aiempi rail/RPM-loki antaa vain painekontekstin.",
        "expectedPattern": "Fyysinen vuotolöydös ratkaisee putkiston tarkastustarpeen.",
        "physicalFollowUp": "Tarkista visuaalisesti märkyys/valumat ja liitosten jäljet; älä tunnustele kädellä käyvän common rail -putken vuotoa."
      }
    ]
  },
  {
    "sourceRow": 36,
    "diagnosticGroup": "4. Polttoainejärjestelmä",
    "componentId": "engine.low_pressure_fuel_hoses",
    "pnc": "23271H/23273H/23274D/23282D/23284A",
    "oe": "23271-26030; 23273-26010; 23274-26020; 23282-26050; 23284-26030",
    "label": "Matalapainepuolen polttoaineletkut",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Ilmavuoto, litistynyt letku tai vuoto voi aiheuttaa pitkän startin, sammumisen, nykimisen, matalan rail-paineen kuormalla ja käsipumpun pehmeyden.",
    "signalKeys": [
      "engine.rail_pressure_obd",
      "engine.rpm"
    ],
    "operatingStates": [
      "cranking",
      "running",
      "acceleration"
    ],
    "testMethod": "Tarkista letkujen tiiviys ja litistymät; vertaa rail-paineen nousua ja kuormavastetta.",
    "expectedPattern": "Syöttöpuolen häiriö voi näkyä rail-vasteessa, mutta letku paikannetaan fyysisesti.",
    "physicalFollowUp": "Tarkista letkunpäät, klemmarit, halkeamat, märkyys, ilmakuplat läpinäkyvällä testiletkulla ja paineen/pumpun pysyvyys seisonnan jälkeen.",
    "limitations": [
      "Rail ei mittaa matalapainepuolen painetta tai ilmakuplia.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [
      "Matalapainepuolen varmennettu paine/virtaus ja rail-tavoite"
    ],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A36:O36",
      "row": 36,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 1149-1167 ja 1240-1255, PNC 23271H ym.",
      "sourceConfidence": "Vahva",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "DENSO/Delphi common rail low-pressure supply -diagnostiikka",
      "sourceNote": "Halpa tarkistus ennen rail-painekomponenttien vaihtoa."
    },
    "sourceObdText": "Rail pressure cranking ja kuormalla; oire voi näkyä vasta vedossa. Ei yksin paikanna letkua.",
    "existingInspectionPoints": [],
    "existingImplementation": null,
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "FUEL HOSES NO.1-5",
        "23271H/23273H/23274D/23282D/23284A",
        "23271-26030; 23273-26010; 23274-26020; 23282-26050; 23284-26030"
      ],
      "system": "INJECTION PUMP ASSEMBLY / FUEL FILTER",
      "componentName": "FUEL HOSES NO.1-5",
      "pnc": "23271H/23273H/23274D/23282D/23284A",
      "oe": "23271-26030; 23273-26010; 23274-26020; 23282-26050; 23284-26030",
      "likelySection": "INJECTION PUMP ASSEMBLY / FUEL FILTER / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "Rail ei mittaa matalapainepuolen painetta tai ilmakuplia.",
    "recipes": [
      {
        "id": "vikadiag-36-physical",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "signalKeys": [],
        "instruction": "Tarkista letkunpäät, klemmarit, halkeamat, märkyys, ilmakuplat läpinäkyvällä testiletkulla ja paineen/pumpun pysyvyys seisonnan jälkeen.",
        "expectedPattern": "Syöttöpuolen häiriö voi näkyä rail-vasteessa, mutta letku paikannetaan fyysisesti.",
        "physicalFollowUp": "Tarkista letkunpäät, klemmarit, halkeamat, märkyys, ilmakuplat läpinäkyvällä testiletkulla ja paineen/pumpun pysyvyys seisonnan jälkeen."
      },
      {
        "id": "vikadiag-36-context",
        "kind": "cross-check",
        "operatingStates": [
          "cranking",
          "running",
          "acceleration"
        ],
        "signalKeys": [
          "engine.rail_pressure_obd",
          "engine.rpm"
        ],
        "instruction": "Tarkista letkujen tiiviys ja litistymät; vertaa rail-paineen nousua ja kuormavastetta.",
        "expectedPattern": "Syöttöpuolen häiriö voi näkyä rail-vasteessa, mutta letku paikannetaan fyysisesti.",
        "physicalFollowUp": "Tarkista letkunpäät, klemmarit, halkeamat, märkyys, ilmakuplat läpinäkyvällä testiletkulla ja paineen/pumpun pysyvyys seisonnan jälkeen."
      }
    ]
  },
  {
    "sourceRow": 37,
    "diagnosticGroup": "4. Polttoainejärjestelmä",
    "componentId": "engine.fuel_check_valve",
    "pnc": "23122B",
    "oe": "23769-26020",
    "label": "Polttoainejärjestelmän takaiskuventtiili",
    "obdRole": "indirect",
    "readiness": "indirect-existing-signals",
    "symptom": "Jos polttoaine valuu takaisin seisonnan aikana, oire voi olla pitkä startti yön jälkeen, ilmakuplat, käsipumpun tyhjeneminen ja rail pressure -hidas nousu.",
    "signalKeys": [
      "engine.rail_pressure_obd",
      "engine.rpm"
    ],
    "operatingStates": [
      "cranking"
    ],
    "testMethod": "Vertaa seisonnan jälkeistä tavallista starttia fyysisen primauksen jälkeiseen starttiin.",
    "expectedPattern": "Primauksen jälkeen muuttunut paineennousu tukee syöttöpuolen tarkastusta, ei yksin takaiskuventtiilivikaa.",
    "physicalFollowUp": "Prime-pumppaus ennen starttia, läpinäkyvä testiletku, seisonnan jälkeinen polttoaineen pysyvyys ja venttiilin läpäisy vain oikeaan suuntaan.",
    "limitations": [
      "Starttinopeus, seisonta ja lämpötila vaikuttavat vertailuun; varmista venttiilin sijainti.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [
      "Ajoneuvovarmennettu rail-tavoite"
    ],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A37:O37",
      "row": 37,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 1147-1148, PNC 23122B, OE 23769-26020",
      "sourceConfidence": "Todennäköinen",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "DENSO/Delphi common rail fuel drain-back -periaate",
      "sourceNote": "Varmista venttiilin tarkka sijainti putkistossa ennen osan epäilyä."
    },
    "sourceObdText": "Rail pressure cranking: paine nousee hitaasti ensimmäisellä startilla mutta paremmin primauksen jälkeen.",
    "existingInspectionPoints": [],
    "existingImplementation": null,
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "VALVE, CHECK",
        "23122B",
        "23769-26020"
      ],
      "system": "INJECTION PUMP ASSEMBLY",
      "componentName": "VALVE, CHECK",
      "pnc": "23122B",
      "oe": "23769-26020",
      "likelySection": "INJECTION PUMP ASSEMBLY / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "Starttinopeus, seisonta ja lämpötila vaikuttavat vertailuun; varmista venttiilin sijainti.",
    "recipes": [
      {
        "id": "vikadiag-37-physical",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "signalKeys": [],
        "instruction": "Prime-pumppaus ennen starttia, läpinäkyvä testiletku, seisonnan jälkeinen polttoaineen pysyvyys ja venttiilin läpäisy vain oikeaan suuntaan.",
        "expectedPattern": "Primauksen jälkeen muuttunut paineennousu tukee syöttöpuolen tarkastusta, ei yksin takaiskuventtiilivikaa.",
        "physicalFollowUp": "Prime-pumppaus ennen starttia, läpinäkyvä testiletku, seisonnan jälkeinen polttoaineen pysyvyys ja venttiilin läpäisy vain oikeaan suuntaan."
      },
      {
        "id": "vikadiag-37-context",
        "kind": "cross-check",
        "operatingStates": [
          "cranking"
        ],
        "signalKeys": [
          "engine.rail_pressure_obd",
          "engine.rpm"
        ],
        "instruction": "Vertaa seisonnan jälkeistä tavallista starttia fyysisen primauksen jälkeiseen starttiin.",
        "expectedPattern": "Primauksen jälkeen muuttunut paineennousu tukee syöttöpuolen tarkastusta, ei yksin takaiskuventtiilivikaa.",
        "physicalFollowUp": "Prime-pumppaus ennen starttia, läpinäkyvä testiletku, seisonnan jälkeinen polttoaineen pysyvyys ja venttiilin läpäisy vain oikeaan suuntaan."
      }
    ]
  },
  {
    "sourceRow": 38,
    "diagnosticGroup": "4. Polttoainejärjestelmä",
    "componentId": "engine.supply_pump_drive_coupling",
    "pnc": "13614A",
    "oe": "13614-26010",
    "label": "Syöttöpumpun mekaaninen käyttökytkin/kytkentä",
    "obdRole": "physical-only",
    "readiness": "physical-only",
    "symptom": "Mekaaninen välys tai rikkoutuminen voi aiheuttaa pumpun pyörimättömyyttä, no-startia, matalaa rail-painetta, epänormaalia ääntä tai metallijätettä.",
    "signalKeys": [],
    "operatingStates": [
      "physical"
    ],
    "testMethod": "Mekaaninen tarkastus vasta muiden no-start/rail-paineen syiden poissulun jälkeen manuaalin mukaan.",
    "expectedPattern": "Pumpun käyttökytkimen vaurio todetaan mekaanisesti.",
    "physicalFollowUp": "Tarkista vain jos rail-paine ei nouse ja sähkö/suodatin/SCV/suuttimet on poissuljettu; vaatii mekaanisen tarkastuksen pumpun irrotuksen yhteydessä.",
    "limitations": [
      "Drive-lähteen rakennelogiikka on epävarma; matala rail-paine ei todista käyttökytkintä.",
      "Ei automaattista osan hyväksymistä/hylkäystä eikä uusia numeerisia rajoja."
    ],
    "missingSignals": [],
    "source": {
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8",
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "range": "A38:O38",
      "row": 38,
      "reviewedAt": "2026-09-14",
      "bomSource": "BOM rivit 1133-1134, PNC 13614A, OE 13614-26010",
      "sourceConfidence": "Epävarma",
      "sourceStatus": "Erä 2 valmis",
      "externalSource": "DENSO common rail pump -rakennelogiikka; BOM service-BOM",
      "sourceNote": "Harvinainen epäily; pidä viimeisenä mekaanisena tarkistuksena."
    },
    "sourceObdText": "Rail pressure cranking pysyy matalana vaikka SCV/sähkö näyttää toimivan; ei yksin todista kytkintä.",
    "existingInspectionPoints": [],
    "existingImplementation": null,
    "manualVisual": {
      "required": true,
      "status": "pending-extract",
      "source": "Lexus IS250/220D repair manual",
      "searchTerms": [
        "2AD-FHV",
        "COUPLING, SUPPLY PUMP DRIVE, NO.1",
        "13614A",
        "13614-26010"
      ],
      "system": "INJECTION PUMP ASSEMBLY",
      "componentName": "COUPLING, SUPPLY PUMP DRIVE, NO.1",
      "pnc": "13614A",
      "oe": "13614-26010",
      "likelySection": "INJECTION PUMP ASSEMBLY / components / inspection",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ],
      "assetPath": null,
      "manualReference": null
    },
    "note": "Drive-lähteen rakennelogiikka on epävarma; matala rail-paine ei todista käyttökytkintä.",
    "recipes": [
      {
        "id": "vikadiag-38-physical",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "signalKeys": [],
        "instruction": "Tarkista vain jos rail-paine ei nouse ja sähkö/suodatin/SCV/suuttimet on poissuljettu; vaatii mekaanisen tarkastuksen pumpun irrotuksen yhteydessä.",
        "expectedPattern": "Pumpun käyttökytkimen vaurio todetaan mekaanisesti.",
        "physicalFollowUp": "Tarkista vain jos rail-paine ei nouse ja sähkö/suodatin/SCV/suuttimet on poissuljettu; vaatii mekaanisen tarkastuksen pumpun irrotuksen yhteydessä."
      }
    ]
  }
];

const chassisContinuation = [
  {
    "componentId": "brakes.master_cylinder",
    "diagnosticGroup": "9. Jarrut, ohjaus ja alusta",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Vajoava poljin tai nestevuoto vaatii hydraulisen tarkastuksen; havainto ei yksilöi pääsylinteriä.",
    "label": "Jarrupääsylinteri",
    "limitations": [
      "ABS/VSC-maininta ei anna Flexille varmennettua jarrupainesignaalia.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "CYLINDER SUB-ASSY, BRAKE MASTER W/PLATE",
      "likelySection": "BRAKE MASTER CYLINDER / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "47028-53020",
      "pnc": "47028",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "CYLINDER SUB-ASSY, BRAKE MASTER W/PLATE",
        "47028",
        "47028-53020"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "BRAKE MASTER CYLINDER",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "ABS/VSC-maininta ei anna Flexille varmennettua jarrupainesignaalia.",
    "obdRole": "physical-only",
    "oe": "47028-53020",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Tarkista nestepinta, näkyvät vuodot ja polkimen vajoaminen paikallaan. Hydraulinen varmistus tehdään manuaalin mukaan.",
    "pnc": "47028",
    "readiness": "physical-only",
    "recipes": [
      {
        "expectedPattern": "Vajoava poljin tai nestevuoto vaatii hydraulisen tarkastuksen; havainto ei yksilöi pääsylinteriä.",
        "id": "vikadiag-39-physical",
        "instruction": "Tarkista nestepinta, näkyvät vuodot ja polkimen vajoaminen paikallaan. Hydraulinen varmistus tehdään manuaalin mukaan.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista nestepinta, näkyvät vuodot ja polkimen vajoaminen paikallaan. Hydraulinen varmistus tehdään manuaalin mukaan.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2583-2584, PNC 47028, OE 47028-53020",
      "externalSource": "Yleinen jarrudiagnostiikka; Haynes/Trodo seized brake caliper -erottelu; LexusOwners brake problem -ketjut",
      "range": "A39:O39",
      "reviewedAt": "2026-09-15",
      "row": 39,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Todennäköinen",
      "sourceNote": "Pääsylinteriä ei kannata epäillä ennen kuin mekaaniset satula-/letkuviat on poissuljettu.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "ABS/VSC-koodeista voi nähdä paine-/järjestelmäpoikkeamia, mutta pääsylinterin varmistus on hydraulinen testi ja vuototarkastus.",
    "sourcePhysicalText": "Tarkista nestetaso, ulkoiset vuodot, polkimen hidas vajoaminen paikallaan painettuna, takaisku/ohivuoto sekä ilmaus. Poissulje ensin satulat, letkut ja ABS-yksikkö.",
    "sourceRow": 39,
    "symptom": "Pehmeä tai vajoava jarrupoljin, jarrupaineen häviäminen, epätasainen jarrutus, nestevuoto tai sisäinen ohivuoto ilman ulkoista vuotoa.",
    "testMethod": "Tarkista nestepinta, näkyvät vuodot ja polkimen vajoaminen paikallaan. Hydraulinen varmistus tehdään manuaalin mukaan."
  },
  {
    "componentId": "brakes.booster",
    "diagnosticGroup": "9. Jarrut, ohjaus ja alusta",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Polkimen pieni painuminen tukee tehostimen toimintaa; poikkeama ohjaa alipaineen, letkun ja tehostimen tarkastukseen.",
    "label": "Jarrutehostin",
    "limitations": [
      "MAP ei mittaa dieselmoottorin jarrutehostimen alipainetta.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "BOOSTER ASSY, BRAKE",
      "figureReviewed": true,
      "imageSourcePath": "rm0150/repair2/img/c109132.png",
      "likelySection": "BRAKE BOOSTER VACUUM TUBE / COMPONENTS / INSPECTION",
      "manualReference": "IS250,220D.iso / rm0150/repair2/html/contents/rm000002811000x.html / BRAKE BOOSTER > ON-VEHICLE INSPECTION",
      "oe": "44610-53290",
      "pnc": "44610",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "BOOSTER ASSY, BRAKE",
        "44610",
        "44610-53290"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "source-identified",
      "system": "BRAKE BOOSTER VACUUM TUBE",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "MAP ei mittaa dieselmoottorin jarrutehostimen alipainetta.",
    "obdRole": "physical-only",
    "oe": "44610-53290",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Auto paikallaan: paina poljinta useasti moottori sammuksissa, pidä painettuna ja käynnistä tavallisesti; havainnoi painuuko poljin hieman.",
    "pnc": "44610",
    "readiness": "physical-only",
    "recipes": [
      {
        "expectedPattern": "Polkimen pieni painuminen tukee tehostimen toimintaa; poikkeama ohjaa alipaineen, letkun ja tehostimen tarkastukseen.",
        "id": "vikadiag-40-physical",
        "instruction": "Auto paikallaan: paina poljinta useasti moottori sammuksissa, pidä painettuna ja käynnistä tavallisesti; havainnoi painuuko poljin hieman.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Auto paikallaan: paina poljinta useasti moottori sammuksissa, pidä painettuna ja käynnistä tavallisesti; havainnoi painuuko poljin hieman.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2605-2606, PNC 44610, OE 44610-53290",
      "externalSource": "LexusOwners brake servo/brake problem -keskustelut; yleinen brake booster diagnosis",
      "range": "A40:O40",
      "reviewedAt": "2026-09-15",
      "row": 40,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Todennäköinen",
      "sourceNote": "Dieselissä alipainejärjestelmä on samalla kriittinen myös muille ohjauksille, joten letkut ensin.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "OBD-rooli epäsuora: alipaine-/käyntihäiriöt ja ABS/VSC-koodit eivät yksin todista tehostinta.",
    "sourcePhysicalText": "Pumppaa jarrua moottori sammuksissa, pidä poljinta ja käynnistä: polkimen pitäisi painua hieman. Tarkista alipaineletku, tehostimen tiiviste ja yksisuuntaventtiili.",
    "sourceRow": 40,
    "symptom": "Kova jarrupoljin, heikko tehostus, moottorin käyntimuutos jarrua painettaessa, suhina tai alipainevuoto.",
    "testMethod": "Auto paikallaan: paina poljinta useasti moottori sammuksissa, pidä painettuna ja käynnistä tavallisesti; havainnoi painuuko poljin hieman."
  },
  {
    "componentId": "brakes.booster_vacuum_hoses",
    "diagnosticGroup": "9. Jarrut, ohjaus ja alusta",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Vuoto tai väärä virtaussuunta on fyysinen löydös.",
    "label": "Jarrutehostimen alipaineventtiili ja letkut",
    "limitations": [
      "Moottorin MAP tai ABS-varoitus ei paikanna tehostimen alipainevuotoa.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "VACUUM CHECK VALVE / VACUUM HOSES",
      "likelySection": "BRAKE BOOSTER VACUUM TUBE / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "44730-28010; 44750-53150; 44750-53130",
      "pnc": "44730/44750/44773",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "VACUUM CHECK VALVE / VACUUM HOSES",
        "44730/44750/44773",
        "44730-28010; 44750-53150; 44750-53130"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "BRAKE BOOSTER VACUUM TUBE",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "Moottorin MAP tai ABS-varoitus ei paikanna tehostimen alipainevuotoa.",
    "obdRole": "physical-only",
    "oe": "44730-28010; 44750-53150; 44750-53130",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Tarkista letkujen halkeamat, läpiviennit ja takaiskuventtiilin tiiviys/suunta; varmista alipaineen pysyvyys käsipumpulla manuaalin mukaan.",
    "pnc": "44730/44750/44773",
    "readiness": "physical-only",
    "recipes": [
      {
        "expectedPattern": "Vuoto tai väärä virtaussuunta on fyysinen löydös.",
        "id": "vikadiag-41-physical",
        "instruction": "Tarkista letkujen halkeamat, läpiviennit ja takaiskuventtiilin tiiviys/suunta; varmista alipaineen pysyvyys käsipumpulla manuaalin mukaan.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista letkujen halkeamat, läpiviennit ja takaiskuventtiilin tiiviys/suunta; varmista alipaineen pysyvyys käsipumpulla manuaalin mukaan.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2609-2616, PNC 44730/44750/44773",
      "externalSource": "LexusOwners brake servo -havainto; yleinen brake booster vacuum diagnosis",
      "range": "A41:O41",
      "reviewedAt": "2026-09-15",
      "row": 41,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Halpa tarkistus ennen tehostimen vaihtoa.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "Ei suoraa OBD-varmistusta; moottorinohjauksen alipainepoikkeamat ja VSC/ABS-oireet voivat olla vain epäsuoria.",
    "sourcePhysicalText": "Tarkista yksisuuntaventtiilin suunta ja tiiveys, letkujen halkeamat, kumiläpiviennit ja alipaineen pysyvyys käsipumpulla.",
    "sourceRow": 41,
    "symptom": "Kova jarrupoljin erityisesti toistuvissa jarrutuksissa, suhina, alipaineen katoaminen seisonnan jälkeen tai tehostuksen viive.",
    "testMethod": "Tarkista letkujen halkeamat, läpiviennit ja takaiskuventtiilin tiiviys/suunta; varmista alipaineen pysyvyys käsipumpulla manuaalin mukaan."
  },
  {
    "componentId": "brakes.front_pads_discs",
    "diagnosticGroup": "9. Jarrut, ohjaus ja alusta",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Puolten/palojen kulumaero ohjaa myös satulan, liukutappien ja letkun tarkastukseen.",
    "label": "Etujarrupalat ja -levyt",
    "limitations": [
      "Mallikohtaiset kuluma- ja heittorajat odottavat manuaalin varmennusta; pyöränopeus ei mittaa kulumaa.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "PAD KIT, DISC BRAKE, FRONT / DISC, FRONT",
      "likelySection": "FRONT DISC BRAKE CALIPER DUST COVER / FRONT AXLE HUB / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "04465-53040; 43512-30310",
      "pnc": "04465/43512",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "PAD KIT, DISC BRAKE, FRONT / DISC, FRONT",
        "04465/43512",
        "04465-53040; 43512-30310"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "FRONT DISC BRAKE CALIPER DUST COVER / FRONT AXLE HUB",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "Mallikohtaiset kuluma- ja heittorajat odottavat manuaalin varmennusta; pyöränopeus ei mittaa kulumaa.",
    "obdRole": "physical-only",
    "oe": "04465-53040; 43512-30310",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Mittaa levyjen paksuus ja heitto sekä molempien palojen paksuus; tarkista ruoste ja lämpöjäljet.",
    "pnc": "04465/43512",
    "readiness": "physical-only",
    "recipes": [
      {
        "expectedPattern": "Puolten/palojen kulumaero ohjaa myös satulan, liukutappien ja letkun tarkastukseen.",
        "id": "vikadiag-42-physical",
        "instruction": "Mittaa levyjen paksuus ja heitto sekä molempien palojen paksuus; tarkista ruoste ja lämpöjäljet.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Mittaa levyjen paksuus ja heitto sekä molempien palojen paksuus; tarkista ruoste ja lämpöjäljet.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2628-2629 ja 2358-2359, PNC 04465/43512",
      "externalSource": "LexusOwners IS brake caliper/pad -ketjut; Haynes/Trodo jarrusatulan erottelu",
      "range": "A42:O42",
      "reviewedAt": "2026-09-15",
      "row": 42,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Jos vain toinen puoli kuumenee, epäile ensin satulaa/liukutappeja/letkua eikä levyä yksin.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "ABS ei yleensä diagnosoi mekaanista levyn/palan kulumaa; pyöränopeudet voivat auttaa vain tärinä-/ABS-aktivointiepäilyssä.",
    "sourcePhysicalText": "Mittaa levyn paksuus ja heitto, tarkista palojen paksuus molemmilta puolilta, palojen liukupinnat, ruostehuulet ja lämpövärjäytymät.",
    "sourceRow": 42,
    "symptom": "Tärinä jarruttaessa, vinkuna, heikko jarrutus, uraiset levyt, epätasainen palakuluminen, metallinen ääni tai jarrupöly/kuumeneminen.",
    "testMethod": "Mittaa levyjen paksuus ja heitto sekä molempien palojen paksuus; tarkista ruoste ja lämpöjäljet."
  },
  {
    "componentId": "brakes.front_calipers",
    "diagnosticGroup": "9. Jarrut, ohjaus ja alusta",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Jarrun vapautumattomuus ohjaa satulan, liukutappien ja letkun erotteluun.",
    "label": "Etujarrusatulat",
    "limitations": [
      "OBD ei totea mekaanista jumia; kuuma vanne ei yksin todista satulaa.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "CYLINDER ASSY, FRONT DISC BRAKE, RH/LH",
      "likelySection": "FRONT DISC BRAKE CALIPER DUST COVER / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "47730-53060; 47750-53060",
      "pnc": "47730/47750",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "CYLINDER ASSY, FRONT DISC BRAKE, RH/LH",
        "47730/47750",
        "47730-53060; 47750-53060"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "FRONT DISC BRAKE CALIPER DUST COVER",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "OBD ei totea mekaanista jumia; kuuma vanne ei yksin todista satulaa.",
    "obdRole": "physical-only",
    "oe": "47730-53060; 47750-53060",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Tarkista tuetun auton pyörän vapautuminen, palojen liike, mäntä, suojakumit ja korroosio; älä provosoi laahausta ajamalla.",
    "pnc": "47730/47750",
    "readiness": "physical-only",
    "recipes": [
      {
        "expectedPattern": "Jarrun vapautumattomuus ohjaa satulan, liukutappien ja letkun erotteluun.",
        "id": "vikadiag-43-physical",
        "instruction": "Tarkista tuetun auton pyörän vapautuminen, palojen liike, mäntä, suojakumit ja korroosio; älä provosoi laahausta ajamalla.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista tuetun auton pyörän vapautuminen, palojen liike, mäntä, suojakumit ja korroosio; älä provosoi laahausta ajamalla.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2657-2664, PNC 47730/47750, OE 47730-53060/47750-53060",
      "externalSource": "LexusOwners: IS220d caliper sticking/seized pins/front caliper rattle; Haynes/Trodo seized caliper symptoms",
      "range": "A43:O43",
      "reviewedAt": "2026-09-15",
      "row": 43,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "IS220d-foorumeilla satuloiden ja tappien jumittuminen esiintyy toistuvana vikana.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "OBD ei varmenna satulaa; ABS/VSC-livedata auttaa vain poissulkemaan pyöränopeusanturien aiheuttaman oireen.",
    "sourcePhysicalText": "Nosta pyörä, tarkista pyörän pyöriminen, palojen vapautuminen, männän palautuminen, pölysuojat, ruoste ja lämpötila infrapunamittarilla ajon jälkeen.",
    "sourceRow": 43,
    "symptom": "Laahaava jarru, auto vetää sivuun, vanne kuumenee, palaneen haju, savu, epätasainen palakuluminen tai kolina satulasta.",
    "testMethod": "Tarkista tuetun auton pyörän vapautuminen, palojen liike, mäntä, suojakumit ja korroosio; älä provosoi laahausta ajamalla."
  },
  {
    "componentId": "brakes.front_caliper_slides",
    "diagnosticGroup": "9. Jarrut, ohjaus ja alusta",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Takertelu ja epätasainen kuluma ohjaavat liukutapin/holkin tarkastukseen.",
    "label": "Etujarrusatulan liukutapit ja holkit",
    "limitations": [
      "Ei OBD-signaalia liukutapin liikkeelle; tappien paikkaa ei arvata.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "FRONT CALIPER SLIDE PINS / BUSH",
      "likelySection": "FRONT DISC BRAKE CALIPER DUST COVER / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "47715-22070; 47715-52190; 47769-50010",
      "pnc": "47715A/47715D/47769",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "FRONT CALIPER SLIDE PINS / BUSH",
        "47715A/47715D/47769",
        "47715-22070; 47715-52190; 47769-50010"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "FRONT DISC BRAKE CALIPER DUST COVER",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "Ei OBD-signaalia liukutapin liikkeelle; tappien paikkaa ei arvata.",
    "obdRole": "physical-only",
    "oe": "47715-22070; 47715-52190; 47769-50010",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Tarkista irrotettujen tappien ruoste, kumiholkit, oikea järjestys ja liukupinnat; voiteluaineen sopivuus tarkistetaan manuaalista.",
    "pnc": "47715A/47715D/47769",
    "readiness": "physical-only",
    "recipes": [
      {
        "expectedPattern": "Takertelu ja epätasainen kuluma ohjaavat liukutapin/holkin tarkastukseen.",
        "id": "vikadiag-44-physical",
        "instruction": "Tarkista irrotettujen tappien ruoste, kumiholkit, oikea järjestys ja liukupinnat; voiteluaineen sopivuus tarkistetaan manuaalista.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista irrotettujen tappien ruoste, kumiholkit, oikea järjestys ja liukupinnat; voiteluaineen sopivuus tarkistetaan manuaalista.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2645-2652 ja 2665-2666, PNC 47715A/47715D/47769",
      "externalSource": "LexusOwners IS220d front caliper knock/rattle; IS250 knocking when braking and steering -ketju",
      "range": "A44:O44",
      "reviewedAt": "2026-09-15",
      "row": 44,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Halpa, erittäin hyvä kohde ennen alustan osien turhaa vaihtoa.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "Ei OBD-varmistusta. ABS/VSC ei näe liukutapin mekaanista jumia.",
    "sourcePhysicalText": "Irrota tapit, tarkista ruoste, kumiholkin turpoaminen, voitelu, tappien eri paikat ja satulakannakkeen reiät. Käytä kumille sopivaa jarrurasvaa.",
    "sourceRow": 44,
    "symptom": "Kolina jarruttaessa/ohjatessa, satulan rämähdys, laahaus, toinen pala kuluu nopeammin, jarru ei palaudu kunnolla.",
    "testMethod": "Tarkista irrotettujen tappien ruoste, kumiholkit, oikea järjestys ja liukupinnat; voiteluaineen sopivuus tarkistetaan manuaalista."
  },
  {
    "componentId": "brakes.rear_pads_discs",
    "diagnosticGroup": "9. Jarrut, ohjaus ja alusta",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Kuluma tai laahaus paikannetaan käyttöjarruun tai erilliseen seisontajarruun.",
    "label": "Takajarrupalat ja -levyt",
    "limitations": [
      "ABS ei mittaa palapaksuutta tai seisontajarrukenkien vapautumista.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "PAD KIT, DISC BRAKE, REAR / DISC, REAR",
      "figureReviewed": true,
      "imageSourcePath": "rm0150/repair2/img/c124896e02.png",
      "likelySection": "REAR DISC BRAKE CALIPER DUST COVER / REAR AXLE SHAFT HUB / COMPONENTS / INSPECTION",
      "manualReference": "IS250,220D.iso / rm0150/repair2/html/contents/rm000000uw1005x.html / PARKING BRAKE ASSEMBLY > COMPONENTS",
      "oe": "04466-22190; 42431-30290",
      "pnc": "04466/42431",
      "required": true,
      "scopeNote": "Kuva erottaa takasatulan ja levyn sisäpuoliset seisontajarrukengät; ei korvaa satulan omaa korjausohjetta.",
      "searchTerms": [
        "IS220d ALE20",
        "PAD KIT, DISC BRAKE, REAR / DISC, REAR",
        "04466/42431",
        "04466-22190; 42431-30290"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "source-identified",
      "system": "REAR DISC BRAKE CALIPER DUST COVER / REAR AXLE SHAFT HUB",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "ABS ei mittaa palapaksuutta tai seisontajarrukenkien vapautumista.",
    "obdRole": "physical-only",
    "oe": "04466-22190; 42431-30290",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Tarkista levyn molemmat puolet ja sisä-/ulkopalat. Erottele käyttöjarrusatula ja levyn sisäpuolinen seisontajarrukenkämekanismi.",
    "pnc": "04466/42431",
    "readiness": "physical-only",
    "recipes": [
      {
        "expectedPattern": "Kuluma tai laahaus paikannetaan käyttöjarruun tai erilliseen seisontajarruun.",
        "id": "vikadiag-45-physical",
        "instruction": "Tarkista levyn molemmat puolet ja sisä-/ulkopalat. Erottele käyttöjarrusatula ja levyn sisäpuolinen seisontajarrukenkämekanismi.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista levyn molemmat puolet ja sisä-/ulkopalat. Erottele käyttöjarrusatula ja levyn sisäpuolinen seisontajarrukenkämekanismi.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2684-2685 ja 2295-2296, PNC 04466/42431",
      "externalSource": "LexusOwners rear caliper seized / pads sticking -ketjut; Haynes seized caliper",
      "range": "A45:O45",
      "reviewedAt": "2026-09-15",
      "row": 45,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Takapäässä on muistettava erottaa käyttöjarru ja seisontajarru.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceClarification": {
      "finding": "Seisontajarrukengät ovat erilliset takasatulasta; alkuperäinen Drive-teksti säilytetty sourcePhysicalText-kentässä.",
      "manualSection": "rm0150/repair2/html/contents/rm000000v5v006x.html"
    },
    "sourceObdText": "OBD-rooli pieni; ABS live wheel speed vain poissulkuun, jos oire liittyy ABS:n ennenaikaiseen aktivointiin.",
    "sourcePhysicalText": "Tarkista levyn molemmat puolet, palan paksuus sisä/ulko, käsijarrun säädön vaikutus, satulan liike ja lämpötila lyhyen ajon jälkeen.",
    "sourceRow": 45,
    "symptom": "Käsijarrun/jarrun laahaus, tärinä, epätasainen kuluma, ruosteiset levyt, palaneen haju, takapyörän kuumeneminen.",
    "testMethod": "Tarkista levyn molemmat puolet ja sisä-/ulkopalat. Erottele käyttöjarrusatula ja levyn sisäpuolinen seisontajarrukenkämekanismi."
  },
  {
    "componentId": "brakes.rear_calipers",
    "diagnosticGroup": "9. Jarrut, ohjaus ja alusta",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Satulan jumitus erotetaan erillisen seisontajarrun laahauksesta.",
    "label": "Takajarrusatulat",
    "limitations": [
      "Drive-rivin käsijarrumekanismiviittaus ei tarkoita satulaan integroitua seisontajarrua; manuaali erottaa kokoonpanot.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "CYLINDER ASSY, REAR DISC BRAKE, RH/LH",
      "figureReviewed": true,
      "imageSourcePath": "rm0150/repair2/img/c124896e02.png",
      "likelySection": "REAR DISC BRAKE CALIPER DUST COVER / COMPONENTS / INSPECTION",
      "manualReference": "IS250,220D.iso / rm0150/repair2/html/contents/rm000000uw1005x.html / PARKING BRAKE ASSEMBLY > COMPONENTS",
      "oe": "47830-53070; 47850-53070",
      "pnc": "47730B/47750A",
      "required": true,
      "scopeNote": "Kuva erottaa takasatulan ja levyn sisäpuoliset seisontajarrukengät; ei korvaa satulan omaa korjausohjetta.",
      "searchTerms": [
        "IS220d ALE20",
        "CYLINDER ASSY, REAR DISC BRAKE, RH/LH",
        "47730B/47750A",
        "47830-53070; 47850-53070"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "source-identified",
      "system": "REAR DISC BRAKE CALIPER DUST COVER",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "Drive-rivin käsijarrumekanismiviittaus ei tarkoita satulaan integroitua seisontajarrua; manuaali erottaa kokoonpanot.",
    "obdRole": "physical-only",
    "oe": "47830-53070; 47850-53070",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Tarkista satulan mäntä, pölysuoja, liukutapit ja palojen vapaa liike; tarkista seisontajarrukengät erillisenä vikapolkuna.",
    "pnc": "47730B/47750A",
    "readiness": "physical-only",
    "recipes": [
      {
        "expectedPattern": "Satulan jumitus erotetaan erillisen seisontajarrun laahauksesta.",
        "id": "vikadiag-46-physical",
        "instruction": "Tarkista satulan mäntä, pölysuoja, liukutapit ja palojen vapaa liike; tarkista seisontajarrukengät erillisenä vikapolkuna.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista satulan mäntä, pölysuoja, liukutapit ja palojen vapaa liike; tarkista seisontajarrukengät erillisenä vikapolkuna.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2696-2701, PNC 47730B/47750A, OE 47830-53070/47850-53070",
      "externalSource": "LexusOwners IS220d rear brake calipers seized; Trodo/Haynes seized caliper symptoms",
      "range": "A46:O46",
      "reviewedAt": "2026-09-15",
      "row": 46,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Foorumihavaintojen mukaan takasatuloiden liukutapit ovat tyypillinen tarkistuskohde.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceClarification": {
      "finding": "Seisontajarrukengät ovat erilliset takasatulasta; alkuperäinen Drive-teksti säilytetty sourcePhysicalText-kentässä.",
      "manualSection": "rm0150/repair2/html/contents/rm000000v5v006x.html"
    },
    "sourceObdText": "OBD ei totea mekaanista jumia. ABS/VSC-koodit ovat eri vikapolku, ellei pyörän nopeussignaali sekoile kuumenemisen/napavian vuoksi.",
    "sourcePhysicalText": "Tarkista männän palautus, pölysuoja, liukutapit, käsijarrumekanismin vaikutus, palojen vapaa liike ja levyn lämpötila.",
    "sourceRow": 46,
    "symptom": "Takajarrun laahaus, kuuma vanne, palaneen haju, epätasainen palakuluminen, heikko käsijarrun vapautuminen tai satulan jumittuminen.",
    "testMethod": "Tarkista satulan mäntä, pölysuoja, liukutapit ja palojen vapaa liike; tarkista seisontajarrukengät erillisenä vikapolkuna."
  },
  {
    "componentId": "brakes.rear_caliper_slides",
    "diagnosticGroup": "9. Jarrut, ohjaus ja alusta",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Takertelu, repeämä tai turvonnut holkki on fyysinen löydös.",
    "label": "Takajarrusatulan liukutapit, holkit ja suojakumit",
    "limitations": [
      "Drive mainitsee puuttuvia OE-tietoja lisätapeille; niitä ei täydennetä arvaamalla.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "REAR CALIPER SLIDE PIN / BUSH / BOOT",
      "likelySection": "REAR DISC BRAKE CALIPER DUST COVER / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "47814-30300; 47879-30300; 47875-30340",
      "pnc": "47814/47769A/47775D",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "REAR CALIPER SLIDE PIN / BUSH / BOOT",
        "47814/47769A/47775D",
        "47814-30300; 47879-30300; 47875-30340"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "REAR DISC BRAKE CALIPER DUST COVER",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "Drive mainitsee puuttuvia OE-tietoja lisätapeille; niitä ei täydennetä arvaamalla.",
    "obdRole": "physical-only",
    "oe": "47814-30300; 47879-30300; 47875-30340",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Tarkista liukutappien, holkkien ja suojakumien kunto ja oikea järjestys irrotettuna; tarkista kannakkeen reiät.",
    "pnc": "47814/47769A/47775D",
    "readiness": "physical-only",
    "recipes": [
      {
        "expectedPattern": "Takertelu, repeämä tai turvonnut holkki on fyysinen löydös.",
        "id": "vikadiag-47-physical",
        "instruction": "Tarkista liukutappien, holkkien ja suojakumien kunto ja oikea järjestys irrotettuna; tarkista kannakkeen reiät.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista liukutappien, holkkien ja suojakumien kunto ja oikea järjestys irrotettuna; tarkista kannakkeen reiät.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2702-2705 ja 2712-2715, PNC 47814/47769A/47775D",
      "externalSource": "LexusOwners IS220d brake calipers & pins; rear brake calipers seized -ketjut",
      "range": "A47:O47",
      "reviewedAt": "2026-09-15",
      "row": 47,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "NO_ROWS-riveillä 47815/47843 pitää täydentää OE myöhemmin, mutta diagnostisesti nämä kuuluvat samaan ryhmään.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "Ei OBD-varmistusta.",
    "sourcePhysicalText": "Irrota, puhdista ja voitele tapit; tarkista suojakumin repeämä, holkin turpoaminen, satulakannakkeen reikä ja tappien oikea järjestys.",
    "sourceRow": 47,
    "symptom": "Laahaus, epätasainen palakuluminen, jarrusatulan kolina, sisä- ja ulkopalan suuri kulumaero, savutus kuumasta levystä.",
    "testMethod": "Tarkista liukutappien, holkkien ja suojakumien kunto ja oikea järjestys irrotettuna; tarkista kannakkeen reiät."
  },
  {
    "componentId": "chassis.front_lower_ball_joints",
    "diagnosticGroup": "9. Jarrut, ohjaus ja alusta",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Välys paikannetaan itse niveleen, ei pelkkään pyörän liikkeeseen.",
    "label": "Etualatukivarren alapallonivelet",
    "limitations": [
      "Pyörän välys voi tulla myös navasta tai muusta nivelestä; ABS ei mittaa palloniveltä.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "JOINT ASSY, LOWER BALL, FRONT RH/LH",
      "likelySection": "FRONT AXLE ARM STEERING KNUCKLE / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "43330-39625; 43340-39505",
      "pnc": "43330K/43340A",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "JOINT ASSY, LOWER BALL, FRONT RH/LH",
        "43330K/43340A",
        "43330-39625; 43340-39505"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "FRONT AXLE ARM STEERING KNUCKLE",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "Pyörän välys voi tulla myös navasta tai muusta nivelestä; ABS ei mittaa palloniveltä.",
    "obdRole": "physical-only",
    "oe": "43330-39625; 43340-39505",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Tarkista oikeasta kohdasta tuetun auton alapallonivelten välys ja suojakumit manuaalin tuentaohjeen mukaan.",
    "pnc": "43330K/43340A",
    "readiness": "physical-only",
    "recipes": [
      {
        "expectedPattern": "Välys paikannetaan itse niveleen, ei pelkkään pyörän liikkeeseen.",
        "id": "vikadiag-48-physical",
        "instruction": "Tarkista oikeasta kohdasta tuetun auton alapallonivelten välys ja suojakumit manuaalin tuentaohjeen mukaan.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista oikeasta kohdasta tuetun auton alapallonivelten välys ja suojakumit manuaalin tuentaohjeen mukaan.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2793-2800, PNC 43330K/43340A",
      "externalSource": "LexusOwners IS220d front suspension bang/knocking -ketjut; MOOG ball joint diagnosis",
      "range": "A48:O48",
      "reviewedAt": "2026-09-15",
      "row": 48,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Etupään kolinoissa foorumeilla mainitaan usein top mount, lower ball joint ja upper control arm; ravistustesti erottaa osan.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "Ei suoraa OBD-varmistusta. ABS live data auttaa vain, jos samalla epäillään napaa/pyöränopeusanturia.",
    "sourcePhysicalText": "Nosta kulma oikein tuettuna, tarkista välys 12–6-suunnassa ja sorkkaraudalla olka-akselin/tukivarren välillä; tarkista suojakumin repeämä ja rasvan vuoto.",
    "sourceRow": 48,
    "symptom": "Kolina montuissa, väljä ohjaustuntuma, renkaan epätasainen kuluminen, naksahdus kääntäessä tai välys pyörää ravistettaessa.",
    "testMethod": "Tarkista oikeasta kohdasta tuetun auton alapallonivelten välys ja suojakumit manuaalin tuentaohjeen mukaan."
  },
  {
    "componentId": "chassis.front_upper_arms",
    "diagnosticGroup": "9. Jarrut, ohjaus ja alusta",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Puslan tai nivelen liike erotetaan muista kolinan lähteistä.",
    "label": "Etupään ylätukivarret",
    "limitations": [
      "OBD ei mittaa puslavälystä tai pyöränkulmia.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "ARM ASSY, FRONT SUSPENSION UPPER, RH/LH",
      "likelySection": "FRONT AXLE ARM STEERING KNUCKLE / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "48610-59065; 48630-59065",
      "pnc": "48610/48630",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "ARM ASSY, FRONT SUSPENSION UPPER, RH/LH",
        "48610/48630",
        "48610-59065; 48630-59065"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "FRONT AXLE ARM STEERING KNUCKLE",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "OBD ei mittaa puslavälystä tai pyöränkulmia.",
    "obdRole": "physical-only",
    "oe": "48610-59065; 48630-59065",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Tarkista ylätukivarsien puslat, pallonivelet ja suojakumit sekä välyksen tarkka sijainti tuetusta autosta.",
    "pnc": "48610/48630",
    "readiness": "physical-only",
    "recipes": [
      {
        "expectedPattern": "Puslan tai nivelen liike erotetaan muista kolinan lähteistä.",
        "id": "vikadiag-49-physical",
        "instruction": "Tarkista ylätukivarsien puslat, pallonivelet ja suojakumit sekä välyksen tarkka sijainti tuetusta autosta.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista ylätukivarsien puslat, pallonivelet ja suojakumit sekä välyksen tarkka sijainti tuetusta autosta.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2834-2835 ja 2848 ym., PNC 48610/48630",
      "externalSource": "LexusOwners front suspension bang/knocking; MOOG control arm and ball joint symptom/inspection -ohjeet",
      "range": "A49:O49",
      "reviewedAt": "2026-09-15",
      "row": 49,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Usein vaihdetaan kokonainen varsi, koska pallonivel/puslat ovat osana kokoonpanoa.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "Ei suoraa OBD-varmistusta.",
    "sourcePhysicalText": "Tarkista puslat, pallonivel, suojakumi, varren liike jarrutuksessa/kiihdytyksessä ja välys pyörää ravistettaessa. Sorkkarauta auttaa puslavälyksen löytämisessä.",
    "sourceRow": 49,
    "symptom": "Kolina pienissä töyssyissä, ohjauksen epämääräisyys, camber/caster muuttuu, renkaan sisä-/ulkoreunan kuluma, narina tai pallonivelen välys.",
    "testMethod": "Tarkista ylätukivarsien puslat, pallonivelet ja suojakumit sekä välyksen tarkka sijainti tuetusta autosta."
  },
  {
    "componentId": "chassis.front_lower_arms",
    "diagnosticGroup": "9. Jarrut, ohjaus ja alusta",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Puslan/varren liike ohjaa mekaaniseen tarkastukseen ja suuntaukseen.",
    "label": "Etualatukivarret / alatukivarren puslat",
    "limitations": [
      "Drive-rivin lyhennetty OE-merkintä ei ole yksi tilausnumero; BOM erottaa RH/LH ja valmistusajat.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "ARM ASSY, FRONT SUSPENSION, LOWER RH/LH",
      "likelySection": "FRONT AXLE ARM STEERING KNUCKLE / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "48620-53020/30290; 48640-53020/30290",
      "pnc": "48620/48640",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "ARM ASSY, FRONT SUSPENSION, LOWER RH/LH",
        "48620/48640",
        "48620-53020/30290; 48640-53020/30290"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "FRONT AXLE ARM STEERING KNUCKLE",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "Drive-rivin lyhennetty OE-merkintä ei ole yksi tilausnumero; BOM erottaa RH/LH ja valmistusajat.",
    "obdRole": "physical-only",
    "oe": "48620-53020/30290; 48640-53020/30290",
    "operatingStates": [
      "physical"
    ],
    "partEvidence": {
      "sourceSheet": "BOM",
      "status": "bom-identified-not-order-approved",
      "variants": [
        {
          "oe": "48620-53020",
          "period": "08/2005 - 08/2008",
          "pnc": "48620",
          "side": "RH",
          "sourceRow": 2846
        },
        {
          "oe": "48620-30290",
          "period": "08/2008 - 08/2010",
          "pnc": "48620",
          "side": "RH",
          "sourceRow": 2847
        },
        {
          "oe": "48640-53020",
          "period": "08/2005 - 08/2008",
          "pnc": "48640",
          "side": "LH",
          "sourceRow": 2860
        },
        {
          "oe": "48640-30290",
          "period": "08/2008 - 08/2010",
          "pnc": "48640",
          "side": "LH",
          "sourceRow": 2861
        }
      ]
    },
    "physicalFollowUp": "Tarkista puslien halkeamat, varren välys ja säätöpultit; erottele alapallonivel. Varmista puolikohtainen OE ja valmistusaika BOMista.",
    "pnc": "48620/48640",
    "readiness": "physical-only",
    "recipes": [
      {
        "expectedPattern": "Puslan/varren liike ohjaa mekaaniseen tarkastukseen ja suuntaukseen.",
        "id": "vikadiag-50-physical",
        "instruction": "Tarkista puslien halkeamat, varren välys ja säätöpultit; erottele alapallonivel. Varmista puolikohtainen OE ja valmistusaika BOMista.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista puslien halkeamat, varren välys ja säätöpultit; erottele alapallonivel. Varmista puolikohtainen OE ja valmistusaika BOMista.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2846-2847 ja jatkorivit PNC 48620/48640; osanumero LH varmistettava täsmäriviltä ennen tilausta",
      "externalSource": "LexusOwners IS220d suspension bang; MOOG control arm bushing symptoms",
      "range": "A50:O50",
      "reviewedAt": "2026-09-15",
      "row": 50,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Todennäköinen",
      "sourceNote": "LH OE pitää tarkistaa täydestä rivistä ennen ostoa, koska näkyvä ote katkesi kesken.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "Ei suoraa OBD-varmistusta; suuntauksen arvot ovat tärkeämpiä kuin OBD.",
    "sourcePhysicalText": "Tarkista puslien halkeamat, varren siirtymä jarrua painettaessa, sorkkarautavälys, pulttien/camber-säätöjen ruoste ja alapallonivel erikseen.",
    "sourceRow": 50,
    "symptom": "Jarrutuksessa tai kiihdytyksessä tapahtuva kolahdus, ohjauksen vaeltelu, vetely urissa, tärinä, renkaan epätasainen kuluma ja aurauskulmien muuttuminen.",
    "testMethod": "Tarkista puslien halkeamat, varren välys ja säätöpultit; erottele alapallonivel. Varmista puolikohtainen OE ja valmistusaika BOMista."
  },
  {
    "componentId": "chassis.front_shocks",
    "diagnosticGroup": "9. Jarrut, ohjaus ja alusta",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Vuoto tai vaimennuspuute tukee jatkotarkastusta; käsin pomputus on vain karkea seulonta.",
    "label": "Etuiskärit",
    "limitations": [
      "Tämän rivin tavallinen iskunvaimennin ei ole OBD-ohjattu aktiivijousitus.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "ABSORBER ASSY, SHOCK, FRONT RH/LH",
      "likelySection": "FRONT SPRING SHOCK ABSORBER / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "48510-80359; 48520-59395",
      "pnc": "48510/48520",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "ABSORBER ASSY, SHOCK, FRONT RH/LH",
        "48510/48520",
        "48510-80359; 48520-59395"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "FRONT SPRING SHOCK ABSORBER",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "Tämän rivin tavallinen iskunvaimennin ei ole OBD-ohjattu aktiivijousitus.",
    "obdRole": "physical-only",
    "oe": "48510-80359; 48520-59395",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Tarkista öljyvuoto, varsi, yläkiinnitys ja rengaskuluma; vaimennuksen arvio on fyysinen tarkastus.",
    "pnc": "48510/48520",
    "readiness": "physical-only",
    "recipes": [
      {
        "expectedPattern": "Vuoto tai vaimennuspuute tukee jatkotarkastusta; käsin pomputus on vain karkea seulonta.",
        "id": "vikadiag-51-physical",
        "instruction": "Tarkista öljyvuoto, varsi, yläkiinnitys ja rengaskuluma; vaimennuksen arvio on fyysinen tarkastus.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista öljyvuoto, varsi, yläkiinnitys ja rengaskuluma; vaimennuksen arvio on fyysinen tarkastus.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2876-2879, PNC 48510/48520",
      "externalSource": "Monroe worn shock/strut symptoms and inspection; LexusOwners suspension noise -ketjut",
      "range": "A51:O51",
      "reviewedAt": "2026-09-15",
      "row": 51,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Jos ääni kuuluu vain terävissä pienissä töyssyissä, tarkista ensin yläpää, koiranluut ja satulatapit.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "Ei suoraa OBD-varmistusta, ellei kyse ole korkeudensäädöstä/aktiivialustasta, jota tässä rivissä ei ole.",
    "sourcePhysicalText": "Tarkista öljyvuoto, varren ruoste, yläpään kiinnitys, palautuminen, rengaskuluminen ja koeajossa keulan liike. Pelkkä käsin pomputus on karkea testi.",
    "sourceRow": 51,
    "symptom": "Pompotus, keulan sukellus jarruttaessa, heikko pito epätasaisella, vuotava öljy, kolina/tukivarsiin sekoittuva ääni tai renkaan kuppikuluminen.",
    "testMethod": "Tarkista öljyvuoto, varsi, yläkiinnitys ja rengaskuluma; vaimennuksen arvio on fyysinen tarkastus."
  },
  {
    "componentId": "chassis.front_suspension_supports",
    "diagnosticGroup": "9. Jarrut, ohjaus ja alusta",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Yläkiinnityksen välys erotetaan iskarista, jousesta ja muista nivelistä.",
    "label": "Etutolpan yläpäät / jousituksen yläkiinnitys",
    "limitations": [
      "Drive-rivin laakeriviittaus ei yksin varmista yläpään rakennetta; rakennekuva tarvitaan.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "SUPPORT ASSY, FRONT SUSPENSION",
      "likelySection": "FRONT SPRING SHOCK ABSORBER / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "48680-53030",
      "pnc": "48680",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "SUPPORT ASSY, FRONT SUSPENSION",
        "48680",
        "48680-53030"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "FRONT SPRING SHOCK ABSORBER",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "Drive-rivin laakeriviittaus ei yksin varmista yläpään rakennetta; rakennekuva tarvitaan.",
    "obdRole": "physical-only",
    "oe": "48680-53030",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Tarkista yläkiinnityksen kumit, välys ja kiinnitys manuaalin mukaan; älä avaa jousikuormitettua kokoonpanoa ilman asianmukaista työmenetelmää.",
    "pnc": "48680",
    "readiness": "physical-only",
    "recipes": [
      {
        "expectedPattern": "Yläkiinnityksen välys erotetaan iskarista, jousesta ja muista nivelistä.",
        "id": "vikadiag-52-physical",
        "instruction": "Tarkista yläkiinnityksen kumit, välys ja kiinnitys manuaalin mukaan; älä avaa jousikuormitettua kokoonpanoa ilman asianmukaista työmenetelmää.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista yläkiinnityksen kumit, välys ja kiinnitys manuaalin mukaan; älä avaa jousikuormitettua kokoonpanoa ilman asianmukaista työmenetelmää.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2880-2881, PNC 48680, OE 48680-53030",
      "externalSource": "LexusOwners IS220d front suspension bang: top mounts mainittu tyypillisenä epäilynä; Monroe strut mounting noise",
      "range": "A52:O52",
      "reviewedAt": "2026-09-15",
      "row": 52,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Tarkista yhdessä iskarin ja jousen kanssa.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "Ei OBD-varmistusta.",
    "sourcePhysicalText": "Tarkista yläpään kumit, laakerin/kiinnityksen välys, jousen pyörähdys kääntäessä ja muttereiden kireys.",
    "sourceRow": 52,
    "symptom": "Kolina tai naksahdus kääntäessä, terävä töyssykolina, jousen nykäisevä liike, ohjauksen palautuksen outous.",
    "testMethod": "Tarkista yläkiinnityksen kumit, välys ja kiinnitys manuaalin mukaan; älä avaa jousikuormitettua kokoonpanoa ilman asianmukaista työmenetelmää."
  },
  {
    "componentId": "chassis.front_stabilizer_links_bushes",
    "diagnosticGroup": "9. Jarrut, ohjaus ja alusta",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Välys paikantuu linkkiin tai puslaan, ei pelkän kolinaäänen perusteella.",
    "label": "Etuvakaajan koiranluut ja puslat",
    "limitations": [
      "OBD ei mittaa vakaajan nivelvälystä.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "FRONT STABILIZER LINKS / BUSH",
      "likelySection": "FRONT SPRING SHOCK ABSORBER / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "48810-53010; 48820-53010; 48815-30570",
      "pnc": "48810/48820B/48815",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "FRONT STABILIZER LINKS / BUSH",
        "48810/48820B/48815",
        "48810-53010; 48820-53010; 48815-30570"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "FRONT SPRING SHOCK ABSORBER",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "OBD ei mittaa vakaajan nivelvälystä.",
    "obdRole": "physical-only",
    "oe": "48810-53010; 48820-53010; 48815-30570",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Tarkista vakaajan linkkien nivelet, suojakumit, puslat ja kiinnikkeet sopivasti tuetulla alustalla.",
    "pnc": "48810/48820B/48815",
    "readiness": "physical-only",
    "recipes": [
      {
        "expectedPattern": "Välys paikantuu linkkiin tai puslaan, ei pelkän kolinaäänen perusteella.",
        "id": "vikadiag-53-physical",
        "instruction": "Tarkista vakaajan linkkien nivelet, suojakumit, puslat ja kiinnikkeet sopivasti tuetulla alustalla.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista vakaajan linkkien nivelet, suojakumit, puslat ja kiinnikkeet sopivasti tuetulla alustalla.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2882-2889, PNC 48810/48820B/48815",
      "externalSource": "LexusOwners IS220d knocking noise -ketjut; yleinen vakaajatangon/vakaajan linkin diagnoosi",
      "range": "A53:O53",
      "reviewedAt": "2026-09-15",
      "row": 53,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Halpa ja yleinen ensitarkistus etupään kolinaan.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "Ei OBD-varmistusta.",
    "sourcePhysicalText": "Ravista koiranluita kuormitettuna ja vapaana, tarkista pallonivelen suojakumit, vakaajan puslan väljyys/kiillottuneet kohdat ja kiinnikepultit.",
    "sourceRow": 53,
    "symptom": "Kolina pienissä töyssyissä, rämähdys mukulakivellä, kallistelun lisääntyminen, ääni joka voi muistuttaa alapalloniveltä tai iskarin yläpäätä.",
    "testMethod": "Tarkista vakaajan linkkien nivelet, suojakumit, puslat ja kiinnikkeet sopivasti tuetulla alustalla."
  }
];

const coolingContinuation = [
  {
    "componentId": "chassis.rear_shocks",
    "diagnosticGroup": "9. Jarrut, ohjaus ja alusta",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Vuoto tai vaimennuspuute on fyysisen jatkotarkastuksen peruste.",
    "label": "Takaiskarit",
    "limitations": [
      "Rivin sama RH/LH-OE säilyy lähdetietona, ei uutena sopivuusvarmennuksena.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "ABSORBER ASSY, SHOCK, REAR RH/LH",
      "likelySection": "REAR SPRING SHOCK ABSORBER / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "48530-80416; 48530-80416",
      "pnc": "48530/48540",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "ABSORBER ASSY, SHOCK, REAR RH/LH",
        "48530/48540",
        "48530-80416; 48530-80416"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "REAR SPRING SHOCK ABSORBER",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "Rivin sama RH/LH-OE säilyy lähdetietona, ei uutena sopivuusvarmennuksena.",
    "obdRole": "physical-only",
    "oe": "48530-80416; 48530-80416",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Tarkista takaiskarien vuodot, puslat, yläkiinnitys ja rengaskuluma.",
    "pnc": "48530/48540",
    "readiness": "physical-only",
    "recipes": [
      {
        "expectedPattern": "Vuoto tai vaimennuspuute on fyysisen jatkotarkastuksen peruste.",
        "id": "vikadiag-54-physical",
        "instruction": "Tarkista takaiskarien vuodot, puslat, yläkiinnitys ja rengaskuluma.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista takaiskarien vuodot, puslat, yläkiinnitys ja rengaskuluma.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2936-2945, PNC 48530/48540",
      "externalSource": "Monroe worn shock symptoms/inspection",
      "range": "A54:O54",
      "reviewedAt": "2026-09-15",
      "row": 54,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "LH jakaa näkyvän OE-numeron RH-rivin kanssa tämän BOM-otteen perusteella; varmista ennen tilausta.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "Ei suoraa OBD-varmistusta.",
    "sourcePhysicalText": "Tarkista öljyvuoto, puslat, yläpään tuenta, renkaiden kulumajälki ja koeajossa perän rauhoittuminen töyssyn jälkeen.",
    "sourceRow": 54,
    "symptom": "Perän pompotus, huono pito kaarteessa, kolina takaa, renkaan kuppikuluminen, öljyvuoto tai perän levottomuus nopeassa suunnanvaihdossa.",
    "testMethod": "Tarkista takaiskarien vuodot, puslat, yläkiinnitys ja rengaskuluma."
  },
  {
    "componentId": "chassis.rear_springs",
    "diagnosticGroup": "9. Jarrut, ohjaus ja alusta",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Katkennut pää tai väärä istuvuus on fyysinen löydös; puoliero ei yksin todista jousivikaa.",
    "label": "Takajouset",
    "limitations": [
      "Ei OBD-korkeussignaalia tälle jouselle eikä arvattua korkeuden hyväksymisrajaa.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "SPRING, COIL, REAR RH/LH",
      "likelySection": "REAR SPRING SHOCK ABSORBER / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "48231-53231",
      "pnc": "48231A/48231B",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "SPRING, COIL, REAR RH/LH",
        "48231A/48231B",
        "48231-53231"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "REAR SPRING SHOCK ABSORBER",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "Ei OBD-korkeussignaalia tälle jouselle eikä arvattua korkeuden hyväksymisrajaa.",
    "obdRole": "physical-only",
    "oe": "48231-53231",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Tarkista jousen päät, murtumat, istuvuus ja kumieristeet; vertaa puolten korkeutta samalla kuormalla ja alustalla.",
    "pnc": "48231A/48231B",
    "readiness": "physical-only",
    "recipes": [
      {
        "expectedPattern": "Katkennut pää tai väärä istuvuus on fyysinen löydös; puoliero ei yksin todista jousivikaa.",
        "id": "vikadiag-55-physical",
        "instruction": "Tarkista jousen päät, murtumat, istuvuus ja kumieristeet; vertaa puolten korkeutta samalla kuormalla ja alustalla.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista jousen päät, murtumat, istuvuus ja kumieristeet; vertaa puolten korkeutta samalla kuormalla ja alustalla.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2918-2921, PNC 48231A/48231B, OE 48231-53231",
      "externalSource": "Yleinen jousen murtuma-/korkeusdiagnoosi; Monroe ride-control inspection",
      "range": "A55:O55",
      "reviewedAt": "2026-09-15",
      "row": 55,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Takajouset kannattaa tarkistaa samalla kun käsitellään takapään kolinoita.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "Ei OBD-varmistusta.",
    "sourcePhysicalText": "Tarkista jousen päät, murtumat alalaakeripinnassa, auton korkeus puolieroina, kumieristeet ja jousen istuvuus.",
    "sourceRow": 55,
    "symptom": "Perän roikkuminen, vino korkeus, kolina, katkennut jousen pää, katsastushuomautus tai renkaan muuttunut asento.",
    "testMethod": "Tarkista jousen päät, murtumat, istuvuus ja kumieristeet; vertaa puolten korkeutta samalla kuormalla ja alustalla."
  },
  {
    "componentId": "chassis.rear_links_arms",
    "diagnosticGroup": "9. Jarrut, ohjaus ja alusta",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Paikannettu välys ja suuntausmittaus tukevat vian erottelua.",
    "label": "Takapään tukivarret ja toe-linkit",
    "limitations": [
      "ABS/VSC-reaktio ei mittaa toe-linkin välystä; lähteen yhdistetty OE-lista ei varmista kaikkia yksittäisiä varsia.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "REAR SUSPENSION LINKS / ARMS",
      "likelySection": "REAR SPRING SHOCK ABSORBER / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "48705-53020; 48706-53020; 48710-53020; 48730-30090; 48740-30110",
      "pnc": "48705/48706B/48710A/48720A/48730F/48740F",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "REAR SUSPENSION LINKS / ARMS",
        "48705/48706B/48710A/48720A/48730F/48740F",
        "48705-53020; 48706-53020; 48710-53020; 48730-30090; 48740-30110"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "REAR SPRING SHOCK ABSORBER",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "ABS/VSC-reaktio ei mittaa toe-linkin välystä; lähteen yhdistetty OE-lista ei varmista kaikkia yksittäisiä varsia.",
    "obdRole": "physical-only",
    "oe": "48705-53020; 48706-53020; 48710-53020; 48730-30090; 48740-30110",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Tarkista takatukivarsien puslat, nivelet ja säätöpultit sekä pyöränkulmat korjauksen jälkeen.",
    "pnc": "48705/48706B/48710A/48720A/48730F/48740F",
    "readiness": "physical-only",
    "recipes": [
      {
        "expectedPattern": "Paikannettu välys ja suuntausmittaus tukevat vian erottelua.",
        "id": "vikadiag-56-physical",
        "instruction": "Tarkista takatukivarsien puslat, nivelet ja säätöpultit sekä pyöränkulmat korjauksen jälkeen.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista takatukivarsien puslat, nivelet ja säätöpultit sekä pyöränkulmat korjauksen jälkeen.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2946-2957, PNC 48705/48706B/48710A/48730F/48740F",
      "externalSource": "MOOG control arm bushing symptoms; LexusOwners suspension noise -foorumihavainnot",
      "range": "A56:O56",
      "reviewedAt": "2026-09-15",
      "row": 56,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Takapään säätöosissa ruoste voi olla käytännön suurin ongelma, vaikka itse varsi ei olisi poikki.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "Ei suoraa OBD-varmistusta; ABS/ajonvakautus voi reagoida vain seurauksena, jos pyöräkulmat/pyöränopeudet ovat epäloogisia.",
    "sourcePhysicalText": "Tarkista puslat sorkkaraudalla, nivelten suojakumit, ruosteiset säätöpultit, jäljet varren liikkumisesta ja tee nelipyöräsuuntaus korjauksen jälkeen.",
    "sourceRow": 56,
    "symptom": "Takapään kolina, perän vaeltelu, renkaan epätasainen kuluminen, aurauskulman muuttuminen, epävakaus urissa tai jarrutuksessa.",
    "testMethod": "Tarkista takatukivarsien puslat, nivelet ja säätöpultit sekä pyöränkulmat korjauksen jälkeen."
  },
  {
    "componentId": "drivetrain.front_hubs",
    "diagnosticGroup": "8. Kardaani, perä, akselit ja navat",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Laakerin karheus/välys todetaan fyysisesti. Elektroninen kulmakohtainen vertailu ei ole nykyisellä evidenssillä mahdollinen.",
    "label": "Etunavat / etupyörän laakeriyksiköt",
    "limitations": [
      "Moottorin RPM tai yleinen ajonopeus ei korvaa neljää ABS-pyöränopeutta.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "HUB SUB-ASSY, FRONT AXLE, RH/LH",
      "likelySection": "FRONT AXLE HUB / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "43550-30020; 43560-30010",
      "pnc": "43501C/43502C",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "HUB SUB-ASSY, FRONT AXLE, RH/LH",
        "43501C/43502C",
        "43550-30020; 43560-30010"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "FRONT AXLE HUB",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [
      "Ajoneuvovarmennetut ABS-pyöränopeudet neljälle pyörälle ja lähde-ECU:n tunnistus"
    ],
    "note": "Moottorin RPM tai yleinen ajonopeus ei korvaa neljää ABS-pyöränopeutta.",
    "obdRole": "indirect",
    "oe": "43550-30020; 43560-30010",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Tarkista tuetun auton navan välys, pyörityksen karheus ja anturi-/magneettikehäalue; pyöränopeusvertailu jää odottamaan varmennettua ABS-signaalia.",
    "pnc": "43501C/43502C",
    "readiness": "needs-signal-verification",
    "recipes": [
      {
        "expectedPattern": "Laakerin karheus/välys todetaan fyysisesti. Elektroninen kulmakohtainen vertailu ei ole nykyisellä evidenssillä mahdollinen.",
        "id": "vikadiag-57-physical",
        "instruction": "Tarkista tuetun auton navan välys, pyörityksen karheus ja anturi-/magneettikehäalue; pyöränopeusvertailu jää odottamaan varmennettua ABS-signaalia.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista tuetun auton navan välys, pyörityksen karheus ja anturi-/magneettikehäalue; pyöränopeusvertailu jää odottamaan varmennettua ABS-signaalia.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2350-2355, PNC 43501C/43502C",
      "externalSource": "SKF wheel bearing/ABS sensor guidance; ClubLexus wheel bearing ABS lights -ketjut",
      "range": "A57:O57",
      "reviewedAt": "2026-09-15",
      "row": 57,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Koska ABS-anturi on sähköinen, tämä linkittyy myös OBD/Techstream-ryhmään.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "ABS/VSC live data: pyöränopeusanturin signaalin tasaisuus hitaassa ajossa; DTC:t jos anturisignaali katoaa.",
    "sourcePhysicalText": "Ravista pyörää, kuuntele pyörittäessä, vertaa ääntä kaarteessa kuormituksen mukaan, tarkista lämpötila ja navan magneettikehä/anturin alue.",
    "sourceRow": 57,
    "symptom": "Nopeuden mukaan kasvava humina, kaarteessa muuttuva ääni, välys pyörässä, ABS/VSC-valo jos anturi/kehä/signaali häiriintyy.",
    "testMethod": "Tarkista tuetun auton navan välys, pyörityksen karheus ja anturi-/magneettikehäalue; pyöränopeusvertailu jää odottamaan varmennettua ABS-signaalia."
  },
  {
    "componentId": "drivetrain.rear_hubs",
    "diagnosticGroup": "8. Kardaani, perä, akselit ja navat",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Fyysinen laakerilöydös ja anturihäiriö erotetaan; sujuva pyöränopeus ei yksin todista laakeria ehjäksi.",
    "label": "Takanavat / takapyörän laakeriyksiköt",
    "limitations": [
      "Yleinen moottorin DTC-luku ei varmista kulmakohtaista ABS-vikaa.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "HUB & BEARING ASSY, REAR AXLE, RH/LH",
      "likelySection": "REAR AXLE SHAFT HUB / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "42410-30020",
      "pnc": "42450A/42450B",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "HUB & BEARING ASSY, REAR AXLE, RH/LH",
        "42450A/42450B",
        "42410-30020"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "REAR AXLE SHAFT HUB",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [
      "Ajoneuvovarmennetut ABS-pyöränopeudet neljälle pyörälle ja lähde-ECU:n tunnistus"
    ],
    "note": "Yleinen moottorin DTC-luku ei varmista kulmakohtaista ABS-vikaa.",
    "obdRole": "indirect",
    "oe": "42410-30020",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Tarkista takanavan välys, karheus ja anturi-/magneettikehäalue; pidä pyöränopeustesti odottamassa ABS-evidenssiä.",
    "pnc": "42450A/42450B",
    "readiness": "needs-signal-verification",
    "recipes": [
      {
        "expectedPattern": "Fyysinen laakerilöydös ja anturihäiriö erotetaan; sujuva pyöränopeus ei yksin todista laakeria ehjäksi.",
        "id": "vikadiag-58-physical",
        "instruction": "Tarkista takanavan välys, karheus ja anturi-/magneettikehäalue; pidä pyöränopeustesti odottamassa ABS-evidenssiä.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista takanavan välys, karheus ja anturi-/magneettikehäalue; pidä pyöränopeustesti odottamassa ABS-evidenssiä.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2297-2300, PNC 42450A/42450B, OE 42410-30020",
      "externalSource": "SKF wheel bearing/ABS sensor guidance; ClubLexus wheel bearing/ABS light -ketjut",
      "range": "A58:O58",
      "reviewedAt": "2026-09-15",
      "row": 58,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Takanavassa sama OE näkyy RH/LH-riveillä tässä BOMissa.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "ABS/VSC live wheel speed -arvot hitaassa ajossa; DTC kertoo yleensä kulman, mutta mekaaninen laakeri pitää kuunnella/tarkistaa.",
    "sourcePhysicalText": "Pyöritä ja kuuntele nostettuna, ravista pyörää, tarkista lämpö, laakerin karheus ja ABS-anturin/magneettikehän kunto.",
    "sourceRow": 58,
    "symptom": "Takaa kuuluva humina tai jyrinä, ääni muuttuu kaarrekuormalla, välys, lämpeneminen tai ABS/VSC-oire pyöränopeussignaalin häiriintyessä.",
    "testMethod": "Tarkista takanavan välys, karheus ja anturi-/magneettikehäalue; pidä pyöränopeustesti odottamassa ABS-evidenssiä."
  },
  {
    "componentId": "steering.eps_rack",
    "diagnosticGroup": "9. Jarrut, ohjaus ja alusta",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Jännitepoikkeama ohjaa akun ja syöttöjen tarkastukseen, mutta EPS:n oma arvio odottaa varmennettuja signaaleja.",
    "label": "Sähkötehostettu ohjausvaihde / hammastanko",
    "limitations": [
      "Moottori-ECU:n jännite ei ole EPS:n liittimen jännite eikä kuvaa ohjausmomenttia tai kulmaa.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista.",
      "Mekaaniset tarkastukset tehdään turvallisesti tuettuna ja moottori sammuksissa; lämpötilaseuranta ei oikeuta jatkamaan ajoa ylikuumenemisen tai nestevuodon aikana."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "LINK ASSY, POWER STEERING",
      "likelySection": "FRONT STEERING GEAR LINK / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "44200-53130",
      "pnc": "44200",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "LINK ASSY, POWER STEERING",
        "44200",
        "44200-53130"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "FRONT STEERING GEAR LINK",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [
      "EPS:n varmennettu syöttöjännite, ohjausmomentti ja ohjauskulma"
    ],
    "note": "Moottori-ECU:n jännite ei ole EPS:n liittimen jännite eikä kuvaa ohjausmomenttia tai kulmaa.",
    "obdRole": "indirect",
    "oe": "44200-53130",
    "operatingStates": [
      "physical",
      "running"
    ],
    "physicalFollowUp": "Tarkista sammutetun auton ohjausvaihteen kiinnitys, suojakumit ja välykset manuaalin mukaan.",
    "pnc": "44200",
    "readiness": "needs-signal-verification",
    "recipes": [
      {
        "expectedPattern": "Jännitepoikkeama ohjaa akun ja syöttöjen tarkastukseen, mutta EPS:n oma arvio odottaa varmennettuja signaaleja.",
        "id": "vikadiag-59-physical",
        "instruction": "Tarkista sammutetun auton ohjausvaihteen kiinnitys, suojakumit ja välykset manuaalin mukaan.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista sammutetun auton ohjausvaihteen kiinnitys, suojakumit ja välykset manuaalin mukaan.",
        "signalKeys": []
      },
      {
        "expectedPattern": "Jännitepoikkeama ohjaa akun ja syöttöjen tarkastukseen, mutta EPS:n oma arvio odottaa varmennettuja signaaleja.",
        "id": "vikadiag-59-context",
        "instruction": "Tarkista ohjausvaihteen kiinnitys, suojakumit ja välykset; vertaa olemassa olevaa ECU-jännitettä vain auton sähköjärjestelmän taustakontekstina.",
        "kind": "cross-check",
        "operatingStates": [
          "running"
        ],
        "physicalFollowUp": "Tarkista sammutetun auton ohjausvaihteen kiinnitys, suojakumit ja välykset manuaalin mukaan.",
        "signalKeys": [
          "engine.ecu_voltage"
        ]
      }
    ],
    "signalKeys": [
      "engine.ecu_voltage"
    ],
    "source": {
      "bomSource": "BOM rivit 2471-2472, PNC 44200, OE 44200-53130",
      "externalSource": "LexusOwners IS220d power steering issues / steering clunk -ketjut; ClubLexus rack and pinion discussions",
      "range": "A59:O59",
      "reviewedAt": "2026-09-15",
      "row": 59,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Pidä erillään satulatappien ja tukivarsien kolinoista; molemmat voivat kuulua ohjattaessa.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "Techstream: EPS/PS DTC:t, jännitetaso ja mahdolliset momentti-/kulma-arvot jos saatavilla. Tavallinen moottori-OBD ei riitä.",
    "sourcePhysicalText": "Tarkista välys raidetankojen irrotuksella/pyörää ravistamalla, kiinnityspultit, kumisuojien vuodot/repeämät, nivelten välys ja akun/jännitteiden vaikutus EPS:ään.",
    "sourceRow": 59,
    "symptom": "Kolina ohjauksessa, raskas tai nykivä ohjaus, välys, ohjaus ei palauta, EPS/PS-varoitus tai täysi tehostuksen puute.",
    "testMethod": "Tarkista ohjausvaihteen kiinnitys, suojakumit ja välykset; vertaa olemassa olevaa ECU-jännitettä vain auton sähköjärjestelmän taustakontekstina."
  },
  {
    "componentId": "steering.tie_rods",
    "diagnosticGroup": "9. Jarrut, ohjaus ja alusta",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Välys paikannetaan niveleen; ohjausvaihde ja muut nivelet erotellaan.",
    "label": "Raidetangon päät ja sisemmät raidetangot",
    "limitations": [
      "EPS-kulma/momentti ei mittaa raidetangon nivelvälystä.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "TIE RODS / STEERING RACK ENDS",
      "likelySection": "FRONT STEERING GEAR LINK / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "45463-30130; 45464-30060; 45503-30070",
      "pnc": "45460/45470/45503",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "TIE RODS / STEERING RACK ENDS",
        "45460/45470/45503",
        "45463-30130; 45464-30060; 45503-30070"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "FRONT STEERING GEAR LINK",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "EPS-kulma/momentti ei mittaa raidetangon nivelvälystä.",
    "obdRole": "physical-only",
    "oe": "45463-30130; 45464-30060; 45503-30070",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Tarkista raidetankojen sisä- ja ulkonivelten välys ja suojakumit; varmistuta aurauskulmista korjauksen jälkeen.",
    "pnc": "45460/45470/45503",
    "readiness": "physical-only",
    "recipes": [
      {
        "expectedPattern": "Välys paikannetaan niveleen; ohjausvaihde ja muut nivelet erotellaan.",
        "id": "vikadiag-60-physical",
        "instruction": "Tarkista raidetankojen sisä- ja ulkonivelten välys ja suojakumit; varmistuta aurauskulmista korjauksen jälkeen.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista raidetankojen sisä- ja ulkonivelten välys ja suojakumit; varmistuta aurauskulmista korjauksen jälkeen.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 2477-2484, PNC 45460/45470/45503",
      "externalSource": "LexusOwners steering knocking/clunk -ketjut; MOOG steering/suspension inspection -periaate",
      "range": "A60:O60",
      "reviewedAt": "2026-09-15",
      "row": 60,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Suuntauksen tarve kirjataan aina tämän rivin huomioksi.",
      "sourceStatus": "Erä 3 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "Ei suoraa OBD-varmistusta; EPS voi näyttää ohjauskulmaa/momenttia, mutta nivelvälys todetaan fyysisesti.",
    "sourcePhysicalText": "Ravista pyörää 3–9-suunnassa, tunnustele sisemmän/ulomman nivelen välys, tarkista suojakumi ja tee aurauskulmien mittaus vaihdon jälkeen.",
    "sourceRow": 60,
    "symptom": "Välys ohjauksessa, kolina, renkaan epätasainen kuluma, auto vaeltelee tai ratti jää vinoon suuntauksen jälkeen.",
    "testMethod": "Tarkista raidetankojen sisä- ja ulkonivelten välys ja suojakumit; varmistuta aurauskulmista korjauksen jälkeen."
  },
  {
    "componentId": "engine.water_pump",
    "diagnosticGroup": "5. Jäähdytys, öljy ja hihnakäyttö",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Lämpökäyrä suhteutetaan fyysiseen neste-/vuototarkastukseen, ei yksittäiseen pumpputuomioon.",
    "label": "Vesipumppu",
    "limitations": [
      "ECT ei mittaa pumpun virtausta; termostaatti, ilma, korkki ja muut vuodot voivat selittää oireen.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista.",
      "Mekaaniset tarkastukset tehdään turvallisesti tuettuna ja moottori sammuksissa; lämpötilaseuranta ei oikeuta jatkamaan ajoa ylikuumenemisen tai nestevuodon aikana."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "PUMP ASSY, ENGINE WATER",
      "likelySection": "WATER PUMP / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "16100-29495",
      "pnc": "16100",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "PUMP ASSY, ENGINE WATER",
        "16100",
        "16100-29495"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "WATER PUMP",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "ECT ei mittaa pumpun virtausta; termostaatti, ilma, korkki ja muut vuodot voivat selittää oireen.",
    "obdRole": "indirect",
    "oe": "16100-29495",
    "operatingStates": [
      "physical",
      "running"
    ],
    "physicalFollowUp": "Tarkista kylmän järjestelmän vuodot ja pumpun mekaaninen kunto moottori sammuksissa.",
    "pnc": "16100",
    "readiness": "indirect-existing-signals",
    "recipes": [
      {
        "expectedPattern": "Lämpökäyrä suhteutetaan fyysiseen neste-/vuototarkastukseen, ei yksittäiseen pumpputuomioon.",
        "id": "vikadiag-61-physical",
        "instruction": "Tarkista kylmän järjestelmän vuodot ja pumpun mekaaninen kunto moottori sammuksissa.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista kylmän järjestelmän vuodot ja pumpun mekaaninen kunto moottori sammuksissa.",
        "signalKeys": []
      },
      {
        "expectedPattern": "Lämpökäyrä suhteutetaan fyysiseen neste-/vuototarkastukseen, ei yksittäiseen pumpputuomioon.",
        "id": "vikadiag-61-context",
        "instruction": "Tarkista kylmän järjestelmän vuodot ja pumpun mekaaninen perusta; seuraa ECT:n käyttäytymistä normaalissa käynnissä ilman ylikuumenemisen provosointia.",
        "kind": "cross-check",
        "operatingStates": [
          "running"
        ],
        "physicalFollowUp": "Tarkista kylmän järjestelmän vuodot ja pumpun mekaaninen kunto moottori sammuksissa.",
        "signalKeys": [
          "engine.coolant_temperature"
        ]
      }
    ],
    "signalKeys": [
      "engine.coolant_temperature"
    ],
    "source": {
      "bomSource": "BOM rivit 634-635, PNC 16100, OE 16100-29495",
      "externalSource": "ClubLexus/LexusOwners 2IS/IS220d water pump ja coolant/overheat -tapaukset; Gates cooling/accessory drive diagnosis",
      "range": "A61:O61",
      "reviewedAt": "2026-09-15",
      "row": 61,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "IS220d:n jäähdytysongelmissa pitää erottaa vesipumppu, ilma/lukko, termostaatti, korkki, vuoto ja 2AD-kansipahviriski.",
      "sourceStatus": "Erä 4 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "Techstream/Flex: coolant temp nousu ajossa ja paikallaan; vertaa sisälämmitykseen, tuulettimien käynnistymiseen ja mahdollisiin ylikuumenemis-/ECT-koodeihin.",
    "sourcePhysicalText": "Paineista järjestelmä kylmänä, tarkista vesipumpun vuotojäljet, välys/laakeriääni, hihnapyörän linjaus ja nestejäljet moottorin etuosassa.",
    "sourceRow": 61,
    "symptom": "Jäähdytysnesteen katoaminen, vinkuva/rahiseva laakeriääni, vuoto vesipumpun reiästä/akselilta, lämpöjen nousu, heikko sisälämmitys tai paineen kertyminen jäähdytysjärjestelmään.",
    "testMethod": "Tarkista kylmän järjestelmän vuodot ja pumpun mekaaninen perusta; seuraa ECT:n käyttäytymistä normaalissa käynnissä ilman ylikuumenemisen provosointia."
  },
  {
    "componentId": "engine.water_pump_gaskets",
    "diagnosticGroup": "5. Jäähdytys, öljy ja hihnakäyttö",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Vuotokohta todetaan fyysisesti; ECT:n muutos ei paikanna tiivistettä.",
    "label": "Vesipumpun tiivisteet",
    "limitations": [
      "Kuumaa paineistettua järjestelmää ei avata eikä tiivistevuotoa testata ylikuumentamalla.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista.",
      "Mekaaniset tarkastukset tehdään turvallisesti tuettuna ja moottori sammuksissa; lämpötilaseuranta ei oikeuta jatkamaan ajoa ylikuumenemisen tai nestevuodon aikana."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "GASKET, WATER PUMP / GASKET, WATER PUMP NO.2",
      "likelySection": "WATER PUMP / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "16271-26010; 16272-26010",
      "pnc": "16271/16272A",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "GASKET, WATER PUMP / GASKET, WATER PUMP NO.2",
        "16271/16272A",
        "16271-26010; 16272-26010"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "WATER PUMP",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "Kuumaa paineistettua järjestelmää ei avata eikä tiivistevuotoa testata ylikuumentamalla.",
    "obdRole": "indirect",
    "oe": "16271-26010; 16272-26010",
    "operatingStates": [
      "physical",
      "running"
    ],
    "physicalFollowUp": "Tarkista jäähtyneestä moottorista pumpun liitospinnan sakka ja vuoto.",
    "pnc": "16271/16272A",
    "readiness": "indirect-existing-signals",
    "recipes": [
      {
        "expectedPattern": "Vuotokohta todetaan fyysisesti; ECT:n muutos ei paikanna tiivistettä.",
        "id": "vikadiag-62-physical",
        "instruction": "Tarkista jäähtyneestä moottorista pumpun liitospinnan sakka ja vuoto.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista jäähtyneestä moottorista pumpun liitospinnan sakka ja vuoto.",
        "signalKeys": []
      },
      {
        "expectedPattern": "Vuotokohta todetaan fyysisesti; ECT:n muutos ei paikanna tiivistettä.",
        "id": "vikadiag-62-context",
        "instruction": "Tarkista jäähtyneestä moottorista pumpun liitospinnan sakka/vuoto; käytä ECT-lokia vain lämpötilakontekstina.",
        "kind": "cross-check",
        "operatingStates": [
          "running"
        ],
        "physicalFollowUp": "Tarkista jäähtyneestä moottorista pumpun liitospinnan sakka ja vuoto.",
        "signalKeys": [
          "engine.coolant_temperature"
        ]
      }
    ],
    "signalKeys": [
      "engine.coolant_temperature"
    ],
    "source": {
      "bomSource": "BOM rivit 204-205 ja 636-637, PNC 16272A/16271",
      "externalSource": "Yleinen Toyota/Lexus jäähdytysvuodon diagnostiikka; ClubLexus coolant leak -tapaukset",
      "range": "A62:O62",
      "reviewedAt": "2026-09-15",
      "row": 62,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Halpa mutta kriittinen osa; vanha tiiviste voi vuotaa vasta lämpimänä/paineessa.",
      "sourceStatus": "Erä 4 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "OBD ei paikanna tiivistevuotoa; seuraa coolant temp -arvoa ja nestetason muutoksen yhteyttä kuormaan.",
    "sourcePhysicalText": "Painekoe, UV-väri tarvittaessa, peili/valo liitospintaan, tarkistus sekä kylmänä että kuumana. Vaihda tiiviste aina pumpun irrotuksessa.",
    "sourceRow": 62,
    "symptom": "Vuoto pumpun ja lohkon/kotelon liitoksesta, makea jäähdytysnesteen haju, kuivunut vaalea/punertava sakka ja hitaasti laskeva nestepinta.",
    "testMethod": "Tarkista jäähtyneestä moottorista pumpun liitospinnan sakka/vuoto; käytä ECT-lokia vain lämpötilakontekstina."
  },
  {
    "componentId": "engine.belt_idler_pulleys",
    "diagnosticGroup": "5. Jäähdytys, öljy ja hihnakäyttö",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Karheus, välys tai linjausvirhe on fyysinen löydös.",
    "label": "Apulaitehihnan ohjainrullat",
    "limitations": [
      "Latauspoikkeama ei paikanna yksittäistä ohjainrullaa.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "PULLEY SUB-ASSY, IDLER, NO.1 / NO.2",
      "likelySection": "WATER PUMP / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "16603-0R010; 16604-26011",
      "pnc": "16603/16604",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "PULLEY SUB-ASSY, IDLER, NO.1 / NO.2",
        "16603/16604",
        "16603-0R010; 16604-26011"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "WATER PUMP",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "Latauspoikkeama ei paikanna yksittäistä ohjainrullaa.",
    "obdRole": "physical-only",
    "oe": "16603-0R010; 16604-26011",
    "operatingStates": [
      "physical"
    ],
    "physicalFollowUp": "Tarkista sammutetun moottorin rullat, linjaus ja hihnan kulumakuva; irrotetun hihnan jälkeen pyöritä rullia käsin manuaalin mukaan.",
    "pnc": "16603/16604",
    "readiness": "physical-only",
    "recipes": [
      {
        "expectedPattern": "Karheus, välys tai linjausvirhe on fyysinen löydös.",
        "id": "vikadiag-63-physical",
        "instruction": "Tarkista sammutetun moottorin rullat, linjaus ja hihnan kulumakuva; irrotetun hihnan jälkeen pyöritä rullia käsin manuaalin mukaan.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista sammutetun moottorin rullat, linjaus ja hihnan kulumakuva; irrotetun hihnan jälkeen pyöritä rullia käsin manuaalin mukaan.",
        "signalKeys": []
      }
    ],
    "signalKeys": [],
    "source": {
      "bomSource": "BOM rivit 638-641, PNC 16603/16604",
      "externalSource": "Gates accessory belt drive / idler-tensioner diagnosis",
      "range": "A63:O63",
      "reviewedAt": "2026-09-15",
      "row": 63,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Tarkista samalla kun hihna vaihdetaan; ääni voi kuulostaa laturilta tai vesipumpulta.",
      "sourceStatus": "Erä 4 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "Ei varsinaista OBD-tarkistusta; epäsuorasti latausjännitteen tai ilmastoinnin häiriöt voivat seurata hihnaongelmasta.",
    "sourcePhysicalText": "Kuuntele stetoskoopilla, tarkista rullan välys, karheus, linjaus ja hihnan kulumakuva. Irrota hihna ja pyöritä rullaa käsin.",
    "sourceRow": 63,
    "symptom": "Ulvova/rahiseva ääni, hihnan sivuttaisliike, hihnan epätasainen kuluminen, laturin/ilmastoinnin toimintahäiriöt ja pahimmillaan hihnan irtoaminen.",
    "testMethod": "Tarkista sammutetun moottorin rullat, linjaus ja hihnan kulumakuva; irrotetun hihnan jälkeen pyöritä rullia käsin manuaalin mukaan."
  },
  {
    "componentId": "engine.belt_tensioner",
    "diagnosticGroup": "5. Jäähdytys, öljy ja hihnakäyttö",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Jännite ja käynti arvioidaan yhdessä fyysisten hihnahavaintojen kanssa.",
    "label": "Apulaitehihnan kiristin",
    "limitations": [
      "ECU-jännite ei mittaa hihnan kireyttä; laturi, akku ja johdot ovat vaihtoehtoisia selittäjiä.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista.",
      "Mekaaniset tarkastukset tehdään turvallisesti tuettuna ja moottori sammuksissa; lämpötilaseuranta ei oikeuta jatkamaan ajoa ylikuumenemisen tai nestevuodon aikana."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "TENSIONER ASSY, V-RIBBED BELT",
      "likelySection": "WATER PUMP / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "16620-0R010",
      "pnc": "16620",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "TENSIONER ASSY, V-RIBBED BELT",
        "16620",
        "16620-0R010"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "WATER PUMP",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "ECU-jännite ei mittaa hihnan kireyttä; laturi, akku ja johdot ovat vaihtoehtoisia selittäjiä.",
    "obdRole": "indirect",
    "oe": "16620-0R010",
    "operatingStates": [
      "physical",
      "running"
    ],
    "physicalFollowUp": "Tarkista kiristimen, rullan ja hihnan mekaaninen kunto moottori sammuksissa manuaalin mukaan.",
    "pnc": "16620",
    "readiness": "indirect-existing-signals",
    "recipes": [
      {
        "expectedPattern": "Jännite ja käynti arvioidaan yhdessä fyysisten hihnahavaintojen kanssa.",
        "id": "vikadiag-64-physical",
        "instruction": "Tarkista kiristimen, rullan ja hihnan mekaaninen kunto moottori sammuksissa manuaalin mukaan.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista kiristimen, rullan ja hihnan mekaaninen kunto moottori sammuksissa manuaalin mukaan.",
        "signalKeys": []
      },
      {
        "expectedPattern": "Jännite ja käynti arvioidaan yhdessä fyysisten hihnahavaintojen kanssa.",
        "id": "vikadiag-64-context",
        "instruction": "Tarkista kiristimen, rullan ja hihnan mekaaninen kunto; seuraa ECU-jännitteen käyttäytymistä normaalissa käynnissä erillisenä sähköisenä kontekstina.",
        "kind": "cross-check",
        "operatingStates": [
          "running"
        ],
        "physicalFollowUp": "Tarkista kiristimen, rullan ja hihnan mekaaninen kunto moottori sammuksissa manuaalin mukaan.",
        "signalKeys": [
          "engine.ecu_voltage"
        ]
      }
    ],
    "signalKeys": [
      "engine.ecu_voltage"
    ],
    "source": {
      "bomSource": "BOM rivit 642-643, PNC 16620, OE 16620-0R010",
      "externalSource": "Gates tensioner failure signs ja TT004-15 tensioner diagnosis",
      "range": "A64:O64",
      "reviewedAt": "2026-09-15",
      "row": 64,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Kiristin voi rikkoa uuden hihnan tai oireilla laturivialta näyttävänä jänniteongelmana.",
      "sourceStatus": "Erä 4 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "OBD: seuraa ECU-jännitettä/latausta vain epäsuorana merkkinä. Varmistus mekaanisella tarkastuksella ja yleismittarilla.",
    "sourcePhysicalText": "Tarkista kiristimen osoitin/raja, jousen liike, vaimennus, rullan välys, linjaus ja hihnan kulumakuva. Tarkista myös laturin vapaakytkin.",
    "sourceRow": 64,
    "symptom": "Hihnan vinkuminen, kiristimen hyppiminen tyhjäkäynnillä, rämisevä ääni, hihnan luisto, lataus- tai ilmastointiongelmat, apulaitelaakerien ennenaikainen rasitus.",
    "testMethod": "Tarkista kiristimen, rullan ja hihnan mekaaninen kunto; seuraa ECU-jännitteen käyttäytymistä normaalissa käynnissä erillisenä sähköisenä kontekstina."
  },
  {
    "componentId": "engine.accessory_belt",
    "diagnosticGroup": "5. Jäähdytys, öljy ja hihnakäyttö",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Hihnan vaurio todetaan visuaalisesti; kuormaan liittyvä jännitepoikkeama ohjaa hihna-/laturijärjestelmään.",
    "label": "Moniurahihna / apulaitehihna",
    "limitations": [
      "Ei suihkepullotestiä käyvän hihnan lähellä tässä ohjeessa; jännite ei paikanna luistoa.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista.",
      "Mekaaniset tarkastukset tehdään turvallisesti tuettuna ja moottori sammuksissa; lämpötilaseuranta ei oikeuta jatkamaan ajoa ylikuumenemisen tai nestevuodon aikana."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "BELT, V(FOR FAN & ALTERNATOR)",
      "likelySection": "V BELT / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "90916-W2014",
      "pnc": "16361A",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "BELT, V(FOR FAN & ALTERNATOR)",
        "16361A",
        "90916-W2014"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "V BELT",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "Ei suihkepullotestiä käyvän hihnan lähellä tässä ohjeessa; jännite ei paikanna luistoa.",
    "obdRole": "indirect",
    "oe": "90916-W2014",
    "operatingStates": [
      "physical",
      "running"
    ],
    "physicalFollowUp": "Tarkista hihnan urat, pinnat, lika ja linjaus moottori sammuksissa.",
    "pnc": "16361A",
    "readiness": "indirect-existing-signals",
    "recipes": [
      {
        "expectedPattern": "Hihnan vaurio todetaan visuaalisesti; kuormaan liittyvä jännitepoikkeama ohjaa hihna-/laturijärjestelmään.",
        "id": "vikadiag-65-physical",
        "instruction": "Tarkista hihnan urat, pinnat, lika ja linjaus moottori sammuksissa.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista hihnan urat, pinnat, lika ja linjaus moottori sammuksissa.",
        "signalKeys": []
      },
      {
        "expectedPattern": "Hihnan vaurio todetaan visuaalisesti; kuormaan liittyvä jännitepoikkeama ohjaa hihna-/laturijärjestelmään.",
        "id": "vikadiag-65-context",
        "instruction": "Tarkista hihnan urat, pinnat, lika ja linjaus moottori sammuksissa; käytä normaalia ECU-jännitelokia vain latauskontekstina.",
        "kind": "cross-check",
        "operatingStates": [
          "running"
        ],
        "physicalFollowUp": "Tarkista hihnan urat, pinnat, lika ja linjaus moottori sammuksissa.",
        "signalKeys": [
          "engine.ecu_voltage"
        ]
      }
    ],
    "signalKeys": [
      "engine.ecu_voltage"
    ],
    "source": {
      "bomSource": "BOM rivit 754-757, PNC 16361A, OE 90916-W2014",
      "externalSource": "Gates Micro-V belt wear symptoms ja belt noise spray bottle test",
      "range": "A65:O65",
      "reviewedAt": "2026-09-15",
      "row": 65,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Jos hihna vaihdetaan, kiristin ja rullat kannattaa tarkistaa samalla.",
      "sourceStatus": "Erä 4 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "Ei suoraa OBD-arvoa; ECU-jännite/lataus voi pudota, jos hihna luistaa laturilla.",
    "sourcePhysicalText": "Tarkista urien kuluma, halkeamat, öljy/jäähdytysneste hihnalla, linjaus ja kiristin. Suihkepullotesti voi auttaa erottamaan linjaus- ja kireysongelmaa.",
    "sourceRow": 65,
    "symptom": "Vinkuminen kylmänä, luisto kuormalla, halkeamat, kiillottunut pinta, reunan rispaantuminen, laturin latauksen tai ilmastoinnin heikkeneminen.",
    "testMethod": "Tarkista hihnan urat, pinnat, lika ja linjaus moottori sammuksissa; käytä normaalia ECU-jännitelokia vain latauskontekstina."
  },
  {
    "componentId": "engine.radiator",
    "diagnosticGroup": "5. Jäähdytys, öljy ja hihnakäyttö",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Lämpötilan kehitys tulkitaan fyysisten vuoto-/kennohavaintojen rinnalla.",
    "label": "Jäähdytin",
    "limitations": [
      "ECT ei mittaa kennon paikallista tukosta; IR-havainto ja puhaltimen toiminta ovat fyysisiä lisätietoja.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista.",
      "Mekaaniset tarkastukset tehdään turvallisesti tuettuna ja moottori sammuksissa; lämpötilaseuranta ei oikeuta jatkamaan ajoa ylikuumenemisen tai nestevuodon aikana."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "RADIATOR ASSY",
      "likelySection": "RADIATOR WATER OUTLET / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "16400-26400",
      "pnc": "16400",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "RADIATOR ASSY",
        "16400",
        "16400-26400"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "RADIATOR WATER OUTLET",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "ECT ei mittaa kennon paikallista tukosta; IR-havainto ja puhaltimen toiminta ovat fyysisiä lisätietoja.",
    "obdRole": "indirect",
    "oe": "16400-26400",
    "operatingStates": [
      "physical",
      "running"
    ],
    "physicalFollowUp": "Tarkista kylmän järjestelmän vuodot ja kennon ulkoinen tukos.",
    "pnc": "16400",
    "readiness": "indirect-existing-signals",
    "recipes": [
      {
        "expectedPattern": "Lämpötilan kehitys tulkitaan fyysisten vuoto-/kennohavaintojen rinnalla.",
        "id": "vikadiag-66-physical",
        "instruction": "Tarkista kylmän järjestelmän vuodot ja kennon ulkoinen tukos.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista kylmän järjestelmän vuodot ja kennon ulkoinen tukos.",
        "signalKeys": []
      },
      {
        "expectedPattern": "Lämpötilan kehitys tulkitaan fyysisten vuoto-/kennohavaintojen rinnalla.",
        "id": "vikadiag-66-context",
        "instruction": "Tarkista kylmän järjestelmän vuodot ja kennon ulkoinen tukos; seuraa ECT:tä normaalissa käynnissä ja aiemmasta ajolokista.",
        "kind": "cross-check",
        "operatingStates": [
          "running"
        ],
        "physicalFollowUp": "Tarkista kylmän järjestelmän vuodot ja kennon ulkoinen tukos.",
        "signalKeys": [
          "engine.coolant_temperature"
        ]
      }
    ],
    "signalKeys": [
      "engine.coolant_temperature"
    ],
    "source": {
      "bomSource": "BOM rivit 667-668, PNC 16400, OE 16400-26400",
      "externalSource": "ClubLexus/IS220d coolant spraying/overheat -ketjut; yleinen jäähdytysjärjestelmän painekoe",
      "range": "A66:O66",
      "reviewedAt": "2026-09-15",
      "row": 66,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "2AD-FHV:ssä ylikuumeneminen pitää erottaa myös kansipahvi-/ilmakuplaongelmasta.",
      "sourceStatus": "Erä 4 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "Techstream/Flex: coolant temp ajossa, tyhjäkäynnillä ja puhaltimen käynnistyessä. Ei kerro suoraan kennon osittaista tukosta.",
    "sourcePhysicalText": "Painekoe, vuotojäljet kennoissa ja päädyissä, lämpökameralla/IR-mittarilla kylmät alueet, letkujen lämpöero ja korkin/ylivuodon tarkistus.",
    "sourceRow": 66,
    "symptom": "Nestetason lasku, ylikuumeneminen kuormalla/paikallaan, ulkoinen vuoto, tukkeutunut kenno, kylmä alakulma tai keulan lämpöjen heikko poistuminen.",
    "testMethod": "Tarkista kylmän järjestelmän vuodot ja kennon ulkoinen tukos; seuraa ECT:tä normaalissa käynnissä ja aiemmasta ajolokista."
  },
  {
    "componentId": "engine.cooling_fans",
    "diagnosticGroup": "5. Jäähdytys, öljy ja hihnakäyttö",
    "excludedActions": [
      "active-test",
      "ecu-write"
    ],
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "ECT ja näkyvä puhaltimen käynti antavat vain järjestelmäkontekstin; pyyntö/toteuma-vertailu ei ole mahdollinen.",
    "label": "Jäähdyttimen puhaltimet ja moottorit",
    "limitations": [
      "Ei Active Testiä, suoraa syöttöä tai ECU-ohjausta Flex-reseptissä; pyörivään tai itsestään käynnistyvään puhaltimeen ei kosketa.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista.",
      "Mekaaniset tarkastukset tehdään turvallisesti tuettuna ja moottori sammuksissa; lämpötilaseuranta ei oikeuta jatkamaan ajoa ylikuumenemisen tai nestevuodon aikana."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "FAN / MOTOR, COOLING FAN",
      "likelySection": "RADIATOR WATER OUTLET / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "16361-26110; 16363-26060; 16363-26070",
      "pnc": "16361/16363",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "FAN / MOTOR, COOLING FAN",
        "16361/16363",
        "16361-26110; 16363-26060; 16363-26070"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "RADIATOR WATER OUTLET",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [
      "Puhaltimen varmennettu pyyntö ja pyörimis-/nopeuspalaute",
      "Ilmastoinnin varmennettu paine/pyyntö"
    ],
    "note": "Ei Active Testiä, suoraa syöttöä tai ECU-ohjausta Flex-reseptissä; pyörivään tai itsestään käynnistyvään puhaltimeen ei kosketa.",
    "obdRole": "indirect",
    "oe": "16361-26110; 16363-26060; 16363-26070",
    "operatingStates": [
      "physical",
      "running"
    ],
    "physicalFollowUp": "Tarkista sammutetun auton liittimet ja sulakkeet manuaalin mukaan; estä puhaltimen tahaton käynnistyminen ennen kosketusta manuaalin turvamenettelyllä.",
    "pnc": "16361/16363",
    "readiness": "indirect-existing-signals",
    "recipes": [
      {
        "expectedPattern": "ECT ja näkyvä puhaltimen käynti antavat vain järjestelmäkontekstin; pyyntö/toteuma-vertailu ei ole mahdollinen.",
        "id": "vikadiag-67-physical",
        "instruction": "Tarkista sammutetun auton liittimet ja sulakkeet manuaalin mukaan; estä puhaltimen tahaton käynnistyminen ennen kosketusta manuaalin turvamenettelyllä.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista sammutetun auton liittimet ja sulakkeet manuaalin mukaan; estä puhaltimen tahaton käynnistyminen ennen kosketusta manuaalin turvamenettelyllä.",
        "signalKeys": []
      },
      {
        "expectedPattern": "ECT ja näkyvä puhaltimen käynti antavat vain järjestelmäkontekstin; pyyntö/toteuma-vertailu ei ole mahdollinen.",
        "id": "vikadiag-67-context",
        "instruction": "Tarkista sammutetun auton liittimet ja sulakkeet manuaalin mukaan; havainnoi luonnollista puhaltimen toimintaa etäältä ja seuraa ECT:tä.",
        "kind": "cross-check",
        "operatingStates": [
          "running"
        ],
        "physicalFollowUp": "Tarkista sammutetun auton liittimet ja sulakkeet manuaalin mukaan; estä puhaltimen tahaton käynnistyminen ennen kosketusta manuaalin turvamenettelyllä.",
        "signalKeys": [
          "engine.coolant_temperature"
        ]
      }
    ],
    "signalKeys": [
      "engine.coolant_temperature"
    ],
    "source": {
      "bomSource": "BOM rivit 659-666, PNC 16361/16363",
      "externalSource": "Toyota/Lexus jäähdytyspuhaltimen diagnostiikkaperiaate; ClubLexus ylikuumenemistapaukset",
      "range": "A67:O67",
      "reviewedAt": "2026-09-15",
      "row": 67,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Todennäköinen",
      "sourceNote": "OBD voi näyttää pyynnön/lämpötilan, mutta ei aina moottorin mekaanista pyörimistä.",
      "sourceStatus": "Erä 4 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "Techstream active test / fan command jos saatavilla; seuraa coolant temp ja A/C pressure/pyyntöä. Varmista käskyn ja todellisen pyörimisen vastaavuus.",
    "sourcePhysicalText": "Testaa sulakkeet/releet, liittimet, puhaltimen vapaa pyörintä, suora syöttö tarvittaessa ja että kenno ei ole tukossa roskasta.",
    "sourceRow": 67,
    "symptom": "Lämmöt nousevat paikallaan, ilmastointi heikkenee pysähdyksissä, puhaltimet eivät käynnisty tai käyvät vain toisella nopeudella/puolella.",
    "testMethod": "Tarkista sammutetun auton liittimet ja sulakkeet manuaalin mukaan; havainnoi luonnollista puhaltimen toimintaa etäältä ja seuraa ECT:tä."
  },
  {
    "componentId": "engine.expansion_tank_cap",
    "diagnosticGroup": "5. Jäähdytys, öljy ja hihnakäyttö",
    "existingImplementation": null,
    "existingInspectionPoints": [],
    "expectedPattern": "Korkin tiiviys todetaan painetesterillä, ei ECT-arvosta.",
    "label": "Paisuntasäiliö ja korkki",
    "limitations": [
      "Ei arvattua korkin avautumispainetta; kuumaa korkkia ei avata.",
      "Ei automaattista osan hyväksymistä tai vikatuomiota. Puuttuva näyte ei ole nolla; numeeriset korjausrajat varmennetaan erikseen manuaalista.",
      "Mekaaniset tarkastukset tehdään turvallisesti tuettuna ja moottori sammuksissa; lämpötilaseuranta ei oikeuta jatkamaan ajoa ylikuumenemisen tai nestevuodon aikana."
    ],
    "manualVisual": {
      "assetPath": null,
      "componentName": "TANK ASSY, RADIATOR RESERVE / CAP SUB-ASSY",
      "likelySection": "RADIATOR WATER OUTLET / COMPONENTS / INSPECTION",
      "manualReference": null,
      "oe": "16470-26110; 16475-28120; 16475-51010",
      "pnc": "16470/16471",
      "required": true,
      "searchTerms": [
        "IS220d ALE20",
        "TANK ASSY, RADIATOR RESERVE / CAP SUB-ASSY",
        "16470/16471",
        "16470-26110; 16475-28120; 16475-51010"
      ],
      "source": "Lexus IS250/220D repair manual",
      "status": "pending-extract",
      "system": "RADIATOR WATER OUTLET",
      "targetViews": [
        "location",
        "inspection diagram",
        "exploded view"
      ]
    },
    "missingSignals": [],
    "note": "Ei arvattua korkin avautumispainetta; kuumaa korkkia ei avata.",
    "obdRole": "indirect",
    "oe": "16470-26110; 16475-28120; 16475-51010",
    "operatingStates": [
      "physical",
      "running"
    ],
    "physicalFollowUp": "Tarkista jäähtyneenä säiliön halkeamat, korkin tiiviste ja ylivuotoreitti; korkin painekoe tehdään manuaalin mukaan.",
    "pnc": "16470/16471",
    "readiness": "indirect-existing-signals",
    "recipes": [
      {
        "expectedPattern": "Korkin tiiviys todetaan painetesterillä, ei ECT-arvosta.",
        "id": "vikadiag-68-physical",
        "instruction": "Tarkista jäähtyneenä säiliön halkeamat, korkin tiiviste ja ylivuotoreitti; korkin painekoe tehdään manuaalin mukaan.",
        "kind": "physical",
        "operatingStates": [
          "physical"
        ],
        "physicalFollowUp": "Tarkista jäähtyneenä säiliön halkeamat, korkin tiiviste ja ylivuotoreitti; korkin painekoe tehdään manuaalin mukaan.",
        "signalKeys": []
      },
      {
        "expectedPattern": "Korkin tiiviys todetaan painetesterillä, ei ECT-arvosta.",
        "id": "vikadiag-68-context",
        "instruction": "Tarkista jäähtyneenä säiliön halkeamat, korkin tiiviste ja ylivuotoreitti; korkin painekoe tehdään manuaalin mukaan. ECT-loki on vain lämpötilakonteksti.",
        "kind": "cross-check",
        "operatingStates": [
          "running"
        ],
        "physicalFollowUp": "Tarkista jäähtyneenä säiliön halkeamat, korkin tiiviste ja ylivuotoreitti; korkin painekoe tehdään manuaalin mukaan.",
        "signalKeys": [
          "engine.coolant_temperature"
        ]
      }
    ],
    "signalKeys": [
      "engine.coolant_temperature"
    ],
    "source": {
      "bomSource": "BOM rivit 693-697, PNC 16470/16471",
      "externalSource": "ClubLexus IS220d coolant spraying -tapaukset; yleinen cooling system pressure cap -diagnostiikka",
      "range": "A68:O68",
      "reviewedAt": "2026-09-15",
      "row": 68,
      "sheet": "Vikadiag_kohteet",
      "sheetId": 910002,
      "sourceConfidence": "Vahva",
      "sourceNote": "Halpa tarkistus ennen isompia päätelmiä kansipahvista.",
      "sourceStatus": "Erä 4 valmis",
      "spreadsheetId": "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8"
    },
    "sourceObdText": "Coolant temp -trendit ja ylikuumenemiskoodit; korkin toiminta pitää testata fyysisesti painetesterillä.",
    "sourcePhysicalText": "Paineista korkki ja järjestelmä, tarkista säiliön hiushalkeamat, letkut, korkin tiiviste ja ylivuotoreitti.",
    "sourceRow": 68,
    "symptom": "Nestettä työntyy yli, järjestelmä ei pidä painetta, letkut kovettuvat tai jäävät pehmeiksi, neste häviää ilman selvää vuotoa, lämmöt heittelevät.",
    "testMethod": "Tarkista jäähtyneenä säiliön halkeamat, korkin tiiviste ja ylivuotoreitti; korkin painekoe tehdään manuaalin mukaan. ECT-loki on vain lämpötilakonteksti."
  }
];

const reviewedCatalog = [...firstBatch, ...[...reviewedContinuation, ...chassisContinuation, ...coolingContinuation].map(candidate => ({
  ...candidate,
  signalEvidence: candidate.signalKeys.map(key => {
    const signal = getIs220dDiagnosticSignal(key);
    return { key, evidence: signal.evidence, authorization: signal.authorization, source: signal.source };
  })
}))];

const seenRows = new Set();
for (const candidate of reviewedCatalog) {
  const visuals = getIs220dRepairManualVisuals(candidate.componentId);
  if (visuals.length) {
    candidate.manualVisual = {
      ...candidate.manualVisual,
      status: "available",
      assetPath: visuals[0].assetPath,
      manualReference: visuals[0].manualReference,
      imageSourcePath: visuals[0].sourceImagePath,
      figureReviewed: true,
      visualIds: visuals.map(visual => visual.id)
    };
  }
  validateVikadiagObdTestCandidate(candidate);
  if (seenRows.has(candidate.sourceRow)) throw new Error(`Duplicate Vikadiag source row ${candidate.sourceRow}`);
  seenRows.add(candidate.sourceRow);
}

export const IS220D_VIKADIAG_OBD_TEST_CATALOG = deepFreeze(reviewedCatalog);

export function getVikadiagObdTestCandidateByRow(sourceRow) {
  return IS220D_VIKADIAG_OBD_TEST_CATALOG.find(candidate => candidate.sourceRow === Number(sourceRow)) || null;
}

export function summarizeVikadiagObdTestCatalog(catalog = IS220D_VIKADIAG_OBD_TEST_CATALOG) {
  const summary = {
    total: catalog.length,
    implementedDedicated: 0,
    readyExistingSignals: 0,
    indirectExistingSignals: 0,
    needsSignalVerification: 0,
    blocked: 0,
    physicalOnly: 0,
    manualVisualPending: 0
  };
  for (const candidate of catalog) {
    if (candidate.readiness === VIKADIAG_TEST_READINESS.IMPLEMENTED_DEDICATED) summary.implementedDedicated += 1;
    if (candidate.readiness === VIKADIAG_TEST_READINESS.READY_EXISTING_SIGNALS) summary.readyExistingSignals += 1;
    if (candidate.readiness === VIKADIAG_TEST_READINESS.INDIRECT_EXISTING_SIGNALS) summary.indirectExistingSignals += 1;
    if (candidate.readiness === VIKADIAG_TEST_READINESS.NEEDS_SIGNAL_VERIFICATION) summary.needsSignalVerification += 1;
    if (candidate.readiness === VIKADIAG_TEST_READINESS.PHYSICAL_ONLY) summary.physicalOnly += 1;
    if (candidate.readiness === VIKADIAG_TEST_READINESS.BLOCKED) summary.blocked += 1;
    if (candidate.manualVisual?.status !== "available") summary.manualVisualPending += 1;
  }
  return Object.freeze(summary);
}
