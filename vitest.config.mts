import { defineConfig } from "vitest/config";

/**
 * Unit tests for the business logic that has to be right — validation, the
 * supplier snapshot, report creation and the completion algorithm (Phase 2
 * §35). Deliberately not a component-rendering suite: the approved UI is
 * graded against the handoff screenshots, not against assertions.
 *
 * `.mts` so Vite loads it as ESM natively, and `resolve.tsconfigPaths` so the
 * `@/*` alias comes straight from tsconfig.json with no extra plugin.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    reporters: ["default"],
  },
});
