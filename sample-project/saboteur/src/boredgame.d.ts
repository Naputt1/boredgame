declare module "boredgame:transport" {
  import type { GameTransport } from "@boredgame/transport";

  export function createTransport(opts: {
    playerId: string;
    gameId: string;
    url?: string;
    instanceId?: string;
  }): GameTransport;
}
