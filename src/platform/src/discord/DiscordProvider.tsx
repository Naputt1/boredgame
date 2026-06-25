import { createContext, ReactNode, useContext, useMemo } from "react";
import { GameProvider } from "@boredgame/react";
import { createTransport } from "boredgame:transport";
import type { PlatformContext, PlatformProviderProps } from "../types";
import { useDiscordContext } from "./useDiscordContext";

const PlatformCtx = createContext<PlatformContext | null>(null);

export const usePlatform = (): PlatformContext => {
  const value = useContext(PlatformCtx);
  if (!value) {
    throw new Error("usePlatform must be used inside PlatformProvider");
  }
  return value;
};

export const PlatformProvider = ({ children, gameDefinition, middleware }: PlatformProviderProps) => {
  const ctx = useDiscordContext();

  const transport = useMemo(
    () =>
      createTransport({
        playerId: ctx.userId,
        gameId: gameDefinition.id,
        url: import.meta.env.VITE_WS_URL as string | undefined,
        instanceId: ctx.instanceId,
      }),
    [ctx.userId, ctx.instanceId, gameDefinition.id]
  );

  return (
    <PlatformCtx.Provider value={ctx}>
      <GameProvider
        definition={gameDefinition}
        playerId={ctx.userId}
        roomId={ctx.instanceId}
        transport={transport}
        participants={ctx.participants}
        middleware={middleware}
      >
        {children}
      </GameProvider>
    </PlatformCtx.Provider>
  );
};
