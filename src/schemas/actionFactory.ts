import { GAME_ACTION_VERSION } from "./actions";
import type {
  PlayerJoinedAction,
  TokenMovedAction,
  GameResetAction,
  GameAction
} from "./actions";

const makeActionId = (playerId: string): string =>
  window.crypto?.randomUUID?.() ?? `${playerId}-${Date.now()}-${Math.random()}`;

export const createActionMeta = (playerId: string): GameAction["meta"] => ({
  playerId,
  timestamp: Date.now(),
  actionId: makeActionId(playerId)
});

export const createPlayerJoinedAction = (
  playerId: string,
  name: string,
  color: string,
  tokenId: string,
  startPosition: { x: number; y: number }
): PlayerJoinedAction => ({
  type: "player.joined",
  version: GAME_ACTION_VERSION,
  payload: { playerId, name, color, tokenId, startPosition },
  meta: createActionMeta(playerId)
});

export const createTokenMovedAction = (
  playerId: string,
  tokenId: string,
  to: { x: number; y: number }
): TokenMovedAction => ({
  type: "token.moved",
  version: GAME_ACTION_VERSION,
  payload: { tokenId, to },
  meta: createActionMeta(playerId)
});

export const createGameResetAction = (playerId: string): GameResetAction => ({
  type: "game.reset",
  version: GAME_ACTION_VERSION,
  payload: {},
  meta: createActionMeta(playerId)
});
