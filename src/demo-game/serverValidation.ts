import type { DemoGameAction } from './actions'
import type { DemoGameState } from './state'
import { isInsideBoard } from './state'

export type ValidationResult =
  | { valid: true }
  | { valid: false; code: string; message: string }

export function validateAuthoritativeAction(
  action: DemoGameAction,
  state: DemoGameState,
  playerId: string
): ValidationResult {
  if (state.appliedActionIds.includes(action.meta.actionId)) {
    return {
      valid: false,
      code: 'DUPLICATE_ACTION',
      message: 'Action already applied',
    }
  }

  switch (action.type) {
    case 'player.joined': {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (state.players[action.payload.playerId]) {
        return {
          valid: false,
          code: 'PLAYER_ALREADY_JOINED',
          message: 'Player is already in the game',
        }
      }
      if (!isInsideBoard(state.board, action.payload.startPosition)) {
        return {
          valid: false,
          code: 'INVALID_POSITION',
          message: 'Start position is outside the board',
        }
      }
      return { valid: true }
    }

    case 'token.moved': {
      const token = state.tokens[action.payload.tokenId]
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!token) {
        return {
          valid: false,
          code: 'TOKEN_NOT_FOUND',
          message: 'Token does not exist',
        }
      }
      if (token.ownerId !== playerId) {
        return {
          valid: false,
          code: 'NOT_YOUR_TOKEN',
          message: "Cannot move another player's token",
        }
      }
      if (!isInsideBoard(state.board, action.payload.to)) {
        return {
          valid: false,
          code: 'INVALID_POSITION',
          message: 'Target position is outside the board',
        }
      }
      return { valid: true }
    }

    case 'game.reset': {
      return { valid: true }
    }
  }
}
