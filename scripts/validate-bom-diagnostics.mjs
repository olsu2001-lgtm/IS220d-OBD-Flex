import fs from "node:fs/promises";
import { validateIs220dBomDiagnosticSnapshot } from "../src/is220d-bom-source.js";

const url = new URL("../data/is220d-bom-diagnostics.json", import.meta.url);
const snapshot = JSON.parse(await fs.readFile(url, "utf8"));
const summary = validateIs220dBomDiagnosticSnapshot(snapshot);

console.log(`IS220d BOM diagnostics snapshot OK: ${summary.total} components (${summary.direct} DIRECT + ${summary.indirect} INDIRECT)`);
console.log(`Sources: Vikadiag_kohteet ${summary.sourceSheets.Vikadiag_kohteet}, BOM ${summary.sourceSheets.BOM}`);
