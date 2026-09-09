export const THEME_STORAGE_KEY = "lexusObdThemePreference";

export const THEME_OPTIONS = Object.freeze([
  Object.freeze({
    id: "system",
    label: "Järjestelmä",
    description: "Seuraa automaattisesti Androidin vaaleaa tai tummaa ulkoasua."
  }),
  Object.freeze({
    id: "lexus-dark",
    label: "Lexus Dark",
    description: "Flexin alkuperäinen tumma vihreä teema."
  }),
  Object.freeze({
    id: "pearl-light",
    label: "Pearl Light",
    description: "Vaalea helmiäissävyinen teema päiväkäyttöön."
  }),
  Object.freeze({
    id: "oled-black",
    label: "OLED Black",
    description: "Puhdas musta tausta ja hillitty vihreä korostus."
  }),
  Object.freeze({
    id: "hybrid-blue",
    label: "Hybrid Blue",
    description: "Tumma sininen teema CT 200h -henkisellä korostuksella."
  }),
  Object.freeze({
    id: "fsport-red",
    label: "F Sport Red",
    description: "Grafiitinharmaa teema punaisella F Sport -korostuksella."
  }),
  Object.freeze({
    id: "high-contrast",
    label: "Korkea kontrasti",
    description: "Musta, valkoinen ja keltainen teema mahdollisimman selkeään luettavuuteen."
  })
]);

const THEME_BY_ID = new Map(THEME_OPTIONS.map(theme => [theme.id, theme]));
const EFFECTIVE_THEME_IDS = new Set(THEME_OPTIONS.filter(theme => theme.id !== "system").map(theme => theme.id));

const THEME_META = Object.freeze({
  "lexus-dark": Object.freeze({ colorScheme: "dark", themeColor: "#0b0f14" }),
  "pearl-light": Object.freeze({ colorScheme: "light", themeColor: "#f4f2ee" }),
  "oled-black": Object.freeze({ colorScheme: "dark", themeColor: "#000000" }),
  "hybrid-blue": Object.freeze({ colorScheme: "dark", themeColor: "#071421" }),
  "fsport-red": Object.freeze({ colorScheme: "dark", themeColor: "#100d0f" }),
  "high-contrast": Object.freeze({ colorScheme: "dark", themeColor: "#000000" })
});

export function normalizeThemePreference(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return THEME_BY_ID.has(normalized) ? normalized : "system";
}

export function resolveTheme(preference, systemPrefersDark = true) {
  const normalized = normalizeThemePreference(preference);
  if (normalized === "system") return systemPrefersDark ? "lexus-dark" : "pearl-light";
  return EFFECTIVE_THEME_IDS.has(normalized) ? normalized : "lexus-dark";
}

export function getThemeOption(id) {
  return THEME_BY_ID.get(normalizeThemePreference(id)) || THEME_BY_ID.get("system");
}

export function getThemeMeta(id) {
  return THEME_META[resolveTheme(id, true)] || THEME_META["lexus-dark"];
}

function readStoredPreference(storage) {
  try { return storage?.getItem?.(THEME_STORAGE_KEY); }
  catch { return null; }
}

function persistPreference(storage, preference) {
  try { storage?.setItem?.(THEME_STORAGE_KEY, preference); }
  catch {}
}

function setMetaThemeColor(metaElement, color) {
  if (!metaElement) return;
  if (typeof metaElement.setAttribute === "function") metaElement.setAttribute("content", color);
  else metaElement.content = color;
}

function defaultDocumentRoot() {
  const documentObject = globalThis.document;
  return documentObject ? documentObject.documentElement : null;
}

function defaultSystemThemeMedia() {
  const mediaFactory = globalThis.matchMedia;
  return typeof mediaFactory === "function"
    ? mediaFactory.call(globalThis, "(prefers-color-scheme: dark)")
    : null;
}

function defaultMetaThemeElement() {
  const documentObject = globalThis.document;
  return documentObject && typeof documentObject.querySelector === "function"
    ? documentObject.querySelector('meta[name="theme-color"]')
    : null;
}

export function createThemeController({
  root = defaultDocumentRoot(),
  storage = globalThis.localStorage,
  systemMedia = defaultSystemThemeMedia(),
  metaElement = defaultMetaThemeElement(),
  onChange = null
} = {}) {
  if (!root) throw new Error("Teemajärjestelmä tarvitsee dokumentin juurielementin");

  let preference = normalizeThemePreference(readStoredPreference(storage));

  const snapshot = () => {
    const resolved = resolveTheme(preference, systemMedia?.matches !== false);
    const option = getThemeOption(preference);
    const resolvedOption = getThemeOption(resolved);
    return Object.freeze({
      preference,
      resolved,
      label: option.label,
      description: option.description,
      resolvedLabel: resolvedOption.label,
      followsSystem: preference === "system"
    });
  };

  const apply = (notify = true) => {
    const current = snapshot();
    const meta = THEME_META[current.resolved] || THEME_META["lexus-dark"];
    root.dataset.theme = current.resolved;
    root.dataset.themePreference = current.preference;
    if (root.style) root.style.colorScheme = meta.colorScheme;
    setMetaThemeColor(metaElement, meta.themeColor);
    if (notify && typeof onChange === "function") onChange(current);
    return current;
  };

  const handleSystemChange = () => {
    if (preference === "system") apply(true);
  };

  if (typeof systemMedia?.addEventListener === "function") systemMedia.addEventListener("change", handleSystemChange);
  else if (typeof systemMedia?.addListener === "function") systemMedia.addListener(handleSystemChange);

  const initial = apply(true);

  return Object.freeze({
    initial,
    getSnapshot: snapshot,
    setPreference(value) {
      preference = normalizeThemePreference(value);
      persistPreference(storage, preference);
      return apply(true);
    },
    refresh() {
      return apply(true);
    },
    destroy() {
      if (typeof systemMedia?.removeEventListener === "function") systemMedia.removeEventListener("change", handleSystemChange);
      else if (typeof systemMedia?.removeListener === "function") systemMedia.removeListener(handleSystemChange);
    }
  });
}
