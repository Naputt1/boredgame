import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { GameDefinition, GameEngineMiddleware, SyncMode, RoomLifecycleState, PlayerSlot } from "@boredgame/core";
import { createGameEngine } from "@boredgame/engine";
import type { GameEngine } from "@boredgame/engine";
import type { GameTransport, ConnectionState, RoomStateData } from "@boredgame/transport";

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
  roomStatus: RoomLifecycleState | null;
  roomHostId: string | null;
  roomPlayers: PlayerSlot[];
  isSpectator: boolean;
  privateCode: string | undefined;
  startGame: () => void;
  leaveRoom: () => void;
  setReady: (ready: boolean) => void;
  setSpectate: (spectating: boolean) => void;
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
  syncMode = "state",
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
  const [roomStatus, setRoomStatus] = useState<RoomLifecycleState | null>(null);
  const [roomHostId, setRoomHostId] = useState<string | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<PlayerSlot[]>([]);
  const [privateCode, setPrivateCode] = useState<string | undefined>(undefined);

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

    if (transport.onRoomUpdate) {
      transport.onRoomUpdate((roomState: RoomStateData) => {
        if (!cancelled) {
          setRoomStatus(roomState.status as RoomLifecycleState);
          setRoomHostId(roomState.hostId);
          setRoomPlayers(roomState.players);
          setPrivateCode(roomState.privateCode);
        }
      });
    }

    if (transport.onHostChanged) {
      transport.onHostChanged((newHostId: string) => {
        if (!cancelled) {
          setRoomHostId(newHostId);
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
      setRoomStatus(null);
      setRoomHostId(null);
      setRoomPlayers([]);
      setPrivateCode(undefined);
      unsubscribe();
      void engine.disconnect();
    };
  }, [engine, roomId, transport]);

  const connected = connectionStatus.state === "connected";
  const isSpectator = roomPlayers.some(p => p.playerId === playerId && p.isSpectator);

  const startGame = useCallback(() => {
    if (transport.startGame) transport.startGame();
  }, [transport]);

  const leaveRoom = useCallback(() => {
    if (transport.leaveRoom) transport.leaveRoom();
  }, [transport]);

  const setReady = useCallback((ready: boolean) => {
    if (transport.setReady) transport.setReady(ready);
  }, [transport]);

  const setSpectateCallback = useCallback((spectating: boolean) => {
    if (transport.setSpectate) transport.setSpectate(spectating);
  }, [transport]);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      sendAction: engine.sendAction as (action: unknown) => void,
      connected,
      connectionStatus,
      playerId,
      roomId,
      participants,
      roomStatus,
      roomHostId,
      roomPlayers,
      isSpectator,
      privateCode,
      startGame,
      leaveRoom,
      setReady,
      setSpectate: setSpectateCallback
    }),
    [connected, connectionStatus, engine.sendAction, playerId, roomId, state, participants,
     roomStatus, roomHostId, roomPlayers, isSpectator, privateCode,
     startGame, leaveRoom, setReady, setSpectateCallback]
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
  roomStatus: RoomLifecycleState | null;
  roomHostId: string | null;
  roomPlayers: PlayerSlot[];
  isSpectator: boolean;
  privateCode: string | undefined;
  startGame: () => void;
  leaveRoom: () => void;
  setReady: (ready: boolean) => void;
  setSpectate: (spectating: boolean) => void;
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
    roomStatus: RoomLifecycleState | null;
    roomHostId: string | null;
    roomPlayers: PlayerSlot[];
    isSpectator: boolean;
    privateCode: string | undefined;
    startGame: () => void;
    leaveRoom: () => void;
    setReady: (ready: boolean) => void;
    setSpectate: (spectating: boolean) => void;
  };
};
