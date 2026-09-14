import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages では https://<user>.github.io/katei-kyoushi/ に置くため base を合わせる
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "かていきょうし",
        short_name: "せんせい",
        lang: "ja",
        display: "standalone",
        orientation: "any",
        background_color: "#f6f3fb",
        theme_color: "#5b4b8a",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,svg,png}"] },
    }),
  ],
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
  },
});
