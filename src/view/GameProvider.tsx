import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { GameEngine, SyncMode, createGameEngine } from "../engine";
import { createInitialState, GameState } from "../core";
import { GameAction } from "../schemas";
import { GameTransport } from "../transport";

type GameProviderProps = {
  children: ReactNode;
  playerId: string;
  roomId: string;
  transport: GameTransport;
  syncMode?: SyncMode;
  initialState?: GameState;
};

type GameContextValue = {
  state: GameState;
  sendAction: (action: GameAction) => void;
  connected: boolean;
  playerId: string;
  roomId: string;
};

const GameContext = createContext<GameContextValue | null>(null);

export const GameProvider = ({
  children,
  playerId,
  roomId,
  transport,
  syncMode = "action",
  initialState
}: GameProviderProps) => {
  const initialStateRef = useRef(initialState ?? createInitialState());
  const [state, setState] = useState(initialStateRef.current);
  const [connected, setConnected] = useState(false);

  const engine = useMemo<GameEngine>(
    () =>
      createGameEngine({
        transport,
        syncMode,
        initialState: initialStateRef.current,
        middleware: [
          {
            onError: (error) => {
              console.error("Game engine error", error);
            }
          }
        ]
      }),
    [syncMode, transport]
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
      sendAction: engine.sendAction,
      connected,
      playerId,
      roomId
    }),
    [connected, engine.sendAction, playerId, roomId, state]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = (): GameContextValue => {
  const value = useContext(GameContext);

  if (!value) {
    throw new Error("useGame must be used inside GameProvider.");
  }

  return value;
};
