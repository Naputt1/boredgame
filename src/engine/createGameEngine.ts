import type {
  GameDefinition,
  GameEngineMiddleware,
  SyncMode,
  Unsubscribe,
} from '@boredgame/core'
import type { GameTransport } from '@boredgame/transport'

export const ENGINE_PROTOCOL_VERSION = '0.1.0'

export type GameEngineOptions<TState, TAction> = {
  transport: GameTransport
  definition: GameDefinition<TState, TAction>
  syncMode?: SyncMode
  initialState?: TState
  middleware?: GameEngineMiddleware[]
}

export type GameEngine<TState, TAction> = {
  connect(roomId: string): Promise<void>
  disconnect(): void | Promise<void>
  getState(): TState
  subscribe(listener: (state: TState) => void): Unsubscribe
  sendAction(action: TAction): void
  replaceState(state: TState): void
}

export const createGameEngine = <TState, TAction>({
  transport,
  definition,
  syncMode = 'state',
  initialState = definition.createInitialState(),
  middleware = [],
}: GameEngineOptions<TState, TAction>): GameEngine<TState, TAction> => {
  let state = initialState
  const listeners = new Set<(state: TState) => void>()

  const notify = () => {
    listeners.forEach((listener) => {
      listener(state)
    })
  }

  const reportError = (error: unknown) => {
    middleware.forEach((entry) => entry.onError?.(error))
  }

  const applyAction = (unsafeAction: unknown) => {
    try {
      const action = definition.actionSchema.parse(unsafeAction)
      middleware.forEach((entry) => entry.beforeApply?.(action, state))
      const nextState = definition.reducer(state, action)

      if (nextState !== state) {
        state = nextState
        middleware.forEach((entry) => entry.afterApply?.(action, state))
        notify()
      }
    } catch (error) {
      reportError(error)
    }
  }

  const replaceState = (unsafeState: unknown) => {
    try {
      if (definition.stateSchema) {
        state = definition.stateSchema.parse(unsafeState)
      } else {
        state = unsafeState as TState
      }
      middleware.forEach((entry) => entry.onStateReplace?.(state))
      notify()
    } catch (error) {
      reportError(error)
    }
  }

  if (transport.onAction) {
    transport.onAction((action) => {
      if (syncMode === 'action') {
        applyAction(action)
      }
    })
  }

  if (transport.onStateUpdate) {
    transport.onStateUpdate((nextState) => {
      if (syncMode === 'state') {
        replaceState(nextState)
      }
    })
  }

  return {
    connect: (roomId) => transport.connect(roomId),
    disconnect: () => transport.disconnect?.(),
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      listener(state)
      return () => listeners.delete(listener)
    },
    sendAction: (unsafeAction) => {
      try {
        const action = definition.actionSchema.parse(unsafeAction)
        middleware.forEach((entry) => entry.beforeSend?.(action, state))
        transport.sendAction(action)
      } catch (error) {
        reportError(error)
      }
    },
    replaceState,
  }
}
