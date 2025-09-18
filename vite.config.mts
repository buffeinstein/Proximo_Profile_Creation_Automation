import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  // Client app lives here (index.html inside this folder)
  root: "src/client",

  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      // Frontend calls like fetch('/api/...') → proxied to your Node server
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false
      }
    }
  },

  preview: {
    port: 5173
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/client")
    }
  },

  envDir: path.resolve(__dirname, "."),
  envPrefix: "VITE_",

  build: {
    outDir: "../../public",
    emptyOutDir: true,
    sourcemap: mode === "development",
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"]
        }
      }
    }
  }
}));