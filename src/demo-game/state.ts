export type PlayerId = string;

export type BoardSize = {
  width: number;
  height: number;
};

export type BoardPosition = {
  x: number;
  y: number;
};

export type Player = {
  id: PlayerId;
  name: string;
  color: string;
};

export type Token = {
  id: string;
  ownerId: PlayerId;
  position: BoardPosition;
};

export type DemoGameState = {
  version: number;
  board: BoardSize;
  players: Record<PlayerId, Player>;
  tokens: Record<string, Token>;
  appliedActionIds: string[];
};

export const GAME_STATE_VERSION = 1;

export const createInitialState = (): DemoGameState => ({
  version: GAME_STATE_VERSION,
  board: {
    width: 8,
    height: 8
  },
  players: {},
  tokens: {},
  appliedActionIds: []
});

export const isInsideBoard = (
  board: BoardSize,
  position: BoardPosition
): boolean =>
  position.x >= 0 &&
  position.y >= 0 &&
  position.x < board.width &&
  position.y < board.height;
