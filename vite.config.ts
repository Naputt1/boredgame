import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@boredgame/core": resolve(__dirname, "src/core/index.ts"),
      "@boredgame/demo-game": resolve(__dirname, "src/demo-game/index.ts"),
      "@boredgame/engine": resolve(__dirname, "src/engine/index.ts"),
      "@boredgame/transport": resolve(__dirname, "src/transport/index.ts"),
      "@boredgame/utils": resolve(__dirname, "src/utils/index.ts")
    }
  }
});
