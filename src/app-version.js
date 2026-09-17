import "./ui-shell.js";
import packageMeta from "../package.json" with { type: "json" };

// The only editable application version is package.json:version.
export const APP_VERSION = packageMeta.version;
