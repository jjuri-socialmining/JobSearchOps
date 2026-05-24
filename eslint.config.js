import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.mjs", "scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "off"
    }
  },
  {
    ignores: ["tmp/**", "node_modules/**"]
  }
];
