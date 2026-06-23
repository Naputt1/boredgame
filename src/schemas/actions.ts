import { z } from "zod";

export const GAME_ACTION_VERSION = 1;

const actionMetaSchema = z.object({
  playerId: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  actionId: z.string().min(1)
});

const positionSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative()
});

export const playerJoinedActionSchema = z.object({
  type: z.literal("player.joined"),
  version: z.literal(GAME_ACTION_VERSION),
  payload: z.object({
    playerId: z.string().min(1),
    name: z.string().min(1),
    color: z.string().min(1),
    tokenId: z.string().min(1),
    startPosition: positionSchema
  }),
  meta: actionMetaSchema
});

export const tokenMovedActionSchema = z.object({
  type: z.literal("token.moved"),
  version: z.literal(GAME_ACTION_VERSION),
  payload: z.object({
    tokenId: z.string().min(1),
    to: positionSchema
  }),
  meta: actionMetaSchema
});

export const gameResetActionSchema = z.object({
  type: z.literal("game.reset"),
  version: z.literal(GAME_ACTION_VERSION),
  payload: z.object({}).strict(),
  meta: actionMetaSchema
});

export const gameActionSchema = z.discriminatedUnion("type", [
  playerJoinedActionSchema,
  tokenMovedActionSchema,
  gameResetActionSchema
]);

export type PlayerJoinedAction = z.infer<typeof playerJoinedActionSchema>;
export type TokenMovedAction = z.infer<typeof tokenMovedActionSchema>;
export type GameResetAction = z.infer<typeof gameResetActionSchema>;
export type GameAction = z.infer<typeof gameActionSchema>;

export const parseGameAction = (action: unknown): GameAction =>
  gameActionSchema.parse(action);

export const isGameAction = (action: unknown): action is GameAction =>
  gameActionSchema.safeParse(action).success;
