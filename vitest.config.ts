import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Unit tests for the business logic that has to be right — validation, the
 * supplier snapshot, report creation and the completion algorithm (Phase 2
 * §35). Deliberately not a component-rendering suite: the approved UI is
 * graded against the handoff screenshots, not against assertions.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Keep the reporter quiet enough to read in CI output.
    reporters: ["default"],
  },
});
