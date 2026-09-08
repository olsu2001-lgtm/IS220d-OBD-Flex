import { app } from "nitron";

app.init({
  name: "IS220d OBD Flex",
  packageId: "fi.oliver.is220dobd",
  version: "0.6.9",
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
