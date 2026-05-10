import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

/** Monorepo ESLint (flat). Type-aware rules use project service when available. */
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.cache/**",
      "coverage/**",
      "apps/marketer-pro-mobile/**",
    ],
  },
  {
    files: ["packages/**/*.ts", "apps/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
