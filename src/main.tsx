import React from "react";
import ReactDOM from "react-dom/client";
import { GameProvider, GameScreen } from "./view";
import { useDiscordContext } from "./platform/discord";
import { LocalTransport } from "./transport";
import "./styles.css";

const App = () => {
  const discord = useDiscordContext();
  const transport = React.useMemo(() => {
    return new LocalTransport();
    // Swap transport without changing UI or core game logic:
    // return new P2PTransport({ instanceId: discord.instanceId });
    // return new WebSocketTransport("wss://example.com/game");
  }, []);

  return (
    <GameProvider
      playerId={discord.userId}
      roomId={discord.instanceId}
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
  </React.StrictMode>
);
