import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Two HTML entry points: "/" is the public login page, "/app/" is the protected app.
export default defineConfig({
  root: "web",
  plugins: [react()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "web/index.html"),
        app: resolve(import.meta.dirname, "web/app/index.html"),
      },
    },
  },
  test: { environment: "node", include: ["../tests/**/*.test.ts"] },
} as Parameters<typeof defineConfig>[0]);
