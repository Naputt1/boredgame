import { describe, expect, it } from "vitest";
import { GAME_ACTION_VERSION, GameAction, gameActionSchema } from ".";

describe("gameActionSchema", () => {
  it("accepts a valid action and infers GameAction", () => {
    const parsed: GameAction = gameActionSchema.parse({
      type: "token.moved",
      version: GAME_ACTION_VERSION,
      payload: {
        tokenId: "token-1",
        to: { x: 1, y: 2 }
      },
      meta: {
        playerId: "player-1",
        timestamp: 10,
        actionId: "action-1"
      }
    });

    expect(parsed.type).toBe("token.moved");
  });

  it("rejects malformed incoming actions", () => {
    expect(() =>
      gameActionSchema.parse({
        type: "token.moved",
        version: GAME_ACTION_VERSION,
        payload: {
          tokenId: "",
          to: { x: -1, y: 2 }
        },
        meta: {
          playerId: "player-1",
          timestamp: 10,
          actionId: "action-1"
        }
      })
    ).toThrow();
  });
});
