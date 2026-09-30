import { defineConfig } from "vitest/config";

/**
 * The end-to-end export audit — see `src/lib/export/audit-export.audit.ts`.
 *
 * Its own config because it is not a unit test: it reads the live database and
 * the storage bucket, and it needs a report that `scripts/audit-seed.mjs` has
 * written. `npm test` must stay offline and fast, so the two never share an
 * `include`.
 *
 *   node --env-file=.env.local scripts/audit-seed.mjs
 *   npx vitest run --config vitest.audit.config.mts
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.audit.ts"],
    testTimeout: 120_000,
    hookTimeout: 180_000,
    reporters: ["default"],
  },
});
