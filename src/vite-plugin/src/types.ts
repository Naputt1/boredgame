export type BoredgamePlatform = "discord" | "fallback" | "auto";
export type BoredgameTransport = "websocket" | "p2p";

export type BoredgamePluginOptions = {
  platform: BoredgamePlatform;
  transport: BoredgameTransport;
};
