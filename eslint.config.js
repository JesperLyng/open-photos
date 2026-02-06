import js from "@eslint/js";
import globals from "globals";
import importPlugin from "eslint-plugin-import";

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
    files: ["server/**/*.js", "packages/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      import: importPlugin,
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
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...importPlugin.configs.recommended.rules,
    },
  },
];
