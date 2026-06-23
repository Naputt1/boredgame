import { describe, expect, it, vi } from "vitest";
import { createGameEngine } from ".";
import { createInitialState, GameState } from "../core";
import { GAME_ACTION_VERSION, GameAction } from "../schemas";
import { LocalTransport } from "../transport";

const joinAction: GameAction = {
  type: "player.joined",
  version: GAME_ACTION_VERSION,
  payload: {
    playerId: "player-1",
    name: "Player 1",
    color: "#2563eb",
    tokenId: "token-1",
    startPosition: { x: 0, y: 0 }
  },
  meta: {
    playerId: "player-1",
    timestamp: 1,
    actionId: "join-1"
  }
};

describe("createGameEngine", () => {
  it("applies looped-back actions once in action mode", async () => {
    const transport = new LocalTransport();
    const engine = createGameEngine({ transport, syncMode: "action" });
    const listener = vi.fn();

    engine.subscribe(listener);
    await engine.connect("room-1");
    engine.sendAction(joinAction);

    expect(engine.getState().players["player-1"]?.name).toBe("Player 1");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("replaces local state from transport snapshots in state mode", async () => {
    const transport = new LocalTransport();
    const engine = createGameEngine({ transport, syncMode: "state" });
    const listener = vi.fn();
    const snapshot: GameState = {
      ...createInitialState(),
      players: {
        "server-player": {
          id: "server-player",
          name: "Server Player",
          color: "#059669"
        }
      }
    };

    engine.subscribe(listener);
    await engine.connect("room-1");
    transport.sendState(snapshot);

    expect(engine.getState().players["server-player"]?.name).toBe("Server Player");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("routes validation errors through middleware", async () => {
    const transport = new LocalTransport();
    const onError = vi.fn();
    const engine = createGameEngine({
      transport,
      syncMode: "action",
      middleware: [{ onError }]
    });

    await engine.connect("room-1");
    engine.sendAction({ ...joinAction, version: 999 } as unknown as GameAction);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(engine.getState()).toEqual(createInitialState());
  });
});
