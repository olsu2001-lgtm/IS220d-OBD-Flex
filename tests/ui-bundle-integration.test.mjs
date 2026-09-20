import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

test("main runtime explicitly wires Health Check coverage and publisher", async () => {
  const source = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(source, /buildIs220dComponentDiagnosticCoverage/);
  assert.match(source, /buildIs220dComponentDiagnosticTextReport/);
  assert.match(source, /publishIs220dComponentDiagnosticCoverageToUi/);
  assert.match(source, /run\.componentDiagnostics\s*=\s*componentCoverage/);
  assert.match(source, /publishIs220dComponentDiagnosticCoverageToUi\(componentCoverage/);
});

test("browser bundle contains the real simplified shell and Health Check UI", async () => {
  const result = await build({
    entryPoints: [new URL("../src/main.js", import.meta.url).pathname],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: ["chrome90"],
    minify: false,
    logLevel: "silent"
  });

  const bundle = result.outputFiles.map(file => file.text).join("\n");
  assert.match(bundle, /Yhdistä autoon/);
  assert.match(bundle, /Lisää toimintoja/);
  assert.match(bundle, /OBD Health Check/);
  assert.match(bundle, /Aloita OBD Health Check/);
  assert.match(bundle, /Tekninen evidenssi/);
  assert.match(bundle, /publishIs220dComponentDiagnosticCoverageToUi/);
  assert.match(bundle, /buildIs220dComponentDiagnosticCoverage/);
});
