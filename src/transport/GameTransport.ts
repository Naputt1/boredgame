export type Unsubscribe = () => void

export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'

export type RoomStateData = {
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

export interface GameTransport {
  connect(roomId: string, roomCode?: string): Promise<void>
  createRoom?(options: {
    isPrivate?: boolean
    discordInstanceId?: string
    maxPlayers?: number
    allowSpectators?: boolean
    maxSpectators?: number
  }): Promise<void>
  leaveRoom?(): void
  startGame?(): void
  setSpectate?(spectating: boolean): void
  setReady?(ready: boolean): void
  sendAction(action: unknown): void
  sendState?(state: unknown): void
  onAction?(callback: (action: unknown) => void): Unsubscribe | undefined
  onStateUpdate?(callback: (state: unknown) => void): Unsubscribe | undefined
  onPeerLeft?(callback: (playerId: string) => void): Unsubscribe | undefined
  onPeerJoined?(callback: (playerId: string) => void): Unsubscribe | undefined
  onTransportError?(
    callback: (payload: { code: string; message: string }) => void
  ): Unsubscribe | undefined
  onConnectionStateChange?(
    callback: (state: ConnectionState) => void
  ): Unsubscribe | undefined
  onRoomUpdate?(
    callback: (roomState: RoomStateData) => void
  ): Unsubscribe | undefined
  onHostChanged?(callback: (newHostId: string) => void): Unsubscribe | undefined
  onRoomClosed?(callback: (reason: string) => void): Unsubscribe | undefined
  disconnect?(): void | Promise<void>
}
