import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  THEME_OPTIONS,
  THEME_STORAGE_KEY,
  createThemeController,
  getThemeMeta,
  normalizeThemePreference,
  resolveTheme
} from "../src/themes.js";

const read = relativePath => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

function fakeMedia(initialMatches) {
  const listeners = new Set();
  return {
    matches: initialMatches,
    addEventListener(type, listener) { if (type === "change") listeners.add(listener); },
    removeEventListener(type, listener) { if (type === "change") listeners.delete(listener); },
    setMatches(value) {
      this.matches = value;
      for (const listener of listeners) listener({ matches: value });
    },
    listenerCount() { return listeners.size; }
  };
}

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    value(key) { return data.get(key); }
  };
}

test("teemaluettelo sisältää järjestelmän ja kuusi yksilöllistä Flex-teemaa", () => {
  assert.deepEqual(THEME_OPTIONS.map(theme => theme.id), [
    "system", "lexus-dark", "pearl-light", "oled-black", "hybrid-blue", "fsport-red", "high-contrast"
  ]);
  assert.equal(new Set(THEME_OPTIONS.map(theme => theme.id)).size, THEME_OPTIONS.length);
  assert.ok(THEME_OPTIONS.every(theme => theme.label && theme.description));
});

test("järjestelmäteema seuraa tummaa ja vaaleaa Android-asetusta", () => {
  assert.equal(resolveTheme("system", true), "lexus-dark");
  assert.equal(resolveTheme("system", false), "pearl-light");
  assert.equal(resolveTheme("hybrid-blue", false), "hybrid-blue");
  assert.equal(normalizeThemePreference("tuntematon"), "system");
});

test("teemavalinta tallentuu, päivittyy heti ja vaihtaa theme-color-arvon", () => {
  const root = { dataset: {}, style: {} };
  const storage = fakeStorage({ [THEME_STORAGE_KEY]: "oled-black" });
  const systemMedia = fakeMedia(false);
  const meta = { content: "", setAttribute(name, value) { if (name === "content") this.content = value; } };
  const changes = [];
  const controller = createThemeController({ root, storage, systemMedia, metaElement: meta, onChange: value => changes.push(value) });

  assert.equal(root.dataset.theme, "oled-black");
  assert.equal(root.dataset.themePreference, "oled-black");
  assert.equal(meta.content, "#000000");

  const selected = controller.setPreference("pearl-light");
  assert.equal(selected.resolved, "pearl-light");
  assert.equal(root.dataset.theme, "pearl-light");
  assert.equal(root.style.colorScheme, "light");
  assert.equal(storage.value(THEME_STORAGE_KEY), "pearl-light");
  assert.equal(meta.content, getThemeMeta("pearl-light").themeColor);
  assert.equal(changes.at(-1).preference, "pearl-light");
  controller.destroy();
  assert.equal(systemMedia.listenerCount(), 0);
});

test("järjestelmäasetuksen muutos vaikuttaa vain Järjestelmä-valinnassa", () => {
  const root = { dataset: {}, style: {} };
  const storage = fakeStorage({ [THEME_STORAGE_KEY]: "system" });
  const systemMedia = fakeMedia(true);
  const controller = createThemeController({ root, storage, systemMedia, metaElement: null });

  assert.equal(root.dataset.theme, "lexus-dark");
  systemMedia.setMatches(false);
  assert.equal(root.dataset.theme, "pearl-light");

  controller.setPreference("fsport-red");
  systemMedia.setMatches(true);
  assert.equal(root.dataset.theme, "fsport-red");
});

test("teemavalitsin on saavutettava ja kaikki paletit sisältyvät APK:n käyttöliittymälähteisiin", async () => {
  const [html, css, main, charts] = await Promise.all([
    read("index.html"), read("styles.css"), read("src/main.js"), read("src/charts.js")
  ]);
  assert.match(html, /<label for="themeSelect">Teema<\/label>/);
  assert.match(html, /id="themeResolvedState"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.match(html, /localStorage\.getItem\("lexusObdThemePreference"\)/);
  for (const theme of THEME_OPTIONS.filter(item => item.id !== "system")) {
    assert.match(html, new RegExp(`<option value="${theme.id}">`));
    if (theme.id === "lexus-dark") assert.match(css, /:root\s*\{/);
    else assert.match(css, new RegExp(`html\\[data-theme="${theme.id}"\\]`));
  }
  assert.match(main, /createThemeController\(\{ onChange: handleThemeChange \}\)/);
  assert.match(charts, /themeColor\("--surface-chart"/);
  assert.match(charts, /colorVariable \|\| "--accent"/);
});

test("teemakontrollerin WebView-oletukset eivät käytä bundlerissa rikkoutuvaa valinnaista metodikutsua", async () => {
  const source = await read("src/themes.js");
  assert.doesNotMatch(source, /document\?\.querySelector\?\./);
  assert.match(source, /function defaultMetaThemeElement\(\)/);
  assert.match(source, /documentObject\.querySelector\('meta\[name="theme-color"\]'\)/);
});

test("kaikkien teemojen perusteksti, himmeä teksti ja toimintopainike täyttävät AA-kontrastin", async () => {
  const css = await read("styles.css");
  const rootVariables = cssVariables(css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] || "");
  for (const theme of THEME_OPTIONS.filter(item => item.id !== "system")) {
    const escaped = theme.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const block = css.match(new RegExp(`html\\[data-theme="${escaped}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] || "";
    const palette = { ...rootVariables, ...cssVariables(block) };
    assert.ok(contrast(palette["--text"], palette["--bg"]) >= 4.5, `${theme.id}: teksti/tausta`);
    assert.ok(contrast(palette["--muted"], palette["--bg"]) >= 4.5, `${theme.id}: himmeä teksti/tausta`);
    assert.ok(contrast(palette["--accent-on"], palette["--accent"]) >= 4.5, `${theme.id}: painiketeksti/korostus`);
  }
});

function cssVariables(block) {
  return Object.fromEntries([...block.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map(match => [match[1], match[2]]));
}

function contrast(first, second) {
  const luminance = hex => {
    const channels = hex.slice(1).match(/.{2}/g).map(value => Number.parseInt(value, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}
