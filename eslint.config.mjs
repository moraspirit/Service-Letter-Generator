// Flat ESLint config for the whole monorepo.
// ESLint searches ancestor directories, so running `eslint .` inside an app
// resolves this file — each app does not need its own config.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/.turbo/**",
      "**/generated/**",
      "**/coverage/**",
      "**/next-env.d.ts",
      "docs/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Next.js rules for the two apps only.
  {
    files: ["apps/*/**/*.{ts,tsx,js,jsx,mjs}"],
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },

  {
    rules: {
      // Unused variables are an error, with a leading underscore as the opt-out.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // AGENTS.md: no `any` in shared packages. Warn everywhere, so it is
      // visible in apps too without blocking day-to-day work.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // Node scripts and tooling config: CommonJS with Node globals available.
  {
    files: ["scripts/**/*.js", "*.config.{js,mjs,ts}", "packages/*/*.config.ts"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      // Provisioning scripts run directly under Node as CommonJS, so require()
      // is the correct form here.
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // Node-run scripts inside packages (the database seed).
  {
    files: ["packages/*/prisma/*.ts"],
    languageOptions: { globals: { ...globals.node } },
  },

  // `any` is an error, not a warning, inside shared packages.
  {
    files: ["packages/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },

  // Must stay last: turns off rules that would fight Prettier.
  prettierConfig,
);
