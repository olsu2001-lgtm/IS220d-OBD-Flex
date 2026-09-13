import { app } from "nitron";

app.init({
  name: "Lexus OBD Flex",
  packageId: "fi.oliver.is220dobd",
  version: "0.9.0",
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
