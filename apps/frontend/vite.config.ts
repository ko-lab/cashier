import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ["iOS >= 10", "Safari >= 10"],
      renderLegacyChunks: true,
      modernPolyfills: true
    })
  ],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../../shared")
    }
  },
  server: {
    fs: {
      allow: [
        path.resolve(__dirname),
        path.resolve(__dirname, "../../shared")
      ]
    },
    proxy: {
      "/rpc": "http://localhost:4000",
      "/client-log": "http://localhost:4000"
    }
  },
  preview: {
    allowedHosts: [
      "cashier.ko-lab.space",
      "cashier.ko-lab.be",
      "wiki.ko-lab.space"
    ],
    proxy: {
      "/rpc": "http://localhost:4000",
      "/client-log": "http://localhost:4000"
    }
  },
  test: {
    environment: "node"
  }
});
