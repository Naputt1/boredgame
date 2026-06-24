import type { GameDefinition } from "@boredgame/core";
import { demoGameActionSchema } from "./actions";
import type { DemoGameAction } from "./actions";
import { createInitialState, DemoGameState } from "./state";
import { demoGameReducer } from "./reducer";
import { DemoGameView } from "./DemoGameView";

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

export { validateAuthoritativeAction } from "./serverValidation";
export type { ValidationResult } from "./serverValidation";

export const demoGameDefinition: GameDefinition<DemoGameState, DemoGameAction> = {
  id: "boredgame-demo",
  name: "Boredgame Demo",
  createInitialState,
  reducer: demoGameReducer,
  actionSchema: demoGameActionSchema,
  renderer: DemoGameView
};
