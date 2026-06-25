import { z } from 'zod'

export const GAME_ACTION_VERSION = 1

const actionMetaSchema = z.object({
  playerId: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  actionId: z.string().min(1),
})

export const placePieceActionSchema = z.object({
  type: z.literal('place.piece'),
  version: z.literal(GAME_ACTION_VERSION),
  payload: z.object({
    row: z.number().int().min(0).max(2),
    col: z.number().int().min(0).max(2),
    mark: z.enum(['X', 'O']),
  }),
  meta: actionMetaSchema,
})

export const joinGameActionSchema = z.object({
  type: z.literal('join.game'),
  version: z.literal(GAME_ACTION_VERSION),
  payload: z.object({
    playerId: z.string().min(1),
    name: z.string().min(1),
    preferredMark: z.enum(['X', 'O']).optional(),
  }),
  meta: actionMetaSchema,
})

export const resetGameActionSchema = z.object({
  type: z.literal('reset.game'),
  version: z.literal(GAME_ACTION_VERSION),
  payload: z.object({}).strict(),
  meta: actionMetaSchema,
})

export const ticTacToeActionSchema = z.discriminatedUnion('type', [
  placePieceActionSchema,
  joinGameActionSchema,
  resetGameActionSchema,
])

export type PlacePieceAction = z.infer<typeof placePieceActionSchema>
export type JoinGameAction = z.infer<typeof joinGameActionSchema>
export type ResetGameAction = z.infer<typeof resetGameActionSchema>
export type TicTacToeAction = z.infer<typeof ticTacToeActionSchema>
