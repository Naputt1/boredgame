export type SyncMode = "action" | "state";

export const WSPROTO_VERSION = 1;
export const WSPROTO_MIN_VERSION = 1;
export const WSPROTO_MAX_VERSION = 1;

export type VersionRange = {
  min: number;
  max: number;
};

export type JoinRoomPayload = {
  gameId: string;
  playerId: string;
  syncMode: SyncMode;
  knownActionIds: string[];
  version?: VersionRange;
};

export type JoinRoomAckPayload = {
  chosenVersion: number;
  playerId: string;
};

export type ActionPayload = {
  action: unknown;
};

export type RequestSyncPayload = {
  knownActionIds: string[];
};

export type StateSnapshotPayload = {
  state: unknown;
};

export type ActionRelayPayload = {
  action: unknown;
};

export type ActionReplayPayload = {
  actions: unknown[];
};

export type PeerLeftPayload = {
  playerId: string;
};

export type PeerJoinedPayload = {
  playerId: string;
};

export type ErrorPayload = {
  code: string;
  message: string;
};

export type ClientMessage =
  | { type: "join-room"; payload: JoinRoomPayload }
  | { type: "action"; payload: ActionPayload }
  | { type: "request-sync"; payload: RequestSyncPayload };

export type ServerMessage =
  | { type: "state-snapshot"; payload: StateSnapshotPayload }
  | { type: "action-relay"; payload: ActionRelayPayload }
  | { type: "action-replay"; payload: ActionReplayPayload }
  | { type: "peer-joined"; payload: PeerJoinedPayload }
  | { type: "peer-left"; payload: PeerLeftPayload }
  | { type: "error"; payload: ErrorPayload }
  | { type: "join-room-ack"; payload: JoinRoomAckPayload };

export type Envelope<T> = {
  ver: number;
  seq: number;
  msg: T;
  compressed?: boolean;
};
