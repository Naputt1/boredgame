import { describe, expect, it } from "vitest";
import { createInitialState, gameReducer, replayActions } from ".";
import { GAME_ACTION_VERSION, GameAction } from "../schemas";

const meta = (actionId: string, playerId = "player-1"): GameAction["meta"] => ({
  playerId,
  timestamp: 1,
  actionId
});

const joinAction = (actionId = "join-1"): GameAction => ({
  type: "player.joined",
  version: GAME_ACTION_VERSION,
  payload: {
    playerId: "player-1",
    name: "Player 1",
    color: "#2563eb",
    tokenId: "token-1",
    startPosition: { x: 0, y: 0 }
  },
  meta: meta(actionId)
});

const moveAction = (actionId = "move-1", x = 2, y = 3): GameAction => ({
  type: "token.moved",
  version: GAME_ACTION_VERSION,
  payload: {
    tokenId: "token-1",
    to: { x, y }
  },
  meta: meta(actionId)
});

describe("gameReducer", () => {
  it("joins players immutably", () => {
    const initialState = createInitialState();
    const nextState = gameReducer(initialState, joinAction());

    expect(nextState).not.toBe(initialState);
    expect(initialState.players).toEqual({});
    expect(nextState.players["player-1"]?.name).toBe("Player 1");
    expect(nextState.tokens["token-1"]?.position).toEqual({ x: 0, y: 0 });
  });

  it("moves tokens within board bounds", () => {
    const joined = gameReducer(createInitialState(), joinAction());
    const moved = gameReducer(joined, moveAction());

    expect(moved.tokens["token-1"]?.position).toEqual({ x: 2, y: 3 });
  });

  it("records but ignores out-of-bounds moves", () => {
    const joined = gameReducer(createInitialState(), joinAction());
    const moved = gameReducer(joined, moveAction("move-out", 99, 99));

    expect(moved.tokens["token-1"]?.position).toEqual({ x: 0, y: 0 });
    expect(moved.appliedActionIds).toContain("move-out");
  });

  it("does not apply duplicate action ids twice", () => {
    const joined = gameReducer(createInitialState(), joinAction());
    const moved = gameReducer(joined, moveAction("duplicate", 1, 1));
    const duplicate = gameReducer(moved, moveAction("duplicate", 4, 4));

    expect(duplicate).toBe(moved);
    expect(duplicate.tokens["token-1"]?.position).toEqual({ x: 1, y: 1 });
  });

  it("replays action history deterministically", () => {
    const actions = [joinAction(), moveAction("move-1", 4, 5)];
    const firstReplay = replayActions(createInitialState(), actions);
    const secondReplay = replayActions(createInitialState(), actions);

    expect(firstReplay).toEqual(secondReplay);
  });

  it("resets to initial state and records reset action", () => {
    const joined = gameReducer(createInitialState(), joinAction());
    const reset = gameReducer(joined, {
      type: "game.reset",
      version: GAME_ACTION_VERSION,
      payload: {},
      meta: meta("reset-1")
    });

    expect(reset.players).toEqual({});
    expect(reset.tokens).toEqual({});
    expect(reset.appliedActionIds).toEqual(["reset-1"]);
  });
});
