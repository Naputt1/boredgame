import { GameAction } from "@boredgame/schemas";
import { createInitialState, GameState, isInsideBoard } from "./state";

const appendAppliedActionId = (
  state: GameState,
  actionId: string
): string[] => [...state.appliedActionIds, actionId];

export const gameReducer = (
  state: GameState,
  action: GameAction
): GameState => {
  if (state.appliedActionIds.includes(action.meta.actionId)) {
    return state;
  }

  switch (action.type) {
    case "player.joined": {
      if (!isInsideBoard(state.board, action.payload.startPosition)) {
        return {
          ...state,
          appliedActionIds: appendAppliedActionId(state, action.meta.actionId)
        };
      }

      const player = {
        id: action.payload.playerId,
        name: action.payload.name,
        color: action.payload.color
      };

      const token = {
        id: action.payload.tokenId,
        ownerId: action.payload.playerId,
        position: action.payload.startPosition
      };

      return {
        ...state,
        players: {
          ...state.players,
          [player.id]: player
        },
        tokens: {
          ...state.tokens,
          [token.id]: token
        },
        appliedActionIds: appendAppliedActionId(state, action.meta.actionId)
      };
    }

    case "token.moved": {
      const token = state.tokens[action.payload.tokenId];

      if (!token || !isInsideBoard(state.board, action.payload.to)) {
        return {
          ...state,
          appliedActionIds: appendAppliedActionId(state, action.meta.actionId)
        };
      }

      return {
        ...state,
        tokens: {
          ...state.tokens,
          [token.id]: {
            ...token,
            position: action.payload.to
          }
        },
        appliedActionIds: appendAppliedActionId(state, action.meta.actionId)
      };
    }

    case "game.reset": {
      return {
        ...createInitialState(),
        appliedActionIds: [action.meta.actionId]
      };
    }
  }
};

export const replayActions = (
  initialState: GameState,
  actions: readonly GameAction[]
): GameState =>
  actions.reduce<GameState>(
    (state, action) => gameReducer(state, action),
    initialState
  );
