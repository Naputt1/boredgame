import type { GameDefinition } from "@boredgame/core";
import { ticTacToeActionSchema } from "./actions";
import type { TicTacToeAction } from "./actions";
import { createInitialState, TicTacToeState } from "./state";
import { ticTacToeReducer } from "./reducer";
import { TicTacToeView } from "./TicTacToeView";
import { validateAuthoritativeAction, type ValidationResult } from "./serverValidation";

export type { TicTacToeState } from "./state";
export type { TicTacToeAction } from "./actions";
export type {
  PlacePieceAction,
  JoinGameAction,
  ResetGameAction
} from "./actions";
export {
  ticTacToeActionSchema,
  placePieceActionSchema,
  joinGameActionSchema,
  resetGameActionSchema
} from "./actions";
export {
  createInitialState,
  computeWinner
} from "./state";
export {
  ticTacToeReducer,
  replayActions
} from "./reducer";
export { validateAuthoritativeAction, type ValidationResult };

export const ticTacToeDefinition: GameDefinition<TicTacToeState, TicTacToeAction> = {
  id: "boredgame-tictactoe",
  name: "Tic-Tac-Toe",
  version: {
    engine: "0.1.0",
    state: "1.0.0",
    actionSchema: "1.0.0"
  },
  metadata: {
    description: "Classic 3×3 Tic-Tac-Toe. Two players alternate placing X and O. Three in a row wins.",
    minPlayers: 1,
    maxPlayers: 2,
    tags: ["classic", "turn-based", "2-player"]
  },
  createInitialState,
  reducer: ticTacToeReducer,
  actionSchema: ticTacToeActionSchema,
  renderer: TicTacToeView,
  validateAction: validateAuthoritativeAction as (
    action: TicTacToeAction,
    state: TicTacToeState,
    playerId: string
  ) => { valid: true } | { valid: false; code: string; message: string }
};
