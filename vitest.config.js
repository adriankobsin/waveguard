import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["mock-server/test/**/*.test.js", "src/**/*.test.{js,jsx}"],
    pool: "forks",
  },
});
