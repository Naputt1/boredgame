import { GameState } from "../core/state";
import { GameAction } from "../schemas/actions";

export type Unsubscribe = () => void;

export interface GameTransport {
  connect(roomId: string): Promise<void>;
  sendAction(action: GameAction): void;
  sendState?(state: GameState): void;
  onAction?(callback: (action: GameAction) => void): Unsubscribe | void;
  onStateUpdate?(callback: (state: GameState) => void): Unsubscribe | void;
  disconnect?(): void | Promise<void>;
}
