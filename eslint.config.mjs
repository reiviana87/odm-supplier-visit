import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // The approved design bundle is a read-only reference, not source. It
    // ships its own prototype runtime (React 17-era ReactDOM.render, a
    // hand-rolled module shim) which is never bundled into this app.
    "design-handoff/**",
    "_archive/**",
  ]),
]);

export default eslintConfig;
