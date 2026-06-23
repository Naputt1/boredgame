import React from "react";
import ReactDOM from "react-dom/client";
import { GameProvider, GameScreen } from "./view";
import { WebSocketTransport } from "@boredgame/transport";
import "./styles.css";

const searchParams = new URLSearchParams(window.location.search);

const urlRoomId = searchParams.get("roomId") ?? undefined;
const urlUserId = searchParams.get("userId") ?? undefined;

const playerId =
  urlUserId ??
  window.localStorage.getItem("boredgame:local-user") ??
  globalThis.crypto?.randomUUID?.() ??
  `player-${Math.random().toString(36).slice(2)}`;

const roomId = urlRoomId ?? "default-room";

if (!urlUserId) {
  window.localStorage.setItem("boredgame:local-user", playerId);
}

const App = () => {
  const transport = React.useMemo(() => {
    return new WebSocketTransport({
      url: "ws://localhost:3001",
      playerId
    });
  }, []);

  return (
    <GameProvider
      playerId={playerId}
      roomId={roomId}
      transport={transport}
      syncMode="action"
    >
      <GameScreen />
    </GameProvider>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
