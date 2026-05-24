import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.mjs", "scripts/**/*.mjs"],
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error"
    }
  },
  {
    ignores: ["tmp/", "node_modules/"]
  }
];
