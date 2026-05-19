import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    globalSetup: "./tests/setup/globalSetup.ts",
    // Make sure to cleanup everything after each test
    clearMocks: true,
    restoreMocks: true,
    // Make sure every db operations run sequantially
    pool: "threads",
    maxWorkers: 1,
    isolate: false,
  },
  plugins: [],
});
