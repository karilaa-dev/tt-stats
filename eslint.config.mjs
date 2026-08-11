import eslint from "@eslint/js"
import { defineConfig, globalIgnores } from "eslint/config"
import globals from "globals"
import tseslint from "typescript-eslint"

export default defineConfig([
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  globalIgnores([
    ".output/**",
    ".tanstack/**",
    ".next/**",
    "dist/**",
    "src/routeTree.gen.ts",
  ]),
])
