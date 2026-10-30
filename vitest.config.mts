import react from "@vitejs/plugin-react"
import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    // Transform Zod's exports to avoid Vitest's external-module interop on Bun.
    server: { deps: { inline: ["zod"] } },
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/**/*.test.{ts,tsx}"],
          exclude: [...configDefaults.exclude, "tests/integration/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          // Each file resets or deliberately breaks tables in the one shared
          // test database, so they run one at a time after the unit tests.
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
})
