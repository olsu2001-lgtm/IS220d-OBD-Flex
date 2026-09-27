# Flex UI Design skill

Use this skill for every user-facing UI/UX change in IS220d OBD Flex.

## Goal

Make the app feel calm, obvious and trustworthy during real garage and roadside use. The normal user should see the next useful action and the current vehicle state without needing to understand ELM commands, ECU identifiers, protocol details or internal evidence plumbing.

The app is a diagnostic instrument, not a dashboard demo. Visual polish must never hide uncertainty, invent confidence or weaken the repository's read-only/evidence rules.

## Required workflow

1. Read `AGENTS.md`, this skill and `docs/FLEX_UI_DESIGN_SYSTEM.md` before changing UI.
2. Identify the one primary user task of the screen.
3. Put the primary task and current state first.
4. Move advanced settings, raw evidence and developer tools behind progressive disclosure.
5. Reuse existing theme variables and interaction patterns. Do not introduce one-off visual systems.
6. Check mobile ergonomics, safe areas, contrast, touch targets and long Finnish labels.
7. Add or update deterministic UI guardrail tests.
8. Run `npm test`. Do not treat screenshots or simulated success as vehicle verification.

## Hierarchy rules

- One primary action per state. Secondary actions must be visually subordinate.
- Prefer a short title, one sentence of guidance and then the action.
- Show summary first, explanation second, raw evidence last.
- Use `details/summary`, sheets or clearly labelled advanced sections for optional complexity.
- Do not place protocol, raw hex, internal IDs or research terminology in the primary path unless the user explicitly asks for it.
- Empty, loading, disconnected, unavailable and failed states must say what the user can do next.

## Navigation rules

- Keep the persistent bottom navigation small and stable.
- Core destinations stay directly visible; infrequent tests and developer tools belong under `Lisää`.
- Do not add a new permanent bottom-navigation item when an existing destination, grouped screen or `Lisää` can contain it.
- Vehicle-specific destinations must disappear cleanly when they do not apply.

## Interaction rules

- Minimum touch target: 44 × 44 CSS px. Prefer 48–52 px for primary mobile actions.
- Never rely on colour alone for state. Pair colour with concise text such as `OK`, `HUOMIO`, `TARKISTA`, `EI VASTAUSTA`.
- Dynamic status text that matters to task completion should be announced with an appropriate live region.
- Destructive or exceptional actions must not look like the default forward path.
- Avoid modal interruption when inline feedback or a bottom sheet is sufficient.

## Visual rules

- Use existing CSS variables such as `--bg`, `--surface`, `--text`, `--muted`, `--accent`, `--success`, `--warning` and danger tokens.
- Do not hard-code new brand colours in feature CSS.
- Keep spacing rhythmic: prefer the existing 6/8/10/12/14/16/20/24 px scale.
- Use rounded cards and grouping to clarify hierarchy, not to decorate every line.
- Preserve safe-area padding for bottom sheets and persistent navigation.
- Do not imitate proprietary Apple assets or exact screens. The target is native-quality hierarchy, restraint and ergonomics.

## Diagnostic-specific rules

- Separate **measurement availability** from **assessment**. “Data received” is not the same as “component OK”.
- Never convert missing/unsupported data into numeric zero.
- Keep evidence level and limitations available, but normally collapsed.
- Health Check summaries should be understandable before opening a component.
- Technical evidence, command IDs, PNC/OE data and repair-manual references belong in the expanded layer.
- A warning must identify the affected system/component and the next useful inspection step when that is supported by evidence.
- Never simplify away uncertainty required by the evidence policy.

## Writing rules

- Prefer concrete Finnish verbs: `Yhdistä autoon`, `Aloita OBD Health Check`, `Mittaa 6 s`.
- Avoid internal project language in primary UI: “probe”, “pipeline”, “registry”, “candidate”, “transport allowlist”.
- Keep button labels action-oriented and short.
- Explanations should answer either “what is this?” or “what do I do next?”, not both in a long paragraph.
- Preserve technical terminology where it is the actual vehicle/repair term.

## Audit before completion

Confirm all of the following:

- The screen has an obvious primary task.
- The most important current state is visible without scrolling when practical.
- Advanced/debug/raw information is collapsed by default.
- Touch targets are at least 44 px.
- Status is not communicated by colour alone.
- All themes remain legible and no feature introduces hard-coded colours.
- Long text and narrow mobile width do not break layout.
- Safe-area insets are preserved.
- No existing safety/evidence wording was weakened.
- Tests cover any new UI invariant.

If a proposed visual simplification conflicts with diagnostic truth, evidence boundaries or vehicle safety, keep the diagnostic truth and redesign the presentation around it.
