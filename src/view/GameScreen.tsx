import { useEffect, useMemo } from "react";
import { GAME_ACTION_VERSION, GameAction } from "../schemas";
import { BoardPosition } from "../core";
import { BoardStage } from "./BoardStage";
import { useGame } from "./GameProvider";

const playerPalette = ["#2563eb", "#dc2626", "#059669", "#d97706", "#7c3aed"];

const createActionMeta = (playerId: string): GameAction["meta"] => ({
  playerId,
  timestamp: Date.now(),
  actionId: window.crypto?.randomUUID?.() ?? `${playerId}-${Date.now()}-${Math.random()}`
});

const playerName = (playerId: string): string => `Player ${playerId.slice(0, 4)}`;

export const GameScreen = () => {
  const { state, sendAction, connected, playerId, roomId } = useGame();
  const ownToken = useMemo(
    () => Object.values(state.tokens).find((token) => token.ownerId === playerId),
    [playerId, state.tokens]
  );

  useEffect(() => {
    if (!connected || state.players[playerId]) {
      return;
    }

    const playerIndex = Object.keys(state.players).length % playerPalette.length;
    sendAction({
      type: "player.joined",
      version: GAME_ACTION_VERSION,
      payload: {
        playerId,
        name: playerName(playerId),
        color: playerPalette[playerIndex],
        tokenId: `token:${playerId}`,
        startPosition: { x: playerIndex, y: playerIndex }
      },
      meta: createActionMeta(playerId)
    });
  }, [connected, playerId, sendAction, state.players]);

  const moveToken = (to: BoardPosition) => {
    if (!ownToken) {
      return;
    }

    sendAction({
      type: "token.moved",
      version: GAME_ACTION_VERSION,
      payload: {
        tokenId: ownToken.id,
        to
      },
      meta: createActionMeta(playerId)
    });
  };

  const resetGame = () => {
    sendAction({
      type: "game.reset",
      version: GAME_ACTION_VERSION,
      payload: {},
      meta: createActionMeta(playerId)
    });
  };

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
          <button type="button" onClick={resetGame}>
            Reset
          </button>
        </div>
      </section>

      <section className="play-surface">
        <BoardStage state={state} onCellSelect={moveToken} />
        <aside className="status-panel">
          <h2>Players</h2>
          <ul>
            {Object.values(state.players).map((player) => (
              <li key={player.id}>
                <span
                  className="player-swatch"
                  style={{ backgroundColor: player.color }}
                />
                <span>{player.name}</span>
              </li>
            ))}
          </ul>
          <h2>Tokens</h2>
          <ul>
            {Object.values(state.tokens).map((token) => (
              <li key={token.id}>
                <span>{state.players[token.ownerId]?.name ?? token.ownerId}</span>
                <span className="token-position">
                  {token.position.x}, {token.position.y}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </main>
  );
};
