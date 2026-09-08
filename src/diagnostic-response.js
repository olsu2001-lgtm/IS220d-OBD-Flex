const NRC_DEFINITIONS = Object.freeze({
  "10": { description: "yleinen hylkäys", category: "general-reject", retryable: false },
  "11": { description: "palvelua ei tueta", category: "service-not-supported", retryable: false },
  "12": { description: "alitoimintoa tai tunnistetta ei tueta", category: "subfunction-not-supported", retryable: false },
  "13": { description: "viestin pituus tai muoto on virheellinen", category: "invalid-format", retryable: false },
  "21": { description: "ECU on varattu; pyyntö voidaan uusia myöhemmin", category: "busy-repeat-request", retryable: true },
  "22": { description: "ehdot eivät täyty", category: "conditions-not-correct", retryable: false },
  "24": { description: "pyyntöjärjestys on virheellinen", category: "request-sequence-error", retryable: false },
  "31": { description: "pyyntö ei ole sallitulla alueella", category: "request-out-of-range", retryable: false },
  "33": { description: "turvallisuusoikeus puuttuu", category: "security-access-denied", retryable: false },
  "35": { description: "turva-avain on virheellinen", category: "invalid-key", retryable: false },
  "36": { description: "turvayritysten enimmäismäärä ylittyi", category: "exceeded-attempts", retryable: false },
  "37": { description: "turvaviive ei ole vielä kulunut", category: "required-delay-not-expired", retryable: true },
  "70": { description: "siirtoa ei hyväksytty", category: "upload-download-not-accepted", retryable: false },
  "71": { description: "tiedonsiirto keskeytettiin", category: "transfer-suspended", retryable: true },
  "72": { description: "ohjelmointivirhe", category: "programming-failure", retryable: false },
  "73": { description: "lohkojärjestys on virheellinen", category: "wrong-block-sequence", retryable: true },
  "78": { description: "vastaus odottaa", category: "response-pending", retryable: true },
  "7E": { description: "alitoimintoa ei tueta nykyisessä istunnossa", category: "subfunction-not-supported-in-session", retryable: false },
  "7F": { description: "palvelua ei tueta nykyisessä istunnossa", category: "service-not-supported-in-session", retryable: false }
});

const ELM_OUTCOMES = Object.freeze([
  { token: "NO DATA", kind: "no-data", description: "Ohjainlaite ei palauttanut tietoa" },
  { token: "UNABLE TO CONNECT", kind: "ecu-unreachable", description: "Adapteri ei saanut yhteyttä ECUun" },
  { token: "BUS INIT: ERROR", kind: "bus-init-error", description: "Ajoneuvoväylän alustus epäonnistui" },
  { token: "BUS INIT ERROR", kind: "bus-init-error", description: "Ajoneuvoväylän alustus epäonnistui" },
  { token: "CAN ERROR", kind: "can-error", description: "CAN-väylävirhe" },
  { token: "BUFFER FULL", kind: "adapter-buffer-full", description: "Adapterin puskuri täyttyi" },
  { token: "LV RESET", kind: "low-voltage-reset", description: "Adapteri nollautui liian matalan jännitteen vuoksi" },
  { token: "STOPPED", kind: "stopped", description: "Komento keskeytyi" }
]);

function normalizeService(value) {
  if (value == null || value === "") return null;
  if (Number.isInteger(value)) return Number(value) & 0xff;
  const normalized = String(value).replace(/[^0-9a-f]/gi, "").toUpperCase();
  if (!/^[0-9A-F]{2}$/.test(normalized)) return null;
  return Number.parseInt(normalized, 16);
}

function candidateHexLines(raw) {
  return String(raw ?? "")
    .replace(/\u0000/g, "")
    .replace(/SEARCHING\.{0,3}/gi, "")
    .replace(/>/g, "")
    .split(/[\r\n]+/)
    .map(line => line.trim().toUpperCase())
    .filter(Boolean)
    .map(line => {
      const tokens = line
        .split(/\s+/)
        .map(token => token.replace(/[^0-9A-F]/g, ""))
        .filter(Boolean);
      if (tokens.length > 1 && (tokens[0].length === 3 || tokens[0].length === 8) && tokens[1].length === 2) tokens.shift();
      let compact = tokens.length === 1
        ? tokens[0]
        : tokens.filter(token => token.length % 2 === 0).join("");
      if (tokens.length === 1 && compact.length % 2 === 1 && compact.length >= 9) compact = compact.slice(3);
      return { source: line, compact };
    });
}

export function parseDiagnosticNegativeResponse(raw, expectedService = null) {
  const expected = normalizeService(expectedService);
  const matches = [];
  for (const line of candidateHexLines(raw)) {
    for (let index = 0; index + 5 < line.compact.length; index += 2) {
      if (line.compact.slice(index, index + 2) !== "7F") continue;
      const serviceHex = line.compact.slice(index + 2, index + 4);
      const code = line.compact.slice(index + 4, index + 6);
      if (!/^[0-9A-F]{2}$/.test(serviceHex) || !/^[0-9A-F]{2}$/.test(code)) continue;
      const service = Number.parseInt(serviceHex, 16);
      const definition = NRC_DEFINITIONS[code] || {
        description: "ECU palautti tuntemattoman kielteisen vastauksen",
        category: "unknown-negative-response",
        retryable: false
      };
      matches.push(Object.freeze({
        service,
        serviceHex,
        code,
        description: definition.description,
        category: definition.category,
        retryable: definition.retryable,
        responsePending: code === "78",
        rawLine: line.source
      }));
    }
  }
  if (expected != null) return matches.find(item => item.service === expected) || null;
  return matches[0] || null;
}

export function classifyDiagnosticResponse({ raw = "", error = "", expectedService = null, positivePrefix = "" } = {}) {
  const errorText = String(error || "");
  const upperError = errorText.toUpperCase();
  if (/AIKAKATKA|TIMEOUT|TIMED OUT/.test(upperError)) {
    return Object.freeze({ kind: "timeout", description: errorText || "Vastaus aikakatkaistiin", retryable: true, negativeResponse: null });
  }
  if (/DISCONNECT|YHTEYS KATKESI|EI OLE YHDISTETTY/.test(upperError)) {
    return Object.freeze({ kind: "disconnected", description: errorText || "Yhteys katkesi", retryable: true, negativeResponse: null });
  }

  const negativeResponse = parseDiagnosticNegativeResponse(raw, expectedService);
  if (negativeResponse) {
    return Object.freeze({
      kind: negativeResponse.responsePending ? "response-pending" : "negative-response",
      description: negativeResponse.description,
      retryable: negativeResponse.retryable,
      negativeResponse
    });
  }

  const text = `${String(raw || "")}\n${errorText}`.toUpperCase();
  if (text.trim() === "?") return Object.freeze({ kind: "adapter-unsupported", description: "Adapteri ei tunnistanut komentoa", retryable: false, negativeResponse: null });
  const elm = ELM_OUTCOMES.find(item => text.includes(item.token));
  if (elm) return Object.freeze({ kind: elm.kind, description: elm.description, retryable: ["no-data", "ecu-unreachable", "bus-init-error", "can-error", "adapter-buffer-full", "stopped"].includes(elm.kind), negativeResponse: null });

  const prefix = String(positivePrefix || "").replace(/[^0-9a-f]/gi, "").toUpperCase();
  const compact = candidateHexLines(raw).map(item => item.compact).join("");
  if (prefix && compact.includes(prefix)) return Object.freeze({ kind: "positive-response", description: `Positiivinen ${prefix}-vastaus löytyi`, retryable: false, negativeResponse: null });
  if (compact) return Object.freeze({ kind: "unclassified-response", description: "Adapteri palautti luokittelematonta dataa", retryable: false, negativeResponse: null });
  if (errorText) return Object.freeze({ kind: "transport-error", description: errorText, retryable: true, negativeResponse: null });
  return Object.freeze({ kind: "empty-response", description: "Tyhjä vastaus", retryable: true, negativeResponse: null });
}

export function diagnosticNrcDefinition(code) {
  const normalized = String(code || "").replace(/[^0-9a-f]/gi, "").toUpperCase().padStart(2, "0").slice(-2);
  const definition = NRC_DEFINITIONS[normalized];
  return definition ? Object.freeze({ code: normalized, ...definition }) : null;
}

export { NRC_DEFINITIONS };
