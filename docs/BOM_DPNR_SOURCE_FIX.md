# BOM navigation and DPNR capture continuation

Source-only continuation on `fix/bom-navigation-dynamic`, PR #31 (2026-09-16).
Live registry baseline: registered 0.9.5, source
`d6ec2a9a447e985a9a50d3da8af5b69db58148ce`. The existing PR head
`9c8dd63d6953bc5d6b8d4bbe020f1b46e05e2db5` differs from that source in the
BOM binding, sensor-test live-start transform and their tests. These changes
are retained. Package/lock version entries are left exactly as found (0.9.4);
this source branch does not allocate a release identity.

## Findings and changes

- The late-installed BOM button binding already works in PR #31. Switching
  away from IS220d while BOM is open could leave its hidden page active and
  show an empty screen. The existing profile handler now returns to Connection.
- The reported screenshot is the hose-cleaning before/after test. Previous
  live-start changes only covered the separate sensor test. Both tests now
  share `dpnr-test-live.js`, which starts the existing live reader on demand.
- Capture reads decoded values, raw evidence and acquisition timestamps from
  the existing main state. Rounded card text and a frozen age label are no
  longer measurement inputs. Repeated reads of one ECU update count once.
- Pressure and RPM must be fresh (existing 2500 ms freshness policy). Missing
  RPM no longer qualifies as KOEO. The existing phase RPM windows remain.
  These are sampling rules, not new pressure acceptance thresholds.
- Discovery/state matching can wait up to 45 seconds. Once sampling starts,
  stale data, wrong RPM, stopped live, changed live session, disconnection,
  backgrounding, profile change or navigation away discards the capture.
  Simultaneous captures are rejected; the active panel's controls are restored
  after success or failure. At least two distinct ECU updates are required.
- Persisted null pressure is treated as missing data, not zero kPa.

No decoder, PID, request, transport allowlist or evidence level was changed.
No ECU writes, Active Tests, forced regeneration or DTC clearing were added.

## Validation and remaining field check

`npm ci` and `npm test`: 521 tests pass locally, including safety/regression.
The added jsdom dev dependency lets the suite execute the full browser bundle
with the existing production source transforms and the actual HTML. This is
an in-memory JavaScript test, not an APK build or registry bypass.

Browser tests click the dynamically installed BOM navigation, navigate back
from DPNR and switch vehicle profiles. They exercise all three phases in both
cleaning rounds and the sensor test (nine captures), including live startup
and storage, using simulated decoded state. Shared collector tests cover
stale/frozen/missing data, duplicate samples, stop/disconnect, RPM mismatch,
concurrent capture and delayed discovery. Existing ELM replay tests cover
217E discovery and decoding separately.

These are software tests, not an Android/vehicle field verification. A later
explicitly authorized APK must still be checked on the phone: open BOM, open
DPNR, confirm live 617E and fresh RPM, complete KOEO/idle/3000 rpm captures,
then stop or disconnect and verify that capture is rejected without replacing
the saved result. The current installed APK is unchanged by this source PR.

No new version, release branch, APK, registry record or Drive upload is part
of this work. Do not merge or publish without the user's separate instruction.
