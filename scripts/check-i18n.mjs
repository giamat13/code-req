// Verifies the translation files:
// - every key in en.json exists in every other locale, and vice versa;
// - placeholders such as {count} match across locales;
// - every static key used by t("...") or data-i18n attributes exists in en.json.

import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const publicDir = join(root, "public");
const localeDir = join(publicDir, "locales");

const base = JSON.parse(await readFile(join(localeDir, "en.json"), "utf8"));
const locales = (await readdir(localeDir))
  .filter((file) => extname(file) === ".json")
  .map((file) => file.slice(0, -".json".length));

const errors = [];
const placeholders = (text) =>
  [...text.matchAll(/\{(\w+)\}/g)]
    .map((match) => match[1])
    .sort()
    .join(",");

for (const locale of locales) {
  if (locale === "en") continue;
  const dictionary = JSON.parse(await readFile(join(localeDir, `${locale}.json`), "utf8"));
  for (const key of Object.keys(base)) {
    if (!(key in dictionary)) {
      errors.push(`${locale}: missing key "${key}"`);
    } else if (placeholders(base[key]) !== placeholders(dictionary[key])) {
      errors.push(`${locale}: placeholders differ for "${key}"`);
    }
  }
  for (const key of Object.keys(dictionary)) {
    if (!(key in base)) errors.push(`${locale}: key "${key}" is not in en.json`);
  }
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return nested.flat();
}

const sourceFiles = (await listFiles(publicDir)).filter(
  (file) => [".js", ".html"].includes(extname(file)) && !file.includes(join("public", "vendor")),
);

for (const file of sourceFiles) {
  const text = await readFile(file, "utf8");
  const used = [
    ...[...text.matchAll(/\bt\(\s*["'`]([a-z][\w.]*)["'`]/g)].map((match) => match[1]),
    ...[...text.matchAll(/data-i18n="([^"]+)"/g)].map((match) => match[1]),
    ...[...text.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap((match) =>
      match[1].split(";").map((pair) => pair.split(":")[1]),
    ),
  ];
  for (const key of used) {
    if (key && !(key in base)) errors.push(`${file.slice(root.length)}: unknown key "${key}"`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  console.error(`\n${errors.length} translation problem(s) found.`);
  process.exit(1);
}
console.log(
  `Checked ${locales.length} locale(s) and ${sourceFiles.length} source file(s). No problems found.`,
);
