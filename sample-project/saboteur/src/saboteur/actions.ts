import { z } from "zod";

export const GAME_ACTION_VERSION = 1;

const actionMetaSchema = z.object({
  playerId: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  actionId: z.string().min(1),
});

export const joinGameActionSchema = z.object({
  type: z.literal("join.game"),
  version: z.literal(GAME_ACTION_VERSION),
  payload: z.object({
    playerId: z.string().min(1),
    name: z.string().min(1),
  }),
  meta: actionMetaSchema,
});

export const startGameActionSchema = z.object({
  type: z.literal("start.game"),
  version: z.literal(GAME_ACTION_VERSION),
  payload: z.object({}),
  meta: actionMetaSchema,
});

const rotationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);

export const playPathActionSchema = z.object({
  type: z.literal("play.path"),
  version: z.literal(GAME_ACTION_VERSION),
  payload: z.object({
    cardId: z.string().min(1),
    col: z.number().int(),
    row: z.number().int(),
    rotation: rotationSchema,
  }),
  meta: actionMetaSchema,
});

export const playActionSchema = z.object({
  type: z.literal("play.action"),
  version: z.literal(GAME_ACTION_VERSION),
  payload: z.object({
    cardId: z.string().min(1),
    targetPlayerId: z.string().optional(),
    // For rockfall: which path card to remove
    targetCol: z.number().int().optional(),
    targetRow: z.number().int().optional(),
    // For repair-dual: which specific type to repair
    repairType: z.enum(["pickaxe", "lantern", "wagon"]).optional(),
  }),
  meta: actionMetaSchema,
});

export const discardCardActionSchema = z.object({
  type: z.literal("discard.card"),
  version: z.literal(GAME_ACTION_VERSION),
  payload: z.object({
    cardId: z.string().min(1),
  }),
  meta: actionMetaSchema,
});

export const collectGoldActionSchema = z.object({
  type: z.literal("collect.gold"),
  version: z.literal(GAME_ACTION_VERSION),
  payload: z.object({}),
  meta: actionMetaSchema,
});

export const resetGameActionSchema = z.object({
  type: z.literal("reset.game"),
  version: z.literal(GAME_ACTION_VERSION),
  payload: z.object({}).strict(),
  meta: actionMetaSchema,
});

export const saboteurActionSchema = z.discriminatedUnion("type", [
  joinGameActionSchema,
  startGameActionSchema,
  playPathActionSchema,
  playActionSchema,
  discardCardActionSchema,
  collectGoldActionSchema,
  resetGameActionSchema,
]);

export type JoinGameAction = z.infer<typeof joinGameActionSchema>;
export type StartGameAction = z.infer<typeof startGameActionSchema>;
export type PlayPathAction = z.infer<typeof playPathActionSchema>;
export type PlayActionAction = z.infer<typeof playActionSchema>;
export type DiscardCardAction = z.infer<typeof discardCardActionSchema>;
export type CollectGoldAction = z.infer<typeof collectGoldActionSchema>;
export type ResetGameAction = z.infer<typeof resetGameActionSchema>;
export type SaboteurAction =
  | JoinGameAction
  | StartGameAction
  | PlayPathAction
  | PlayActionAction
  | DiscardCardAction
  | CollectGoldAction
  | ResetGameAction;
