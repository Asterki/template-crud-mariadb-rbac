import { defineConfig, loadEnv } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { resolve } from "node:path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const originSecret = env.ORIGIN_SECRET;

  return {
    plugins: [
      TanStackRouterVite({ autoCodeSplitting: true }),
      viteReact(),
      tailwindcss(),
    ],
    build: {},
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
      },
    },
    // Development only: keep the browser on one origin and let Vite inject
    // the optional origin secret. Production uses the Vercel rewrite.
    server: {
      proxy: {
        "/api": {
          target: env.VITE_PROXY_TARGET || "http://localhost:3000",
          changeOrigin: false,
          ...(originSecret
            ? { headers: { "x-origin-secret": originSecret } }
            : {}),
        },
      },
    },
  };
});
