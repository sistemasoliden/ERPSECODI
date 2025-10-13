import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
  base: "/", // 👈 IMPORTANTE
});

//import { defineConfig } from "vite";
//import react from "@vitejs/plugin-react";
//import path from "path";

//export default defineConfig({
//plugins: [react()],
//resolve: {
//    alias: {
//     "@": path.resolve(__dirname, "src"),
//  },
//},
//server: {
// port: 5173,
//strictPort: true,
//proxy: {
//"/api": {
//target: "http://localhost:5000",
//changeOrigin: true,
//},
//},
//},
//build: {
//outDir: "dist",
//},
//base: "/", // 👈 IMPORTANTE
//});
