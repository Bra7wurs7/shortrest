import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  plugins: [
    solidPlugin(),
    nodePolyfills({
      include: ["fs", "path", "stream", "buffer", "events"],
      overrides: {
        fs: "memfs",
      },
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
  server: {
    port: 3000,
  },
  build: {
    target: "esnext",
  },
});
