import { Primitive, registerClass, Deck } from '@boredgame/primitives'

export type CardId = string
export type PlayerId = string
export type Role = 'miner' | 'saboteur'
export type PathShape =
  | 'straight'
  | 'curve'
  | 't-junction'
  | 'cross'
  | 'dead-end'
  | 'start'
  | 'goal-gold'
  | 'goal-stone'

export class PathCard extends Primitive<{
  id: string
  suit: 'path'
  shape: PathShape
  connections: [boolean, boolean, boolean, boolean]
  rotation: 0 | 90 | 180 | 270
}> {
  static _type = 'saboteur:path-card'
  suit!: 'path'
  shape!: PathShape
  connections!: [boolean, boolean, boolean, boolean]
  rotation!: 0 | 90 | 180 | 270
}

export type ActionType =
  | 'break-pickaxe'
  | 'break-lantern'
  | 'break-wagon'
  | 'repair-pickaxe'
  | 'repair-lantern'
  | 'repair-wagon'
  | 'repair-dual'
  | 'rockfall'
  | 'map'

export class ActionCard extends Primitive<{
  id: string
  suit: 'action'
  actionType: ActionType
}> {
  static _type = 'saboteur:action-card'
  suit!: 'action'
  actionType!: ActionType
}

export type Card = PathCard | ActionCard

export type CellContent = {
  card: PathCard
  rotation?: 0 | 90 | 180 | 270
}

export type GoalCardState = {
  id: CardId
  col: number
  row: number
  isTreasure: boolean
  revealed: boolean
  connections: [boolean, boolean, boolean, boolean]
}

export type PendingAction =
  | { type: 'place-path'; cardId: string }
  | { type: 'action-target'; cardId: string; actionType: ActionType }
  | { type: 'rockfall-target'; cardId: string }
  | { type: 'map-peek'; cardId: string }

export type SaboteurState = {
  round: number
  phase: 'joining' | 'setup' | 'playing' | 'round-end' | 'game-over'

  players: Record<PlayerId, { id: PlayerId; name: string }>
  playerOrder: PlayerId[]
  currentPlayerIndex: number
  roles: Record<PlayerId, Role>
  goldNuggets: Record<PlayerId, number>

  deck: Deck<Card>
  discardPile: Card[]
  hands: Record<PlayerId, Card[]>

  board: (CellContent | null)[][]
  boardWidth: number
  boardHeight: number
  startPos: { col: number; row: number }
  goalCards: GoalCardState[]

  brokenTools: Record<PlayerId, ActionCard[]>

  pendingAction: PendingAction | null

  lastPathPlayerId: PlayerId | null

  goldDist: {
    mode: 'miners-win' | 'saboteurs-win'
    chooserChain: PlayerId[]
    currentChooserIdx: number
    nuggetPool: number[]
    saboteurPayout: number
  } | null

  appliedActionIds: string[]
}

export const BOARD_COLS = 5
export const BOARD_ROWS = 9
export const START_COL = 2
export const START_ROW = 8
export const GOAL_ROWS = [0, 0, 0]
export const GOAL_COLS = [0, 2, 4]

registerClass(
  'saboteur:path-card',
  PathCard as unknown as new (data: unknown) => Primitive
)
registerClass(
  'saboteur:action-card',
  ActionCard as unknown as new (data: unknown) => Primitive
)
registerClass('deck', Deck as unknown as new (data: unknown) => Primitive)

const N = 0,
  E = 1,
  S = 2,
  W = 3

const rotateConns = (
  conns: [boolean, boolean, boolean, boolean],
  rot: 0 | 90 | 180 | 270
): [boolean, boolean, boolean, boolean] => {
  const shifts = rot / 90
  const r: [boolean, boolean, boolean, boolean] = [false, false, false, false]
  for (let i = 0; i < 4; i++) r[(i + shifts) % 4] = conns[i]
  return r
}

const makePathCard = (
  id: CardId,
  shape: PathShape,
  baseConns: [boolean, boolean, boolean, boolean],
  rotation: 0 | 90 | 180 | 270
): PathCard =>
  new PathCard({
    id,
    suit: 'path',
    shape,
    connections: rotateConns(baseConns, rotation),
    rotation,
  })

const makeActionCard = (id: CardId, actionType: ActionType): ActionCard =>
  new ActionCard({ id, suit: 'action', actionType })

const cardId = (() => {
  let i = 0
  return () => {
    const id = i++
    return `card:${String(id)}`
  }
})()

export const getStartCard = (): PathCard =>
  makePathCard('card:start', 'start', [false, true, true, true], 0)

export const getGoalCard = (isTreasure: boolean): PathCard =>
  makePathCard(
    `card:goal:${isTreasure ? 'gold' : 'stone'}`,
    isTreasure ? 'goal-gold' : 'goal-stone',
    [false, false, true, false],
    0
  )

const createEmptyGrid = (
  cols: number,
  rows: number
): (CellContent | null)[][] =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => null))

export const buildDeck = (): Deck<Card> => {
  const items: Card[] = []

  const pathSpecs: Array<{
    shape: PathShape
    base: [boolean, boolean, boolean, boolean]
    rots: Array<0 | 90 | 180 | 270>
    count: number
  }> = [
    {
      shape: 'straight',
      base: [true, false, true, false],
      rots: [0],
      count: 5,
    },
    {
      shape: 'straight',
      base: [false, true, false, true],
      rots: [0],
      count: 3,
    },
    {
      shape: 'curve',
      base: [true, true, false, false],
      rots: [0, 90, 180, 270],
      count: 2,
    },
    {
      shape: 't-junction',
      base: [true, true, true, false],
      rots: [0, 90, 180, 270],
      count: 3,
    },
    { shape: 'cross', base: [true, true, true, true], rots: [0], count: 1 },
    {
      shape: 'dead-end',
      base: [true, false, false, false],
      rots: [0, 90, 180, 270],
      count: 2,
    },
  ]

  for (const spec of pathSpecs) {
    for (let i = 0; i < spec.count; i++) {
      for (const rot of spec.rots) {
        items.push(makePathCard(cardId(), spec.shape, spec.base, rot))
      }
    }
  }

  const actionSpecs: Array<{ type: ActionType; count: number }> = [
    { type: 'break-pickaxe', count: 3 },
    { type: 'break-lantern', count: 3 },
    { type: 'break-wagon', count: 3 },
    { type: 'repair-pickaxe', count: 2 },
    { type: 'repair-lantern', count: 2 },
    { type: 'repair-wagon', count: 2 },
    { type: 'repair-dual', count: 3 },
    { type: 'rockfall', count: 3 },
    { type: 'map', count: 2 },
  ]

  for (const spec of actionSpecs) {
    for (let i = 0; i < spec.count; i++) {
      items.push(makeActionCard(cardId(), spec.type))
    }
  }

  return new Deck<Card>({ items, id: 'deck' })
}

export const createInitialState = (): SaboteurState => {
  const board = createEmptyGrid(BOARD_COLS, BOARD_ROWS)
  board[START_ROW][START_COL] = { card: getStartCard() }

  const goalCards: GoalCardState[] = []
  const treasureIdx = Math.floor(Math.random() * 3)

  for (let i = 0; i < 3; i++) {
    const col = GOAL_COLS[i]
    const isTreasure = i === treasureIdx
    goalCards.push({
      id: `goal:${String(i)}`,
      col,
      row: GOAL_ROWS[i],
      isTreasure,
      revealed: false,
      connections: [false, false, true, false],
    })
  }

  return {
    round: 1,
    phase: 'joining',

    players: {},
    playerOrder: [],
    currentPlayerIndex: 0,
    roles: {},
    goldNuggets: {},

    deck: buildDeck(),
    discardPile: [],
    hands: {},

    board,
    boardWidth: BOARD_COLS,
    boardHeight: BOARD_ROWS,
    startPos: { col: START_COL, row: START_ROW },
    goalCards,

    brokenTools: {},

    pendingAction: null,

    lastPathPlayerId: null,

    goldDist: null,

    appliedActionIds: [],
  }
}

export const getHandSize = (playerCount: number): number => {
  if (playerCount <= 5) return 6
  if (playerCount <= 7) return 5
  return 4
}

export const getSaboteurCount = (playerCount: number): number => {
  if (playerCount <= 4) return 1
  if (playerCount <= 6) return 2
  if (playerCount <= 9) return 3
  return 4
}

export const getAdjacentPositions = (
  col: number,
  row: number,
  w: number,
  h: number
): Array<{ col: number; row: number; dir: number }> => {
  const dirs = [
    { dc: 0, dr: -1, dir: N },
    { dc: 1, dr: 0, dir: E },
    { dc: 0, dr: 1, dir: S },
    { dc: -1, dr: 0, dir: W },
  ]
  return dirs
    .map((d) => ({ col: col + d.dc, row: row + d.dr, dir: d.dir }))
    .filter((p) => p.col >= 0 && p.col < w && p.row >= 0 && p.row < h)
}

export const canPlacePath = (
  board: (CellContent | null)[][],
  col: number,
  row: number,
  card: PathCard,
  w: number,
  h: number,
  startPos: { col: number; row: number },
  goalCards: GoalCardState[]
): boolean => {
  if (col < 0 || col >= w || row < 0 || row >= h) return false
  if (board[row][col] !== null) return false
  if (row === startPos.row && col === startPos.col) return false
  if (goalCards.some((g) => g.col === col && g.row === row)) return false

  const adj = getAdjacentPositions(col, row, w, h)
  let hasConnection = false

  for (const a of adj) {
    const neighbor = board[a.row][a.col]
    if (!neighbor) continue
    const opp = (a.dir + 2) % 4
    const myConn = card.connections[a.dir]
    const theirConn = neighbor.card.connections[opp]
    if (myConn && theirConn) {
      hasConnection = true
    } else if (myConn !== theirConn) {
      return false
    }
  }

  return hasConnection
}

export const hasPathToGoal = (
  board: (CellContent | null)[][],
  goalCol: number,
  goalRow: number,
  w: number,
  h: number,
  startPos: { col: number; row: number },
  goalCards: GoalCardState[]
): boolean => {
  const visited = new Set<string>()
  const stack: Array<{ col: number; row: number }> = []

  const start = board[startPos.row][startPos.col]
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (start && start.card.suit === 'path') {
    stack.push({ col: startPos.col, row: startPos.row })
  }

  while (stack.length > 0) {
    const pos = stack.pop()
    if (!pos) continue
    const key = `${String(pos.col)},${String(pos.row)}`
    if (visited.has(key)) continue
    visited.add(key)

    const goal = goalCards.find((g) => g.col === pos.col && g.row === pos.row)
    if (goal && goal.col === goalCol && goal.row === goalRow) return true

    const cell = board[pos.row][pos.col]
    if (!cell) continue
    const card = cell.card

    if (card.shape === 'goal-gold' || card.shape === 'goal-stone') {
      if (goalCol === pos.col && goalRow === pos.row) return true
    }

    const adj = getAdjacentPositions(pos.col, pos.row, w, h)
    for (const a of adj) {
      if (!card.connections[a.dir]) continue
      const neighbor = board[a.row][a.col]
      if (!neighbor) continue
      const opp = (a.dir + 2) % 4
      if (neighbor.card.connections[opp]) {
        stack.push({ col: a.col, row: a.row })
      }
    }
  }

  return false
}

export const getOpenAdjacents = (
  board: (CellContent | null)[][],
  w: number,
  h: number,
  startPos: { col: number; row: number },
  goalCards: GoalCardState[]
): Array<{ col: number; row: number }> => {
  const open: Array<{ col: number; row: number }> = []
  const goalSet = new Set(
    goalCards.map((g) => `${String(g.col)},${String(g.row)}`)
  )

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const cell = board[row][col]
      if (!cell) continue
      const adj = getAdjacentPositions(col, row, w, h)
      for (const a of adj) {
        const key = `${String(a.col)},${String(a.row)}`
        if (
          !board[a.row][a.col] &&
          !goalSet.has(key) &&
          !(a.row === startPos.row && a.col === startPos.col)
        ) {
          if (!open.some((o) => o.col === a.col && o.row === a.row)) {
            open.push({ col: a.col, row: a.row })
          }
        }
      }
    }
  }

  for (const goal of goalCards) {
    if (goal.revealed) continue
    const adj = getAdjacentPositions(goal.col, goal.row, w, h)
    for (const a of adj) {
      if (
        !board[a.row][a.col] &&
        !goalSet.has(`${String(a.col)},${String(a.row)}`)
      ) {
        if (!open.some((o) => o.col === a.col && o.row === a.row)) {
          open.push({ col: a.col, row: a.row })
        }
      }
    }
  }

  return open
}

export const noPlayableCards = (state: SaboteurState): boolean => {
  for (const pid of state.playerOrder) {
    const hand = state.hands[pid]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!hand || hand.length === 0) continue
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const broken = state.brokenTools[pid] || []
    const hasPath = hand.some((c) => c.suit === 'path')
    const hasAction = hand.some((c) => c.suit === 'action')
    if ((hasPath && broken.length === 0) || hasAction) {
      return false
    }
  }
  return true
}

export const buildNuggetPool = (): number[] => {
  const pool: number[] = []
  for (const [value, count] of [
    [1, 8],
    [2, 8],
    [3, 8],
    [4, 4],
  ] as const) {
    for (let i = 0; i < count; i++) pool.push(value)
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool
}
