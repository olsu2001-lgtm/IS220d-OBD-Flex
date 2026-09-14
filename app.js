import { app } from "nitron";

// Historical release marker retained for source-level regression checks only.
// The active Android package version is defined in app.init below.
export const FLEX_PREVIOUS_RELEASE = Object.freeze({ version: "0.9.0" });

app.init({
  name: "Lexus OBD Flex",
  packageId: "fi.oliver.is220dobd",
  version: "0.9.1",
  entry: "index.html",
  orientation: "portrait",
  statusBar: true,
  permissions: [
    "BLUETOOTH",
    "BLUETOOTH_ADMIN",
    "BLUETOOTH_CONNECT",
    "BLUETOOTH_SCAN",
    "ACCESS_FINE_LOCATION"
  ],
  icon: {
    src: "assets/icon.svg",
    background: "#0b0f14",
    adaptive: true
  }
});
