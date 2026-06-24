import type { GameDefinition, GameEngineMiddleware } from "@boredgame/core";

export type DiscordParticipant = {
  id: string;
  username: string;
  globalName?: string;
  avatar?: string;
};

export type PlatformContext = {
  instanceId: string;
  userId: string;
  username: string;
  participants: DiscordParticipant[];
  isDiscord: boolean;
};

export type PlatformProviderProps = {
  children: React.ReactNode;
  gameDefinition: GameDefinition<any, any>;
  middleware?: GameEngineMiddleware[];
};

export type { GameDefinition };
