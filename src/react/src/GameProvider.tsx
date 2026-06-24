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
import type { GameTransport } from "@boredgame/transport";

export type GameParticipant = {
  id: string;
  username: string;
  globalName?: string;
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
};

type GameContextValue = {
  state: unknown;
  sendAction: (action: unknown) => void;
  connected: boolean;
  playerId: string;
  roomId: string;
  participants: GameParticipant[];
};

const GameContext = createContext<GameContextValue | null>(null);

const createLoggingMiddleware = (): GameEngineMiddleware => ({
  onError: (error) => {
    console.error("Game engine error", error);
  }
});

export const GameProvider = <TState, TAction>({
  children,
  definition,
  playerId,
  roomId,
  transport,
  syncMode = "action",
  initialState,
  participants = []
}: GameProviderProps<TState, TAction>) => {
  const initialStateRef = useRef(initialState ?? definition.createInitialState());
  const [state, setState] = useState(initialStateRef.current);
  const [connected, setConnected] = useState(false);

  const engine = useMemo<GameEngine<TState, TAction>>(
    () =>
      createGameEngine({
        transport,
        definition,
        syncMode,
        initialState: initialStateRef.current,
        middleware: [createLoggingMiddleware()]
      }),
    [syncMode, transport, definition]
  );

  useEffect(() => {
    const unsubscribe = engine.subscribe(setState);
    let cancelled = false;

    engine
      .connect(roomId)
      .then(() => {
        if (!cancelled) {
          setConnected(true);
        }
      })
      .catch((error) => {
        console.error("Failed to connect game engine", error);
      });

    return () => {
      cancelled = true;
      setConnected(false);
      unsubscribe();
      void engine.disconnect();
    };
  }, [engine, roomId]);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      sendAction: engine.sendAction as (action: unknown) => void,
      connected,
      playerId,
      roomId,
      participants
    }),
    [connected, engine.sendAction, playerId, roomId, state, participants]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = <TState = unknown, TAction = unknown>(): {
  state: TState;
  sendAction: (action: TAction) => void;
  connected: boolean;
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
    playerId: string;
    roomId: string;
    participants: GameParticipant[];
  };
};
