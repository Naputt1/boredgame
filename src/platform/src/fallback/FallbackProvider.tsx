import { createContext, ReactNode, useContext, useMemo } from "react";
import { GameProvider } from "@boredgame/react";
import { createTransport } from "boredgame:transport";
import type { PlatformContext } from "../types";
import { useFallbackContext } from "./useFallbackContext";

const PlatformCtx = createContext<PlatformContext | null>(null);

export const usePlatform = (): PlatformContext => {
  const value = useContext(PlatformCtx);
  if (!value) {
    throw new Error("usePlatform must be used inside PlatformProvider");
  }
  return value;
};

export const PlatformProvider = ({ children }: { children: ReactNode }) => {
  const ctx = useFallbackContext();

  const transport = useMemo(
    () => createTransport({ playerId: ctx.userId }),
    [ctx.userId]
  );

  return (
    <PlatformCtx.Provider value={ctx}>
      <GameProvider
        playerId={ctx.userId}
        roomId={ctx.instanceId}
        transport={transport}
        participants={ctx.participants}
      >
        {children}
      </GameProvider>
    </PlatformCtx.Provider>
  );
};
