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
