import type { GameDefinition } from '@boredgame/core'
import { saboteurActionSchema } from './actions'
import type { SaboteurAction } from './actions'
import { createInitialState, type SaboteurState } from './state'
import { saboteurReducer } from './reducer'
import { SaboteurView } from './SaboteurView'

export type { SaboteurState } from './state'
export type { SaboteurAction } from './actions'
export type {
  Card,
  Role,
  PathShape,
  ActionType,
  CellContent,
  GoalCardState,
} from './state'
export { PathCard, ActionCard } from './state'

export {
  createInitialState,
  BOARD_COLS,
  BOARD_ROWS,
  START_COL,
  START_ROW,
  GOAL_COLS,
} from './state'
export * from './actions'

export const saboteurDefinition: GameDefinition<SaboteurState, SaboteurAction> =
  {
    id: 'boredgame-saboteur',
    name: 'Saboteur',
    version: {
      engine: '0.1.0',
      state: '1.0.0',
      actionSchema: '1.0.0',
    },
    metadata: {
      description:
        'Dwarves dig for gold while saboteurs try to thwart them. A card game of tunneling and trickery.',
      minPlayers: 3,
      maxPlayers: 10,
      tags: ['card', 'party', 'multiplayer'],
    },
    createInitialState,
    reducer: saboteurReducer,
    actionSchema: saboteurActionSchema,
    renderer: SaboteurView,
  }
