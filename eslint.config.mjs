import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "**/next.config.js",
    "**/postcss.config.js",
    "backfill.js",
    "check_policies.js",
    "confirm_users.js",
    "fix_rls.js",
    "fix_stores_policy.js",
    "migrate.js",
    "seed_categories.js",
    "setup_storage.js",
  ]),
]);

export default eslintConfig;
