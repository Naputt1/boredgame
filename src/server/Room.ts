import { WebSocket } from "ws";
import type { GameDefinition, SyncMode } from "@boredgame/core";
import {
  type Envelope,
  type ServerMessage,
  WSPROTO_VERSION
} from "@boredgame/transport";

type ConnectedPlayer = {
  playerId: string;
  socket: WebSocket;
  syncMode: SyncMode;
  protocolVersion: number;
};

const FULL_SNAPSHOT_THRESHOLD = 50;
const DEFAULT_MAX_ACTION_LOG = 500;

export class Room {
  readonly roomId: string;
  private definition: GameDefinition<unknown, unknown>;
  private players = new Map<string, ConnectedPlayer>();
  private state: unknown;
  private actionLog: unknown[] = [];
  private nextSeq = 0;
  private maxActionLogSize: number;
  private lastPruneSnapshot: unknown = null;

  constructor(
    roomId: string,
    definition: GameDefinition<unknown, unknown>,
    maxActionLogSize: number = DEFAULT_MAX_ACTION_LOG
  ) {
    this.roomId = roomId;
    this.definition = definition;
    this.state = definition.createInitialState();
    this.maxActionLogSize = maxActionLogSize;
  }

  get isEmpty(): boolean {
    return this.players.size === 0;
  }

  join(
    socket: WebSocket,
    playerId: string,
    syncMode: SyncMode,
    knownActionIds: string[],
    protocolVersion: number = WSPROTO_VERSION
  ): void {
    const isNew = !this.players.has(playerId);

    this.players.set(playerId, { playerId, socket, syncMode, protocolVersion });

    if (isNew) {
      this.broadcast({ type: "peer-joined", payload: { playerId } }, playerId);
    }

    if (syncMode === "action") {
      this.send(socket, protocolVersion, {
        type: "action-replay",
        payload: { actions: this.actionLog }
      });
      return;
    }

    const missingCount = this.actionLog.length - knownActionIds.length;

    if (missingCount > FULL_SNAPSHOT_THRESHOLD) {
      this.send(socket, protocolVersion, {
        type: "state-snapshot",
        payload: { state: this.state }
      });
    } else {
      const replay = this.actionLog.slice(knownActionIds.length);
      this.send(socket, protocolVersion, {
        type: "action-replay",
        payload: { actions: replay }
      });
    }
  }

  leave(playerId: string): void {
    this.players.delete(playerId);

    this.broadcast({ type: "peer-left", payload: { playerId } });
  }

  handleAction(rawAction: unknown, senderPlayerId: string): void {
    let action: unknown;

    try {
      action = this.definition.actionSchema.parse(rawAction);
    } catch {
      this.sendToPlayer(senderPlayerId, {
        type: "error",
        payload: { code: "INVALID_ACTION", message: "Action failed schema validation" }
      });
      return;
    }

    const player = this.players.get(senderPlayerId);
    if (!player) {
      return;
    }

    if (this.definition.validateAction) {
      const result = this.definition.validateAction(action, this.state, senderPlayerId);

      if (!result.valid) {
        this.sendToPlayer(senderPlayerId, {
          type: "error",
          payload: { code: result.code, message: result.message }
        });
        return;
      }
    }

    this.actionLog.push(action);

    this.state = this.definition.reducer(this.state, action);

    if (this.actionLog.length >= this.maxActionLogSize) {
      this.pruneActionLog();
    }

    if (player.syncMode === "action") {
      this.broadcast({ type: "action-relay", payload: { action } });
      return;
    }

    this.broadcast({ type: "state-snapshot", payload: { state: this.state } });
  }

  sendSnapshot(socket: WebSocket, protocolVersion?: number): void {
    const ver = protocolVersion ?? WSPROTO_VERSION;
    this.send(socket, ver, {
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

  private pruneActionLog(): void {
    const snapshotState = this.actionLog.reduce<unknown>(
      (s, a) => this.definition.reducer(s, a as Parameters<typeof this.definition.reducer>[1]),
      this.lastPruneSnapshot ?? this.state
    );

    this.lastPruneSnapshot = snapshotState;
    this.actionLog = [];
  }

  private sendToPlayer(playerId: string, msg: ServerMessage): void {
    const player = this.players.get(playerId);
    if (player) {
      this.send(player.socket, player.protocolVersion, msg);
    }
  }

  // ── Private ─────────────────────────────────────────────

  private broadcast(msg: ServerMessage, excludePlayerId?: string): void {
    for (const [pid, player] of this.players) {
      if (pid !== excludePlayerId) {
        this.send(player.socket, player.protocolVersion, msg);
      }
    }
  }

  private send(socket: WebSocket, ver: number, msg: ServerMessage): void {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const envelope: Envelope<ServerMessage> = {
      ver,
      seq: this.nextSeq++,
      msg
    };

    // NOTE: For production, large envelopes can be compressed via zlib:
    //   const json = JSON.stringify(envelope);
    //   if (json.length > 1024) {
    //     const deflated = deflateSync(Buffer.from(json)).toString("base64");
    //     socket.send(JSON.stringify({ ...envelope, compressed: true, data: deflated }));
    //   }

    socket.send(JSON.stringify(envelope));
  }
}
