import { GameState } from "../core/state";
import { GameAction } from "../schemas/actions";
import { GameTransport, Unsubscribe } from "./GameTransport";

type ServerMessage =
  | { kind: "action"; action: GameAction }
  | { kind: "state"; state: GameState };

export class WebSocketTransport implements GameTransport {
  private socket: WebSocket | null = null;
  private actionListeners = new Set<(action: GameAction) => void>();
  private stateListeners = new Set<(state: GameState) => void>();

  constructor(private readonly url: string) {}

  async connect(roomId: string): Promise<void> {
    this.socket = new WebSocket(`${this.url}?roomId=${encodeURIComponent(roomId)}`);

    await new Promise<void>((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("WebSocket did not initialize."));
        return;
      }

      this.socket.onopen = () => resolve();
      this.socket.onerror = () => reject(new Error("WebSocket connection failed."));
      this.socket.onmessage = (event) => this.handleMessage(event.data);
    });
  }

  sendAction(action: GameAction): void {
    this.send({ kind: "action", action });
  }

  sendState(state: GameState): void {
    this.send({ kind: "state", state });
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
    this.socket?.close();
    this.socket = null;
  }

  private send(message: ServerMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocketTransport must connect before sending.");
    }

    this.socket.send(JSON.stringify(message));
  }

  private handleMessage(data: unknown): void {
    const parsed = JSON.parse(String(data)) as ServerMessage;

    if (parsed.kind === "action") {
      this.actionListeners.forEach((listener) => listener(parsed.action));
      return;
    }

    if (parsed.kind === "state") {
      this.stateListeners.forEach((listener) => listener(parsed.state));
    }
  }
}
