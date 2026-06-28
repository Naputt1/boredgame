import type { UnoAction } from './actions'
import { Deck } from '@boredgame/primitives'
import { createInitialState, type UnoState, type UnoCard, type UnoColor, COLORS } from './state'
import { getCardScore } from './state'

const appendId = (state: UnoState, actionId: string): string[] =>
  [...state.appliedActionIds, actionId]

const getCurrentPlayerId = (state: UnoState): string =>
  state.playerOrder[state.currentPlayerIndex]

const advanceTurn = (state: UnoState): number => {
  const next = state.currentPlayerIndex + state.direction
  const count = state.playerOrder.length
  return ((next % count) + count) % count
}

const shuffleDeckIfNeeded = (state: UnoState): UnoState => {
  if (state.deck.size > 0) return state
  if (state.discardPile.length <= 1) return state
  const top = state.discardPile[state.discardPile.length - 1]
  const rest = state.discardPile.slice(0, -1)
  const newDeck = new Deck<UnoCard>({ items: rest, id: 'uno:deck' }).shuffle()
  return { ...state, deck: newDeck, discardPile: [top] }
}

const drawCards = (
  state: UnoState,
  playerId: string,
  count: number
): UnoState => {
  let s = state
  let drawn: UnoCard[] = []
  let remaining = count
  while (remaining > 0) {
    s = shuffleDeckIfNeeded(s)
    const result = s.deck.draw(remaining)
    drawn = [...drawn, ...result.drawn]
    s = { ...s, deck: result.deck }
    remaining = count - drawn.length
    if (s.deck.size === 0 && s.discardPile.length <= 1) break
  }
  s = {
    ...s,
    hands: {
      ...s.hands,
      [playerId]: [...s.hands[playerId], ...drawn],
    },
  }
  return s
}

export const unoReducer = (
  state: UnoState,
  action: UnoAction
): UnoState => {
  if (state.appliedActionIds.includes(action.meta.actionId)) {
    return state
  }

  switch (action.type) {
    case 'join.game': {
      const pid = action.payload.playerId
      if (pid in state.players) {
        return { ...state, appliedActionIds: appendId(state, action.meta.actionId) }
      }
      return {
        ...state,
        players: {
          ...state.players,
          [pid]: { id: pid, name: action.payload.name },
        },
        playerOrder: [...state.playerOrder, pid],
        hands: { ...state.hands, [pid]: [] },
        scores: { ...state.scores, [pid]: 0 },
        appliedActionIds: appendId(state, action.meta.actionId),
      }
    }

    case 'start.game': {
      if (state.phase !== 'joining' && state.phase !== 'round-end') {
        return { ...state, appliedActionIds: appendId(state, action.meta.actionId) }
      }

      const playerCount = state.playerOrder.length
      if (playerCount < 1) {
        return { ...state, appliedActionIds: appendId(state, action.meta.actionId) }
      }

      let s: UnoState = {
        ...state,
        phase: 'playing',
        deck: state.deck.shuffle(),
        discardPile: [],
        hands: Object.fromEntries(state.playerOrder.map((p) => [p, []])),
        currentPlayerIndex: 0,
        direction: 1,
        currentColor: null,
        pendingDraws: 0,
        calledUno: {},
        lastAction: null,
        appliedActionIds: appendId(state, action.meta.actionId),
      }

      for (const pid of s.playerOrder) {
        s = drawCards(s, pid, 7)
      }

      const topCards = s.deck.top(1)
      if (topCards.length > 0) {
        const { drawn, deck } = s.deck.draw(1)
        s = { ...s, deck, discardPile: [drawn[0]] }
        if (drawn[0].unoColor) {
          s = { ...s, currentColor: drawn[0].unoColor }
        } else {
          s = { ...s, currentColor: COLORS[Math.floor(Math.random() * COLORS.length)] }
        }
        if (drawn[0].unoValue === 'skip') {
          s = { ...s, currentPlayerIndex: advanceTurn(s) }
        } else if (drawn[0].unoValue === 'reverse') {
          const newDir: 1 | -1 = s.direction === 1 ? -1 : 1
          s = { ...s, direction: newDir }
        } else if (drawn[0].unoValue === 'draw-two') {
          const nextPid = s.playerOrder[advanceTurn(s)]
          s = drawCards(s, nextPid, 2)
          s = { ...s, currentPlayerIndex: advanceTurn(s) }
        } else if (drawn[0].unoValue === 'wild-draw-four') {
          const nextPid = s.playerOrder[advanceTurn(s)]
          s = drawCards(s, nextPid, 4)
          s = { ...s, currentPlayerIndex: advanceTurn(s) }
        }
      }

      return s
    }

    case 'play.card': {
      if (state.phase !== 'playing') {
        return { ...state, appliedActionIds: appendId(state, action.meta.actionId) }
      }

      const pid = action.meta.playerId
      if (getCurrentPlayerId(state) !== pid) {
        return { ...state, appliedActionIds: appendId(state, action.meta.actionId) }
      }

      const hand = state.hands[pid] ?? []
      const cardIndex = hand.findIndex((c) => c.id === action.payload.cardId)
      if (cardIndex === -1) {
        return { ...state, appliedActionIds: appendId(state, action.meta.actionId) }
      }

      const card = hand[cardIndex]
      const topCard = state.discardPile[state.discardPile.length - 1]

      const matchesColor = state.currentColor !== null && card.unoColor === state.currentColor
      const matchesValue = card.unoValue === topCard.unoValue
      const isWild = card.isWild()

      if (!isWild && !matchesColor && !matchesValue) {
        return { ...state, appliedActionIds: appendId(state, action.meta.actionId) }
      }

      const newHand = [...hand]
      newHand.splice(cardIndex, 1)

      let chosenColor: UnoColor | null = null
      if (isWild && action.payload.chosenColor) {
        chosenColor = action.payload.chosenColor
      } else if (!isWild && card.unoColor) {
        chosenColor = card.unoColor
      }

      let s: UnoState = {
        ...state,
        hands: { ...state.hands, [pid]: newHand },
        discardPile: [...state.discardPile, card],
        currentColor: chosenColor,
        lastAction: `${pid} played ${card.unoValue}`,
        appliedActionIds: appendId(state, action.meta.actionId),
      }

      if (newHand.length === 0) {
        const handScores = Object.entries(s.hands).reduce<
          Record<string, number>
        >(
          (acc, [p, cards]) => ({
            ...acc,
            [p]: cards.reduce((sum, c) => sum + getCardScore(c), 0),
          }),
          {}
        )
        const newScores = { ...s.scores }
        for (const p of s.playerOrder) {
          newScores[p] = (newScores[p] || 0) + (handScores[p] || 0)
        }

        const winner = Object.entries(newScores).find(
          ([, score]) => score >= s.targetScore
        )

        s = {
          ...s,
          phase: winner ? 'game-over' : 'round-end',
          scores: newScores,
          lastAction: null,
        }
        return s
      }

      if (card.unoValue === 'skip') {
        s = { ...s, currentPlayerIndex: advanceTurn(s) }
      } else if (card.unoValue === 'reverse') {
        const newDir: 1 | -1 = s.direction === 1 ? -1 : 1
        s = { ...s, direction: newDir }
        if (s.playerOrder.length === 2) {
          s = { ...s, currentPlayerIndex: advanceTurn(s) }
        }
      } else if (card.unoValue === 'draw-two') {
        const nextPid = s.playerOrder[advanceTurn(s)]
        s = drawCards(s, nextPid, 2)
        s = { ...s, currentPlayerIndex: advanceTurn(s), pendingDraws: 0 }
      } else if (card.unoValue === 'wild-draw-four') {
        const nextPid = s.playerOrder[advanceTurn(s)]
        s = drawCards(s, nextPid, 4)
        s = { ...s, currentPlayerIndex: advanceTurn(s), pendingDraws: 0 }
      } else {
        s = { ...s, currentPlayerIndex: advanceTurn(s) }
      }

      s = { ...s, calledUno: {} }
      return s
    }

    case 'draw.card': {
      if (state.phase !== 'playing') {
        return { ...state, appliedActionIds: appendId(state, action.meta.actionId) }
      }

      const pid = action.meta.playerId
      if (getCurrentPlayerId(state) !== pid) {
        return { ...state, appliedActionIds: appendId(state, action.meta.actionId) }
      }

      const drawCount = state.pendingDraws > 0 ? state.pendingDraws : 1
      let s = drawCards(state, pid, drawCount)

      s = {
        ...s,
        currentPlayerIndex: advanceTurn(s),
        pendingDraws: 0,
        lastAction: `${pid} drew ${String(drawCount)} card(s)`,
        appliedActionIds: appendId(s, action.meta.actionId),
      }

      return s
    }

    case 'call.uno': {
      const caller = action.meta.playerId
      return {
        ...state,
        calledUno: { ...state.calledUno, [caller]: true },
        appliedActionIds: appendId(state, action.meta.actionId),
      }
    }

    case 'reset.game': {
      return {
        ...createInitialState(),
        appliedActionIds: [action.meta.actionId],
      }
    }

    default:
      return state
  }
}
