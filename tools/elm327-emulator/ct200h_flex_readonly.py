"""ELM327-emulator merge scenario for Lexus CT 200h Flex read-only tests.

Usage with a separately installed ELM327-emulator:
  1. Start ``python3 -m elm``.
  2. At the emulator prompt run ``merge ct200h_flex_readonly``.
  3. Run ``scenario ct200h_flex_readonly``.

All responses are synthetic regression values written for Flex. This file
contains no Techstream or Lexus repair-manual content. The scenario has no
write, clear, Active Test, security-access, coding or charging command.
"""


def _header(value):
    return f"<header>{value}</header>"


def _size(value):
    return f"<size>{value}</size>"


def _data(value):
    return f"<data>{value}</data>"


ENGINE_REQUEST_HEADER = "7E0"
ENGINE_RESPONSE_HEADER = "7E8"
HYBRID_REQUEST_HEADER = "7E2"
HYBRID_RESPONSE_HEADER = "7EA"


ObdMessage = {
    "ct200h_flex_readonly": {
        "CT200H_SUPPORTED_PIDS": {
            "Request": r"^0100$",
            "Descr": "Synthetic CT 200h supported-PID response",
            "Header": ENGINE_REQUEST_HEADER,
            "Response": _header(ENGINE_RESPONSE_HEADER) + _size("06") + _data("41 00 BE 3F A8 13"),
            "Priority": 20,
        },
        "CT200H_MODEL_21C1": {
            "Request": r"^(21C1|0221C10000000000)$",
            "Descr": "Synthetic ZWA10 model identification",
            "Header": HYBRID_REQUEST_HEADER,
            "Response": _header(HYBRID_RESPONSE_HEADER) + _size("12") + _data("61 C1 5A 57 41 31 30 20 20 32 5A 52 46 58 45 00 00 45"),
            "Priority": 30,
        },
        "CT200H_SOC_2101": {
            "Request": r"^(2101|0221010000000000)$",
            "Descr": "Synthetic 60 percent hybrid state of charge",
            "Header": HYBRID_REQUEST_HEADER,
            "Response": _header(HYBRID_RESPONSE_HEADER) + _size("18") + _data("61 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 99"),
            "Priority": 30,
        },
        "CT200H_BLOCKS_2181": {
            "Request": r"^(2181|0221810000000000)$",
            "Descr": "Synthetic 14-block voltage response",
            "Header": HYBRID_REQUEST_HEADER,
            "Response": _header(HYBRID_RESPONSE_HEADER) + _size("1E") + _data("61 81 2E 16 2E 26 2E 1E 2E 2E 2E 37 2E 3F 2E 47 2E 4F 2E 57 2E 60 2E 68 2E 70 2E 78 2E 80"),
            "Priority": 30,
        },
        "CT200H_TEMPERATURES_2187": {
            "Request": r"^(2187|0221870000000000)$",
            "Descr": "Synthetic intake and TB1-TB3 temperatures",
            "Header": HYBRID_REQUEST_HEADER,
            "Response": _header(HYBRID_RESPONSE_HEADER) + _size("0A") + _data("61 87 4B 07 50 08 51 08 52 08"),
            "Priority": 30,
        },
        "CT200H_RESISTANCE_2195": {
            "Request": r"^(2195|0221950000000000)$",
            "Descr": "Synthetic 14-block internal resistance response",
            "Header": HYBRID_REQUEST_HEADER,
            "Response": _header(HYBRID_RESPONSE_HEADER) + _size("10") + _data("61 95 19 1A 1B 1C 1D 1E 1F 20 21 22 23 24 25 26"),
            "Priority": 30,
        },
        "CT200H_CURRENT_2198": {
            "Request": r"^(2198|0221980000000000)$",
            "Descr": "Synthetic current, power limits and SOC response",
            "Header": HYBRID_REQUEST_HEADER,
            "Response": _header(HYBRID_RESPONSE_HEADER) + _size("0A") + _data("61 98 89 C4 58 D0 04 78 80 70"),
            "Priority": 30,
        },
        "CT200H_PERMANENT_DTC": {
            "Request": r"^0A$",
            "Descr": "Synthetic permanent P0A80 read response",
            "Header": HYBRID_REQUEST_HEADER,
            "Response": _header(HYBRID_RESPONSE_HEADER) + _size("04") + _data("4A 01 0A 80"),
            "Priority": 30,
        },
        "CT200H_STORED_DTC": {
            "Request": r"^13B0$",
            "Descr": "Synthetic stored P3000 and P0A80 read response",
            "Header": HYBRID_REQUEST_HEADER,
            "Response": _header(HYBRID_RESPONSE_HEADER) + _size("06") + _data("53 02 30 00 0A 80"),
            "Priority": 30,
        },
    }
}
