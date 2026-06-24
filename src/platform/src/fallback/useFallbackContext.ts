import { useEffect, useState } from "react";
import type { PlatformContext } from "../types";

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

export const useFallbackContext = (): PlatformContext => {
  const [context] = useState<PlatformContext>(createFallbackContext);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const roomId = search.get("roomId");
    const userId = search.get("userId");

    if (roomId || userId) {
      const uid = userId ?? context.userId;
      window.localStorage.setItem("boredgame:local-user", uid);
    }
  }, [context.userId]);

  return context;
};
