import type { TicTacToeState } from './state'
import type { TicTacToeAction } from './actions'

export type ValidationResult =
  | { valid: true }
  | { valid: false; code: string; message: string }

export const validateAuthoritativeAction = (
  action: TicTacToeAction,
  state: TicTacToeState,
  senderPlayerId: string
): ValidationResult => {
  switch (action.type) {
    case 'place.piece': {
      const player = Object.values(state.players).find(
        (p) => p.id === senderPlayerId
      )
      if (!player) {
        return {
          valid: false,
          code: 'NOT_IN_GAME',
          message: 'You must join the game first.',
        }
      }

      if (player.mark !== action.payload.mark) {
        return {
          valid: false,
          code: 'WRONG_MARK',
          message: "That's not your mark.",
        }
      }

      if (state.currentPlayer !== player.mark) {
        return {
          valid: false,
          code: 'NOT_YOUR_TURN',
          message: 'Wait for your turn.',
        }
      }

      if (state.board[action.payload.row][action.payload.col] !== null) {
        return {
          valid: false,
          code: 'CELL_TAKEN',
          message: 'That cell is already taken.',
        }
      }

      return { valid: true }
    }

    case 'join.game': {
      const playerCount = Object.keys(state.players).length
      if (playerCount >= 2) {
        return {
          valid: false,
          code: 'GAME_FULL',
          message: 'Game is full (max 2 players).',
        }
      }
      return { valid: true }
    }

    case 'reset.game': {
      return { valid: true }
    }

    default:
      return {
        valid: false,
        code: 'UNKNOWN_ACTION',
        message: 'Unknown action type.',
      }
  }
}
