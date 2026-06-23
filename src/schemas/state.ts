import { z } from "zod";

export const gameStateSchema = z.object({
  version: z.number().int().positive(),
  board: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive()
  }),
  players: z.record(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      color: z.string().min(1)
    })
  ),
  tokens: z.record(
    z.object({
      id: z.string().min(1),
      ownerId: z.string().min(1),
      position: z.object({
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative()
      })
    })
  ),
  appliedActionIds: z.array(z.string().min(1))
});

export const parseGameState = (state: unknown) => gameStateSchema.parse(state);
