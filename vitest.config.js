import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    timeout: 15000,
    pool: "forks",
    sequence: { concurrent: false },
  },
});
