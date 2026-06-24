import type { GameDefinition } from "@boredgame/core";
import { demoGameActionSchema } from "./actions";
import type { DemoGameAction } from "./actions";
import { createInitialState, DemoGameState } from "./state";
import { demoGameReducer } from "./reducer";
import { DemoGameView } from "./DemoGameView";
import { validateAuthoritativeAction, type ValidationResult } from "./serverValidation";

export type { DemoGameState } from "./state";
export type { DemoGameAction } from "./actions";
export type {
  PlayerJoinedAction,
  TokenMovedAction,
  GameResetAction
} from "./actions";
export {
  demoGameActionSchema,
  playerJoinedActionSchema,
  tokenMovedActionSchema,
  gameResetActionSchema
} from "./actions";
export {
  createPlayerJoinedAction,
  createTokenMovedAction,
  createGameResetAction
} from "./actionFactory";
export {
  createInitialState,
  isInsideBoard
} from "./state";
export {
  demoGameReducer,
  replayActions
} from "./reducer";
export type {
  PlayerId,
  BoardSize,
  BoardPosition,
  Player,
  Token
} from "./state";

export { validateAuthoritativeAction, type ValidationResult };

export const demoGameDefinition: GameDefinition<DemoGameState, DemoGameAction> = {
  id: "boredgame-demo",
  name: "Boredgame Demo",
  version: {
    engine: "0.1.0",
    state: "1.0.0",
    actionSchema: "1.0.0"
  },
  metadata: {
    description: "A multiplayer board game on a shared 8×8 grid. Place your token and move around the board.",
    minPlayers: 1,
    maxPlayers: 5,
    tags: ["board", "multiplayer"]
  },
  createInitialState,
  reducer: demoGameReducer,
  actionSchema: demoGameActionSchema,
  renderer: DemoGameView,
  validateAction: validateAuthoritativeAction as (
    action: DemoGameAction,
    state: DemoGameState,
    playerId: string
  ) => { valid: true } | { valid: false; code: string; message: string }
};
