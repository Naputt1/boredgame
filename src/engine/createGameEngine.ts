import { gameReducer, createInitialState, GameState } from "@boredgame/core";
import { GameAction, parseGameAction, parseGameState } from "@boredgame/schemas";
import { GameTransport, Unsubscribe } from "@boredgame/transport";

export type SyncMode = "action" | "state";

export type GameEngineMiddleware = {
  beforeSend?(action: GameAction, state: GameState): void;
  beforeApply?(action: GameAction, state: GameState): void;
  afterApply?(action: GameAction, state: GameState): void;
  onStateReplace?(state: GameState): void;
  onError?(error: unknown): void;
};

export type GameEngineOptions = {
  transport: GameTransport;
  syncMode: SyncMode;
  initialState?: GameState;
  middleware?: GameEngineMiddleware[];
};

export type GameEngine = {
  connect(roomId: string): Promise<void>;
  disconnect(): void | Promise<void>;
  getState(): GameState;
  subscribe(listener: (state: GameState) => void): Unsubscribe;
  sendAction(action: GameAction): void;
  replaceState(state: GameState): void;
};

export const createGameEngine = ({
  transport,
  syncMode,
  initialState = createInitialState(),
  middleware = []
}: GameEngineOptions): GameEngine => {
  let state = initialState;
  const listeners = new Set<(state: GameState) => void>();

  const notify = () => {
    listeners.forEach((listener) => listener(state));
  };

  const reportError = (error: unknown) => {
    middleware.forEach((entry) => entry.onError?.(error));
  };

  const applyAction = (unsafeAction: unknown) => {
    try {
      const action = parseGameAction(unsafeAction);
      middleware.forEach((entry) => entry.beforeApply?.(action, state));
      const nextState = gameReducer(state, action);

      if (nextState !== state) {
        state = nextState;
        middleware.forEach((entry) => entry.afterApply?.(action, state));
        notify();
      }
    } catch (error) {
      reportError(error);
    }
  };

  const replaceState = (unsafeState: GameState) => {
    try {
      state = parseGameState(unsafeState);
      middleware.forEach((entry) => entry.onStateReplace?.(state));
      notify();
    } catch (error) {
      reportError(error);
    }
  };

  if (transport.onAction) {
    transport.onAction((action) => {
      if (syncMode === "action") {
        applyAction(action);
      }
    });
  }

  if (transport.onStateUpdate) {
    transport.onStateUpdate((nextState) => {
      if (syncMode === "state") {
        replaceState(nextState);
      }
    });
  }

  return {
    connect: (roomId) => transport.connect(roomId),
    disconnect: () => transport.disconnect?.(),
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    sendAction: (unsafeAction) => {
      try {
        const action = parseGameAction(unsafeAction);
        middleware.forEach((entry) => entry.beforeSend?.(action, state));
        transport.sendAction(action);
      } catch (error) {
        reportError(error);
      }
    },
    replaceState
  };
};
