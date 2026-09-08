const normalizeCommand = value => String(value || "").replace(/\s+/g, "").toUpperCase();
const defaultWait = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));

export class ReplayTransportError extends Error {
  constructor(message, { code = "REPLAY_ERROR", command = "", partialRaw = "" } = {}) {
    super(message);
    this.name = "ReplayTransportError";
    this.code = code;
    this.command = command;
    this.partialRaw = partialRaw;
    this.raw = partialRaw;
  }
}

/**
 * Deterministic ELM-compatible transport for regression tests and report
 * replay. It never opens Bluetooth and never retries a command implicitly.
 */
export class ReplayElmTransport {
  constructor(script = [], options = {}) {
    if (!Array.isArray(script)) throw new TypeError("Replay-skriptin pitää olla taulukko");
    this.script = script.map((entry, index) => Object.freeze({ ...entry, index }));
    this.strictOrder = options.strictOrder !== false;
    this.wait = typeof options.wait === "function" ? options.wait : defaultWait;
    this.device = Object.freeze({
      ok: true,
      name: options.name || "IS220d ELM replay",
      address: options.address || "REPLAY:IS220D",
      transport: "replay",
      transportProfile: options.transportProfile || "is220d-elm-replay-v1"
    });
    this.cursor = 0;
    this.connected = false;
    this.history = [];
  }

  async connect() {
    this.connected = true;
    this.cursor = 0;
    this.history = [];
    return { ...this.device };
  }

  async disconnect() {
    this.connected = false;
  }

  findEntry(command) {
    if (this.strictOrder) {
      const entry = this.script[this.cursor];
      if (!entry) throw new ReplayTransportError(`Replay-skripti päättyi ennen komentoa ${command}`, { code: "REPLAY_EXHAUSTED", command });
      const expected = normalizeCommand(entry.command);
      if (expected !== command) {
        throw new ReplayTransportError(`Replay-järjestysvirhe: odotettiin ${expected || "(tyhjä)"}, saatiin ${command || "(tyhjä)"}`, {
          code: "REPLAY_ORDER_MISMATCH",
          command
        });
      }
      this.cursor += 1;
      return entry;
    }

    const index = this.script.findIndex((entry, entryIndex) => entryIndex >= this.cursor && normalizeCommand(entry.command) === command);
    if (index < 0) throw new ReplayTransportError(`Replay-skriptissä ei ole komentoa ${command}`, { code: "REPLAY_COMMAND_MISSING", command });
    this.cursor = index + 1;
    return this.script[index];
  }

  async send(command, timeoutMs = 2500) {
    if (!this.connected) throw new ReplayTransportError("Replay-kuljetusta ei ole yhdistetty", { code: "REPLAY_DISCONNECTED", command: normalizeCommand(command) });
    const normalized = normalizeCommand(command);
    const entry = this.findEntry(normalized);
    const response = Array.isArray(entry.responseChunks)
      ? entry.responseChunks.join(entry.chunkSeparator ?? "")
      : String(entry.response ?? "");
    const delayMs = Math.max(0, Number(entry.delayMs) || 0);
    const timeout = Math.max(0, Number(timeoutMs) || 0);
    const event = {
      sequence: this.history.length + 1,
      command: normalized,
      expectedCommand: normalizeCommand(entry.command),
      delayMs,
      timeoutMs: timeout,
      outcome: "pending",
      raw: ""
    };
    this.history.push(event);

    if (entry.disconnect) {
      this.connected = false;
      event.outcome = "disconnected";
      throw new ReplayTransportError(entry.error || `Replay-yhteys katkesi komennolla ${normalized}`, {
        code: "REPLAY_DISCONNECTED",
        command: normalized,
        partialRaw: String(entry.partialRaw || "")
      });
    }

    if (timeout > 0 && delayMs > timeout) {
      event.outcome = "timeout";
      event.raw = String(entry.partialRaw || "");
      throw new ReplayTransportError(`Replay-aikakatkaisu (${normalized}, ${timeout} ms)`, {
        code: "REPLAY_TIMEOUT",
        command: normalized,
        partialRaw: event.raw
      });
    }

    if (delayMs) await this.wait(delayMs);
    if (entry.error) {
      event.outcome = "error";
      event.raw = String(entry.partialRaw || "");
      throw new ReplayTransportError(String(entry.error), {
        code: entry.errorCode || "REPLAY_SCRIPTED_ERROR",
        command: normalized,
        partialRaw: event.raw
      });
    }

    event.outcome = "response";
    event.raw = response;
    return response;
  }

  snapshot() {
    return Object.freeze({
      schemaVersion: 1,
      transportProfile: this.device.transportProfile,
      connected: this.connected,
      cursor: this.cursor,
      scriptLength: this.script.length,
      complete: this.cursor === this.script.length,
      history: Object.freeze(this.history.map(event => Object.freeze({ ...event })))
    });
  }
}

export function replayScenarioFromFixture(fixture, scenarioName) {
  const scenarios = fixture?.scenarios || {};
  const scenario = scenarios[scenarioName];
  if (!scenario || !Array.isArray(scenario.steps)) throw new Error(`Replay-fixtuurista puuttuu skenaario ${scenarioName}`);
  return {
    name: scenario.name || scenarioName,
    description: scenario.description || "",
    script: scenario.steps.map(step => ({ ...step }))
  };
}
