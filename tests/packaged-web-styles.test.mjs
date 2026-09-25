import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { copyWebStyles, verifyPackagedWebStyles } from "../scripts/web-assets.mjs";

const root = new URL("../", import.meta.url).pathname;

test("APK staging includes the stylesheet loaded by the mobile shell", () => {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), "flex-styles-"));
  try {
    copyWebStyles(root, destination);
    const zip = new AdmZip();
    for (const name of fs.readdirSync(destination)) zip.addFile(`assets/${name}`, fs.readFileSync(path.join(destination, name)));
    assert.doesNotThrow(() => verifyPackagedWebStyles(zip, root));
    assert.match(zip.readAsText("assets/ios-health-ui.css"), /\.ios-tabbar/);
    zip.deleteFile("assets/ios-health-ui.css");
    assert.throws(() => verifyPackagedWebStyles(zip, root), /missing stylesheet: ios-health-ui.css/);
    zip.addFile("assets/ios-health-ui.css", Buffer.from("/* stale style */"));
    assert.throws(() => verifyPackagedWebStyles(zip, root), /differs from source: ios-health-ui.css/);
  } finally { fs.rmSync(destination, { recursive: true, force: true }); }
});
