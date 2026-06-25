# Boredgame

Discord-ready board game framework. Build multiplayer board games that run as Discord Activities (or standalone web apps).

## Architecture

```
                      GameDefinition<TState, TAction>
                     ┌──────────────────────────────────┐
                     │ id     name    reducer            │
                     │ createInitialState   actionSchema │
                     │ renderer       middleware (opt)   │
                     └──────────────────────────────────┘
                                   │
┌────────────┐    ┌──────────────┐ ▽ ┌──────────────────┐
│  Transport │◄───│    Engine    │───│  React Provider  │
│ (WS/P2P)   │    │ (generic)   │   │ (context + hook) │
└────────────┘    └──────────────┘   └──────────────────┘
                                              │
                                    ┌─────────▽─────────┐
                                    │  GameScreen (app) │
                                    │  uses useGame()   │
                                    └───────────────────┘
```

## Create a new board game in 5 files

Every game is a `GameDefinition<TState, TAction>` — a plain object describing your game's types, logic, and renderer. Drop it into the engine and it just works.

### 1. `state.ts` — Game state

```typescript
export type MyState = {
  score: number
  players: string[]
  appliedActionIds: string[]
}

export const createInitialState = (): MyState => ({
  score: 0,
  players: [],
  appliedActionIds: [],
})
```

Include an `appliedActionIds` array for idempotent action replay — the reducer uses this to skip duplicate actions.

### 2. `actions.ts` — Action schemas (Zod)

```typescript
import { z } from 'zod'

export const rollDiceSchema = z.object({
  type: z.literal('roll.dice'),
  version: z.literal(1),
  payload: z.object({ playerId: z.string().min(1) }),
  meta: z.object({
    actionId: z.string().min(1),
    playerId: z.string().min(1),
    timestamp: z.number().int().nonnegative(),
  }),
})

export const myActionSchema = z.discriminatedUnion('type', [rollDiceSchema])
export type MyAction = z.infer<typeof myActionSchema>
```

The `meta` block is required — it carries `actionId` for deduplication and `playerId`/`timestamp` for auditing.

### 3. `reducer.ts` — Pure reducer

```typescript
import type { MyAction } from './actions'
import type { MyState } from './state'
import { createInitialState } from './state'

export const myReducer = (state: MyState, action: MyAction): MyState => {
  if (state.appliedActionIds.includes(action.meta.actionId)) {
    return state
  }

  switch (action.type) {
    case 'roll.dice': {
      const roll = Math.floor(Math.random() * 6) + 1
      return {
        ...state,
        score: state.score + roll,
        appliedActionIds: [...state.appliedActionIds, action.meta.actionId],
      }
    }
  }
}
```

For deterministic games (replayable from an action log), use `@boredgame/utils` seeded RNG instead of `Math.random()`.

### 4. `Board.tsx` — React renderer

```typescript
import type { GameRendererProps } from "@boredgame/core";
import type { MyState, MyAction } from "./types";

export const MyBoard = ({
  state,
  playerId,
  sendAction,
  participants
}: GameRendererProps<MyState, MyAction>) => {
  return (
    <div>
      <p>Score: {state.score}</p>
      <button
        onClick={() =>
          sendAction({
            type: "roll.dice",
            version: 1,
            payload: { playerId },
            meta: {
              actionId: crypto.randomUUID(),
              playerId,
              timestamp: Date.now()
            }
          })
        }
      >
        Roll
      </button>
    </div>
  );
};
```

### 5. `definition.ts` — Wire it up

```typescript
import type { GameDefinition } from '@boredgame/core'
import { myActionSchema } from './actions'
import type { MyAction } from './actions'
import { createInitialState } from './state'
import type { MyState } from './state'
import { myReducer } from './reducer'
import { MyBoard } from './Board'

export const myGameDefinition: GameDefinition<MyState, MyAction> = {
  id: 'my-game',
  name: 'My Game',
  createInitialState,
  reducer: myReducer,
  actionSchema: myActionSchema,
  renderer: MyBoard,
}
```

### Using it

```typescript
import { PlatformProvider } from "@boredgame/platform";
import { myGameDefinition } from "./my-game";

<PlatformProvider gameDefinition={myGameDefinition}>
  <App />
</PlatformProvider>
```

Inside your app:

```typescript
import { useGame } from '@boredgame/react'
import type { MyState, MyAction } from './my-game'

const { state, sendAction, connected } = useGame<MyState, MyAction>()
```

### Adding to the server

```typescript
import { Room } from '@boredgame/server'
import { myGameDefinition } from './my-game'

const room = new Room('room-1', myGameDefinition)
```

## Seeded RNG (optional)

For games that need deterministic randomness (e.g., shuffle, roll with replay):

```typescript
import { createSeededRng, hashSeed } from '@boredgame/utils'

// Deterministic seed from game config
const seed = hashSeed('my-game', 'room-42', 'player-1')
const rng = createSeededRng(seed)

rng.next() // float in [0, 1)
rng.nextInt(1, 6) // dice roll
rng.shuffle(deck) // Fisher-Yates shuffle
rng.pick(hand) // random card
```

Two players with the same seed get the same shuffle order — perfect for synchronizing random setup without network chatter.

## Packages

| Package                | Purpose                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `@boredgame/core`      | `GameDefinition` type, middleware types                       |
| `@boredgame/engine`    | Generic game engine — runs reducer, validates actions via Zod |
| `@boredgame/react`     | React context provider + `useGame` hook                       |
| `@boredgame/transport` | Network layer (WebSocket, Local loopback, P2P stub)           |
| `@boredgame/platform`  | Discord SDK integration + fallback local mode                 |
| `@boredgame/server`    | WebSocket server — multi-room, action relay, state snapshots  |
| `@boredgame/utils`     | Seeded PRNG, hashSeed, (more utilities to come)               |
| `@boredgame/demo-game` | Reference demo game (token moving on an 8×8 board)            |

## Development

```bash
pnpm install
pnpm dev:sample    # start the sample game at http://127.0.0.1:5173
pnpm test          # run all tests
```
