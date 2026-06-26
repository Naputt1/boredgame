import { Deck, Primitive } from '@boredgame/primitives'
import type { SaboteurAction } from './actions'
import {
  createInitialState,
  type SaboteurState,
  type Card,
  type PlayerId,
  PathCard,
  type ActionCard,
  type ActionType,
  type Role,
  type CellContent,
  BOARD_COLS,
  BOARD_ROWS,
  START_COL,
  START_ROW,
  GOAL_COLS,
  canPlacePath,
  hasPathToGoal,
  getHandSize,
  getSaboteurCount,
  getStartCard,
  getGoalCard,
  buildDeck,
  noPlayableCards,
  buildNuggetPool,
} from './state'

const appendId = (s: SaboteurState, id: string): string[] => [
  ...s.appliedActionIds,
  id,
]

const shuffleRoles = <T>(arr: T[]): T[] => {
  const r = [...arr]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

const getRoleCounts = (
  totalPlayers: number
): { miners: number; saboteurs: number } => {
  const s = getSaboteurCount(totalPlayers)
  return { miners: totalPlayers - s, saboteurs: s }
}

const getSaboteurPayout = (state: SaboteurState): number => {
  const sCount = Object.values(state.roles).filter(
    (r) => r === 'saboteur'
  ).length
  if (sCount <= 1) return 4
  if (sCount <= 3) return 3
  return 2
}

const replaceOrAddCell = (
  board: (CellContent | null)[][],
  col: number,
  row: number,
  content: CellContent
): (CellContent | null)[][] => {
  const b = board.map((r) => [...r])
  b[row] = [...b[row]]
  b[row][col] = content
  return b
}

export const saboteurReducer = (
  state: SaboteurState,
  action: SaboteurAction
): SaboteurState => {
  if (state.appliedActionIds.includes(action.meta.actionId)) {
    return state
  }

  if (!(state.deck instanceof Deck)) {
    state = {
      ...state,
      deck: Primitive.fromJSON(state.deck) as Deck<Card>,
    }
  }

  switch (action.type) {
    case 'join.game': {
      if (state.phase !== 'joining')
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (state.players[action.payload.playerId])
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }
      if (Object.keys(state.players).length >= 10)
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }

      const newPlayers = {
        ...state.players,
        [action.payload.playerId]: {
          id: action.payload.playerId,
          name: action.payload.name,
        },
      }
      const newOrder = [...state.playerOrder, action.payload.playerId]
      const playerCount = newOrder.length

      if (playerCount >= 3) {
        const roleCounts = getRoleCounts(playerCount)
        const roleDeck: Role[] = [
          ...Array<Role>(roleCounts.miners).fill('miner'),
          ...Array<Role>(roleCounts.saboteurs).fill('saboteur'),
        ]
        const shuffledRoles = shuffleRoles(roleDeck)
        const roles: Record<PlayerId, Role> = {}
        newOrder.forEach((pid, i) => {
          roles[pid] = shuffledRoles[i]
        })

        const handSize = getHandSize(playerCount)
        const { drawn, deck: remaining } = state.deck
          .shuffle()
          .draw(handSize * playerCount)
        const hands: Record<PlayerId, Card[]> = {}
        let deckPtr = 0
        for (const pid of newOrder) {
          const hand: Card[] = []
          for (let h = 0; h < handSize; h++) {
            if (deckPtr < drawn.length) {
              hand.push(drawn[deckPtr++])
            }
          }
          hands[pid] = hand
        }

        return {
          ...state,
          players: newPlayers,
          playerOrder: newOrder,
          roles,
          hands,
          deck: remaining,
          brokenTools: {},
          phase: 'playing',
          currentPlayerIndex: 0,
          pendingAction: null,
          goldDist: null,
          appliedActionIds: appendId(state, action.meta.actionId),
        }
      }

      return {
        ...state,
        players: newPlayers,
        playerOrder: newOrder,
        appliedActionIds: appendId(state, action.meta.actionId),
      }
    }

    case 'play.path': {
      if (state.phase !== 'playing')
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }

      const pid = action.meta.playerId
      if (state.playerOrder[state.currentPlayerIndex] !== pid) {
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }
      }

      const broken = state.brokenTools[pid]
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (broken && broken.length > 0) {
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }
      }

      const hand = state.hands[pid]
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!hand)
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }

      const cardIdx = hand.findIndex((c) => c.id === action.payload.cardId)
      if (cardIdx === -1)
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }

      const card = hand[cardIdx] as PathCard
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (card.suit !== 'path')
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }

      const { col, row, rotation } = action.payload

      const placedCard = new PathCard({
        id: card.id,
        suit: 'path',
        shape: card.shape,
        rotation,
        connections: rotateConnectionsForAction(card, rotation),
      })

      if (
        !canPlacePath(
          state.board,
          col,
          row,
          placedCard,
          BOARD_COLS,
          BOARD_ROWS,
          state.startPos,
          state.goalCards
        )
      ) {
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }
      }

      const newHand = hand.filter((c) => c.id !== card.id)
      const newBoard = replaceOrAddCell(state.board, col, row, {
        card: placedCard,
      })

      const reachedGoal = state.goalCards.find(
        (g) =>
          !g.revealed &&
          Math.abs(g.col - col) <= 1 &&
          Math.abs(g.row - row) <= 1 &&
          hasPathToGoal(
            newBoard,
            g.col,
            g.row,
            BOARD_COLS,
            BOARD_ROWS,
            state.startPos,
            state.goalCards
          )
      )

      if (reachedGoal) {
        const newGoals = state.goalCards.map((g) => {
          if (g.id === reachedGoal.id) return { ...g, revealed: true }
          return g
        })

        if (reachedGoal.isTreasure) {
          const goalCard = getGoalCard(true)
          const boardWithGoal = replaceOrAddCell(
            newBoard,
            reachedGoal.col,
            reachedGoal.row,
            { card: goalCard }
          )

          const drawResult =
            state.deck.size > 0
              ? state.deck.draw(1)
              : { drawn: [], deck: state.deck }
          const finalHand =
            drawResult.drawn.length > 0
              ? [...newHand, ...drawResult.drawn]
              : newHand

          const minerOrder = state.playerOrder.filter(
            (p) => state.roles[p] === 'miner'
          )
          const pool = buildNuggetPool()
          const drawCount = minerOrder.length

          return {
            ...state,
            board: boardWithGoal,
            goalCards: newGoals,
            hands: { ...state.hands, [pid]: finalHand },
            deck: drawResult.deck,
            currentPlayerIndex:
              (state.currentPlayerIndex + 1) % state.playerOrder.length,
            phase: 'round-end',
            lastPathPlayerId: pid,
            goldDist: {
              mode: 'miners-win',
              chooserChain: minerOrder,
              currentChooserIdx: minerOrder.indexOf(pid),
              nuggetPool: pool.slice(0, drawCount),
              saboteurPayout: 0,
            },
            appliedActionIds: appendId(state, action.meta.actionId),
          }
        } else {
          const goalCard = getGoalCard(false)
          const boardWithGoal = replaceOrAddCell(
            newBoard,
            reachedGoal.col,
            reachedGoal.row,
            { card: goalCard }
          )

          const drawResult =
            state.deck.size > 0
              ? state.deck.draw(1)
              : { drawn: [], deck: state.deck }
          const finalHand =
            drawResult.drawn.length > 0
              ? [...newHand, ...drawResult.drawn]
              : newHand

          return {
            ...state,
            board: boardWithGoal,
            goalCards: newGoals,
            hands: { ...state.hands, [pid]: finalHand },
            deck: drawResult.deck,
            currentPlayerIndex:
              (state.currentPlayerIndex + 1) % state.playerOrder.length,
            lastPathPlayerId: pid,
            appliedActionIds: appendId(state, action.meta.actionId),
          }
        }
      }

      const drawResult =
        state.deck.size > 0
          ? state.deck.draw(1)
          : { drawn: [], deck: state.deck }
      const finalHand =
        drawResult.drawn.length > 0
          ? [...newHand, ...drawResult.drawn]
          : newHand

      const nextIdx = (state.currentPlayerIndex + 1) % state.playerOrder.length

      const isDeckEmpty = drawResult.deck.size === 0
      const updatedAllHands = { ...state.hands, [pid]: finalHand }
      const updatedState = {
        ...state,
        hands: updatedAllHands,
        deck: drawResult.deck,
      }
      const stuck = isDeckEmpty && noPlayableCards(updatedState)

      return {
        ...state,
        board: newBoard,
        hands: updatedAllHands,
        deck: drawResult.deck,
        currentPlayerIndex: nextIdx,
        lastPathPlayerId: pid,
        phase: stuck ? 'round-end' : state.phase,
        goldDist: stuck
          ? {
              mode: 'saboteurs-win',
              chooserChain: state.playerOrder.filter(
                (p) => state.roles[p] === 'saboteur'
              ),
              currentChooserIdx: 0,
              nuggetPool: [],
              saboteurPayout: getSaboteurPayout(state),
            }
          : state.goldDist,
        appliedActionIds: appendId(state, action.meta.actionId),
      }
    }

    case 'play.action': {
      if (state.phase !== 'playing')
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }

      const pid = action.meta.playerId
      if (state.playerOrder[state.currentPlayerIndex] !== pid) {
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }
      }

      const hand = state.hands[pid]
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!hand)
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }

      const cardIdx = hand.findIndex((c) => c.id === action.payload.cardId)
      if (cardIdx === -1)
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }

      const card = hand[cardIdx] as ActionCard
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (card.suit !== 'action')
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }

      const { targetPlayerId, targetCol, targetRow, repairType } =
        action.payload
      const newHand = hand.filter((c) => c.id !== card.id)

      let newBrokenTools = { ...state.brokenTools }
      let newBoard = state.board.map((r) => [...r])
      let newGoals = [...state.goalCards]
      let newDiscardPile = [...state.discardPile, card]
      let removedBrokenCards: ActionCard[] = []

      switch (card.actionType) {
        case 'break-pickaxe':
        case 'break-lantern':
        case 'break-wagon': {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!targetPlayerId || !state.players[targetPlayerId]) {
            return {
              ...state,
              appliedActionIds: appendId(state, action.meta.actionId),
            }
          }
          if (targetPlayerId === pid) {
            return {
              ...state,
              appliedActionIds: appendId(state, action.meta.actionId),
            }
          }
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          const existing = newBrokenTools[targetPlayerId] || []
          if (existing.some((c) => c.actionType === card.actionType)) {
            return {
              ...state,
              appliedActionIds: appendId(state, action.meta.actionId),
            }
          }
          newBrokenTools = {
            ...newBrokenTools,
            [targetPlayerId]: [...existing, card],
          }
          break
        }

        case 'repair-pickaxe':
        case 'repair-lantern':
        case 'repair-wagon': {
          const repairMap: Record<string, ActionType> = {
            'repair-pickaxe': 'break-pickaxe',
            'repair-lantern': 'break-lantern',
            'repair-wagon': 'break-wagon',
          }
          const breakType = repairMap[card.actionType]
          if (!targetPlayerId) {
            return {
              ...state,
              appliedActionIds: appendId(state, action.meta.actionId),
            }
          }
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          const existingBroken = newBrokenTools[targetPlayerId] || []
          const matchIdx = existingBroken.findIndex(
            (c) => c.actionType === breakType
          )
          if (matchIdx === -1)
            return {
              ...state,
              appliedActionIds: appendId(state, action.meta.actionId),
            }
          const repairedCard = existingBroken[matchIdx]
          newBrokenTools = {
            ...newBrokenTools,
            [targetPlayerId]: existingBroken.filter((_, i) => i !== matchIdx),
          }
          removedBrokenCards = [repairedCard]
          break
        }

        case 'repair-dual': {
          if (!repairType || !targetPlayerId) {
            return {
              ...state,
              appliedActionIds: appendId(state, action.meta.actionId),
            }
          }
          const brkType = `break-${repairType}` as ActionType
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          const existingBrk = newBrokenTools[targetPlayerId] || []
          const matchDualIdx = existingBrk.findIndex(
            (c) => c.actionType === brkType
          )
          if (matchDualIdx === -1)
            return {
              ...state,
              appliedActionIds: appendId(state, action.meta.actionId),
            }
          const repairedCard = existingBrk[matchDualIdx]
          newBrokenTools = {
            ...newBrokenTools,
            [targetPlayerId]: existingBrk.filter((_, i) => i !== matchDualIdx),
          }
          removedBrokenCards = [repairedCard]
          break
        }

        case 'rockfall': {
          if (targetCol === undefined || targetRow === undefined) {
            return {
              ...state,
              appliedActionIds: appendId(state, action.meta.actionId),
            }
          }
          const targetCell = state.board[targetRow]?.[targetCol]
          if (!targetCell)
            return {
              ...state,
              appliedActionIds: appendId(state, action.meta.actionId),
            }
          if (targetCol === START_COL && targetRow === START_ROW) {
            return {
              ...state,
              appliedActionIds: appendId(state, action.meta.actionId),
            }
          }
          if (
            state.goalCards.some(
              (g) => g.col === targetCol && g.row === targetRow
            )
          ) {
            return {
              ...state,
              appliedActionIds: appendId(state, action.meta.actionId),
            }
          }
          newBoard = state.board.map((r) => [...r])
          newBoard[targetRow] = [...newBoard[targetRow]]
          newBoard[targetRow][targetCol] = null
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (targetCell.card) {
            newDiscardPile = [...newDiscardPile, targetCell.card]
          }
          break
        }

        case 'map': {
          if (targetCol === undefined || targetRow === undefined) {
            return {
              ...state,
              appliedActionIds: appendId(state, action.meta.actionId),
            }
          }
          const goal = newGoals.find(
            (g) => g.col === targetCol && g.row === targetRow
          )
          if (!goal)
            return {
              ...state,
              appliedActionIds: appendId(state, action.meta.actionId),
            }
          newGoals = newGoals.map((g) =>
            g.id === goal.id ? { ...g, revealed: true } : g
          )
          break
        }
      }

      if (removedBrokenCards.length > 0) {
        newDiscardPile = [...newDiscardPile, ...removedBrokenCards]
      }

      const drawResult =
        state.deck.size > 0
          ? state.deck.draw(1)
          : { drawn: [], deck: state.deck }
      const finalHand =
        drawResult.drawn.length > 0
          ? [...newHand, ...drawResult.drawn]
          : newHand

      const nextIdx = (state.currentPlayerIndex + 1) % state.playerOrder.length

      const updatedAllHands = { ...state.hands, [pid]: finalHand }
      const updatedState = {
        ...state,
        hands: updatedAllHands,
        deck: drawResult.deck,
        brokenTools: newBrokenTools,
        board: newBoard,
        goalCards: newGoals,
        discardPile: newDiscardPile,
      }
      const stuck = drawResult.deck.size === 0 && noPlayableCards(updatedState)

      return {
        ...state,
        hands: updatedAllHands,
        deck: drawResult.deck,
        brokenTools: newBrokenTools,
        board: newBoard,
        goalCards: newGoals,
        discardPile: newDiscardPile,
        currentPlayerIndex: nextIdx,
        phase: stuck ? 'round-end' : state.phase,
        goldDist: stuck
          ? {
              mode: 'saboteurs-win',
              chooserChain: state.playerOrder.filter(
                (p) => state.roles[p] === 'saboteur'
              ),
              currentChooserIdx: 0,
              nuggetPool: [],
              saboteurPayout: getSaboteurPayout(state),
            }
          : state.goldDist,
        appliedActionIds: appendId(state, action.meta.actionId),
      }
    }

    case 'discard.card': {
      if (state.phase !== 'playing')
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }

      const pid = action.meta.playerId
      if (state.playerOrder[state.currentPlayerIndex] !== pid) {
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }
      }

      const hand = state.hands[pid]

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!hand || hand.length === 0) {
        const nextIdx =
          (state.currentPlayerIndex + 1) % state.playerOrder.length
        const updatedState = { ...state, currentPlayerIndex: nextIdx }
        const deckCheck = state.deck.size === 0
        const stuck = deckCheck && noPlayableCards(updatedState)
        return {
          ...state,
          currentPlayerIndex: nextIdx,
          phase: stuck ? 'round-end' : state.phase,
          goldDist: stuck
            ? {
                mode: 'saboteurs-win',
                chooserChain: state.playerOrder.filter(
                  (p) => state.roles[p] === 'saboteur'
                ),
                currentChooserIdx: 0,
                nuggetPool: [],
                saboteurPayout: getSaboteurPayout(state),
              }
            : state.goldDist,
          appliedActionIds: appendId(state, action.meta.actionId),
        }
      }

      const cardIdx = hand.findIndex((c) => c.id === action.payload.cardId)
      if (cardIdx === -1)
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }

      const discarded = hand[cardIdx]
      const newHand2 = hand.filter((c) => c.id !== discarded.id)

      const drawResult2 =
        state.deck.size > 0
          ? state.deck.draw(1)
          : { drawn: [], deck: state.deck }
      const finalHand2 =
        drawResult2.drawn.length > 0
          ? [...newHand2, ...drawResult2.drawn]
          : newHand2

      const nextIdx2 = (state.currentPlayerIndex + 1) % state.playerOrder.length

      const updatedAllHands2 = { ...state.hands, [pid]: finalHand2 }
      const updatedState2 = {
        ...state,
        hands: updatedAllHands2,
        deck: drawResult2.deck,
      }
      const stuck =
        drawResult2.deck.size === 0 && noPlayableCards(updatedState2)

      return {
        ...state,
        hands: updatedAllHands2,
        deck: drawResult2.deck,
        discardPile: [...state.discardPile, discarded],
        currentPlayerIndex: nextIdx2,
        phase: stuck ? 'round-end' : state.phase,
        goldDist: stuck
          ? {
              mode: 'saboteurs-win',
              chooserChain: state.playerOrder.filter(
                (p) => state.roles[p] === 'saboteur'
              ),
              currentChooserIdx: 0,
              nuggetPool: [],
              saboteurPayout: getSaboteurPayout(state),
            }
          : state.goldDist,
        appliedActionIds: appendId(state, action.meta.actionId),
      }
    }

    case 'collect.gold': {
      if (state.phase !== 'round-end' || !state.goldDist) {
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }
      }

      const gd = state.goldDist
      const currentChooser = gd.chooserChain[gd.currentChooserIdx]
      if (action.meta.playerId !== currentChooser) {
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }
      }

      const newNuggets = { ...state.goldNuggets }

      if (gd.mode === 'miners-win') {
        const pool = [...gd.nuggetPool]
        const pick = pool.shift() ?? 0
        newNuggets[currentChooser] = (newNuggets[currentChooser] || 0) + pick
      } else {
        newNuggets[currentChooser] =
          (newNuggets[currentChooser] || 0) + gd.saboteurPayout
      }

      if (gd.currentChooserIdx >= gd.chooserChain.length - 1) {
        return {
          ...state,
          goldNuggets: newNuggets,
          goldDist: null,
          phase: state.round >= 3 ? 'game-over' : 'setup',
          appliedActionIds: appendId(state, action.meta.actionId),
        }
      }

      return {
        ...state,
        goldNuggets: newNuggets,
        goldDist: {
          ...gd,
          nuggetPool:
            gd.mode === 'miners-win' ? gd.nuggetPool.slice(1) : gd.nuggetPool,
          currentChooserIdx: gd.currentChooserIdx + 1,
        },
        appliedActionIds: appendId(state, action.meta.actionId),
      }
    }

    case 'start.game': {
      if (state.phase !== 'setup')
        return {
          ...state,
          appliedActionIds: appendId(state, action.meta.actionId),
        }

      const nextRound = state.round + 1

      let startIdx = 0
      if (state.lastPathPlayerId) {
        const lastIdx = state.playerOrder.indexOf(state.lastPathPlayerId)
        startIdx = (lastIdx + 1) % state.playerOrder.length
      }

      const newBoard: (CellContent | null)[][] = Array.from(
        { length: BOARD_ROWS },
        () => Array.from({ length: BOARD_COLS }, () => null)
      )
      newBoard[START_ROW][START_COL] = { card: getStartCard(), rotation: 0 }

      const treasureIdx = Math.floor(Math.random() * 3)
      const newGoals: typeof state.goalCards = GOAL_COLS.map((col, i) => ({
        id: `goal:${String(nextRound)}:${String(i)}`,
        col,
        row: 0,
        isTreasure: i === treasureIdx,
        revealed: false,
        connections: [false, false, true, false],
      }))

      const roleCounts = getRoleCounts(state.playerOrder.length)
      const roleDeck: Role[] = [
        ...Array<Role>(roleCounts.miners).fill('miner'),
        ...Array<Role>(roleCounts.saboteurs).fill('saboteur'),
      ]
      const shuffledRoles = shuffleRoles(roleDeck)
      const roles: Record<PlayerId, Role> = {}
      state.playerOrder.forEach((pid, i) => {
        roles[pid] = shuffledRoles[i]
      })

      const deck = buildDeck().shuffle()
      const handSize = getHandSize(state.playerOrder.length)
      const hands: Record<PlayerId, Card[]> = {}
      const { drawn, deck: remaining } = deck.draw(
        handSize * state.playerOrder.length
      )
      let cardPtr = 0
      for (const pid of state.playerOrder) {
        const h: Card[] = []
        for (let i = 0; i < handSize; i++) {
          h.push(drawn[cardPtr++])
        }
        hands[pid] = h
      }

      return {
        ...state,
        round: nextRound,
        board: newBoard,
        goalCards: newGoals,
        deck: remaining,
        hands,
        roles,
        brokenTools: {},
        currentPlayerIndex: startIdx,
        lastPathPlayerId: null,
        pendingAction: null,
        goldDist: null,
        phase: 'playing',
        appliedActionIds: appendId(state, action.meta.actionId),
      }
    }

    case 'reset.game': {
      const fresh = createInitialState()
      fresh.players = state.players
      fresh.goldNuggets = state.goldNuggets
      return {
        ...fresh,
        appliedActionIds: [action.meta.actionId],
      }
    }

    default:
      return state
  }
}

const rotateConnectionsForAction = (
  card: PathCard,
  rotation: 0 | 90 | 180 | 270
): [boolean, boolean, boolean, boolean] => {
  if (rotation === 0)
    return [...card.connections] as [boolean, boolean, boolean, boolean]
  const shifts = rotation / 90
  const r: [boolean, boolean, boolean, boolean] = [false, false, false, false]
  for (let i = 0; i < 4; i++) r[(i + shifts) % 4] = card.connections[i]
  return r
}
