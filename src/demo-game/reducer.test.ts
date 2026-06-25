import { describe, expect, it } from 'vitest'
import { createInitialState, demoGameReducer, replayActions } from '.'
import { GAME_ACTION_VERSION, DemoGameAction } from './actions'

const meta = (
  actionId: string,
  playerId = 'player-1'
): DemoGameAction['meta'] => ({
  playerId,
  timestamp: 1,
  actionId,
})

const joinAction = (actionId = 'join-1'): DemoGameAction => ({
  type: 'player.joined',
  version: GAME_ACTION_VERSION,
  payload: {
    playerId: 'player-1',
    name: 'Player 1',
    color: '#2563eb',
    tokenId: 'token-1',
    startPosition: { x: 0, y: 0 },
  },
  meta: meta(actionId),
})

const moveAction = (actionId = 'move-1', x = 2, y = 3): DemoGameAction => ({
  type: 'token.moved',
  version: GAME_ACTION_VERSION,
  payload: {
    tokenId: 'token-1',
    to: { x, y },
  },
  meta: meta(actionId),
})

describe('demoGameReducer', () => {
  it('joins players immutably', () => {
    const initialState = createInitialState()
    const nextState = demoGameReducer(initialState, joinAction())

    expect(nextState).not.toBe(initialState)
    expect(initialState.players).toEqual({})
    expect(nextState.players['player-1'].name).toBe('Player 1')
    expect(nextState.tokens['token-1'].position).toEqual({ x: 0, y: 0 })
  })

  it('moves tokens within board bounds', () => {
    const joined = demoGameReducer(createInitialState(), joinAction())
    const moved = demoGameReducer(joined, moveAction())

    expect(moved.tokens['token-1'].position).toEqual({ x: 2, y: 3 })
  })

  it('records but ignores out-of-bounds moves', () => {
    const joined = demoGameReducer(createInitialState(), joinAction())
    const moved = demoGameReducer(joined, moveAction('move-out', 99, 99))

    expect(moved.tokens['token-1'].position).toEqual({ x: 0, y: 0 })
    expect(moved.appliedActionIds).toContain('move-out')
  })

  it('does not apply duplicate action ids twice', () => {
    const joined = demoGameReducer(createInitialState(), joinAction())
    const moved = demoGameReducer(joined, moveAction('duplicate', 1, 1))
    const duplicate = demoGameReducer(moved, moveAction('duplicate', 4, 4))

    expect(duplicate).toBe(moved)
    expect(duplicate.tokens['token-1'].position).toEqual({ x: 1, y: 1 })
  })

  it('replays action history deterministically', () => {
    const actions = [joinAction(), moveAction('move-1', 4, 5)]
    const firstReplay = replayActions(createInitialState(), actions)
    const secondReplay = replayActions(createInitialState(), actions)

    expect(firstReplay).toEqual(secondReplay)
  })

  it('resets to initial state and records reset action', () => {
    const joined = demoGameReducer(createInitialState(), joinAction())
    const reset = demoGameReducer(joined, {
      type: 'game.reset',
      version: GAME_ACTION_VERSION,
      payload: {},
      meta: meta('reset-1'),
    })

    expect(reset.players).toEqual({})
    expect(reset.tokens).toEqual({})
    expect(reset.appliedActionIds).toEqual(['reset-1'])
  })

  it('rejects move for nonexistent token', () => {
    const state = createInitialState()
    const result = demoGameReducer(state, moveAction('no-token-move', 4, 5))

    expect(result.tokens).toEqual({})
    expect(result.appliedActionIds).toContain('no-token-move')
  })

  it('produces different results for different action orderings', () => {
    const actionsA = [joinAction('a-join'), moveAction('a-move', 4, 5)]
    const actionsB = [moveAction('b-move', 4, 5), joinAction('b-join')]
    const resultA = replayActions(createInitialState(), actionsA)
    const resultB = replayActions(createInitialState(), actionsB)

    expect(resultA.tokens['token-1'].position).toEqual({ x: 4, y: 5 })
    expect(resultB.tokens['token-1'].position).toEqual({ x: 0, y: 0 })
    expect(resultA.appliedActionIds).toEqual(['a-join', 'a-move'])
    expect(resultB.appliedActionIds).toEqual(['b-move', 'b-join'])
  })

  it('does not perform version validation (delegated to schema parser)', () => {
    const state = createInitialState()
    const result = demoGameReducer(state, {
      ...joinAction('bad-version'),
      version: 999,
    } as unknown as import('./actions').DemoGameAction)

    expect(result.players['player-1'].name).toBe('Player 1')
  })

  it('returns same state for empty action list in replay', () => {
    const state = createInitialState()
    const result = replayActions(state, [])

    expect(result).toBe(state)
  })

  it('does not mutate inputs during replay', () => {
    const initialState = createInitialState()
    const action = joinAction('immutable-1')
    const actions: readonly DemoGameAction[] = [action]
    const actionSnapshot = { ...action, meta: { ...action.meta } }

    replayActions(initialState, actions)

    expect(initialState).toEqual(createInitialState())
    expect(action).toEqual(actionSnapshot)
  })
})
