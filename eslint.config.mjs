import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      ".lighthouseci/**",
      "public/vendor/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["public/**/*.js", "public/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Build DOM with h() from core/dom.js. Never parse markup from strings.
      "no-restricted-properties": [
        "error",
        { property: "innerHTML", message: "Build nodes with h() or svg() from core/dom.js." },
        { property: "outerHTML", message: "Build nodes with h() or svg() from core/dom.js." },
        {
          property: "insertAdjacentHTML",
          message: "Build nodes with h() or svg() from core/dom.js.",
        },
      ],
    },
  },
  {
    files: ["scripts/**/*.mjs", "test/**/*.mjs", "*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
  prettier,
];
