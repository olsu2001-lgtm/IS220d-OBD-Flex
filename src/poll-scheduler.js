import { getProfileReadDataProbe } from "./vehicle-profiles.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const hexByte = value => (Number(value) & 0xff).toString(16).padStart(2, "0").toUpperCase();

/**
 * Source-level cadence for Mode 01. Multiple values decoded from the same PID
 * intentionally share one policy and one request.
 */
export const MODE01_POLL_POLICY = Object.freeze({
  "01": Object.freeze({ intervalMs: 15000, priority: 3 }),
  "04": Object.freeze({ intervalMs: 500, priority: 0 }),
  "05": Object.freeze({ intervalMs: 5000, priority: 2 }),
  "0B": Object.freeze({ intervalMs: 500, priority: 0 }),
  "0C": Object.freeze({ intervalMs: 250, priority: 0 }),
  "0D": Object.freeze({ intervalMs: 250, priority: 0 }),
  "0F": Object.freeze({ intervalMs: 5000, priority: 2 }),
  "10": Object.freeze({ intervalMs: 500, priority: 0 }),
  "11": Object.freeze({ intervalMs: 750, priority: 1 }),
  "1F": Object.freeze({ intervalMs: 15000, priority: 3 }),
  "21": Object.freeze({ intervalMs: 15000, priority: 3 }),
  "23": Object.freeze({ intervalMs: 500, priority: 0 }),
  "24": Object.freeze({ intervalMs: 1000, priority: 1 }),
  "2C": Object.freeze({ intervalMs: 750, priority: 1 }),
  "2D": Object.freeze({ intervalMs: 750, priority: 1 }),
  "31": Object.freeze({ intervalMs: 15000, priority: 3 }),
  "33": Object.freeze({ intervalMs: 5000, priority: 2 }),
  "3C": Object.freeze({ intervalMs: 1500, priority: 1 }),
  "3E": Object.freeze({ intervalMs: 1500, priority: 1 }),
  "42": Object.freeze({ intervalMs: 5000, priority: 2 }),
  "49": Object.freeze({ intervalMs: 500, priority: 0 }),
  "4A": Object.freeze({ intervalMs: 500, priority: 0 }),
  "4C": Object.freeze({ intervalMs: 500, priority: 0 }),
  "5C": Object.freeze({ intervalMs: 5000, priority: 2 }),
  "5D": Object.freeze({ intervalMs: 1000, priority: 1 }),
  "5E": Object.freeze({ intervalMs: 1000, priority: 1 }),
  "69": Object.freeze({ intervalMs: 750, priority: 1 }),
  "6D": Object.freeze({ intervalMs: 750, priority: 1 }),
  "70": Object.freeze({ intervalMs: 750, priority: 1 }),
  "71": Object.freeze({ intervalMs: 750, priority: 1 }),
  "73": Object.freeze({ intervalMs: 750, priority: 1 }),
  "78": Object.freeze({ intervalMs: 1000, priority: 1 }),
  "7A": Object.freeze({ intervalMs: 1000, priority: 1 }),
  "7C": Object.freeze({ intervalMs: 1000, priority: 1 }),
  "86": Object.freeze({ intervalMs: 2000, priority: 2 }),
  "8B": Object.freeze({ intervalMs: 1000, priority: 1 }),
  "8C": Object.freeze({ intervalMs: 1500, priority: 1 }),
  "8F": Object.freeze({ intervalMs: 1500, priority: 1 })
});

const DEFAULT_MODE01_POLICY = Object.freeze({ intervalMs: 2500, priority: 2 });

function definitionIsSupported(definition, supportedPids) {
  if (!(supportedPids instanceof Set)) return true;
  if (definition?.toyotaCommand) return supportedPids.has(definition.id);
  return Number.isInteger(definition?.pid) && supportedPids.has(definition.pid);
}

export function pollSourceForDefinition(definition) {
  if (!definition || definition.derived || definition.adapterOnly) return null;
  if (definition.toyotaCommand) {
    const command = String(definition.toyotaCommand).replace(/\s+/g, "").toUpperCase();
    const probe = getProfileReadDataProbe(command, definition.vehicleKey || "");
    if (!probe || !definition.toyotaValueKey) return null;
    return Object.freeze({
      key: `toyota:${command}`,
      kind: "toyota-read-data",
      command,
      service: probe.service,
      intervalMs: Math.max(250, Number(probe.cacheMaxAgeMs) || 1000),
      priority: probe.cacheMaxAgeMs <= 800 ? 0 : 1,
      baseTimeoutMs: 5000,
      minimumTimeoutMs: 1800
    });
  }
  if (!Number.isInteger(definition.pid)) return null;
  const pidHex = hexByte(definition.pid);
  const policy = MODE01_POLL_POLICY[pidHex] || DEFAULT_MODE01_POLICY;
  return Object.freeze({
    key: `mode01:${pidHex}`,
    kind: "mode01",
    command: `01${pidHex}`,
    service: 0x01,
    intervalMs: policy.intervalMs,
    priority: policy.priority,
    baseTimeoutMs: 2200,
    minimumTimeoutMs: 1100
  });
}

export function buildAdaptivePollPlan(definitions = [], supportedPids = null) {
  const grouped = new Map();
  for (const definition of definitions) {
    if (!definitionIsSupported(definition, supportedPids)) continue;
    const source = pollSourceForDefinition(definition);
    if (!source) continue;
    const existing = grouped.get(source.key);
    if (existing) {
      existing.definitions.push(definition);
      existing.metricIds.push(definition.id);
      existing.intervalMs = Math.min(existing.intervalMs, source.intervalMs);
      existing.priority = Math.min(existing.priority, source.priority);
      continue;
    }
    grouped.set(source.key, {
      ...source,
      definitions: [definition],
      metricIds: [definition.id]
    });
  }
  return Object.freeze(
    [...grouped.values()]
      .sort((left, right) => left.priority - right.priority || left.intervalMs - right.intervalMs || left.key.localeCompare(right.key))
      .map(source => Object.freeze({
        ...source,
        definitions: Object.freeze([...source.definitions]),
        metricIds: Object.freeze([...source.metricIds])
      }))
  );
}

/**
 * Fair, source-aware live-data scheduler. It never creates vehicle commands;
 * every request originates from an already supported metric definition.
 */
export class AdaptivePollScheduler {
  constructor(definitions = [], options = {}) {
    this.clock = typeof options.clock === "function" ? options.clock : Date.now;
    this.maximumBatchSources = Math.max(1, Math.floor(Number(options.maximumBatchSources) || 8));
    this.maximumBackoffMs = Math.max(5000, Number(options.maximumBackoffMs) || 30000);
    const startedAt = Number.isFinite(options.startedAt) ? options.startedAt : this.clock();
    const plan = buildAdaptivePollPlan(definitions, options.supportedPids || null);
    this.states = new Map(plan.map(source => [source.key, {
      source,
      nextDueAt: startedAt,
      inFlight: false,
      attempts: 0,
      hits: 0,
      cacheHits: 0,
      misses: 0,
      consecutiveHits: 0,
      consecutiveMisses: 0,
      peakMissStreak: 0,
      latencyEwmaMs: null,
      lastDurationMs: null,
      lastResponseClass: "",
      lastError: "",
      lastCompletedAt: null
    }]));
  }

  hasSources() {
    return this.states.size > 0;
  }

  claimDueBatch(now = this.clock(), limit = this.maximumBatchSources) {
    const batchLimit = Math.max(1, Math.floor(Number(limit) || this.maximumBatchSources));
    const due = [...this.states.values()]
      .filter(state => !state.inFlight && state.nextDueAt <= now)
      .sort((left, right) =>
        left.nextDueAt - right.nextDueAt ||
        left.source.priority - right.source.priority ||
        left.source.key.localeCompare(right.source.key)
      )
      .slice(0, batchLimit);
    for (const state of due) state.inFlight = true;
    return Object.freeze(due.map(state => state.source));
  }

  requireState(key) {
    const state = this.states.get(String(key || ""));
    if (!state) throw new Error(`Tuntematon pollauslähde: ${key || "(tyhjä)"}`);
    return state;
  }

  recordSuccess(key, durationMs = 0, completedAt = this.clock()) {
    const state = this.requireState(key);
    const duration = Math.max(0, Number(durationMs) || 0);
    state.inFlight = false;
    state.attempts += 1;
    state.hits += 1;
    state.consecutiveHits += 1;
    state.consecutiveMisses = 0;
    state.lastDurationMs = duration;
    state.latencyEwmaMs = state.latencyEwmaMs == null
      ? duration
      : state.latencyEwmaMs * 0.75 + duration * 0.25;
    state.lastResponseClass = "positive-response";
    state.lastError = "";
    state.lastCompletedAt = completedAt;
    state.nextDueAt = completedAt + state.source.intervalMs;
  }

  recordCacheHit(key, completedAt = this.clock()) {
    const state = this.requireState(key);
    state.inFlight = false;
    state.cacheHits += 1;
    state.lastDurationMs = 0;
    state.lastResponseClass = "cache-hit";
    state.lastError = "";
    state.lastCompletedAt = completedAt;
    state.nextDueAt = completedAt + state.source.intervalMs;
  }

  recordFailure(key, outcome = {}, durationMs = 0, completedAt = this.clock()) {
    const state = this.requireState(key);
    const responseClass = String(outcome.responseClass || outcome.kind || "transport-error");
    const retryable = outcome.retryable !== false;
    state.inFlight = false;
    state.attempts += 1;
    state.misses += 1;
    state.consecutiveHits = 0;
    state.consecutiveMisses += 1;
    state.peakMissStreak = Math.max(state.peakMissStreak, state.consecutiveMisses);
    state.lastDurationMs = Math.max(0, Number(durationMs) || 0);
    state.lastResponseClass = responseClass;
    state.lastError = String(outcome.error || outcome.description || "");
    state.lastCompletedAt = completedAt;

    let backoffMs;
    if (responseClass === "response-pending") {
      backoffMs = clamp(Math.round(state.source.intervalMs / 2), 250, 1000);
    } else if (responseClass === "disconnected") {
      backoffMs = this.maximumBackoffMs;
    } else if (retryable) {
      const exponent = Math.min(5, state.consecutiveMisses - 1);
      backoffMs = Math.min(this.maximumBackoffMs, Math.max(500, state.source.intervalMs) * (2 ** exponent));
    } else {
      const exponent = Math.min(3, state.consecutiveMisses - 1);
      backoffMs = Math.min(this.maximumBackoffMs, Math.max(5000, state.source.intervalMs * 4) * (2 ** exponent));
    }
    state.nextDueAt = completedAt + backoffMs;
    return backoffMs;
  }

  recommendedTimeoutMs(key) {
    const state = this.requireState(key);
    const { baseTimeoutMs, minimumTimeoutMs } = state.source;
    if (state.consecutiveMisses || state.consecutiveHits < 3 || !Number.isFinite(state.latencyEwmaMs)) return baseTimeoutMs;
    return Math.round(clamp(state.latencyEwmaMs * 4 + 350, minimumTimeoutMs, baseTimeoutMs));
  }

  nextDelayMs(now = this.clock(), capMs = 120) {
    const cap = Math.max(15, Number(capMs) || 120);
    const candidates = [...this.states.values()].filter(state => !state.inFlight);
    if (!candidates.length) return cap;
    const nextDueAt = Math.min(...candidates.map(state => state.nextDueAt));
    return clamp(nextDueAt - now, 0, cap);
  }

  snapshot(now = this.clock()) {
    const sources = [...this.states.values()].map(state => Object.freeze({
      key: state.source.key,
      kind: state.source.kind,
      command: state.source.command,
      metricIds: state.source.metricIds,
      intervalMs: state.source.intervalMs,
      priority: state.source.priority,
      nextDueInMs: Math.max(0, state.nextDueAt - now),
      inFlight: state.inFlight,
      attempts: state.attempts,
      hits: state.hits,
      cacheHits: state.cacheHits,
      misses: state.misses,
      lossPercent: state.attempts ? state.misses * 100 / state.attempts : 0,
      consecutiveHits: state.consecutiveHits,
      consecutiveMisses: state.consecutiveMisses,
      peakMissStreak: state.peakMissStreak,
      latencyEwmaMs: state.latencyEwmaMs,
      lastDurationMs: state.lastDurationMs,
      lastResponseClass: state.lastResponseClass,
      lastError: state.lastError,
      recommendedTimeoutMs: this.recommendedTimeoutMs(state.source.key)
    }));
    const attempts = sources.reduce((sum, source) => sum + source.attempts, 0);
    const hits = sources.reduce((sum, source) => sum + source.hits, 0);
    const cacheHits = sources.reduce((sum, source) => sum + source.cacheHits, 0);
    const misses = sources.reduce((sum, source) => sum + source.misses, 0);
    const latencies = sources.map(source => source.latencyEwmaMs).filter(Number.isFinite);
    const summary = Object.freeze({
      sourceCount: sources.length,
      dueSourceCount: sources.filter(source => source.nextDueInMs === 0).length,
      attempts,
      hits,
      cacheHits,
      misses,
      lossPercent: attempts ? misses * 100 / attempts : 0,
      maxMissStreak: sources.reduce((max, source) => Math.max(max, source.peakMissStreak), 0),
      latencyEwmaMs: latencies.length ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length : null
    });
    return Object.freeze({ schemaVersion: 1, capturedAt: now, summary, sources: Object.freeze(sources) });
  }
}
