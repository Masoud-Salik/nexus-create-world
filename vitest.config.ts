import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // The queue tests share one `jobs` table; running files in parallel would
    // make the "nothing lost" assertions racy.
    fileParallelism: false,
  },
});
