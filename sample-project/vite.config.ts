import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { boredgame } from "@boredgame/vite-plugin";

export default defineConfig({
  plugins: [
    boredgame({
      platform: "discord",
      transport: "websocket",
    }),
    react(),
  ],
});
