import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DPNR_CLEANING_BUILD_MARKER,
  patchMainForDpnrCleaningTest
} from "../scripts/dpnr-cleaning-main-transform.mjs";

const read = relativePath => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("DPNR-puhdistustesti injektoidaan nykyiseen main.js:ään deterministisesti", async () => {
  const main = await read("src/main.js");
  const patched = patchMainForDpnrCleaningTest(main);
  assert.match(patched, /installDpnrCleaningTest/);
  assert.match(patched, new RegExp(DPNR_CLEANING_BUILD_MARKER));
  assert.match(patched, /state\.client\.command\(command, timeoutMs\)/);
  assert.match(patched, /state\.vehicleKey !== VEHICLE_KEYS\.IS220D/);
  assert.equal(patchMainForDpnrCleaningTest(patched), patched);
});

test("DPNR-puhdistustesti käyttää vain read-only-lukuja ja ELM-asetuksia", async () => {
  const source = await read("src/dpnr-cleaning-test.js");
  assert.match(source, /"010C"/);
  assert.match(source, /"217E"/);
  assert.match(source, /"ATSH7E0"/);
  assert.match(source, /isSafeTerminalCommand/);
  assert.doesNotMatch(source, /(?:^|[^0-9A-F])04(?:[^0-9A-F]|$)/i);
  assert.doesNotMatch(source, /Active Test|forced regeneration|pakkoregener/i);
  assert.doesNotMatch(source, /\b(?:2E|2F|31|34|36)\b/);
});

test("responsive build transform sisältää DPNR-transformin", async () => {
  const source = await read("scripts/responsive-ui-transform.mjs");
  assert.match(source, /patchMainForDpnrCleaningTest/);
  assert.match(source, /dpnr-cleaning-main-transform\.mjs/);
});
