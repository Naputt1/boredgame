import { demoGameDefinition } from "@boredgame/demo-game";
import type { DemoGameState, DemoGameAction } from "@boredgame/demo-game";
import { useGame } from "@boredgame/react";
import { DevtoolsPanel } from "@boredgame/devtools";
import type { ActionLog } from "@boredgame/devtools";
import { ConnectionBanner } from "./ConnectionBanner";

type GameScreenProps = {
  actionLog: ActionLog<DemoGameAction>;
};

export const GameScreen = ({ actionLog }: GameScreenProps) => {
  const {
    state,
    sendAction,
    connected,
    connectionStatus,
    playerId,
    roomId,
    participants
  } = useGame<DemoGameState, DemoGameAction>();

  const Renderer = demoGameDefinition.renderer;

  return (
    <>
      <ConnectionBanner connectionStatus={connectionStatus} />
      <main className="app-shell">
        <section className="game-toolbar" aria-label="Game controls">
          <div>
            <p className="eyebrow">Discord-ready board framework</p>
            <h1>Boredgame</h1>
          </div>
          <div className="toolbar-meta">
            <span>
              {connectionStatus.state === "connected"
                ? "Connected"
                : connectionStatus.state === "reconnecting"
                  ? "Reconnecting"
                  : "Connecting"}
            </span>
            <span>Room {roomId.slice(0, 8)}</span>
          </div>
        </section>

        <Renderer
          state={state}
          playerId={playerId}
          sendAction={sendAction}
          participants={participants}
          connected={connected}
        />
      </main>

      {import.meta.env.DEV && (
        <DevtoolsPanel
          actionLog={actionLog}
          reducer={demoGameDefinition.reducer as (state: unknown, action: DemoGameAction) => unknown}
          createInitialState={demoGameDefinition.createInitialState as () => unknown}
        />
      )}
    </>
  );
};
