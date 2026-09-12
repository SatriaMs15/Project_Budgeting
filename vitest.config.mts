import { defineConfig } from "vitest/config";

export default defineConfig({
  // No @vitejs/plugin-react: it pulls a Babel 8 chain that conflicts with
  // shadcn's Babel 7 pin. Vitest transforms JSX with oxc on its own, and Vite
  // now resolves tsconfig `paths` (the "@/..." aliases) natively.
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
