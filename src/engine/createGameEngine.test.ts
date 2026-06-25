import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createGameEngine } from '.'
import { LocalTransport } from '@boredgame/transport'

type TestState = {
  count: number
  appliedActionIds: string[]
}

type TestAction = {
  type: 'increment'
  version: 1
  payload: { by: number }
  meta: { actionId: string; playerId: string; timestamp: number }
}

const testDefinition = {
  id: 'test',
  name: 'Test Game',
  version: { engine: '0.1.0', state: '1.0.0', actionSchema: '1.0.0' },
  metadata: { description: 'Test game', minPlayers: 1, maxPlayers: 4 },
  createInitialState: (): TestState => ({
    count: 0,
    appliedActionIds: [],
  }),
  reducer: (state: TestState, action: TestAction): TestState => {
    if (state.appliedActionIds.includes(action.meta.actionId)) {
      return state
    }
    return {
      ...state,
      count: state.count + action.payload.by,
      appliedActionIds: [...state.appliedActionIds, action.meta.actionId],
    }
  },
  actionSchema: z.object({
    type: z.literal('increment'),
    version: z.literal(1),
    payload: z.object({
      by: z.number().int().positive(),
    }),
    meta: z.object({
      actionId: z.string().min(1),
      playerId: z.string().min(1),
      timestamp: z.number().int().nonnegative(),
    }),
  }),
  renderer: () => null,
}

const incrementAction = (actionId = 'inc-1', by = 1): TestAction => ({
  type: 'increment',
  version: 1,
  payload: { by },
  meta: { actionId, playerId: 'player-1', timestamp: 1 },
})

describe('createGameEngine', () => {
  it('applies looped-back actions once in action mode', async () => {
    const transport = new LocalTransport()
    const engine = createGameEngine({
      transport,
      definition: testDefinition,
      syncMode: 'action',
    })
    const listener = vi.fn()

    engine.subscribe(listener)
    await engine.connect('room-1')
    engine.sendAction(incrementAction())

    expect(engine.getState().count).toBe(1)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('replaces local state from transport snapshots in state mode', async () => {
    const transport = new LocalTransport()
    const engine = createGameEngine({
      transport,
      definition: testDefinition,
      syncMode: 'state',
    })
    const listener = vi.fn()
    const snapshot: TestState = { count: 42, appliedActionIds: ['snap-1'] }

    engine.subscribe(listener)
    await engine.connect('room-1')
    transport.sendState(snapshot)

    expect(engine.getState().count).toBe(42)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('routes validation errors through middleware', async () => {
    const transport = new LocalTransport()
    const onError = vi.fn()
    const engine = createGameEngine({
      transport,
      definition: testDefinition,
      syncMode: 'action',
      middleware: [{ onError }],
    })

    await engine.connect('room-1')
    engine.sendAction({
      ...incrementAction(),
      version: 999,
    } as unknown as TestAction)

    expect(onError).toHaveBeenCalledTimes(1)
    expect(engine.getState()).toEqual(testDefinition.createInitialState())
  })

  it('disconnect cleans up transport', async () => {
    const transport = new LocalTransport()
    const onError = vi.fn()
    const engine = createGameEngine({
      transport,
      definition: testDefinition,
      syncMode: 'action',
      middleware: [{ onError }],
    })

    await engine.connect('room-1')
    void engine.disconnect()
    engine.sendAction(incrementAction())

    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('reconnect restores action flow', async () => {
    const transport = new LocalTransport()
    const engine = createGameEngine({
      transport,
      definition: testDefinition,
      syncMode: 'action',
    })

    await engine.connect('room-1')
    void engine.disconnect()
    await engine.connect('room-1')
    engine.sendAction(incrementAction())

    expect(engine.getState().count).toBe(1)
  })

  it('duplicate remote actions are applied once', async () => {
    const transport = new LocalTransport()
    const engine = createGameEngine({
      transport,
      definition: testDefinition,
      syncMode: 'action',
    })
    const listener = vi.fn()

    engine.subscribe(listener)
    await engine.connect('room-1')
    transport.sendAction(incrementAction())
    transport.sendAction(incrementAction())

    expect(listener).toHaveBeenCalledTimes(2)
    expect(engine.getState().count).toBe(1)
  })

  it('beforeSend middleware fires on outbound actions', async () => {
    const transport = new LocalTransport()
    const beforeSend = vi.fn()
    const engine = createGameEngine({
      transport,
      definition: testDefinition,
      syncMode: 'action',
      middleware: [{ beforeSend }],
    })

    await engine.connect('room-1')
    engine.sendAction(incrementAction())

    expect(beforeSend).toHaveBeenCalledTimes(1)
    expect(beforeSend).toHaveBeenCalledWith(
      incrementAction(),
      expect.any(Object)
    )
  })

  it('beforeApply fires before afterApply around reducer', async () => {
    const transport = new LocalTransport()
    const order: string[] = []
    const engine = createGameEngine({
      transport,
      definition: testDefinition,
      syncMode: 'action',
      middleware: [
        {
          beforeApply: () => order.push('before'),
          afterApply: () => order.push('after'),
        },
      ],
    })

    await engine.connect('room-1')
    transport.sendAction(incrementAction())

    expect(order).toEqual(['before', 'after'])
  })

  it('multiple middlewares fire in array order', async () => {
    const transport = new LocalTransport()
    const order: number[] = []
    const engine = createGameEngine({
      transport,
      definition: testDefinition,
      syncMode: 'action',
      middleware: [
        { beforeSend: () => order.push(1) },
        { beforeSend: () => order.push(2) },
      ],
    })

    await engine.connect('room-1')
    engine.sendAction(incrementAction())

    expect(order).toEqual([1, 2])
  })
})
