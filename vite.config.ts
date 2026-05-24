/// <reference types="vitest/config" />

import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// __dirname não existe em ESM — derivamos de import.meta.url.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  build: {
    rollupOptions: {
      output: {
        // Code-splitting via vendor chunks (S19). Tauri offline-first
        // ganha pouco com paralelismo de download, mas split reduz
        // parse time no boot e torna build mais granular (cresce
        // chunk específico = sabemos qual lib mudou).
        manualChunks: (id) => {
          // kdbxweb + @xmldom (parser XML transitivo): cripto e
          // parsing pesado. ~250-300 KB.
          if (
            id.includes("node_modules/kdbxweb") ||
            id.includes("node_modules/@xmldom")
          ) {
            return "crypto";
          }
          // React + react-dom + scheduler (concurrent mode dep).
          // ~120 KB. Match com "/" para não pegar react-dom etc.
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler")
          ) {
            return "react";
          }
          // UI primitives: radix-ui (meta) + @radix-ui/* (transitivos)
          // + lucide-react (ícones) + sonner (toasts). ~60-100 KB.
          if (
            id.includes("node_modules/radix-ui") ||
            id.includes("node_modules/@radix-ui") ||
            id.includes("node_modules/lucide-react") ||
            id.includes("node_modules/sonner")
          ) {
            return "ui-vendor";
          }
          // Restante (app code + outras deps) vai pro index.js
        },
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  test: {
    environment: "node",
    globals: false,
  },
}));
