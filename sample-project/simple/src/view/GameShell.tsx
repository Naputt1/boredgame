import { useCallback, useState } from "react";
import { GameRegistry } from "@boredgame/registry";
import { GameSelector } from "@boredgame/react";
import { PlatformProvider } from "@boredgame/platform";
import { demoGameDefinition } from "@boredgame/demo-game";
import { ticTacToeDefinition } from "@boredgame/tic-tac-toe";
import { saboteurDefinition } from "saboteur-project/definition";
import { GameScreen } from "./GameScreen";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Phase =
  | { type: "select" }
  | { type: "play"; definition: any; id: string };

const registry = new GameRegistry();
registry.registerAll([demoGameDefinition, ticTacToeDefinition, saboteurDefinition]);

export const GameShell = () => {
  const [phase, setPhase] = useState<Phase>({ type: "select" });

  const handleSelect = useCallback((def: any) => {
    setPhase({ type: "play", definition: def, id: def.id });
  }, []);

  const handleBack = useCallback(() => {
    setPhase({ type: "select" });
  }, []);

  if (phase.type === "select") {
    return <GameSelector registry={registry} onSelect={handleSelect} />;
  }

  return (
    <PlatformProvider
      key={phase.id}
      gameDefinition={phase.definition}
    >
      <GameScreen definition={phase.definition} onBack={handleBack} />
    </PlatformProvider>
  );
};
