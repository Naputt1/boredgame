export type SyncMode = 'action' | 'state'

export const WSPROTO_VERSION = 1
export const WSPROTO_MIN_VERSION = 1
export const WSPROTO_MAX_VERSION = 1

export type VersionRange = {
  min: number
  max: number
}

export type JoinRoomPayload = {
  gameId: string
  playerId: string
  syncMode: SyncMode
  knownActionIds: string[]
  version?: VersionRange
  roomCode?: string
}

export type JoinRoomAckPayload = {
  chosenVersion: number
  playerId: string
}

export type ActionPayload = {
  action: unknown
}

export type RequestSyncPayload = {
  knownActionIds: string[]
}

export type StateSnapshotPayload = {
  state: unknown
}

export type ActionRelayPayload = {
  action: unknown
}

export type ActionReplayPayload = {
  actions: unknown[]
}

export type PeerLeftPayload = {
  playerId: string
}

export type PeerJoinedPayload = {
  playerId: string
}

export type ErrorPayload = {
  code: string
  message: string
}

export type CreateRoomPayload = {
  gameId: string
  playerId: string
  syncMode: SyncMode
  isPrivate?: boolean
  discordInstanceId?: string
  maxPlayers?: number
  allowSpectators?: boolean
  maxSpectators?: number
}

export type LeaveRoomPayload = {
  playerId: string
}

export type StartGamePayload = Record<string, never>

export type SpectatePayload = {
  playerId: string
  spectating: boolean
}

export type SetReadyPayload = {
  playerId: string
  ready: boolean
}

export type PingPayload = Record<string, never>

export type RoomStatePayload = {
  roomId: string
  status: string
  hostId: string
  players: Array<{
    playerId: string
    joinedAt: number
    isSpectator: boolean
    isReady: boolean
  }>
  createdAt: number
  gameId: string
  privateCode?: string
}

export type HostChangedPayload = {
  newHostId: string
}

export type PlayerKickedPayload = {
  playerId: string
  reason: string
}

export type PongPayload = Record<string, never>

export type RoomClosedPayload = {
  reason: string
}

export type ClientMessage =
  | { type: 'create-room'; payload: CreateRoomPayload }
  | { type: 'join-room'; payload: JoinRoomPayload }
  | { type: 'leave-room'; payload: LeaveRoomPayload }
  | { type: 'action'; payload: ActionPayload }
  | { type: 'request-sync'; payload: RequestSyncPayload }
  | { type: 'start-game'; payload: StartGamePayload }
  | { type: 'spectate'; payload: SpectatePayload }
  | { type: 'set-ready'; payload: SetReadyPayload }
  | { type: 'ping'; payload: PingPayload }

export type ServerMessage =
  | { type: 'state-snapshot'; payload: StateSnapshotPayload }
  | { type: 'action-relay'; payload: ActionRelayPayload }
  | { type: 'action-replay'; payload: ActionReplayPayload }
  | { type: 'peer-joined'; payload: PeerJoinedPayload }
  | { type: 'peer-left'; payload: PeerLeftPayload }
  | { type: 'error'; payload: ErrorPayload }
  | { type: 'join-room-ack'; payload: JoinRoomAckPayload }
  | { type: 'room-state'; payload: RoomStatePayload }
  | { type: 'host-changed'; payload: HostChangedPayload }
  | { type: 'player-kicked'; payload: PlayerKickedPayload }
  | { type: 'pong'; payload: PongPayload }
  | { type: 'room-closed'; payload: RoomClosedPayload }

export type Envelope<T> = {
  ver: number
  seq: number
  msg: T
  compressed?: boolean
}
