import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // "./" funciona em qualquer caminho (preview, GitHub Pages /RS_TURISMO/, etc.).
  // Com single-file no build, JS/CSS vão embutidos no HTML — sem 404 de assets.
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    // Single-file só no build (no dev atrapalha o HMR).
    ...(command === "build" ? [viteSingleFile()] : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
}));
