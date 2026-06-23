import { GameState } from "@boredgame/core";
import { GameAction } from "@boredgame/schemas";
import { GameTransport, Unsubscribe } from "./GameTransport";

export type P2PTransportOptions = {
  instanceId: string;
};

export class P2PTransport implements GameTransport {
  private actionListeners = new Set<(action: GameAction) => void>();
  private stateListeners = new Set<(state: GameState) => void>();
  private roomId: string | null = null;

  constructor(private readonly options: P2PTransportOptions) {}

  async connect(roomId = this.options.instanceId): Promise<void> {
    this.roomId = roomId;
    // Template boundary: wire Discord instance-scoped WebRTC signaling here.
  }

  sendAction(action: GameAction): void {
    if (!this.roomId) {
      throw new Error("P2PTransport must connect before sending actions.");
    }

    // Template boundary: broadcast serialized action to peers here.
    this.actionListeners.forEach((listener) => listener(action));
  }

  sendState(state: GameState): void {
    if (!this.roomId) {
      throw new Error("P2PTransport must connect before sending state.");
    }

    // Template boundary: send late-join or recovery snapshots here.
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
    this.roomId = null;
  }
}
