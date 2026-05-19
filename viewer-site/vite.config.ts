import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  server: {
    port: 3001,
  },
  build: {
    target: "esnext",
    cssMinify: true,
    minify: "esbuild",
    sourcemap: false,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks: {
          solid: ["solid-js"],
          proto: [
            "@bufbuild/protobuf",
            "@connectrpc/connect",
            "@connectrpc/connect-web",
          ],
        },
      },
    },
  },
});
