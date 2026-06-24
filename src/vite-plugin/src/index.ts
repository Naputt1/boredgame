import type { Plugin } from "vite";
import type { BoredgamePluginOptions } from "./types";

const TRANSPORT_ID = "boredgame:transport";

export const boredgame = (options: BoredgamePluginOptions): Plugin => {
  const platformTarget = `@boredgame/platform/${options.platform}`;

  return {
    name: "boredgame",

    resolveId(id, importer) {
      if (id === "boredgame:transport") {
        return "\0" + TRANSPORT_ID;
      }
      if (id === "@boredgame/platform" && importer) {
        return this.resolve(platformTarget, importer, { skipSelf: true });
      }
      return null;
    },

    load(id) {
      if (id === "\0" + TRANSPORT_ID) {
        return generateTransportModule(options.transport);
      }
      return null;
    },
  };
};

function generateTransportModule(transport: BoredgamePluginOptions["transport"]): string {
  if (transport === "websocket") {
    return [
      `import { WebSocketTransport } from "@boredgame/transport";`,
      ``,
      `export const createTransport = (opts) => {`,
      `  const url = opts.url ?? import.meta.env.VITE_WS_URL ?? "ws://localhost:3001";`,
      `  return new WebSocketTransport({ url, playerId: opts.playerId });`,
      `};`,
    ].join("\n");
  }

  return [
    `import { P2PTransport } from "@boredgame/transport";`,
    ``,
    `export const createTransport = (opts) => {`,
    `  return new P2PTransport({ instanceId: opts.instanceId });`,
    `};`,
  ].join("\n");
}
