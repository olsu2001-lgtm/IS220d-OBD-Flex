# Safety model

IS220d OBD Flex is diagnostic software used around a real vehicle. A plausible
but incorrect command or value can cause unsafe maintenance decisions. The app
therefore uses a read-only, allowlisted and fail-closed design.

## Forbidden capabilities

The project must not transmit or expose:

- ECU writes, coding, flashing or programming
- Active Test or actuator control
- forced DPF/DPNR regeneration
- DTC clearing, including OBD Mode 04
- immobilizer, key registration or security-access functions
- unrestricted command entry or a free hexadecimal terminal
- guessed Toyota identifiers, payload layouts or conversion formulas

An unsupported request must fail before reaching the transport.

## Network and secrets

- The APK must not request `android.permission.INTERNET`.
- Android cleartext traffic must remain disabled.
- Vehicle data is processed and stored locally unless the user explicitly
  exports a report.
- Signing keys, passwords, tokens and private vehicle reports must never be
  committed. CI builds are unsigned development artifacts unless a separately
  reviewed signing process is introduced.

## Transport isolation

Quicklynks FFF0/FFF6 uses its verified binary framing. ASCII ELM327, vLinker
Classic/SPP and BLE ISO-TP are separate transports. A command verified on one
transport is not automatically safe or valid on another.

## Measurement integrity

- Preserve raw responses alongside derived Toyota values.
- Reject truncated ISO-TP sequences, wrong response services, wrong identifiers,
  insufficient payloads and values outside documented plausible ranges.
- Do not infer an ECU or sensor fault from a fixed or suspicious value alone.
- Labels such as Techstream's `DPF Thermal Deteriorate`, `DPF PM Block` and
  `DPF No Activate` remain comparison observations until their identifiers and
  byte layouts are verified for this vehicle.
- Simulation and replay prove software behavior, not correctness on the car.

## Review requirement

Any change to a transport, allowlist, ECU header, request, response parser,
decoder, conversion formula, evidence level or plausible range requires a pull
request review and matching regression tests before merge.

