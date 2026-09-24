# Flex UI Design System

This document is the human-readable design system for IS220d OBD Flex. The executable AI/development checklist is in [`skills/flex-ui/SKILL.md`](../skills/flex-ui/SKILL.md).

## Product character

Flex should feel like a focused mobile diagnostic instrument: restrained, quick to scan and predictable while standing next to the car. The interface should expose complexity progressively rather than displaying every available control at once.

The design direction borrows general qualities associated with well-designed native mobile software—clear hierarchy, generous spacing, large touch targets and controlled disclosure—but does not copy proprietary Apple screens, assets or branding.

## Information architecture

Every screen has three layers:

1. **Immediate layer** — current state, primary task and the next useful action.
2. **Detail layer** — grouped results, secondary controls and explanations.
3. **Technical layer** — raw evidence, protocol details, command identifiers, PNC/OE numbers and developer/research tools.

A normal diagnostic flow should rarely require the technical layer.

### Persistent navigation

The bottom navigation is for high-frequency destinations only. Less frequent tests, session tools and developer functions belong under **Lisää**. Adding a new feature does not automatically justify another persistent tab.

## Component hierarchy

### Hero / screen heading

Use a concise task or state heading. Supporting copy should normally be one sentence. Avoid introductory walls of text.

### Cards

Cards group one coherent concept. Do not create a separate card for every single metric. Related values belong in one section with a clear label and consistent spacing.

### Primary action

A screen should normally have one visually dominant action. Secondary and cancel actions remain available but subordinate.

### Progressive disclosure

Use collapsed `details` sections or the existing bottom-sheet pattern for:

- connection advanced settings;
- protocol/adapter identity;
- raw evidence;
- repair-manual references;
- developer/research tools;
- large filter sets;
- diagnostic limitations that do not need to be read before starting.

## Diagnostic state language

Two different concepts must remain visually and semantically separate.

**Data state** describes whether Flex obtained usable evidence:

- DATA SAATU
- OSITTAIN
- EI VASTAUSTA
- EI TESTATTU

**Assessment state** describes what the available evidence suggests. The compact Health Check layer uses:

- OK
- HUOMIO
- TARKISTA
- EI VARMAA TULOSTA
- EI ARVIOITU

The expanded technical layer may use more precise labels such as `ARVO USKOTTAVA`, `POIKKEAMA` and `VAHVA POIKKEAMA`. “OK” must never be created merely from transport success.

## Typography and density

Use the existing application typography and theme system. Hierarchy should come primarily from size, weight, spacing and grouping.

- Primary screen titles: strongest hierarchy on the page.
- Section titles: clearly below the screen title.
- Body/help text: readable without competing with metrics.
- Metadata: smaller and muted, but still AA-readable under the theme tests.
- Raw identifiers/code: monospace only where it improves parsing.

Avoid using tiny text to fit too much information into one screen. Move secondary information into the next disclosure layer instead.

## Spacing

Prefer the existing rhythm: 6, 8, 10, 12, 14, 16, 20 and 24 px. Repeated elements should use the same gap and padding unless there is a functional reason not to.

Whitespace is functional: it separates tasks and reduces mis-taps.

## Touch and mobile ergonomics

Interactive targets must be at least **44 × 44 CSS px**. Primary mobile actions should generally be 48–52 px high.

Bottom sheets and persistent bottom controls must account for `env(safe-area-inset-bottom)`. Controls near screen edges must remain usable on devices with display cut-outs and gesture navigation.

Do not make critical controls dependent on hover.

## Colour and themes

Feature UI must use existing CSS variables rather than hard-coded colours. State colour is supplementary, never the only carrier of meaning.

Existing theme contrast regression tests remain authoritative. New components must work under every supported theme, including high contrast.

## Motion and feedback

Feedback should be immediate and local:

- button state changes when work starts;
- progress and status text update in place;
- a completion state explains the result or next step;
- failures explain whether the issue is connection, unavailable data, wrong operating state or another known condition.

Avoid decorative animation during vehicle diagnostics. Motion must not obscure state changes.

## Health Check reference pattern

The Health Check is the reference implementation for the design direction:

1. one clear run action;
2. summary counts visible first;
3. systems grouped into collapsible sections;
4. component details collapsed;
5. technical evidence nested inside the component;
6. compact states `OK / HUOMIO / TARKISTA`;
7. search and filters available without dominating the default view.

Future diagnostic screens should reuse this hierarchy where practical instead of inventing another navigation model.

## Connection reference pattern

The connection screen should prioritize:

1. adapter selection;
2. **Yhdistä autoon**;
3. visible connection-stage feedback.

Vehicle/protocol overrides, adapter identity and developer diagnostics remain available under advanced sections.

## Review checklist

A UI change is not complete until the reviewer can answer yes to these questions:

- Is the next action obvious?
- Can the primary state be understood in a few seconds?
- Is advanced complexity hidden until requested?
- Are all touch targets at least 44 px?
- Are statuses understandable without colour?
- Does the layout tolerate narrow screens and long Finnish text?
- Does it use theme variables rather than one-off colours?
- Are safe areas respected?
- Does it preserve the distinction between data availability and diagnostic assessment?
- Does it preserve uncertainty and evidence limitations?
- Is the new invariant covered by a deterministic test?

The design system changes only presentation priorities. It never overrides `AGENTS.md`, `docs/SAFETY.md`, `docs/PROTOCOL.md` or the evidence policy.
