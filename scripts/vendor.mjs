// Copies third-party files from node_modules into public/ so the site never loads them from a CDN.
// Run after changing the versions of dompurify or @fontsource-variable/inter, then commit the result.

import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

const copies = [
  ["node_modules/dompurify/dist/purify.es.mjs", "public/vendor/dompurify/purify.es.mjs"],
  ["node_modules/dompurify/LICENSE", "public/vendor/dompurify/LICENSE"],
  [
    "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
    "public/assets/fonts/inter-latin-wght-normal.woff2",
  ],
  ["node_modules/@fontsource-variable/inter/LICENSE", "public/assets/fonts/LICENSE-Inter.txt"],
];

for (const [from, to] of copies) {
  const target = join(root, to);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(root, from), target);
  console.log(`Vendored ${to}`);
}
