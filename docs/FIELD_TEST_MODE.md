# Field Test Mode

Status: **guided UI wrapper around the existing wide vLinker / ELM + Toyota diagnostic**.

Field Test Mode exists to make the three-run ECU Survey validation repeatable without introducing a second diagnostic implementation.

## What it does

The ECU Survey panel shows a `Field Test Mode · ECU Survey 3×` card.

The user selects one explicit engine state:

- `Moottori käy` (`running`), or
- `Moottori ei käy` (`stopped`).

The selected state is kept locally for the next field-test action.

The card shows:

- the embedded/current Build SHA;
- selected engine state;
- how many stored read-only runs match that same build + engine-state pair;
- the current collection state (`0/3`, `1/3`, `2/3`, `3/3`);
- whether a completed 3/3 group is ready or still needs attention.

## Starting a run

`Aja kenttäajo N/3` does only three things:

1. checks that the existing wide-diagnostic button `runGekoTest` is currently available;
2. sets the existing `diagnosticEngineState` control to the selected explicit state;
3. clicks the existing `runGekoTest` button once.

The helper does **not** call the transport, ELM client or CAN layer directly.

If the original diagnostic button is disabled, Field Test Mode does not bypass it. It reports that the adapter must be connected first.

## No automatic three-run loop

The helper never starts the second or third run automatically.

Each run requires a separate user action. This preserves the normal diagnostic lifecycle and allows the user to keep the vehicle in the intended state between runs.

After each completed run the existing ECU Survey history event refreshes the card.

## Grouping

The helper's visual run count only includes stored snapshots with:

- `mode = read-only`;
- the same Build SHA as the running/current build;
- the same explicit engine state selected in Field Test Mode.

Changing from `running` to `stopped` therefore starts a separate visual collection group.

The actual 0.7.0 field-validation decision remains owned by `evaluateFieldValidationSession()` and its stricter checks. Field Test Mode does not replace or weaken that gate.

## Button states

Before three runs:

- `Aja kenttäajo 1/3`
- `Aja kenttäajo 2/3`
- `Aja kenttäajo 3/3`

When the current 3-run validation group is clean:

- status: `3/3 valmis`
- button: `Aja lisävarmennusajo`

When three matching runs exist but the actual validation gate needs attention:

- status: `3/3 tarkistettava`
- button: `Aja korvaava kenttäajo`

A new matching run can then replace the oldest sample in the three-run validation window.

## Safety boundary

Field Test Mode adds no:

- OBD/ELM/Toyota command;
- protocol/header change;
- Bluetooth transport code;
- Android permission;
- network access;
- background loop;
- Active Test, DTC clear, write, coding or programming function.

It is only an on-device UI controller for the existing read-only wide diagnostic.
