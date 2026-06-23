import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@boredgame/core": resolve(__dirname, "src/core/index.ts"),
      "@boredgame/engine": resolve(__dirname, "src/engine/index.ts"),
      "@boredgame/schemas": resolve(__dirname, "src/schemas/index.ts"),
      "@boredgame/transport": resolve(__dirname, "src/transport/index.ts"),
      "@boredgame/view": resolve(__dirname, "src/view/index.ts"),
      "@boredgame/platform": resolve(__dirname, "src/platform/index.ts")
    }
  }
});
