import { GameAction } from "@boredgame/schemas";
import { GameState } from "@boredgame/core";

export type SyncMode = "action" | "state";

export const WSPROTO_VERSION = 1;

export type JoinRoomPayload = {
  playerId: string;
  syncMode: SyncMode;
  knownActionIds: string[];
};

export type ActionPayload = {
  action: GameAction;
};

export type RequestSyncPayload = {
  knownActionIds: string[];
};

export type StateSnapshotPayload = {
  state: GameState;
};

export type ActionRelayPayload = {
  action: GameAction;
};

export type ActionReplayPayload = {
  actions: GameAction[];
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
  | { type: "error"; payload: ErrorPayload };

export type Envelope<T> = {
  ver: typeof WSPROTO_VERSION;
  seq: number;
  msg: T;
};
