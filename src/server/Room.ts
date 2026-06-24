import { WebSocket } from "ws";
import { createInitialState, GameState, gameReducer } from "@boredgame/core";
import { GameAction, parseGameAction } from "@boredgame/schemas";
import {
  Envelope,
  ServerMessage,
  SyncMode,
  WSPROTO_VERSION
} from "@boredgame/transport";

type ConnectedPlayer = {
  playerId: string;
  socket: WebSocket;
  syncMode: SyncMode;
};

const FULL_SNAPSHOT_THRESHOLD = 50;

export class Room {
  readonly roomId: string;
  private players = new Map<string, ConnectedPlayer>();
  private state: GameState;
  private actionLog: GameAction[] = [];
  private nextSeq = 0;

  constructor(roomId: string) {
    this.roomId = roomId;
    this.state = createInitialState();
  }

  get isEmpty(): boolean {
    return this.players.size === 0;
  }

  join(
    socket: WebSocket,
    playerId: string,
    syncMode: SyncMode,
    knownActionIds: string[]
  ): void {
    const isNew = !this.players.has(playerId);

    this.players.set(playerId, { playerId, socket, syncMode });

    if (isNew) {
      this.broadcast({ type: "peer-joined", payload: { playerId } }, playerId);
    }

    if (syncMode === "action") {
      this.send(socket, {
        type: "action-replay",
        payload: { actions: this.actionLog }
      });
      return;
    }

    const missingCount = this.actionLog.length - knownActionIds.length;

    if (missingCount > FULL_SNAPSHOT_THRESHOLD) {
      this.send(socket, {
        type: "state-snapshot",
        payload: { state: this.state }
      });
    } else {
      const replay = this.actionLog.slice(knownActionIds.length);
      this.send(socket, {
        type: "action-replay",
        payload: { actions: replay }
      });
    }
  }

  leave(playerId: string): void {
    this.players.delete(playerId);

    this.broadcast({ type: "peer-left", payload: { playerId } });
  }

  handleAction(rawAction: unknown, _senderPlayerId: string): void {
    const action = parseGameAction(rawAction);
    this.actionLog.push(action);

    if (this.syncModeForPlayer(_senderPlayerId) === "action") {
      this.broadcast({ type: "action-relay", payload: { action } });
      return;
    }

    this.state = gameReducer(this.state, action);
    this.broadcast({ type: "state-snapshot", payload: { state: this.state } });
  }

  private syncModeForPlayer(playerId: string): SyncMode | undefined {
    return this.players.get(playerId)?.syncMode;
  }

  sendSnapshot(socket: WebSocket): void {
    this.send(socket, {
      type: "state-snapshot",
      payload: { state: this.state }
    });
  }

  removeSocket(socket: WebSocket): void {
    for (const [playerId, player] of this.players) {
      if (player.socket === socket) {
        this.leave(playerId);
        return;
      }
    }
  }

  // ── Private ─────────────────────────────────────────────

  private broadcast(msg: ServerMessage, excludePlayerId?: string): void {
    for (const [pid, player] of this.players) {
      if (pid !== excludePlayerId) {
        this.send(player.socket, msg);
      }
    }
  }

  private send(socket: WebSocket, msg: ServerMessage): void {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const envelope: Envelope<ServerMessage> = {
      ver: WSPROTO_VERSION,
      seq: this.nextSeq++,
      msg
    };

    socket.send(JSON.stringify(envelope));
  }
}
