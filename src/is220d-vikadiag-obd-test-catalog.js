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
export const IS220D_VIKADIAG_OBD_TEST_SOURCE_BATCH = "Drive rows 2-38 reviewed 2026-09-14";

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

const reviewedCatalog = [...firstBatch, ...reviewedContinuation.map(candidate => ({
  ...candidate,
  signalEvidence: candidate.signalKeys.map(key => {
    const signal = getIs220dDiagnosticSignal(key);
    return { key, evidence: signal.evidence, authorization: signal.authorization, source: signal.source };
  })
}))];

const seenRows = new Set();
for (const candidate of reviewedCatalog) {
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

