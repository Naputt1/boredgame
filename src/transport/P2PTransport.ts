import { GameTransport, Unsubscribe } from './GameTransport'

export type P2PTransportOptions = {
  instanceId: string
}

export class P2PTransport implements GameTransport {
  private actionListeners = new Set<(action: unknown) => void>()
  private stateListeners = new Set<(state: unknown) => void>()
  private roomId: string | null = null

  constructor(private readonly options: P2PTransportOptions) {}

  connect(roomId = this.options.instanceId): Promise<void> {
    this.roomId = roomId
    // Template boundary: wire Discord instance-scoped WebRTC signaling here.
    return Promise.resolve()
  }

  sendAction(action: unknown): void {
    if (!this.roomId) {
      throw new Error('P2PTransport must connect before sending actions.')
    }

    // Template boundary: broadcast serialized action to peers here.
    this.actionListeners.forEach((listener) => {
      listener(action)
    })
  }

  sendState(state: unknown): void {
    if (!this.roomId) {
      throw new Error('P2PTransport must connect before sending state.')
    }

    // Template boundary: send late-join or recovery snapshots here.
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

  disconnect(): void {
    this.roomId = null
  }
}
