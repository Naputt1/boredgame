import type { GameDefinition } from '@boredgame/core'
import { unoActionSchema } from './actions'
import type { UnoAction } from './actions'
import { createInitialState, type UnoState } from './state'
import { unoReducer } from './reducer'
import { UnoView } from './UnoView'

export type { UnoState } from './state'
export type { UnoAction } from './actions'
export type { UnoColor, UnoValue } from './state'
export { UnoCard } from './state'

export { createInitialState, COLORS, VALUES, buildDeck } from './state'
export * from './actions'

export const unoDefinition: GameDefinition<UnoState, UnoAction> = {
  id: 'boredgame-uno',
  name: 'UNO',
  version: {
    engine: '0.1.0',
    state: '1.0.0',
    actionSchema: '1.0.0',
  },
  metadata: {
    description:
      'Match cards by color or value. Be the first to empty your hand!',
    minPlayers: 1,
    maxPlayers: 10,
    tags: ['card', 'party', 'multiplayer'],
  },
  createInitialState,
  reducer: unoReducer,
  actionSchema: unoActionSchema,
  renderer: UnoView,
}
