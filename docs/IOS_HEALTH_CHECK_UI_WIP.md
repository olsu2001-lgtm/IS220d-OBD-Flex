# iOS-style Health Check UI — WIP

Status: implementation work only. Do not build, tag, release, upload APK, or increment the app version from this branch.

## Goal

Replace the current tool-first mobile information architecture with a diagnosis-first UI inspired by Apple's iOS Human Interface Guidelines while keeping Flex's existing diagnostic runtime and vehicle profiles intact.

## Primary navigation

The persistent mobile tab bar is reduced to four destinations:

1. **Tila** — vehicle overview and visual Health Check.
2. **Live** — selected live metrics and charts.
3. **Testit** — injector, DPNR, DTC, drive and power diagnostics.
4. **Lisää** — connection setup, BOM/diagnostic tools, saved sessions, terminal, appearance and expert tools.

Existing page IDs remain valid during migration so runtime code does not need a big-bang rewrite.

## Tila / Health Check

The new default post-connection experience should answer three questions without scrolling through raw PIDs:

- Is the vehicle/ECU connection healthy?
- Which systems have confirmed findings?
- Where should the user drill down next?

Health Check system groups for IS220d:

- Engine / OBD
- Air, boost and EGR
- Fuel and injectors
- DPNR / exhaust aftertreatment
- Electrical / charging
- ECU / DTC coverage

States are evidence states, not guessed component condition:

- `ok`: check completed and no finding in the evidence used by that check
- `attention`: check completed and produced a concrete finding
- `fault`: confirmed DTC/test failure
- `unavailable`: the requested evidence could not be obtained
- `running`: check in progress
- `idle`: not checked yet

A missing Toyota PID must never be rendered as numeric zero. `0` is reserved for a successfully decoded ECU value of zero. Missing/unsupported/timeout/parser-error remain distinct evidence states.

## Visual language

- Content first; app branding is no longer a large permanent header.
- Large page title with compact vehicle + ECU connection status.
- System-native font stack with `-apple-system` / BlinkMacSystemFont first.
- Minimum 44 px interactive targets.
- Rounded grouped surfaces with restrained separators and shadows.
- Semantic status colors only for diagnostic meaning.
- Translucent/material treatment reserved for navigation and floating controls, not every content card.
- Safe-area-aware top and bottom layout.
- Reduced-motion support.
- Light and dark appearance remain supported.

## Live redesign

The default Live view becomes a dashboard rather than the full PID catalog:

- 6–8 pinned metrics above the fold
- chart directly below the pinned metrics
- multi-signal chart selection
- metric picker as a sheet/search view
- raw/all metrics in a secondary expert view
- unsupported values hidden from the normal dashboard

## Testit hub

The existing specialist pages remain functional but are entered from one grouped Testit hub. Initial groups:

- Vikakoodit
- Suuttimet
- DPNR
- Koeajo
- Tehotesti
- vehicle-specific tests such as CT 200h purchase test

## Lisä / expert tools

Connection configuration, appearance, ECU survey, BOM/component diagnostics, saved runs, field validation, evidence bundle and raw terminal are secondary tools and must not compete with Tila/Live in the persistent tab bar.

## Migration guardrails

- No version bump.
- No APK/release artifact.
- No release registry update.
- Keep existing diagnostic transports and command allowlists unchanged during UI migration.
- Add UI smoke coverage before replacing existing navigation behavior.
- Preserve direct deep-link/data-page access to existing pages until the new hubs are complete.
