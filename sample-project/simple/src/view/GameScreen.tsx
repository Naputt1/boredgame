import { useGame, LobbyView } from "@boredgame/react";
import { ConnectionBanner } from "./ConnectionBanner";

type GameScreenProps = {
  definition: any;
  onBack: () => void;
};

export const GameScreen = ({ definition, onBack }: GameScreenProps) => {
  const {
    state,
    sendAction,
    connected,
    connectionStatus,
    playerId,
    roomId,
    participants,
    roomStatus
  } = useGame();

  if (roomStatus === "lobby" || roomStatus === "starting") {
    return (
      <LobbyView
        gameName={definition.name}
        minPlayers={definition.metadata.minPlayers}
        onBack={onBack}
      />
    );
  }

  const Renderer = definition.renderer;

  return (
    <>
      <ConnectionBanner connectionStatus={connectionStatus} />
      <main className="app-shell">
        <section className="game-toolbar" aria-label="Game controls">
          <div>
            <p className="eyebrow">{definition.metadata.description}</p>
            <h1>{definition.name}</h1>
          </div>
          <div className="toolbar-meta">
            <button type="button" onClick={onBack} style={{ fontSize: 12, padding: "4px 12px" }}>
              Back to games
            </button>
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
    </>
  );
};
