# Project Drive archive and Git migration registry

This file records what relevant Flex material was found in the project Drive/File Library and how it should be handled in GitHub.

The goal is to keep **source, evidence and reproducible documentation** in Git while leaving generated binaries, large proprietary reference archives and duplicate package snapshots in Drive.

## Migration policy

| Drive material | GitHub handling |
|---|---|
| Current source code, tests and build scripts | Git is authoritative |
| Current changelog and test report | Keep in Git |
| Vehicle identity / protocol evidence | Summarize in versioned Markdown |
| Historical Flex test reports and design notes | Preserve as reconciled historical documentation |
| Historical source ZIPs | Keep in Drive; record SHA-256 and lineage in Git |
| APKs/debug APKs | Keep out of source tree; record hashes where useful |
| Full diagnostic field reports | Keep raw originals in Drive; commit sanitized findings only |
| Techstream distribution/archive | Do not commit; preserve derived evidence and provenance only |
| Lexus repair-manual ISO/RAR | Do not commit; preserve independently written findings only |
| Signing keys / keystores | Never commit |
| Parts/BOM spreadsheets | Separate Lexus parts project data; not a Flex runtime/source dependency |

## Current IS220d line

The archive includes source snapshots and test evidence from the late 0.6.x line. Git is now authoritative, but these hashes provide provenance for the material that preceded the repository import.

### Source archive registry

| Version | Project archive | SHA-256 | Recorded test state |
|---|---|---|---|
| 0.6.5 | `IS220d_OBD-Flex-0.6.5-project.zip` | `1c645296326b666d0db01a772993fa465105b866b7d70659c17b00bfed87d5aa` | development-study baseline |
| 0.6.6 | `IS220d_OBD-Flex-0.6.6-project.zip` | `a0636152684d28e66a0a2a0b6aa3136dd27deaa660155acfe1939119d4c8d631` | 79/79 tests; vLinker Ready |
| 0.6.7 | `IS220d_OBD-Flex-0.6.7-project.zip` | `bd9ba0fdee4975be4b1ef5b14d5f9c54af151d91a444b61e123375c90a37d0dd` | 91/91 tests; validated profile/replay |
| 0.6.8 | `IS220d_OBD-Flex-0.6.8-project.zip` | `48670c419d40d2c7ba835b6908bba69868be47a3d6d1b247dbb0ac6a0d837148` | 101/101 tests; adaptive live polling |
| 0.6.9 | `IS220d_OBD-Flex-0.6.9-project.zip` | `df34b9bfbbe8c88b1a15434529b438a213fdff994955542e5d7f6bb4bc2ac473` | 102/102 tests; DPNR inspection |

The 0.6.6 report records that the physical vLinker MC+ had not yet arrived, so Classic/BLE vehicle validation was still open. The 0.6.7 and 0.6.8 reports likewise distinguish successful software/APK verification from later physical IS220d + vLinker verification. This distinction is retained in the current evidence policy.

### 0.6.9 Git baseline

The current Git baseline is `IS220d OBD Flex 0.6.9` / versionCode 609.

The preserved 0.6.9 report records:

- 102/102 automated tests passed;
- project ZIP SHA-256: `df34b9bfbbe8c88b1a15434529b438a213fdff994955542e5d7f6bb4bc2ac473`;
- release APK SHA-256: `db15d1a644c588185b0d097155c166da57b9cc3a379a8891a8a1b504c0060a1b`;
- debug APK SHA-256: `a61b8f8458afd3dd0a1b2afbf063d9f79c561171dd7ac5aa8aa874822783667e`;
- test-report SHA-256: `bd70ec43a1e2190522c6ada64722fefdac6850efb288b207c8dbdafad508a5e3`.

Generated APKs remain excluded by `.gitignore`.

## Historical multi-vehicle 0.7.x line

See [`HISTORICAL_0_7_X.md`](HISTORICAL_0_7_X.md) for the reconciled timeline.

### Source archive registry

| Version | Project archive | SHA-256 |
|---|---|---|
| 0.7.0 | `Lexus_OBD-Flex-0.7.0-project.zip` | `e105cc8073f4b1e26017b0041c40badeb12b827b8937990dd6032d71b2b3de8b` |
| 0.7.1 | `Lexus_OBD-Flex-0.7.1-project.zip` | `a380c1d7ef498a47a3e1c2178b53728b39759fe6cd74b1c543779e50256ee367` |
| 0.7.2 | `Lexus_OBD-Flex-0.7.2-project.zip` | `8820a7d4ad60977cde6b903af5856ddcfe042dcea817bf933217c7b1b04cb90e` |
| 0.7.3 | `Lexus_OBD-Flex-0.7.3-project.zip` | `bf583746394aa0cec1aa2b49f15ea4fceeeeaa5326b959ee45f5d2ca1df58385` |
| 0.7.4 | `Lexus_OBD-Flex-0.7.4-project.zip` | `41c176abea073957fd9ec9083c337851d0d1f999cd5ee752f6c0e1d80b08446e` |
| 0.7.5 | `Lexus_OBD-Flex-0.7.5-project.zip` | `1ed67f9277cd32e5c78f20863ce60fa624baee5617ee0b0989e7093feac161c3` |

No 0.7.6 project evidence was located in the searched archive.

No 0.7.7 project-ZIP checksum was located, although the 0.7.7 test report and APK checksums were preserved.

### Relevant historical Markdown/report classes found

The archive contains evidence for:

- 0.7.0 CT 200h support and CT quick-start;
- 0.7.1 CT purchase-inspection workflow;
- 0.7.2 CT purchase-inspection update and GPS/OBD power-test guide;
- 0.7.3 theme guide and release audit;
- 0.7.4 automatic vehicle-identification guide and source test report;
- 0.7.5 startup regression/build report;
- 0.7.7 IS220d injector-screening guide and build report;
- version-specific SHA-256 registries for multiple 0.7.x releases.

Rather than copying every near-duplicate report into the active source root, their engineering-relevant information is consolidated in versioned docs and the originals remain in Drive.

## Development study

`Kehitys/IS220d_OBD_Flex_kehitysselvitys_2026-08-11.docx`

The 40-page report is retained in Drive. Git contains a source-faithful digest at [`DEVELOPMENT_STUDY_2026-08-11.md`](DEVELOPMENT_STUDY_2026-08-11.md).

The digest keeps architecture, evidence levels, network topology, roadmap, test strategy and technical-debt findings while deliberately not reproducing the repair manual's detailed Customize tables.

## OBD identity evidence

The project OBD text file records the target vehicle's:

- ISO 15765-4 CAN 11-bit / 500 kbit/s protocol;
- engine response CAN ID `7E8`;
- calibration ID `35360000`;
- CVN `01CAD67F74`;
- VIN used to correlate captures.

This was imported into [`VEHICLE_EVIDENCE.md`](VEHICLE_EVIDENCE.md).

## Field diagnostic reports

Useful real-session reports are kept raw in Drive. Engineering findings are summarized in [`FIELD_EVIDENCE.md`](FIELD_EVIDENCE.md).

The current Git summary intentionally omits full Bluetooth addresses and other unnecessary device identifiers while retaining transport/protocol behavior and useful raw payloads.

## Techstream archive

The project contains Techstream 12.20.024 archive parts and historical research derived from its EU data definitions.

The August development study inventoried the Techstream material as a multi-region database set and used EU Data/PIDGroup definitions and help files for research. Git handling remains:

- do not import the Techstream distribution itself;
- do not import proprietary database dumps;
- retain independently written protocol/evidence descriptions;
- label Techstream-derived identifiers/conversions separately from vehicle-verified production data;
- current production commands remain controlled by `src/is220d-profile.js` and `docs/PROTOCOL.md`.

## Lexus repair manual archive

The development study inventoried the Lexus IS250/220D repair-manual archive as 26,893 files, including HTML, PNG and PDF material. Duplicate RAR and ISO copies were reported identical in that study.

Git handling:

- do not import the ISO/RAR or bulk manual content;
- do not reproduce diagrams or large manual tables;
- preserve independently written architecture/test findings with provenance;
- use the manual as reference evidence, not as source code or redistributable repository content.

## APK archive

The Drive FLEX folder contains many generated APK snapshots, including historical `IS220d_OBD-Flex` and `Lexus_OBD-Flex` releases.

They remain in Drive because:

- Git source should remain reproducible rather than become a binary dump;
- APKs are generated artifacts;
- the current `.gitignore` already excludes `*.apk` and related build outputs;
- hashes/test reports are enough to identify archived builds.

## Parts and vehicle-maintenance data

Project-level parts/BOM spreadsheets and maintenance records are valuable to the wider Lexus project but are not application source inputs for Flex. The August development study also explicitly treated parts lists as reference material without diagnostic impact. They therefore remain outside this Git repository unless a future feature explicitly defines a versioned, non-sensitive data interface to them.

## Future import checklist

When new Drive material appears:

1. determine whether it is source, generated binary, raw evidence, third-party reference, or unrelated project data;
2. put source/test changes in Git branches and PRs;
3. summarize raw vehicle evidence without unnecessary personal/device identifiers;
4. record hashes for retained binary/source archives when lineage matters;
5. do not let historical commands silently bypass the current allowlist or evidence policy;
6. update this registry when an archive becomes authoritative, superseded or intentionally excluded.
