import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = relativePath =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("Androidin GATT-silta tunnistaa vain varmennetun Quicklynks FFF0/FFF6 -profiilin binääriseksi", async () => {
  const source = await read("native/smali/com/nicron/webview/BleObdBridge.smali");

  assert.match(source, /0000fff0-0000-1000-8000-00805f9b34fb/i);
  assert.match(source, /0000fff6-0000-1000-8000-00805f9b34fb/i);
  assert.match(source, /Quicklynks FFF0\/FFF6 · binääri/);
  assert.match(source, /ENABLE_NOTIFICATION_VALUE/);
  assert.match(source, /QuicklynksCodec;->hexToBytes/);
  assert.match(source, /QuicklynksCodec;->bytesToHex/);
  assert.match(source, /QuicklynksCodec;->hasCompleteFrame/);
  assert.match(source, /\.method public declared-synchronized send/);
});

test("BLE-haku käyttää kolmea Android-hakuvaihetta pääsäikeellä ja raportoi vaihekohtaiset callbackit", async () => {
  const [bridge, callback, simpleStart, configuredStart, stop] = await Promise.all([
    read("native/smali/com/nicron/webview/BleObdBridge.smali"),
    read("native/smali/com/nicron/webview/BleScanCallback.smali"),
    read("native/smali/com/nicron/webview/BleScanStartSimpleRunnable.smali"),
    read("native/smali/com/nicron/webview/BleScanStartConfiguredRunnable.smali"),
    read("native/smali/com/nicron/webview/BleScanStopRunnable.smali")
  ]);

  assert.match(simpleStart, /BluetoothLeScanner;->startScan\(Landroid\/bluetooth\/le\/ScanCallback;\)V/);
  assert.match(configuredStart, /ScanSettings\$Builder/);
  assert.match(configuredStart, /ScanFilter\$Builder/);
  assert.match(configuredStart, /setDeviceName\(Ljava\/lang\/String;\)/);
  assert.match(bridge, /scanDefaultCallbacks/);
  assert.match(bridge, /scanLowLatencyCallbacks/);
  assert.match(bridge, /scanObdFilterCallbacks/);
  assert.match(bridge, /scanCallbackCount/);
  assert.match(bridge, /scanDurationMs/);
  assert.match(bridge, /Activity;->runOnUiThread\(Ljava\/lang\/Runnable;\)V/);
  assert.match(callback, /BleObdBridge;->noteScanResult\(\)V/);
  assert.match(simpleStart, /BluetoothLeScanner;->startScan/);
  assert.match(configuredStart, /BluetoothLeScanner;->startScan\(Ljava\/util\/List;Landroid\/bluetooth\/le\/ScanSettings;/);
  assert.match(stop, /BluetoothLeScanner;->stopScan/);
});

test("Bluetooth Classic SPP ja tavallinen ASCII-ELM327 säilyvät lähteessä", async () => {
  const [classicBridge, core] = await Promise.all([
    read("native/smali/com/nicron/webview/ObdBridge.smali"),
    read("src/core.js")
  ]);

  assert.match(classicBridge, /00001101-0000-1000-8000-00805f9b34fb/i);
  assert.match(core, /class Elm327Client/);
  assert.match(core, /this\.command\("ATZ"/);
  assert.match(core, /this\.command\("ATE0"/);
  assert.match(core, /this\.command\("ATL0"/);
});

test("0.9.1 ei pyydä internetoikeutta ja säilyttää Flex-pakettitunnuksen", async () => {
  const app = await read("app.js");

  assert.match(app, /packageId:\s*"fi\.oliver\.is220dobd"/);
  assert.match(app, /name:\s*"Lexus OBD Flex"/);
  assert.match(app, /version:\s*"0\.9\.1"/);
  assert.equal(app.includes("android.permission.INTERNET"), false);
});

test("0.7.4 tunnistaa yhdistetyn auton oletuksena ja säilyttää käsivalinnan varaprofiilina", async () => {
  const [main, core, detector, html] = await Promise.all([
    read("src/main.js"),
    read("src/core.js"),
    read("src/vehicle-detection.js"),
    read("index.html")
  ]);

  assert.match(main, /: VEHICLE_KEYS\.AUTO;/);
  assert.match(main, /await detectVehicleProfile\(\);/);
  assert.match(main, /readVehicleIdentification/);
  assert.match(main, /getVehicleReadDataProbes\(VEHICLE_KEYS\.IS220D\)/);
  assert.match(core, /readVehicleIdentification/);
  assert.match(core, /"0902"/);
  assert.match(detector, /JTHBB262/);
  assert.match(detector, /JTHKD5BH/);
  assert.match(detector, /detectedKeys\.size > 1/);
  assert.match(html, /<option value="auto">Automaattinen tunnistus \(suositus\)<\/option>/);
  assert.match(html, /id="detectVehicleButton"/);
  assert.equal(/Active Test|pakkoregenerointi/.test(detector), false);
});

test("0.7.4:n vLinker BLE -polku löytää FFF1 UARTin, neuvottelee MTU:n ja raportoi GATT-capabilityt", async () => {
  const [bridge, profile, core, main, html] = await Promise.all([
    read("native/smali/com/nicron/webview/BleObdBridge.smali"),
    read("src/adapter-profile.js"),
    read("src/core.js"),
    read("src/main.js"),
    read("index.html")
  ]);

  assert.match(bridge, /FFF0 · FFF1 yhdistetty UART/);
  assert.match(bridge, /0000fff1-0000-1000-8000-00805f9b34fb/i);
  assert.match(bridge, /requestConnectionPriority\(I\)Z/);
  assert.match(bridge, /const\/16 v0, 0x205/);
  assert.match(bridge, /requestMtu\(I\)Z/);
  assert.match(bridge, /"payloadSize"/);
  assert.match(bridge, /"writeType"/);
  assert.match(bridge, /ENABLE_INDICATION_VALUE/);
  assert.match(profile, /VLINKER_CAPABILITY_PROBES/);
  assert.match(profile, /"STI"/);
  assert.match(profile, /"STDI"/);
  assert.match(profile, /MANAGED_RECONNECT_DELAYS_MS = Object\.freeze\(\[700, 1500, 3000\]\)/);
  assert.match(core, /discoverToyotaLiveMetrics/);
  assert.match(core, /isProfileReadOnlyCommand\(command, this\.vehicleKey\)/);
  assert.match(core, /toyotaEgrPosition/);
  assert.match(main, /kesken jäänyttä kyselyä tai live-ajoa ei lähetetä uudelleen/);
  assert.match(html, /vLinker MC-IOS/);
  assert.match(html, /id="adapterSupportIdentity"/);
  assert.match(html, /id="adapterFirmwareIdentity"/);
});

test("0.7.4 rekisteröi korkean tarkkuuden GPS-tehotestin ilman reittikoordinaattien vientiä", async () => {
  const [activity, gpsBridge, main, model, html, app] = await Promise.all([
    read("native/smali/com/nicron/webview/MainActivity.smali"),
    read("native/smali/com/nicron/webview/PowerGpsBridge.smali"),
    read("src/main.js"),
    read("src/power-test.js"),
    read("index.html"),
    read("app.js")
  ]);

  assert.match(activity, /PowerGpsBridge/);
  assert.match(activity, /const-string v3, "powerGps"/);
  assert.match(activity, /android\.permission\.ACCESS_FINE_LOCATION/);
  assert.match(gpsBridge, /requestLocationUpdates\(Ljava\/lang\/String;JFLandroid\/location\/LocationListener;Landroid\/os\/Looper;\)V/);
  assert.match(gpsBridge, /getElapsedRealtimeNanos/);
  assert.match(gpsBridge, /getSpeedAccuracyMetersPerSecond/);
  assert.match(gpsBridge, /isFromMockProvider/);
  assert.doesNotMatch(gpsBridge, /getLatitude|getLongitude|"latitude"|"longitude"/);
  assert.match(model, /lexus-power-test-v1/);
  assert.match(model, /averageWheelPowerKw/);
  assert.match(model, /peakSystemPowerKw/);
  assert.match(model, /Tehoarvio ei korvaa dynamometrimittausta/);
  assert.match(main, /createPowerTestRun/);
  assert.match(main, /powerObdSnapshot/);
  assert.match(main, /buildPowerTestReport/);
  assert.match(html, /id="page-power"/);
  assert.match(html, /id="powerPreset"/);
  assert.match(html, /id="powerTotalMass"/);
  assert.match(html, /id="powerArmButton"/);
  assert.match(html, /Reittikoordinaatteja ei tallenneta/);
  assert.match(app, /"ACCESS_FINE_LOCATION"/);
  assert.equal(app.includes("INTERNET"), false);
});

test("0.6.8 käyttää lähdekohtaista adaptiivista pollausjonoa ja säilyttää Quicklynks-polun erillisenä", async () => {
  const [scheduler, core, main, html] = await Promise.all([
    read("src/poll-scheduler.js"),
    read("src/core.js"),
    read("src/main.js"),
    read("index.html")
  ]);

  assert.match(scheduler, /class AdaptivePollScheduler/);
  assert.match(scheduler, /buildAdaptivePollPlan/);
  assert.match(scheduler, /recommendedTimeoutMs/);
  assert.match(scheduler, /peakMissStreak/);
  assert.match(core, /readMetricGroup/);
  assert.match(core, /validateToyotaMetricValue/);
  assert.match(main, /new AdaptivePollScheduler/);
  assert.match(main, /liveClient\.binaryQuicklynks\s*\?\s*null/);
  assert.match(main, /pollQuality:\s*pollingQualitySnapshot/);
  assert.match(html, /id="pollHealth"/);
  assert.doesNotMatch(scheduler, /(?:command|request)\s*[:=]\s*["'`](?:04|2E|2F|31|34|36|3E00)/i);
});

test("0.6.5 säilyttää WebViewin tiedostopainikkeen Androidin järjestelmävalitsimen", async () => {
  const [activity, chromeClient, html] = await Promise.all([
    read("native/smali/com/nicron/webview/MainActivity.smali"),
    read("native/smali/com/nicron/webview/FileChooserChromeClient.smali"),
    read("index.html")
  ]);

  assert.match(html, /id="obdPlusTraceFile"[^>]+type="file"/);
  assert.match(activity, /FileChooserChromeClient/);
  assert.doesNotMatch(activity, /new-instance v2, Landroid\/webkit\/WebChromeClient;/);
  assert.match(chromeClient, /onShowFileChooser/);
  assert.match(chromeClient, /MainActivity;->openFileChooser/);
  assert.match(activity, /android\.intent\.action\.OPEN_DOCUMENT/);
  assert.match(activity, /android\.intent\.category\.OPENABLE/);
  assert.match(activity, /startActivityForResult/);
  assert.match(activity, /FileChooserParams;->parseResult/);
  assert.match(activity, /ValueCallback;->onReceiveValue/);
});

test("0.6.5 säilyttää payload-only-vastaukset ja vain standardoidut Quicklynks-lukukyselyt", async () => {
  const [main, core] = await Promise.all([
    read("src/main.js"),
    read("src/core.js")
  ]);

  assert.match(core, /id:\s*"fast"/);
  assert.match(core, /intervalMs:\s*2000/);
  assert.match(core, /id:\s*"slow"/);
  assert.match(core, /intervalMs:\s*15000/);
  assert.match(core, /quicklynksField80/);
  assert.match(core, /adapterVoltage/);
  assert.match(core, /boostPressure/);
  assert.match(core, /QUICKLYNKS_PRODUCTION_PAUSE_MS/);
  assert.match(main, /valueAgesMs/);
  assert.match(core, /aftertreatment_standard_candidate/);
  assert.match(core, /diesel_standard_candidate/);
  assert.match(core, /pollOptionalStandardMetrics/);
  assert.match(core, /dpfRegenerationActive/);
  assert.match(core, /railPressureTarget/);
  assert.match(core, /boostPressureTarget/);
  assert.match(core, /const data = frame\.slice\(2\)/);
  assert.match(core, /candidate\[0\] !== 0x13/);
  assert.match(core, /isEmptySentinel/);
  assert.doesNotMatch(core, /buildQuicklynksToyotaDataQuery|parseQuicklynksToyotaDataResponse|pollToyotaDataMetrics/);
  assert.doesNotMatch(core, /0261/);
  assert.doesNotMatch(main, /pollToyotaDataMetrics/);
  assert.doesNotMatch(core, /\[0x60,\s*"Mode 01 tuettujen PIDien bittikartta 61–80"\]/);
  assert.match(core, /QUICKLYNKS_SUPPORT_BITMAP_PROBES/);
  assert.match(core, /\[0x60,\s*"PID-tukibittikandidaatti 61–80"\]/);
  assert.match(core, /normalizeQuicklynksNotificationChunks/);
  assert.match(core, /continuationMarkersStripped/);
});

test("0.6.5:n OBD Plus -jälkianalyysi purkaa btsnoozin paikallisesti ja passiivisesti", async () => {
  const [main, trace, html, app] = await Promise.all([
    read("src/main.js"),
    read("src/btsnoop.js"),
    read("index.html"),
    read("app.js")
  ]);

  assert.match(html, /id="obdPlusTraceFile"/);
  assert.match(html, /id="analyzeObdPlusTrace"/);
  assert.match(html, /Bluetooth HCI snoop log/);
  assert.match(main, /extractBtsnoopSource/);
  assert.match(main, /analyzeQuicklynksBtsnoop/);
  assert.match(main, /buildQuicklynksTraceReport/);
  assert.match(trace, /btsnoop\\0/);
  assert.match(trace, /BTSNOOP_LOG_SUMMARY/);
  assert.match(trace, /decodeBtsnooz/);
  assert.match(trace, /DecompressionStream\("deflate"\)/);
  assert.match(trace, /zip-btsnooz/);
  assert.match(trace, /quicklynks-obdplus-btsnoop-readonly-v1/);
  assert.match(trace, /Muiden Bluetooth-yhteyksien payloadit jätetään pois/);
  assert.doesNotMatch(trace, /sendBinary|\.command\(|BluetoothGatt;|BluetoothSocket;/);
  assert.equal(app.includes("android.permission.INTERNET"), false);
});

test("koeajon PID-tutkimus säilyy ja erillinen Quicklynks-laaja diagnostiikka on vain luku", async () => {
  const [main, core, html] = await Promise.all([
    read("src/main.js"),
    read("src/core.js"),
    read("index.html")
  ]);

  assert.match(main, /quicklynksResearch:\s*state\.client\.binaryQuicklynks/);
  assert.match(main, /maybeRunQuicklynksResearchProbe/);
  assert.match(main, /sessionToQuicklynksResearchCsv/);
  assert.match(core, /return `02\$\{probe\.queryTypeHex\}\$\{probe\.identifierHex\}`/);
  assert.match(core, /mode:\s*"read_only"/);
  assert.match(core, /quicklynks-read41-payload-v6-no-active-test/);
  assert.doesNotMatch(core, /toyota_read_data_21/);
  assert.match(core, /frame\.followingLength !== 0x13/);
  assert.match(core, /frame\.payloadHex !== "00"/);
  assert.doesNotMatch(core, /DPNR Reju\(PM\)|DPNR Reju\(S\)|Injector Cut/);
  assert.equal(html.includes("pidResearchButton"), false);
  assert.match(html, /id="runQuicklynksDiagnostic"/);
  assert.match(html, /02 41 PID/);
  assert.match(html, /00\/20\/40\/60\/80\/A0/);
  assert.match(html, /51 vain lukevaa/);
  assert.match(main, /runQuicklynksWideDiagnostic/);
  assert.match(main, /probeSupportBitmap/);
  assert.match(main, /QUICKLYNKS_WIDE_DIAGNOSTIC_ROUNDS/);
});

test("Motonetin varmennettu osoite tarjotaan suorana GATT-varmistuksena", async () => {
  const main = await read("src/main.js");

  assert.match(main, /25:28:07:06:00:66/);
  assert.match(main, /Motonet OBD \(suora GATT-varmistus\)/);
  assert.match(main, /knownFallback/);
});

test("automaattinen ELM/CAN-diagnostiikka jatkaa NO DATA -tilanteesta raporttiin asti", async () => {
  const [main, html] = await Promise.all([
    read("src/main.js"),
    read("index.html")
  ]);

  assert.match(html, /id="stageBluetooth"/);
  assert.match(html, /id="stageElm"/);
  assert.match(html, /id="stageEcu"/);
  assert.match(html, /id="runGekoTest"/);
  assert.match(html, /Jaa raportti ChatGPT:lle/);
  assert.match(html, /id="cancelGekoTest"/);
  assert.match(html, /id="diagnosticProgressBar"/);
  assert.match(main, /runGekoDiagnostic/);
  assert.match(main, /Pitkä automaattihaku/);
  assert.match(main, /Pakotettu CAN 11\/500/);
  assert.match(main, /FULL_DIAGNOSTIC_ENGINE_HEADERS/);
  assert.match(main, /"ATSP0"/);
  assert.match(main, /"ATTP6"/);
  assert.match(main, /"ATSP6"/);
  assert.match(main, /Nykytila ennen nollausta/);
  assert.match(main, /Odota ATZ-nollauksen valmistumista", 1800/);
  assert.match(main, /Kuuntele kaikkea CAN-liikennettä 20 s", timeoutMs: 20000/);
  assert.match(main, /"ATCAF0"/);
  assert.match(main, /"ATMA"/);
  assert.match(main, /"0201000000000000"/);
  assert.match(main, /"010C"/);
  assert.match(main, /"0105"/);
  assert.match(main, /"0110"/);
  assert.match(main, /"0902"/);
  assert.match(main, /getVehicleReadDataProbes/);
  assert.match(main, /toyotaDiagnosticStep/);
  assert.match(main, /"formatted"/);
  assert.match(main, /"filtered-formatted"/);
  assert.match(main, /"raw-single-frame"/);
  assert.match(main, /`ATCRA\$\{toyotaResponseHeader\}`/);
  assert.match(main, /isProfileReadOnlyCommand\(command, probe\.vehicleKey \|\| state\.vehicleKey\)/);
  assert.match(html, /217E/);
  assert.match(html, /217F/);
  assert.match(html, /212C/);
  assert.match(main, /buildFullDiagnosticReport/);
  assert.match(main, /saveOrShareFullDiagnostic/);
});

test("0.9.1 säilyttää suutintestiraportin mutta estää kentässä vastaamattoman 219C:n", async () => {
  const [main, html, injector, profile] = await Promise.all([
    read("src/main.js"),
    read("index.html"),
    read("src/injector-test.js"),
    read("src/is220d-profile.js")
  ]);
  assert.match(html, /id="page-injector-test"/);
  assert.match(html, /id="shareInjectorReport"/);
  assert.match(html, /Jaa raportti tekoälylle/);
  assert.match(main, /runInjectorTest/);
  assert.match(main, /buildInjectorTestReport/);
  assert.match(profile, /command: "2193"/);
  assert.match(profile, /command: "2196"/);
  assert.match(profile, /command: "219C"/);
  assert.match(profile, /IS220D_FIELD_DISABLED_COMMANDS/);
  assert.match(main, /INJECTOR_TEST_AVAILABILITY\.supported/);
  assert.match(injector, /paluuvirta-\/leak-off-testi/);
  assert.doesNotMatch(injector, /command:\s*["'](?:04|2E|2F|31|34|36)/i);
});

test("CSV voidaan jakaa Androidin jakovalikolla tekoälysovellukseen ilman internetoikeutta", async () => {
  const [bridge, runnable, main, app] = await Promise.all([
    read("native/smali/com/nicron/webview/ObdBridge.smali"),
    read("native/smali/com/nicron/webview/ShareCsvRunnable.smali"),
    read("src/main.js"),
    read("app.js")
  ]);

  assert.match(bridge, /\.method public shareCsv\(Ljava\/lang\/String;Ljava\/lang\/String;Ljava\/lang\/String;Ljava\/lang\/String;\)Ljava\/lang\/String;/);
  assert.match(bridge, /android\.intent\.action\.SEND/);
  assert.match(bridge, /android\.intent\.extra\.STREAM/);
  assert.match(bridge, /android\.intent\.extra\.TEXT/);
  assert.match(bridge, /FLAG_GRANT_READ_URI_PERMISSION|const\/4 v1, 0x1/);
  assert.match(runnable, /Activity;->startActivity\(Landroid\/content\/Intent;\)V/);
  assert.match(main, /Jaa tekoälyanalyysiin/);
  assert.match(main, /buildAiAnalysisPrompt/);
  assert.equal(app.includes("android.permission.INTERNET"), false);
});

test("Quicklynksin natiivisilta raportoi BLE-ilmoituspalat ja diagnostiikkajako käyttää omaa otsikkoa", async () => {
  const [bleBridge, classicBridge, main] = await Promise.all([
    read("native/smali/com/nicron/webview/BleObdBridge.smali"),
    read("native/smali/com/nicron/webview/ObdBridge.smali"),
    read("src/main.js")
  ]);
  assert.match(bleBridge, /responseChunkCount/);
  assert.match(bleBridge, /responseChunksHex/);
  assert.match(bleBridge, /const-string v2, "\|"/);
  assert.match(classicBridge, /android\.intent\.extra\.SUBJECT/);
  assert.doesNotMatch(classicBridge, /const-string v3, "Lexus IS220d koeajodatan analyysi"/);
  assert.match(main, /Lexus OBD Flex · laaja Quicklynks BLE -diagnostiikka/);
  assert.match(main, /\$\{vehicle\}_Flex_laaja_diagnostiikka_\$\{adapter\}/);
  assert.match(main, /"text\/plain"/);
});
