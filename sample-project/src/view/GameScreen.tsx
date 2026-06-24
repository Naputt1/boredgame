import { useEffect, useMemo } from "react";
import {
  createPlayerJoinedAction,
  createTokenMovedAction,
  createGameResetAction
} from "@boredgame/schemas";
import { BoardPosition } from "@boredgame/core";
import { useGame } from "@boredgame/react";
import { BoardStage } from "./BoardStage";

const playerPalette = ["#2563eb", "#dc2626", "#059669", "#d97706", "#7c3aed"];

const displayName = (
  playerId: string,
  participants: { id: string; username: string; globalName?: string }[]
): string => {
  const match = participants.find((p) => p.id === playerId);
  if (match) return match.globalName ?? match.username;
  return `Player ${playerId.slice(0, 4)}`;
};

export const GameScreen = () => {
  const { state, sendAction, connected, playerId, roomId, participants } = useGame();
  const ownToken = useMemo(
    () => Object.values(state.tokens).find((token) => token.ownerId === playerId),
    [playerId, state.tokens]
  );

  useEffect(() => {
    if (!connected || state.players[playerId]) {
      return;
    }

    const playerIndex = Object.keys(state.players).length % playerPalette.length;
    sendAction(
      createPlayerJoinedAction(
        playerId,
        displayName(playerId, participants),
        playerPalette[playerIndex],
        `token:${playerId}`,
        { x: playerIndex, y: playerIndex }
      )
    );
  }, [connected, playerId, sendAction, state.players, participants]);

  const moveToken = (to: BoardPosition) => {
    if (!ownToken) {
      return;
    }

    sendAction(createTokenMovedAction(playerId, ownToken.id, to));
  };

  const resetGame = () => {
    sendAction(createGameResetAction(playerId));
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
                <span>{displayName(player.id, participants)}</span>
              </li>
            ))}
          </ul>
          <h2>Tokens</h2>
          <ul>
            {Object.values(state.tokens).map((token) => (
              <li key={token.id}>
                <span>{displayName(token.ownerId, participants)}</span>
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
