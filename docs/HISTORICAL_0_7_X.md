# Historical Drive branch: Lexus OBD Flex 0.7.x

## Status

This document records the August 2026 `Lexus OBD Flex` 0.7.x development line found in the project Drive/File Library.

It is **historical evidence, not the active source baseline**.

The active GitHub project is `IS220d OBD Flex` 0.6.9 and is intentionally IS220d-only. Its executable Toyota production allowlist remains the one defined by `AGENTS.md`, `docs/PROTOCOL.md` and `src/is220d-profile.js`.

The 0.7.x line used the same package ID (`fi.oliver.is220dobd`) but temporarily broadened the product into a multi-vehicle `Lexus OBD Flex` experiment. Useful parsers, tests and design lessons may be re-evaluated later, but no historical command becomes active merely because it existed in this branch.

## Version timeline

### 0.7.0 — CT 200h support

Drive evidence records a multi-vehicle release supporting IS220d and Lexus CT 200h / ZWA10 / 2ZR-FXE.

- 113/113 automated tests passed in the recorded build.
- CT hybrid-data path was read-only.
- Recorded CT read requests included `21C1`, `2101`, `2181`, `2187`, `2195` and `2198` on the CT hybrid ECU path.
- Recorded CT DTC reads included `0A` and `13B0`.
- The historical release explicitly excluded CT DTC clearing, Active Test, coding, security/key functions, forced charging and ECU programming.
- Quicklynks FFF0/FFF6 was not used for guessed CT manufacturer frames.

These CT commands are **not** part of the current IS220d production allowlist.

### 0.7.1 — CT purchase inspection

The next Drive release added a CT 200h purchase-inspection workflow on top of the read-only CT profile.

The historical workflow combined EOBD readiness/DTC observations, hybrid-battery data and selected known CT problem indicators into a local report. It did not turn unreachable ECUs into a false "no codes" result.

### 0.7.2 — GPS/OBD power test

Drive records version 0.7.2 with 129/129 automated tests.

- Phone GPS speed was the primary timing source.
- OBD was optional supplementary data.
- Supported timing intervals included 0–100 km/h, 80–120 km/h, 0–60 mph, 60–120 km/h and a custom interval.
- The power estimate used vehicle kinetic energy plus rolling, grade and aerodynamic terms.
- The Android bridge deliberately did not export latitude/longitude; the historical tests checked that route coordinates were not collected.
- The function remained separate from ECU writes or active tests.

### 0.7.3 — application themes

Drive records 135/135 automated tests for 0.7.3.

The UI gained:

- System
- Lexus Dark
- Pearl Light
- OLED Black
- Hybrid Blue
- F Sport Red
- High Contrast

The test report records contrast checks, persistent local theme selection and no change to ECU permissions or command paths.

### 0.7.4 — automatic vehicle identification

The source report records 145/145 tests for the automatic-identification implementation.

Historical identification sources were:

- standard EOBD VIN read `0902`;
- CT model token read `21C1`;
- IS220d `217E`, `217F` and `212C` evidence groups.

The recorded logic required mutually consistent evidence and rejected conflicting VIN/ECU evidence. Quicklynks was not given guessed manufacturer-specific identification frames.

Important build note: the 0.7.4 test report states that the environment did **not** have the locked build/signing dependencies required to produce and verify the APK. The source target was `0.7.4` / versionCode `704`, but that report must not be treated as a verified APK release.

### 0.7.5 — WebView startup regression fix

Drive records 146/146 automated tests and successful packaged UI smoke tests.

The release fixed a startup failure caused by an esbuild-generated `_c is not defined` error in the theme-controller bundle. Because the exception occurred before event registration, theme controls, bottom navigation and Bluetooth list interaction all appeared broken at the same time.

The build pipeline was extended with a smoke test that starts the actual `index.html + app.bundle.js` pair and verifies basic UI interaction before APK creation.

### 0.7.6 — no preserved evidence located

No 0.7.6 source package, test report or SHA registry was found in the searched project Drive/File Library material. Do not infer its contents from the surrounding versions.

### 0.7.7 — IS220d injector-balance screening

Drive records 153/153 automated tests and successful debug/release APK builds.

The user-invoked IS220d injector screening collected approximately 45 seconds of:

- `010C` — RPM
- `0105` — coolant temperature
- `2193` — fuel temperature candidate
- `2196` — common-rail pressure candidate
- `219C` — cylinder injection-feedback values

The historical report explicitly marks `2193`, `2196` and `219C` and their conversions as **Techstream-derived and not yet vehicle-verified**. They were kept out of the normal production live profile and used only in the dedicated screening workflow.

The current IS220d 0.6.9 project does not inherit these requests automatically. Any future reintroduction requires fresh evidence review, active-profile changes, regression tests and vehicle verification under the current repository contract.

## Preserved archive hashes

The Drive SHA registries provide the following project-package hashes:

| Version | Project ZIP SHA-256 | Notes |
|---|---|---|
| 0.7.0 | `e105cc8073f4b1e26017b0041c40badeb12b827b8937990dd6032d71b2b3de8b` | multi-vehicle CT branch |
| 0.7.1 | `a380c1d7ef498a47a3e1c2178b53728b39759fe6cd74b1c543779e50256ee367` | CT purchase inspection |
| 0.7.2 | `8820a7d4ad60977cde6b903af5856ddcfe042dcea817bf933217c7b1b04cb90e` | GPS/OBD power test |
| 0.7.3 | `bf583746394aa0cec1aa2b49f15ea4fceeeeaa5326b959ee45f5d2ca1df58385` | themes |
| 0.7.4 | `41c176abea073957fd9ec9083c337851d0d1f999cd5ee752f6c0e1d80b08446e` | source archive; APK not verified by its report |
| 0.7.5 | `1ed67f9277cd32e5c78f20863ce60fa624baee5617ee0b0989e7093feac161c3` | startup/smoke-test fix |

No 0.7.7 project-ZIP hash was located in the searched archive material. The 0.7.7 report does record APK hashes:

- release: `158965ea01194fb3af680b38737785229102915eb93a7ff6680f75dce3fd04e9`
- debug: `5eaf5ca8597cf70391856d5517650693428eaeda88182df7d15e4f7fcf4256fc`

## Signing continuity recorded in Drive

Several 0.7.x reports record the same development signing-certificate SHA-256:

`1E:08:A9:03:AE:F9:C3:A7:21:51:0B:64:EC:76:4D:01:D3:D0:94:EB:95:41:61:B6:25:44:EA:8F:18:7B:59:53`

This is certificate identity evidence only. No signing key or secret is stored in this repository.

## What is reusable from this branch

Potentially reusable after current-policy review:

- UI smoke-testing strategy introduced after the 0.7.3 startup regression;
- ISO-TP/VIN parsing and conflict-aware vehicle-identification design;
- route-free GPS timing architecture;
- theme-system accessibility tests;
- test-report and archive-hash practices;
- dedicated, evidence-labelled experimental workflows rather than silently publishing uncertain values.

Not automatically reusable:

- CT 200h command sets or profiles;
- any command outside the active IS220d allowlist;
- Techstream-derived injector requests/formulas without renewed vehicle verification;
- any future service/write/customize architecture from the old multi-vehicle direction.
