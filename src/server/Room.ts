import { WebSocket } from "ws";
import type { GameDefinition, SyncMode, RoomLifecycleState, PlayerSlot } from "@boredgame/core";
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

const DEFAULT_MAX_ACTION_LOG = 500;
const LOBBY_STALE_MS = 600_000;
const IN_GAME_STALE_MS = 1_800_000;
const ENDED_TTL_MS = 3_600_000;
const PAUSE_TIMEOUT_MS = 300_000;

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export class Room {
  readonly roomId: string;
  readonly discordInstanceId?: string;
  readonly privateCode: string;
  readonly isPrivate: boolean;
  readonly createdAt: number;

  status: RoomLifecycleState = "lobby";
  hostId: string;
  lastActivity: number;
  startedAt?: number;
  endedAt?: number;

  private definition: GameDefinition<unknown, unknown>;
  private connections = new Map<string, ConnectedPlayer>();
  private slots = new Map<string, PlayerSlot>();
  private state: unknown;
  private actionLog: unknown[] = [];
  private nextSeq = 0;
  private maxActionLogSize: number;
  private lastPruneSnapshot: unknown = null;
  private maxPlayers: number;
  private maxSpectators: number;
  private allowSpectators: boolean;
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;
  private onEmpty: (() => void) | null = null;

  constructor(
    roomId: string,
    definition: GameDefinition<unknown, unknown>,
    creatorPlayerId: string,
    options?: {
      isPrivate?: boolean;
      discordInstanceId?: string;
      maxPlayers?: number;
      allowSpectators?: boolean;
      maxSpectators?: number;
      maxActionLogSize?: number;
    },
    onEmpty?: () => void
  ) {
    this.roomId = roomId;
    this.definition = definition;
    this.hostId = creatorPlayerId;
    this.createdAt = Date.now();
    this.lastActivity = this.createdAt;
    this.state = definition.createInitialState();
    this.maxActionLogSize = options?.maxActionLogSize ?? DEFAULT_MAX_ACTION_LOG;
    this.maxPlayers = options?.maxPlayers ?? definition.metadata.maxPlayers;
    this.allowSpectators = options?.allowSpectators ?? false;
    this.maxSpectators = options?.maxSpectators ?? 0;
    this.discordInstanceId = options?.discordInstanceId;
    this.isPrivate = options?.isPrivate ?? false;
    this.privateCode = generateRoomCode();
    this.onEmpty = onEmpty ?? null;
  }

  get isEmpty(): boolean {
    return this.connections.size === 0;
  }

  get playerCount(): number {
    let count = 0;
    for (const slot of this.slots.values()) {
      if (!slot.isSpectator) count++;
    }
    return count;
  }

  get spectatorCount(): number {
    let count = 0;
    for (const slot of this.slots.values()) {
      if (slot.isSpectator) count++;
    }
    return count;
  }

  getSlots(): PlayerSlot[] {
    return Array.from(this.slots.values());
  }

  getDefinition(): GameDefinition<unknown, unknown> {
    return this.definition;
  }

  join(
    socket: WebSocket,
    playerId: string,
    syncMode: SyncMode,
    knownActionIds: string[],
    protocolVersion: number = WSPROTO_VERSION,
    roomCode?: string,
    asSpectator?: boolean
  ): string | null {
    if (this.status !== "lobby" && this.status !== "paused") {
      return "ROOM_NOT_LOBBY";
    }

    if (this.isPrivate && roomCode !== this.privateCode) {
      return "INVALID_CODE";
    }

    const isSpectator = asSpectator ?? false;

    if (isSpectator) {
      if (!this.allowSpectators) {
        return "SPECTATORS_NOT_ALLOWED";
      }
      if (this.spectatorCount >= this.maxSpectators) {
        return "SPECTATOR_FULL";
      }
    } else {
      if (this.playerCount >= this.maxPlayers) {
        return "ROOM_FULL";
      }
    }

    const isNew = !this.slots.has(playerId);
    const now = Date.now();

    if (isNew) {
      this.slots.set(playerId, {
        playerId,
        joinedAt: now,
        isSpectator,
        isReady: false
      });
    }

    this.connections.set(playerId, { playerId, socket, syncMode, protocolVersion });
    this.lastActivity = now;

    this.broadcastRoomState();

    if (isNew) {
      this.broadcast({ type: "peer-joined", payload: { playerId } }, playerId);
    }

    if (syncMode === "action") {
      this.send(socket, protocolVersion, {
        type: "action-replay",
        payload: { actions: this.actionLog }
      });
    } else {
      this.send(socket, protocolVersion, {
        type: "state-snapshot",
        payload: { state: this.state }
      });
    }

    return null;
  }

  leave(playerId: string): void {
    this.connections.delete(playerId);
    this.slots.delete(playerId);
    this.lastActivity = Date.now();

    this.broadcast({ type: "peer-left", payload: { playerId } });

    if (this.hostId === playerId) {
      this.migrateHost();
    }

    if (this.isEmpty) {
      if (this.status === "lobby" || this.status === "archived") {
        this.status = "archived";
        this.onEmpty?.();
      } else if (this.status === "in_game" || this.status === "starting") {
        this.status = "paused";
        this.startPauseTimer();
      }
    } else {
      this.broadcastRoomState();
    }
  }

  private migrateHost(): void {
    let newHost = "";
    for (const [pid, slot] of this.slots) {
      if (!slot.isSpectator) {
        if (!newHost || slot.joinedAt < this.slots.get(newHost)!.joinedAt) {
          newHost = pid;
        }
      }
    }

    if (!newHost) {
      for (const [pid, slot] of this.slots) {
        if (!newHost || slot.joinedAt < this.slots.get(newHost)!.joinedAt) {
          newHost = pid;
        }
      }
    }

    if (newHost && newHost !== this.hostId) {
      this.hostId = newHost;
      this.broadcast({ type: "host-changed", payload: { newHostId: newHost } });
    }
  }

  startGame(): string | null {
    if (this.hostId && !this.connections.has(this.hostId)) {
      return "HOST_DISCONNECTED";
    }
    if (this.status !== "lobby") {
      return "NOT_LOBBY";
    }
    const minPlayers = this.definition.metadata.minPlayers;
    if (this.playerCount < minPlayers) {
      return "NOT_ENOUGH_PLAYERS";
    }

    this.status = "starting";
    this.broadcastRoomState();

    setTimeout(() => {
      if (this.status === "starting") {
        this.status = "in_game";
        this.startedAt = Date.now();
        this.broadcastRoomState();
      }
    }, 2000);

    return null;
  }

  endGame(): string | null {
    if (this.status !== "in_game" && this.status !== "paused") {
      return "NOT_IN_GAME";
    }
    this.clearPauseTimer();
    this.status = "ended";
    this.endedAt = Date.now();
    this.broadcastRoomState();
    return null;
  }

  pauseGame(): string | null {
    if (this.status !== "in_game") {
      return "NOT_IN_GAME";
    }
    this.status = "paused";
    this.startPauseTimer();
    this.broadcastRoomState();
    return null;
  }

  resumeGame(): string | null {
    if (this.status !== "paused") {
      return "NOT_PAUSED";
    }
    this.clearPauseTimer();
    this.status = "in_game";
    this.broadcastRoomState();
    return null;
  }

  setSpectate(playerId: string, spectating: boolean): string | null {
    const slot = this.slots.get(playerId);
    if (!slot) return "NOT_IN_ROOM";

    if (this.status !== "lobby") return "NOT_LOBBY";

    if (spectating && !this.allowSpectators) return "SPECTATORS_NOT_ALLOWED";
    if (spectating && this.spectatorCount >= this.maxSpectators && !slot.isSpectator) {
      return "SPECTATOR_FULL";
    }

    slot.isSpectator = spectating;
    this.broadcastRoomState();
    return null;
  }

  setReady(playerId: string, ready: boolean): string | null {
    const slot = this.slots.get(playerId);
    if (!slot) return "NOT_IN_ROOM";

    if (this.status !== "lobby") return "NOT_LOBBY";

    slot.isReady = ready;
    this.broadcastRoomState();
    return null;
  }

  handleAction(rawAction: unknown, senderPlayerId: string): void {
    if (this.status !== "in_game") {
      this.sendToPlayer(senderPlayerId, {
        type: "error",
        payload: { code: "GAME_NOT_IN_PROGRESS", message: "Game is not in progress" }
      });
      return;
    }

    const slot = this.slots.get(senderPlayerId);
    if (slot?.isSpectator) {
      this.sendToPlayer(senderPlayerId, {
        type: "error",
        payload: { code: "SPECTATOR_CANT_ACT", message: "Spectators cannot perform actions" }
      });
      return;
    }

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

    const player = this.connections.get(senderPlayerId);
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
    this.lastActivity = Date.now();

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

  sendRoomState(socket: WebSocket): void {
    const player = this.findPlayerBySocket(socket);
    if (!player) return;

    this.send(socket, player.protocolVersion, {
      type: "room-state",
      payload: {
        roomId: this.roomId,
        status: this.status,
        hostId: this.hostId,
        players: this.getSlots(),
        createdAt: this.createdAt,
        gameId: this.definition.id,
        privateCode: this.privateCode
      }
    });
  }

  removeSocket(socket: WebSocket): void {
    for (const [playerId, player] of this.connections) {
      if (player.socket === socket) {
        this.leave(playerId);
        return;
      }
    }
  }

  abandon(reason: string): void {
    this.broadcast({ type: "room-closed", payload: { reason } });
    this.status = "archived";
    this.clearPauseTimer();
    this.onEmpty?.();
  }

  isStale(): boolean {
    const now = Date.now();
    const age = now - this.lastActivity;

    switch (this.status) {
      case "lobby":
        return age > LOBBY_STALE_MS;
      case "in_game":
        return age > IN_GAME_STALE_MS;
      case "ended":
      case "archived":
        return age > ENDED_TTL_MS;
      default:
        return false;
    }
  }

  getSocketByPlayerId(playerId: string): WebSocket | undefined {
    return this.connections.get(playerId)?.socket;
  }

  hasPlayer(playerId: string): boolean {
    return this.connections.has(playerId);
  }

  private findPlayerBySocket(socket: WebSocket): ConnectedPlayer | undefined {
    for (const player of this.connections.values()) {
      if (player.socket === socket) {
        return player;
      }
    }
    return undefined;
  }

  private startPauseTimer(): void {
    this.clearPauseTimer();
    this.pauseTimer = setTimeout(() => {
      if (this.status === "paused") {
        this.abandon("Pause timeout expired");
      }
    }, PAUSE_TIMEOUT_MS);
  }

  private clearPauseTimer(): void {
    if (this.pauseTimer !== null) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }

  private broadcastRoomState(): void {
    const payload: ServerMessage = {
      type: "room-state",
      payload: {
        roomId: this.roomId,
        status: this.status,
        hostId: this.hostId,
        players: this.getSlots(),
        createdAt: this.createdAt,
        gameId: this.definition.id,
        privateCode: this.privateCode
      }
    };

    for (const [, player] of this.connections) {
      this.send(player.socket, player.protocolVersion, payload);
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
    const player = this.connections.get(playerId);
    if (player) {
      this.send(player.socket, player.protocolVersion, msg);
    }
  }

  private broadcast(msg: ServerMessage, excludePlayerId?: string): void {
    for (const [pid, player] of this.connections) {
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

    socket.send(JSON.stringify(envelope));
  }
}
