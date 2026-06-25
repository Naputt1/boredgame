export type Unsubscribe = () => void;

export type ConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export type RoomStateData = {
  roomId: string;
  status: string;
  hostId: string;
  players: Array<{ playerId: string; joinedAt: number; isSpectator: boolean; isReady: boolean }>;
  createdAt: number;
  gameId: string;
  privateCode?: string;
};

export interface GameTransport {
  connect(roomId: string, roomCode?: string): Promise<void>;
  createRoom?(options: {
    isPrivate?: boolean;
    discordInstanceId?: string;
    maxPlayers?: number;
    allowSpectators?: boolean;
    maxSpectators?: number;
  }): Promise<void>;
  leaveRoom?(): void;
  startGame?(): void;
  setSpectate?(spectating: boolean): void;
  setReady?(ready: boolean): void;
  sendAction(action: unknown): void;
  sendState?(state: unknown): void;
  onAction?(callback: (action: unknown) => void): Unsubscribe | void;
  onStateUpdate?(callback: (state: unknown) => void): Unsubscribe | void;
  onPeerLeft?(callback: (playerId: string) => void): Unsubscribe | void;
  onPeerJoined?(callback: (playerId: string) => void): Unsubscribe | void;
  onTransportError?(callback: (payload: { code: string; message: string }) => void): Unsubscribe | void;
  onConnectionStateChange?(callback: (state: ConnectionState) => void): Unsubscribe | void;
  onRoomUpdate?(callback: (roomState: RoomStateData) => void): Unsubscribe | void;
  onHostChanged?(callback: (newHostId: string) => void): Unsubscribe | void;
  onRoomClosed?(callback: (reason: string) => void): Unsubscribe | void;
  disconnect?(): void | Promise<void>;
}
