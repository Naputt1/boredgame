import { useCallback, useState } from "react";
import { GameRegistry } from "@boredgame/registry";
import { GameSelector, GameProvider } from "@boredgame/react";
import { PlatformProvider } from "@boredgame/platform";
import { saboteurDefinition } from "../saboteur";
import type { GameTransport } from "@boredgame/transport";
import { GameScreen } from "./GameScreen";
import { RoomSetup } from "./RoomSetup";

type Phase =
  | { type: "select" }
  | { type: "setup"; definition: any }
  | { type: "play"; definition: any; roomId: string; transport: GameTransport; userId: string; username: string };

const registry = new GameRegistry();
registry.registerAll([saboteurDefinition]);

const isDiscord = typeof window !== "undefined" && Boolean(
  (import.meta as Record<string, any>).env?.VITE_DISCORD_CLIENT_ID &&
  new URLSearchParams(window.location.search).get("frame_id") ||
  new URLSearchParams(window.location.search).get("instance_id")
);

export const GameShell = () => {
  const [phase, setPhase] = useState<Phase>({ type: "select" });

  const handleSelect = useCallback((def: any) => {
    if (isDiscord) {
      setPhase({ type: "play", definition: def, roomId: "", transport: null as any, userId: "", username: "" });
    } else {
      setPhase({ type: "setup", definition: def });
    }
  }, []);

  const handleRoomReady = useCallback((opts: { roomId: string; transport: GameTransport; userId: string; username: string }) => {
    if (phase.type === "setup") {
      setPhase({ type: "play", definition: phase.definition, ...opts });
    }
  }, [phase]);

  const handleBack = useCallback(() => {
    setPhase({ type: "select" });
  }, []);

  if (phase.type === "select") {
    return <GameSelector registry={registry} onSelect={handleSelect} />;
  }

  if (phase.type === "setup") {
    return <RoomSetup definition={phase.definition} onRoomReady={handleRoomReady} onBack={handleBack} />;
  }

  if (isDiscord) {
    return (
      <PlatformProvider key={phase.definition.id} gameDefinition={phase.definition}>
        <GameScreen definition={phase.definition} onBack={handleBack} />
      </PlatformProvider>
    );
  }

  return (
    <GameProvider
      definition={phase.definition}
      playerId={phase.userId}
      roomId={phase.roomId}
      transport={phase.transport}
    >
      <GameScreen definition={phase.definition} onBack={handleBack} />
    </GameProvider>
  );
};
