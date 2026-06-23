import { GameAction } from "../schemas/actions";
import { GameState } from "../core/state";
import { GameTransport, Unsubscribe } from "./GameTransport";

export class LocalTransport implements GameTransport {
  private actionListeners = new Set<(action: GameAction) => void>();
  private stateListeners = new Set<(state: GameState) => void>();
  private connectedRoomId: string | null = null;

  async connect(roomId: string): Promise<void> {
    this.connectedRoomId = roomId;
  }

  sendAction(action: GameAction): void {
    if (!this.connectedRoomId) {
      throw new Error("LocalTransport must connect before sending actions.");
    }

    this.actionListeners.forEach((listener) => listener(action));
  }

  sendState(state: GameState): void {
    if (!this.connectedRoomId) {
      throw new Error("LocalTransport must connect before sending state.");
    }

    this.stateListeners.forEach((listener) => listener(state));
  }

  onAction(callback: (action: GameAction) => void): Unsubscribe {
    this.actionListeners.add(callback);
    return () => this.actionListeners.delete(callback);
  }

  onStateUpdate(callback: (state: GameState) => void): Unsubscribe {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  disconnect(): void {
    this.connectedRoomId = null;
  }
}
