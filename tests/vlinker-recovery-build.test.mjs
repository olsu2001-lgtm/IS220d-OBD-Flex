import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { patchMainForImReadiness } from "../scripts/im-readiness-main-transform.mjs";
import { patchMainForResponsiveness } from "../scripts/responsive-ui-transform.mjs";
import {
  VLINKER_RECOVERY_BUILD_MARKER,
  patchMainForVLinkerRecovery
} from "../scripts/vlinker-recovery-main-transform.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");

function buildTransformedMain() {
  return patchMainForVLinkerRecovery(
    patchMainForResponsiveness(
      patchMainForImReadiness(source)
    )
  );
}

test("vLinker recovery transform composes with the existing build transforms", () => {
  const transformed = buildTransformedMain();
  assert.match(transformed, new RegExp(VLINKER_RECOVERY_BUILD_MARKER));
  assert.match(transformed, /lastSuccessfulObdDevice/);
  assert.match(transformed, /lastSuccessfulObdTransport/);
  assert.match(transformed, /Classic-paritus puuttuu/);
  assert.match(transformed, /vlinkerNeedsClassicPairing/);
  assert.match(transformed, /GATT toimi · ELM ei vastaa/);
  assert.match(transformed, /PIN-koodilla 1234/);
});

test("failed selections cannot overwrite the automatic last-successful route", () => {
  const transformed = buildTransformedMain();
  assert.doesNotMatch(
    transformed,
    /const previous = currentOption\?\.dataset\.address \|\| localStorage\.getItem\("lastObdDevice"\)/
  );

  const connectedIndex = transformed.indexOf("    state.connected = true;");
  const legacyPersistIndex = transformed.indexOf('    localStorage.setItem("lastObdDevice", address);');
  const successPersistIndex = transformed.indexOf('    localStorage.setItem("lastSuccessfulObdDevice", address);');
  assert.ok(connectedIndex >= 0, "state.connected success anchor must remain present");
  assert.ok(successPersistIndex > connectedIndex, "successful route must be persisted only after adapter initialization");
  assert.ok(legacyPersistIndex > connectedIndex, "legacy compatibility key must also be written only after success");

  const beforeSuccessfulInitialization = transformed.slice(0, connectedIndex);
  assert.doesNotMatch(
    beforeSuccessfulInitialization,
    /localStorage\.setItem\("lastObdDevice", address\)/,
    "connect start must not persist a merely selected device"
  );
  assert.doesNotMatch(
    beforeSuccessfulInitialization,
    /localStorage\.setItem\("lastObdTransport", transportType\)/,
    "connect start must not persist a merely selected transport"
  );
});

test("missing Classic bond is a recovery state instead of a silent MC-IOS replacement", () => {
  const transformed = buildTransformedMain();
  assert.match(
    transformed,
    /profile\.vlinker && transport === "ble" && !hasPairedClassicVlinker/
  );
  assert.match(
    transformed,
    /Flex ei löydä paritettua vLinker MC \/ MC-Android Classic -yhteyttä/
  );
  assert.match(
    transformed,
    /BLE-mainos ei tarkoita, että Classic-paritus olisi kunnossa/
  );
});

test("a GATT-only failure no longer leaves Bluetooth falsely green", () => {
  const transformed = buildTransformedMain();
  assert.match(
    transformed,
    /GATT-yhteys muodostui, mutta yhteys suljettiin adapterialustuksen epäonnistuttua/
  );
  assert.match(
    transformed,
    /GATT toimi, mutta vLinkerin ELM327-kanava ei vastannut/
  );
});

test("vLinker recovery transform is idempotent", () => {
  const once = buildTransformedMain();
  assert.equal(patchMainForVLinkerRecovery(once), once);
});

test("vLinker recovery transform fails closed when main connection structure changes", () => {
  assert.throws(
    () => patchMainForVLinkerRecovery('import { APP_VERSION } from "./app-version.js";'),
    /anchor count|anchor missing|ambiguous/
  );
});
