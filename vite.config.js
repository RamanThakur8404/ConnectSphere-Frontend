import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const gatewayTarget = process.env.VITE_GATEWAY_TARGET || "http://localhost:8080";

export default defineConfig({
  define: {
    global: "window",
  },
  server: {
    host: "::",
    port: 5173,
    strictPort: true,
    proxy: {
      // Proxy all /api requests to Spring Cloud Gateway
      "/api": {
        target: gatewayTarget,
        changeOrigin: true,
        secure: false,
      },
      "/oauth2": {
        target: gatewayTarget,
        changeOrigin: true,
        secure: false,
      },
      "/login": {
        target: gatewayTarget,
        changeOrigin: true,
        secure: false,
      },
      // Proxy WebSocket for real-time notifications
      "/ws-message": {
        target: gatewayTarget,
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
  preview: {
    host: "::",
    port: 5173,
    strictPort: true,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    include: ["src/**/*.{test,spec}.{js,jsx}"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      include: [
        "src/lib/apiBase.js",
        "src/lib/auth-utils.js",
        "src/lib/service-helpers.js",
        "src/lib/utils.js",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
