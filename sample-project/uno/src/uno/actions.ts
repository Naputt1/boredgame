import { z } from 'zod'

export const GAME_ACTION_VERSION = 1

const actionMetaSchema = z.object({
  playerId: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  actionId: z.string().min(1),
})

export const joinGameActionSchema = z.object({
  type: z.literal('join.game'),
  version: z.literal(GAME_ACTION_VERSION),
  payload: z.object({
    playerId: z.string().min(1),
    name: z.string().min(1),
  }),
  meta: actionMetaSchema,
})

export const startGameActionSchema = z.object({
  type: z.literal('start.game'),
  version: z.literal(GAME_ACTION_VERSION),
  payload: z.object({}),
  meta: actionMetaSchema,
})

const unoColorSchema = z.enum(['red', 'yellow', 'green', 'blue'])

export const playCardActionSchema = z.object({
  type: z.literal('play.card'),
  version: z.literal(GAME_ACTION_VERSION),
  payload: z.object({
    cardId: z.string().min(1),
    chosenColor: unoColorSchema.optional(),
  }),
  meta: actionMetaSchema,
})

export const drawCardActionSchema = z.object({
  type: z.literal('draw.card'),
  version: z.literal(GAME_ACTION_VERSION),
  payload: z.object({}),
  meta: actionMetaSchema,
})

export const callUnoActionSchema = z.object({
  type: z.literal('call.uno'),
  version: z.literal(GAME_ACTION_VERSION),
  payload: z.object({}),
  meta: actionMetaSchema,
})

export const resetGameActionSchema = z.object({
  type: z.literal('reset.game'),
  version: z.literal(GAME_ACTION_VERSION),
  payload: z.object({}).strict(),
  meta: actionMetaSchema,
})

export const unoActionSchema = z.discriminatedUnion('type', [
  joinGameActionSchema,
  startGameActionSchema,
  playCardActionSchema,
  drawCardActionSchema,
  callUnoActionSchema,
  resetGameActionSchema,
])

export type JoinGameAction = z.infer<typeof joinGameActionSchema>
export type StartGameAction = z.infer<typeof startGameActionSchema>
export type PlayCardAction = z.infer<typeof playCardActionSchema>
export type DrawCardAction = z.infer<typeof drawCardActionSchema>
export type CallUnoAction = z.infer<typeof callUnoActionSchema>
export type ResetGameAction = z.infer<typeof resetGameActionSchema>
export type UnoAction =
  | JoinGameAction
  | StartGameAction
  | PlayCardAction
  | DrawCardAction
  | CallUnoAction
  | ResetGameAction
