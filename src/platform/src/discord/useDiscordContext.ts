import { DiscordSDK } from "@discord/embedded-app-sdk";
import { useEffect, useState } from "react";
import type { DiscordParticipant, PlatformContext } from "../types";

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;

const localId = (prefix: string): string => {
  const storageKey = `boredgame:${prefix}`;
  const stored = window.localStorage.getItem(storageKey);
  if (stored) return stored;
  const generated =
    window.crypto?.randomUUID?.() ?? `${prefix}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(storageKey, generated);
  return generated;
};

const createFallbackContext = (): PlatformContext => {
  const uid = localId("local-user");
  return {
    instanceId: localId("local-room"),
    userId: uid,
    username: `Player ${uid.slice(0, 4)}`,
    participants: [],
    isDiscord: false,
  };
};

export const useDiscordContext = (): PlatformContext => {
  const [context, setContext] = useState<PlatformContext>(createFallbackContext);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!CLIENT_ID) {
        return;
      }

      try {
        const sdk = new DiscordSDK(CLIENT_ID);
        await sdk.ready();

        const { user } = await sdk.commands.authenticate({});

        const participants = await fetchParticipants(sdk);

        if (!cancelled) {
          setContext({
            instanceId: sdk.instanceId,
            userId: user.id,
            username: user.global_name ?? user.username,
            participants,
            isDiscord: true,
          });
        }
      } catch {
        if (!cancelled) {
          setContext(createFallbackContext());
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, []);

  return context;
};

async function fetchParticipants(sdk: DiscordSDK): Promise<DiscordParticipant[]> {
  try {
    const result = await sdk.commands.getActivityInstanceConnectedParticipants();
    return (result.participants ?? []).map((p) => ({
      id: p.id,
      username: p.username,
      globalName: p.global_name ?? undefined,
      avatar: p.avatar ?? undefined,
    }));
  } catch {
    return [];
  }
}
