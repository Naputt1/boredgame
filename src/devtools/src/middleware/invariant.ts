import type { GameEngineMiddleware } from '@boredgame/core'

export type InvariantPredicate = (state: unknown, action: unknown) => boolean

export const invariantMiddleware = (
  predicate: InvariantPredicate,
  message = 'Invariant violation'
): GameEngineMiddleware => ({
  afterApply(action, state) {
    if (!predicate(state, action)) {
      const err = new Error(
        `${message}\naction: ${JSON.stringify(action)}\nstate: ${JSON.stringify(state)}`
      )
      console.error(err)
      throw err
    }
  },
})
