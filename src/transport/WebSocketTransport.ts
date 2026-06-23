import { GameState } from "@boredgame/core";
import { GameAction } from "@boredgame/schemas";
import { GameTransport, Unsubscribe } from "./GameTransport";
import {
  ClientMessage,
  Envelope,
  ServerMessage,
  WSPROTO_VERSION
} from "./WebSocketProtocol";

export type WebSocketTransportOptions = {
  url: string;
  playerId: string;
  maxReconnectAttempts?: number;
  reconnectBaseDelayMs?: number;
  fullSnapshotThreshold?: number;
};

export class WebSocketTransport implements GameTransport {
  private ws: WebSocket | null = null;
  private roomId: string | null = null;
  private syncMode: "action" | "state" = "action";
  private knownActionIds: string[] = [];

  private seq = 0;

  private actionListeners = new Set<(action: GameAction) => void>();
  private stateListeners = new Set<(state: GameState) => void>();
  private peerLeftListeners = new Set<(playerId: string) => void>();
  private peerJoinedListeners = new Set<(playerId: string) => void>();
  private errorListeners = new Set<(payload: { code: string; message: string }) => void>();

  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectBaseDelayMs: number;
  private fullSnapshotThreshold: number;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disconnectedIntentionally = false;

  private url: string;
  private playerId: string;

  constructor(options: WebSocketTransportOptions) {
    this.url = options.url;
    this.playerId = options.playerId;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
    this.reconnectBaseDelayMs = options.reconnectBaseDelayMs ?? 1000;
    this.fullSnapshotThreshold = options.fullSnapshotThreshold ?? 50;
  }

  async connect(roomId: string): Promise<void> {
    this.roomId = roomId;
    this.disconnectedIntentionally = false;
    this.reconnectAttempts = 0;
    this.knownActionIds = [];

    await this.openConnection();
  }

  sendAction(action: GameAction): void {
    this.send({ type: "action", payload: { action } });
  }

  sendState(_state: GameState): void {
    // Not used by WebSocketTransport — authoritative state comes from the server.
  }

  onAction(callback: (action: GameAction) => void): Unsubscribe {
    this.actionListeners.add(callback);
    return () => this.actionListeners.delete(callback);
  }

  onStateUpdate(callback: (state: GameState) => void): Unsubscribe {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  onPeerLeft(callback: (playerId: string) => void): Unsubscribe {
    this.peerLeftListeners.add(callback);
    return () => this.peerLeftListeners.delete(callback);
  }

  onPeerJoined(callback: (playerId: string) => void): Unsubscribe {
    this.peerJoinedListeners.add(callback);
    return () => this.peerJoinedListeners.delete(callback);
  }

  onTransportError(callback: (payload: { code: string; message: string }) => void): Unsubscribe {
    this.errorListeners.add(callback);
    return () => this.errorListeners.delete(callback);
  }

  disconnect(): void {
    this.disconnectedIntentionally = true;
    this.clearReconnectTimer();
    this.ws?.close();
    this.ws = null;
  }

  // ── Private ───────────────────────────────────────────────

  private async openConnection(): Promise<void> {
    const wsUrl = new URL(this.url);
    wsUrl.searchParams.set("roomId", this.roomId ?? "");
    wsUrl.searchParams.set("playerId", this.playerId);

    this.ws = new WebSocket(wsUrl.toString());

    return new Promise<void>((resolve, reject) => {
      if (!this.ws) {
        reject(new Error("WebSocket did not initialize."));
        return;
      }

      const onOpen = () => {
        this.ws?.removeEventListener("open", onOpen);
        this.ws?.removeEventListener("error", onError);

        this.joinRoom();
        resolve();
      };

      const onError = () => {
        this.ws?.removeEventListener("open", onOpen);
        this.ws?.removeEventListener("error", onError);
        reject(new Error("WebSocket connection failed."));
      };

      this.ws.addEventListener("open", onOpen);
      this.ws.addEventListener("close", (event) => this.handleClose(event));
      this.ws.addEventListener("error", (event) => this.handleError(event));
      this.ws.addEventListener("message", (event) => this.handleMessage(event.data));
    });
  }

  private joinRoom(): void {
    this.send({
      type: "join-room",
      payload: {
        playerId: this.playerId,
        syncMode: this.syncMode,
        knownActionIds: this.knownActionIds
      }
    });
  }

  private send(msg: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocketTransport is not connected.");
    }

    const envelope: Envelope<ClientMessage> = {
      ver: WSPROTO_VERSION,
      seq: this.seq++,
      msg
    };

    this.ws.send(JSON.stringify(envelope));
  }

  private handleMessage(data: unknown): void {
    let envelope: Envelope<ServerMessage>;

    try {
      envelope = JSON.parse(String(data)) as Envelope<ServerMessage>;
    } catch {
      return;
    }

    if (envelope.ver !== WSPROTO_VERSION) {
      return;
    }

    const msg = envelope.msg;

    switch (msg.type) {
      case "state-snapshot": {
        this.stateListeners.forEach((listener) => listener(msg.payload.state));
        break;
      }

      case "action-relay": {
        this.actionListeners.forEach((listener) => listener(msg.payload.action));
        break;
      }

      case "action-replay": {
        for (const action of msg.payload.actions) {
          this.actionListeners.forEach((listener) => listener(action));
        }
        break;
      }

      case "peer-joined": {
        this.peerJoinedListeners.forEach((listener) => listener(msg.payload.playerId));
        break;
      }

      case "peer-left": {
        this.peerLeftListeners.forEach((listener) => listener(msg.payload.playerId));
        break;
      }

      case "error": {
        this.errorListeners.forEach((listener) => listener(msg.payload));
        break;
      }
    }
  }

  private handleClose(_event: CloseEvent): void {
    if (this.disconnectedIntentionally) {
      return;
    }

    this.scheduleReconnect();
  }

  private handleError(_event: Event): void {
    // close will fire after error, so reconnection is handled in handleClose
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    const delay =
      this.reconnectBaseDelayMs * Math.pow(2, this.reconnectAttempts);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;

      try {
        await this.openConnection();
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
