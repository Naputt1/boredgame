import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@boredgame/core": resolve(__dirname, "src/core/index.ts"),
      "@boredgame/engine": resolve(__dirname, "src/engine/index.ts"),
      "@boredgame/schemas": resolve(__dirname, "src/schemas/index.ts"),
      "@boredgame/transport": resolve(__dirname, "src/transport/index.ts")
    }
  }
});
