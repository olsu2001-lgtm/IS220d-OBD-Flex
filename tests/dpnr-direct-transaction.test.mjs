import test from "node:test";
import assert from "node:assert/strict";
import { Elm327Client } from "../src/core.js";

class RecordingTransport {
  constructor() { this.commands = []; }
  async send(command) {
    this.commands.push(command);
    if (command === "217E") return "61 7E 0A 04 02 00\r>";
    if (command === "02217E0000000000") return "7E8 06 61 7E 0A 04 02 00\r>";
    return "OK\r>";
  }
}

test("guided DPNR formatted 217E transaction is accepted by the production read-only gate", async () => {
  const transport = new RecordingTransport();
  const client = new Elm327Client(transport);
  const result = await client.runReadOnlyEcuTransaction({
    requestHeader: "7E0",
    setupCommands: ["ATSP6", "ATCAF1", "ATCFC1", "ATAL", "ATH0", "ATS0", "ATSTFF"],
    requests: [{ command: "217E", service: 0x21, timeoutMs: 7000 }],
    continueOnReadError: true,
    label: "DPNR test formatted"
  });
  assert.equal(result.responses.length, 1);
  assert.equal(result.responses[0].error, "");
  assert.match(result.responses[0].raw, /61\s+7E\s+0A\s+04/i);
  assert.ok(transport.commands.includes("ATSH7E0"));
  assert.ok(transport.commands.includes("217E"));
});

test("guided DPNR raw 217E fallback is accepted by the same production allowlist and response filter", async () => {
  const transport = new RecordingTransport();
  const client = new Elm327Client(transport);
  const result = await client.runReadOnlyEcuTransaction({
    requestHeader: "7E0",
    responseHeader: "7E8",
    setupCommands: ["ATSP6", "ATCAF0", "ATCFC0", "ATAL", "ATH1", "ATS1", "ATSTFF"],
    requests: [{ command: "02217E0000000000", service: 0x21, timeoutMs: 9000 }],
    continueOnReadError: true,
    label: "DPNR test raw fallback"
  });
  assert.equal(result.responses.length, 1);
  assert.equal(result.responses[0].error, "");
  assert.match(result.responses[0].raw, /7E8\s+06\s+61\s+7E\s+0A\s+04/i);
  assert.ok(transport.commands.includes("ATSH7E0"));
  assert.ok(transport.commands.includes("ATCRA7E8"));
  assert.ok(transport.commands.includes("02217E0000000000"));
  assert.ok(transport.commands.includes("ATCRA"), "response filter is cleaned up after the transaction");
});
