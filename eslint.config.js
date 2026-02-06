import js from "@eslint/js";
import globals from "globals";
import importPlugin from "eslint-plugin-import";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "client/**",
      "dist/**",
      "build/**",
      ".vite/**",
    ],
  },
  {
    files: ["server/**/*.{js,ts}", "packages/**/*.{js,ts}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tsParser,
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      import: importPlugin,
      "@typescript-eslint": tsPlugin,
    },
    settings: {
      "import/resolver": {
        node: {
          moduleDirectory: [
            "node_modules",
            "server/node_modules",
            "packages/types/node_modules",
          ],
        },
        typescript: {
          project: ["server/tsconfig.json", "packages/types/tsconfig.json"],
        },
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...importPlugin.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
    },
  },
];
