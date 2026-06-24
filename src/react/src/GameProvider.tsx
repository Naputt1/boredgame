import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { GameDefinition, GameEngineMiddleware, SyncMode } from "@boredgame/core";
import { createGameEngine } from "@boredgame/engine";
import type { GameEngine } from "@boredgame/engine";
import type { GameTransport, ConnectionState } from "@boredgame/transport";

export type GameParticipant = {
  id: string;
  username: string;
  globalName?: string;
};

export type ConnectionStatus = {
  state: ConnectionState;
  lastError: { code: string; message: string } | null;
};

type GameProviderProps<TState, TAction> = {
  children: ReactNode;
  definition: GameDefinition<TState, TAction>;
  playerId: string;
  roomId: string;
  transport: GameTransport;
  syncMode?: SyncMode;
  initialState?: TState;
  participants?: GameParticipant[];
  middleware?: GameEngineMiddleware[];
};

type GameContextValue = {
  state: unknown;
  sendAction: (action: unknown) => void;
  connected: boolean;
  connectionStatus: ConnectionStatus;
  playerId: string;
  roomId: string;
  participants: GameParticipant[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GameEngineContextValue = GameEngine<any, any> | null;

const GameContext = createContext<GameContextValue | null>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GameEngineContext = createContext<GameEngine<any, any> | null>(null);

const createLoggingMiddleware = (): GameEngineMiddleware => ({
  onError: (error) => {
    console.error("Game engine error", error);
  }
});

const EMPTY_MIDDLEWARE: GameEngineMiddleware[] = [];
const EMPTY_PARTICIPANTS: GameParticipant[] = [];

export const GameProvider = <TState, TAction>({
  children,
  definition,
  playerId,
  roomId,
  transport,
  syncMode = "action",
  initialState,
  participants = EMPTY_PARTICIPANTS,
  middleware = EMPTY_MIDDLEWARE
}: GameProviderProps<TState, TAction>) => {
  const initialStateRef = useRef(initialState ?? definition.createInitialState());
  const [state, setState] = useState(initialStateRef.current);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    state: "connecting",
    lastError: null
  });

  const engine = useMemo<GameEngine<TState, TAction>>(
    () => createGameEngine({
      transport,
      definition,
      syncMode,
      initialState: initialStateRef.current,
      middleware: [...middleware, createLoggingMiddleware()]
    }),
    [syncMode, transport, definition, middleware]
  );

  useEffect(() => {
    const unsubscribe = engine.subscribe(setState);
    let cancelled = false;

    if (transport.onConnectionStateChange) {
      transport.onConnectionStateChange((connState) => {
        if (!cancelled) {
          setConnectionStatus((prev) => ({ ...prev, state: connState }));
        }
      });
    }

    if (transport.onTransportError) {
      transport.onTransportError((error) => {
        if (!cancelled) {
          setConnectionStatus((prev) => ({ ...prev, lastError: error }));
        }
      });
    }

    engine
      .connect(roomId)
      .then(() => {
        if (!cancelled) {
          setConnectionStatus((prev) => ({ ...prev, state: "connected" }));
        }
      })
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : String(error);
        if (message !== "Connection cancelled") {
          console.error("Failed to connect game engine", error);
        }
        if (!cancelled) {
          setConnectionStatus((prev) => ({
            ...prev,
            state: "disconnected",
            lastError: { code: "CONNECT_FAILED", message }
          }));
        }
      });

    return () => {
      cancelled = true;
      setConnectionStatus({ state: "disconnected", lastError: null });
      unsubscribe();
      void engine.disconnect();
    };
  }, [engine, roomId, transport]);

  const connected = connectionStatus.state === "connected";

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      sendAction: engine.sendAction as (action: unknown) => void,
      connected,
      connectionStatus,
      playerId,
      roomId,
      participants
    }),
    [connected, connectionStatus, engine.sendAction, playerId, roomId, state, participants]
  );

  return (
    <GameEngineContext.Provider value={engine}>
      <GameContext.Provider value={value}>{children}</GameContext.Provider>
    </GameEngineContext.Provider>
  );
};

export const useGameEngine = <TState = unknown, TAction = unknown>(): GameEngine<TState, TAction> | null => {
  const ctx = useContext(GameEngineContext);
  return ctx as GameEngine<TState, TAction> | null;
};

export const useGame = <TState = unknown, TAction = unknown>(): {
  state: TState;
  sendAction: (action: TAction) => void;
  connected: boolean;
  connectionStatus: ConnectionStatus;
  playerId: string;
  roomId: string;
  participants: GameParticipant[];
} => {
  const value = useContext(GameContext);

  if (!value) {
    throw new Error("useGame must be used inside GameProvider.");
  }

  return value as {
    state: TState;
    sendAction: (action: TAction) => void;
    connected: boolean;
    connectionStatus: ConnectionStatus;
    playerId: string;
    roomId: string;
    participants: GameParticipant[];
  };
};
