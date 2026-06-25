import type { DemoGameAction } from './actions'
import { createInitialState, isInsideBoard } from './state'
import type { DemoGameState } from './state'

const appendAppliedActionId = (
  state: DemoGameState,
  actionId: string
): string[] => [...state.appliedActionIds, actionId]

export const demoGameReducer = (
  state: DemoGameState,
  action: DemoGameAction
): DemoGameState => {
  if (state.appliedActionIds.includes(action.meta.actionId)) {
    return state
  }

  switch (action.type) {
    case 'player.joined': {
      if (!isInsideBoard(state.board, action.payload.startPosition)) {
        return {
          ...state,
          appliedActionIds: appendAppliedActionId(state, action.meta.actionId),
        }
      }

      const player = {
        id: action.payload.playerId,
        name: action.payload.name,
        color: action.payload.color,
      }

      const token = {
        id: action.payload.tokenId,
        ownerId: action.payload.playerId,
        position: action.payload.startPosition,
      }

      return {
        ...state,
        players: {
          ...state.players,
          [player.id]: player,
        },
        tokens: {
          ...state.tokens,
          [token.id]: token,
        },
        appliedActionIds: appendAppliedActionId(state, action.meta.actionId),
      }
    }

    case 'token.moved': {
      const token = state.tokens[action.payload.tokenId]

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!token || !isInsideBoard(state.board, action.payload.to)) {
        return {
          ...state,
          appliedActionIds: appendAppliedActionId(state, action.meta.actionId),
        }
      }

      return {
        ...state,
        tokens: {
          ...state.tokens,
          [token.id]: {
            ...token,
            position: action.payload.to,
          },
        },
        appliedActionIds: appendAppliedActionId(state, action.meta.actionId),
      }
    }

    case 'game.reset': {
      return {
        ...createInitialState(),
        appliedActionIds: [action.meta.actionId],
      }
    }
  }
}

export const replayActions = (
  initialState: DemoGameState,
  actions: readonly DemoGameAction[]
): DemoGameState =>
  actions.reduce<DemoGameState>(
    (state, action) => demoGameReducer(state, action),
    initialState
  )
