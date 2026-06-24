import type { TicTacToeAction } from "./actions";
import { createInitialState, computeWinner } from "./state";
import type { TicTacToeState } from "./state";

const appendId = (state: TicTacToeState, actionId: string): string[] =>
  [...state.appliedActionIds, actionId];

export const ticTacToeReducer = (
  state: TicTacToeState,
  action: TicTacToeAction
): TicTacToeState => {
  if (state.appliedActionIds.includes(action.meta.actionId)) {
    return state;
  }

  switch (action.type) {
    case "place.piece": {
      if (state.winner) {
        return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
      }

      const { row, col, mark } = action.payload;

      if (state.currentPlayer !== mark) {
        return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
      }

      if (state.board[row][col] !== null) {
        return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
      }

      const newBoard = state.board.map((r) => [...r]) as typeof state.board;
      newBoard[row][col] = mark;

      const winner = computeWinner(newBoard);
      const nextPlayer = winner ? state.currentPlayer : (state.currentPlayer === "X" ? "O" : "X");

      return {
        ...state,
        board: newBoard,
        currentPlayer: nextPlayer,
        winner,
        appliedActionIds: appendId(state, action.meta.actionId)
      };
    }

    case "join.game": {
      const existing = Object.values(state.players).find(
        (p) => p.id === action.payload.playerId
      );
      if (existing) {
        return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
      }

      const takenMarks = new Set(Object.values(state.players).map((p) => p.mark));
      const mark = action.payload.preferredMark && !takenMarks.has(action.payload.preferredMark)
        ? action.payload.preferredMark
        : takenMarks.has("X") ? "O" : "X";

      return {
        ...state,
        players: {
          ...state.players,
          [action.payload.playerId]: {
            id: action.payload.playerId,
            mark,
            name: action.payload.name
          }
        },
        appliedActionIds: appendId(state, action.meta.actionId)
      };
    }

    case "reset.game": {
      return {
        ...createInitialState(),
        players: state.players,
        appliedActionIds: [action.meta.actionId]
      };
    }

    default:
      return { ...state, appliedActionIds: appendId(state, (action as TicTacToeAction).meta.actionId) };
  }
};

export const replayActions = (
  initialState: TicTacToeState,
  actions: readonly TicTacToeAction[]
): TicTacToeState =>
  actions.reduce<TicTacToeState>(
    (s, a) => ticTacToeReducer(s, a),
    initialState
  );
