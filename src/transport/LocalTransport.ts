import { GameTransport, Unsubscribe, ConnectionState } from './GameTransport'

export class LocalTransport implements GameTransport {
  private actionListeners = new Set<(action: unknown) => void>()
  private stateListeners = new Set<(state: unknown) => void>()
  private connectionStateListeners = new Set<(state: ConnectionState) => void>()
  private connectedRoomId: string | null = null

  connect(roomId: string): Promise<void> {
    this.connectedRoomId = roomId
    this.connectionStateListeners.forEach((l) => {
      l('connected')
    })
    return Promise.resolve()
  }

  sendAction(action: unknown): void {
    if (!this.connectedRoomId) {
      throw new Error('LocalTransport must connect before sending actions.')
    }

    this.actionListeners.forEach((listener) => {
      listener(action)
    })
  }

  sendState(state: unknown): void {
    if (!this.connectedRoomId) {
      throw new Error('LocalTransport must connect before sending state.')
    }

    this.stateListeners.forEach((listener) => {
      listener(state)
    })
  }

  onAction(callback: (action: unknown) => void): Unsubscribe {
    this.actionListeners.add(callback)
    return () => this.actionListeners.delete(callback)
  }

  onStateUpdate(callback: (state: unknown) => void): Unsubscribe {
    this.stateListeners.add(callback)
    return () => this.stateListeners.delete(callback)
  }

  onConnectionStateChange(
    callback: (state: ConnectionState) => void
  ): Unsubscribe {
    this.connectionStateListeners.add(callback)

    if (this.connectedRoomId) {
      callback('connected')
    }

    return () => this.connectionStateListeners.delete(callback)
  }

  disconnect(): void {
    this.connectedRoomId = null
    this.connectionStateListeners.forEach((l) => {
      l('disconnected')
    })
  }
}
