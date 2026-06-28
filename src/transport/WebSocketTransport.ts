import {
  GameTransport,
  Unsubscribe,
  ConnectionState,
  RoomStateData,
} from './GameTransport'
import {
  type ClientMessage,
  type Envelope,
  type ServerMessage,
  type SyncMode,
  WSPROTO_VERSION,
  WSPROTO_MIN_VERSION,
  WSPROTO_MAX_VERSION,
} from './WebSocketProtocol'

export type WebSocketTransportOptions = {
  url: string
  playerId: string
  gameId: string
  maxReconnectAttempts?: number
  reconnectBaseDelayMs?: number
  fullSnapshotThreshold?: number
}

export class WebSocketTransport implements GameTransport {
  private ws: WebSocket | null = null
  private roomId: string | null = null
  private syncMode: SyncMode = 'state'
  private knownActionIds: string[] = []
  private negotiatedVersion = WSPROTO_VERSION

  private seq = 0

  private actionListeners = new Set<(action: unknown) => void>()
  private stateListeners = new Set<(state: unknown) => void>()
  private peerLeftListeners = new Set<(playerId: string) => void>()
  private peerJoinedListeners = new Set<(playerId: string) => void>()
  private errorListeners = new Set<
    (payload: { code: string; message: string }) => void
  >()
  private connectionStateListeners = new Set<(state: ConnectionState) => void>()
  private roomUpdateListeners = new Set<(roomState: RoomStateData) => void>()
  private hostChangedListeners = new Set<(newHostId: string) => void>()
  private roomClosedListeners = new Set<(reason: string) => void>()

  private reconnectAttempts = 0
  private maxReconnectAttempts: number
  private reconnectBaseDelayMs: number
  private fullSnapshotThreshold: number
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private disconnectedIntentionally = false
  private pendingConnectReject: ((reason: Error) => void) | null = null
  private connectionGen = 0

  private url: string
  private playerId: string
  private gameId: string
  private roomCode: string | undefined

  constructor(options: WebSocketTransportOptions) {
    this.url = options.url
    this.playerId = options.playerId
    this.gameId = options.gameId
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5
    this.reconnectBaseDelayMs = options.reconnectBaseDelayMs ?? 1000
    this.fullSnapshotThreshold = options.fullSnapshotThreshold ?? 50
  }

  async connect(roomId: string, roomCode?: string): Promise<void> {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return
    }
    this.roomId = roomId
    if (roomCode !== undefined) {
      this.roomCode = roomCode
    }
    this.disconnectedIntentionally = false
    this.reconnectAttempts = 0
    this.knownActionIds = []
    this.emitConnectionState('connecting')

    await this.openConnection()
  }

  async createRoom(options: {
    isPrivate?: boolean
    discordInstanceId?: string
    maxPlayers?: number
    allowSpectators?: boolean
    maxSpectators?: number
  }): Promise<void> {
    this.disconnectedIntentionally = false
    this.reconnectAttempts = 0
    this.knownActionIds = []
    this.emitConnectionState('connecting')

    await this.openConnection(options)
  }

  leaveRoom(): void {
    this.send({ type: 'leave-room', payload: { playerId: this.playerId } })
  }

  startGame(): void {
    this.send({ type: 'start-game', payload: {} })
  }

  setSpectate(spectating: boolean): void {
    this.send({
      type: 'spectate',
      payload: { playerId: this.playerId, spectating },
    })
  }

  setReady(ready: boolean): void {
    this.send({
      type: 'set-ready',
      payload: { playerId: this.playerId, ready },
    })
  }

  sendAction(action: unknown): void {
    this.send({ type: 'action', payload: { action } })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sendState(_state: unknown): void {
    // Not used by WebSocketTransport — authoritative state comes from the server.
  }

  onAction(callback: (action: unknown) => void): Unsubscribe {
    this.actionListeners.add(callback)
    return () => this.actionListeners.delete(callback)
  }

  onStateUpdate(callback: (state: unknown) => void): Unsubscribe {
    this.stateListeners.add(callback)
    return () => this.stateListeners.delete(callback)
  }

  onPeerLeft(callback: (playerId: string) => void): Unsubscribe {
    this.peerLeftListeners.add(callback)
    return () => this.peerLeftListeners.delete(callback)
  }

  onPeerJoined(callback: (playerId: string) => void): Unsubscribe {
    this.peerJoinedListeners.add(callback)
    return () => this.peerJoinedListeners.delete(callback)
  }

  onTransportError(
    callback: (payload: { code: string; message: string }) => void
  ): Unsubscribe {
    this.errorListeners.add(callback)
    return () => this.errorListeners.delete(callback)
  }

  onConnectionStateChange(
    callback: (state: ConnectionState) => void
  ): Unsubscribe {
    this.connectionStateListeners.add(callback)
    return () => this.connectionStateListeners.delete(callback)
  }

  onRoomUpdate(callback: (roomState: RoomStateData) => void): Unsubscribe {
    this.roomUpdateListeners.add(callback)
    return () => this.roomUpdateListeners.delete(callback)
  }

  onHostChanged(callback: (newHostId: string) => void): Unsubscribe {
    this.hostChangedListeners.add(callback)
    return () => this.hostChangedListeners.delete(callback)
  }

  onRoomClosed(callback: (reason: string) => void): Unsubscribe {
    this.roomClosedListeners.add(callback)
    return () => this.roomClosedListeners.delete(callback)
  }

  disconnect(): void {
    this.disconnectedIntentionally = true
    this.clearReconnectTimer()
    this.pendingConnectReject?.(new Error('Connection cancelled'))
    this.pendingConnectReject = null
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'Client disconnect')
    }
    this.ws = null
    this.emitConnectionState('disconnected')
  }

  // ── Private ───────────────────────────────────────────────

  private emitConnectionState(state: ConnectionState): void {
    this.connectionStateListeners.forEach((l) => {
      l(state)
    })
  }

  private async openConnection(createRoomOptions?: {
    isPrivate?: boolean
    discordInstanceId?: string
    maxPlayers?: number
    allowSpectators?: boolean
    maxSpectators?: number
  }): Promise<void> {
    const wsUrl = new URL(this.url)
    wsUrl.searchParams.set('roomId', this.roomId ?? '')
    wsUrl.searchParams.set('playerId', this.playerId)

    this.connectionGen++
    const currentGen = this.connectionGen

    this.ws = new WebSocket(wsUrl.toString())

    return new Promise<void>((resolve, reject) => {
      this.pendingConnectReject = reject

      if (!this.ws) {
        this.pendingConnectReject = null
        reject(new Error('WebSocket did not initialize.'))
        return
      }

      const onOpen = () => {
        if (currentGen !== this.connectionGen) return
        this.ws?.removeEventListener('open', onOpen)
        this.ws?.removeEventListener('error', onError)

        if (createRoomOptions) {
          this.sendCreateRoom(createRoomOptions)
        } else {
          this.joinRoom()
        }
      }

      const onMessage = (event: MessageEvent) => {
        if (currentGen !== this.connectionGen) return
        const data = typeof event.data === 'string' ? event.data : null
        if (!data) return

        let envelope: Envelope<ServerMessage>
        try {
          envelope = JSON.parse(data) as Envelope<ServerMessage>
        } catch {
          return
        }

        const msg = envelope.msg

        if (msg.type === 'join-room-ack') {
          this.pendingConnectReject = null
          this.negotiatedVersion = msg.payload.chosenVersion
          this.emitConnectionState('connected')
          resolve()
          return
        }

        this.handleServerMessage(envelope)
      }

      const onError = () => {
        if (currentGen !== this.connectionGen) return
        this.ws?.removeEventListener('open', onOpen)
        this.ws?.removeEventListener('error', onError)
        const rejectFn = this.pendingConnectReject
        this.pendingConnectReject = null
        rejectFn?.(new Error('WebSocket connection failed.'))
      }

      const onClose = (event: CloseEvent) => {
        if (currentGen !== this.connectionGen) return
        this.handleClose(event)
      }

      this.ws.addEventListener('open', onOpen)
      this.ws.addEventListener('close', onClose)
      this.ws.addEventListener('error', (event) => {
        this.handleError(event)
        onError()
      })
      this.ws.addEventListener('message', onMessage)
    })
  }

  private joinRoom(): void {
    this.send({
      type: 'join-room',
      payload: {
        gameId: this.gameId,
        playerId: this.playerId,
        syncMode: this.syncMode,
        knownActionIds: this.knownActionIds,
        version: { min: WSPROTO_MIN_VERSION, max: WSPROTO_MAX_VERSION },
        roomCode: this.roomCode,
      },
    })
  }

  private sendCreateRoom(options: {
    isPrivate?: boolean
    discordInstanceId?: string
    maxPlayers?: number
    allowSpectators?: boolean
    maxSpectators?: number
  }): void {
    this.send({
      type: 'create-room',
      payload: {
        gameId: this.gameId,
        playerId: this.playerId,
        syncMode: this.syncMode,
        isPrivate: options.isPrivate,
        discordInstanceId: options.discordInstanceId,
        maxPlayers: options.maxPlayers,
        allowSpectators: options.allowSpectators,
        maxSpectators: options.maxSpectators,
      },
    })
  }

  private send(msg: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocketTransport is not connected.')
    }

    const envelope: Envelope<ClientMessage> = {
      ver: this.negotiatedVersion,
      seq: this.seq++,
      msg,
    }

    this.ws.send(JSON.stringify(envelope))
  }

  private handleServerMessage(envelope: Envelope<ServerMessage>): void {
    if (envelope.ver !== this.negotiatedVersion) {
      return
    }

    const msg = envelope.msg

    switch (msg.type) {
      case 'state-snapshot': {
        this.stateListeners.forEach((listener) => {
          listener(msg.payload.state)
        })
        break
      }

      case 'action-relay': {
        this.actionListeners.forEach((listener) => {
          listener(msg.payload.action)
        })
        break
      }

      case 'action-replay': {
        for (const action of msg.payload.actions) {
          this.actionListeners.forEach((listener) => {
            listener(action)
          })
        }
        break
      }

      case 'peer-joined': {
        this.peerJoinedListeners.forEach((listener) => {
          listener(msg.payload.playerId)
        })
        break
      }

      case 'peer-left': {
        this.peerLeftListeners.forEach((listener) => {
          listener(msg.payload.playerId)
        })
        break
      }

      case 'error': {
        this.errorListeners.forEach((listener) => {
          listener(msg.payload)
        })
        break
      }

      case 'room-state': {
        this.roomUpdateListeners.forEach((listener) => {
          listener(msg.payload)
        })
        break
      }

      case 'host-changed': {
        this.hostChangedListeners.forEach((listener) => {
          listener(msg.payload.newHostId)
        })
        break
      }

      case 'player-kicked': {
        this.errorListeners.forEach((listener) => {
          listener({ code: 'KICKED', message: msg.payload.reason })
        })
        break
      }

      case 'room-closed': {
        this.roomClosedListeners.forEach((listener) => {
          listener(msg.payload.reason)
        })
        break
      }

      case 'pong': {
        // heartbeat received — nothing to do, connection is alive
        break
      }

      default:
        break
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private handleClose(_event: CloseEvent): void {
    if (this.disconnectedIntentionally) {
      return
    }

    this.emitConnectionState('reconnecting')
    this.scheduleReconnect()
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private handleError(_event: Event): void {
    // close will fire after error, so reconnection is handled in handleClose
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emitConnectionState('disconnected')
      return
    }

    const delay =
      this.reconnectBaseDelayMs * Math.pow(2, this.reconnectAttempts)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      void this.openConnection().catch(() => {
        this.scheduleReconnect()
      })
    }, delay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}
