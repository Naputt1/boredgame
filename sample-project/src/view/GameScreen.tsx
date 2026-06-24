import { demoGameDefinition } from "@boredgame/demo-game";
import type { DemoGameState, DemoGameAction } from "@boredgame/demo-game";
import { useGame } from "@boredgame/react";

export const GameScreen = () => {
  const { state, sendAction, connected, playerId, roomId, participants } =
    useGame<DemoGameState, DemoGameAction>();

  const Renderer = demoGameDefinition.renderer;

  return (
    <main className="app-shell">
      <section className="game-toolbar" aria-label="Game controls">
        <div>
          <p className="eyebrow">Discord-ready board framework</p>
          <h1>Boredgame</h1>
        </div>
        <div className="toolbar-meta">
          <span>{connected ? "Connected" : "Connecting"}</span>
          <span>Room {roomId.slice(0, 8)}</span>
        </div>
      </section>

      <Renderer
        state={state}
        playerId={playerId}
        sendAction={sendAction}
        participants={participants}
      />
    </main>
  );
};
