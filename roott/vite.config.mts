// import path from "node:path";
// import { defineConfig } from "vite";
// import react from "@vitejs/plugin-react";

// export default defineConfig(({ mode }) => ({
//   root: "src/client",
//   plugins: [react()],
//   server: {
//     port: 5173,
//     proxy: {
//       "/api": { target: "http://localhost:3000", changeOrigin: true, secure: false }
//     }
//   },
//   preview: { port: 5173 },
//   resolve: {
//     alias: { "@": path.resolve(__dirname, "src/client") }
//   },
//   envDir: path.resolve(__dirname, "."),     // still fine
//   envPrefix: "VITE_",
//   build: {
//     outDir: "../../public",                 // if intentional keep; else maybe "../dist"
//     emptyOutDir: true,
//     sourcemap: mode === "development",
//     rollupOptions: {
//       output: {
//         manualChunks: {
//           react: ["react", "react-dom"]
//         }
//       }
//     }
//   }
// }));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true }
    }
  },
  preview: { port: 5173 },
  envDir: ".",
  envPrefix: "VITE_",
  build: {
    outDir: "dist",
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