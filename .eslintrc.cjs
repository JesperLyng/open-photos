module.exports = {
  root: true,
  env: {
    es2022: true,
  },
  ignorePatterns: ["node_modules/", "dist/", "build/", ".vite/"] ,
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["import"],
  extends: ["eslint:recommended", "plugin:import/recommended", "prettier"],
  settings: {
    react: { version: "detect" },
  },
  overrides: [
    {
      files: ["client/**/*.{js,jsx}"],
      env: { browser: true },
      parserOptions: { ecmaFeatures: { jsx: true } },
      plugins: ["react", "react-hooks", "jsx-a11y"],
      extends: [
        "eslint:recommended",
        "plugin:react/recommended",
        "plugin:react-hooks/recommended",
        "plugin:jsx-a11y/recommended",
        "plugin:import/recommended",
        "prettier",
      ],
      rules: {
        "react/react-in-jsx-scope": "off",
      },
    },
    {
      files: ["server/**/*.js"],
      env: { node: true },
    },
    {
      files: ["packages/**/*.js"],
      env: { node: true },
    },
  ],
};
