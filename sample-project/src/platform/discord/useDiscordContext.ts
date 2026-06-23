import { useEffect, useState } from "react";

export type DiscordParticipant = {
  id: string;
  username?: string;
  globalName?: string;
};

export type DiscordContext = {
  instanceId: string;
  userId: string;
  participants: DiscordParticipant[];
  isDiscord: boolean;
};

type DiscordSdkLike = {
  commands?: {
    getInstanceConnectedParticipants?: () => Promise<{
      participants?: DiscordParticipant[];
    }>;
  };
};

const localId = (prefix: string): string => {
  const storageKey = `boredgame:${prefix}`;
  const stored = window.localStorage.getItem(storageKey);

  if (stored) {
    return stored;
  }

  const generated =
    window.crypto?.randomUUID?.() ?? `${prefix}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(storageKey, generated);
  return generated;
};

export const useDiscordContext = (): DiscordContext => {
  const [context, setContext] = useState<DiscordContext>(() => ({
    instanceId: localId("local-room"),
    userId: localId("local-user"),
    participants: [],
    isDiscord: false
  }));

  useEffect(() => {
    let cancelled = false;

    const loadDiscordContext = async () => {
      const search = new URLSearchParams(window.location.search);
      const instanceId =
        search.get("instance_id") ??
        search.get("instanceId") ??
        context.instanceId;
      const userId = search.get("user_id") ?? search.get("userId") ?? context.userId;
      const sdk = (window as Window & { DiscordSDK?: DiscordSdkLike }).DiscordSDK;
      const participants =
        (await sdk?.commands?.getInstanceConnectedParticipants?.())?.participants ?? [];

      if (!cancelled) {
        setContext({
          instanceId,
          userId,
          participants,
          isDiscord: Boolean(search.get("frame_id") || search.get("instance_id") || sdk)
        });
      }
    };

    void loadDiscordContext();

    return () => {
      cancelled = true;
    };
  }, [context.instanceId, context.userId]);

  return context;
};
