"""ELM327-emulator merge scenario for IS220d OBD Flex read-only tests.

Usage with a separately installed ELM327-emulator:
  1. Start ``python3 -m elm``.
  2. At the emulator prompt run ``merge is220d_flex_readonly``.
  3. Run ``scenario is220d_flex_readonly``.

This file contains only Flex-authored synthetic responses. It neither embeds
ELM327-emulator nor changes the emulator's license. The scenario intentionally
contains no write, clear, active-test, security-access or regeneration command.
"""


def _header(value):
    return f"<header>{value}</header>"


def _size(value):
    return f"<size>{value}</size>"


def _data(value):
    return f"<data>{value}</data>"


ENGINE_REQUEST_HEADER = "7E0"
ENGINE_RESPONSE_HEADER = "7E8"


ObdMessage = {
    "is220d_flex_readonly": {
        "IS220D_SUPPORTED_PIDS": {
            "Request": r"^0100$",
            "Descr": "Synthetic IS220d supported-PID response",
            "Header": ENGINE_REQUEST_HEADER,
            "Response": _header(ENGINE_RESPONSE_HEADER) + _size("06") + _data("41 00 BE 3F A8 13"),
            "Priority": 20,
        },
        "IS220D_ENGINE_RPM": {
            "Request": r"^010C$",
            "Descr": "Synthetic running-engine RPM, 800 rpm",
            "Header": ENGINE_REQUEST_HEADER,
            "Response": _header(ENGINE_RESPONSE_HEADER) + _size("04") + _data("41 0C 0C 80"),
            "Priority": 20,
        },
        "IS220D_TOYOTA_217E": {
            "Request": r"^(217E|02217E0000000000)$",
            "Descr": "Synthetic verified-layout DPNR status response",
            "Header": ENGINE_REQUEST_HEADER,
            "Response": _header(ENGINE_RESPONSE_HEADER) + _size("06") + _data("61 7E 0A 04 02 00"),
            "Priority": 30,
        },
        "IS220D_TOYOTA_217F": {
            "Request": r"^(217F|02217F0000000000)$",
            "Descr": "Synthetic verified-layout DPNR temperature response",
            "Header": ENGINE_REQUEST_HEADER,
            "Response": _header(ENGINE_RESPONSE_HEADER) + _size("06") + _data("61 7F 01 00 02 00"),
            "Priority": 30,
        },
        "IS220D_TOYOTA_212C": {
            "Request": r"^(212C|02212C0000000000)$",
            "Descr": "Synthetic verified-layout EGR position response",
            "Header": ENGINE_REQUEST_HEADER,
            "Response": _header(ENGINE_RESPONSE_HEADER) + _size("03") + _data("61 2C 80"),
            "Priority": 30,
        },
    }
}
