import fs from "node:fs";
import path from "node:path";

// Include styles loaded dynamically by the application as well as index.html.
export const WEB_STYLE_FILES = Object.freeze(["styles.css", "ios-health-ui.css"]);

export function copyWebStyles(root, destination) {
  for (const file of WEB_STYLE_FILES) {
    fs.copyFileSync(path.join(root, file), path.join(destination, file));
  }
}

export function verifyPackagedWebStyles(zip, root) {
  for (const file of WEB_STYLE_FILES) {
    const entry = zip.getEntry(`assets/${file}`);
    if (!entry) throw new Error(`APK is missing stylesheet: ${file}`);
    if (!entry.getData().equals(fs.readFileSync(path.join(root, file)))) {
      throw new Error(`APK stylesheet differs from source: ${file}`);
    }
  }
}
