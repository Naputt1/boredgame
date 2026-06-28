import { Primitive, registerClass, Deck } from '@boredgame/primitives'
import { Card } from '@boredgame/pixi-renderer'

export type UnoColor = 'red' | 'yellow' | 'green' | 'blue'
export type UnoValue =
  | '0' | '1' | '2' | '3' | '4'
  | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | 'draw-two'
  | 'wild' | 'wild-draw-four'

export type PlayerId = string

const COLOR_MAP: Record<UnoColor, number> = {
  red: 0xef4444,
  yellow: 0xeab308,
  green: 0x22c55e,
  blue: 0x3b82f6,
}

export class UnoCard extends Card {
  static _type = 'uno:card'

  unoColor: UnoColor | null = null
  unoValue: UnoValue = '0'

  constructor(data?: Partial<UnoCard>) {
    super(data)
    if (data) {
      if (data.unoColor !== undefined) this.unoColor = data.unoColor
      if (data.unoValue !== undefined) this.unoValue = data.unoValue
    }
    if (this.unoColor) {
      this.color = COLOR_MAP[this.unoColor]
    }
    if (!this.label) {
      this.label = this.formatValue()
    }
    if (!this.rank) {
      this.rank = this.formatValue()
    }
    this.width = 60
    this.height = 90
  }

  isWild(): boolean {
    return this.unoValue === 'wild' || this.unoValue === 'wild-draw-four'
  }

  isAction(): boolean {
    return (
      this.unoValue === 'skip' ||
      this.unoValue === 'reverse' ||
      this.unoValue === 'draw-two' ||
      this.unoValue === 'wild-draw-four'
    )
  }

  matches(other: UnoCard): boolean {
    if (this.isWild()) return true
    if (other.isWild()) return true
    if (this.unoColor !== null && this.unoColor === other.unoColor) return true
    if (this.unoValue === other.unoValue) return true
    return false
  }

  private formatValue(): string {
    switch (this.unoValue) {
      case 'skip': return '\u2191'
      case 'reverse': return '\u21C4'
      case 'draw-two': return '+2'
      case 'wild': return 'W'
      case 'wild-draw-four': return '+4'
      default: return this.unoValue
    }
  }
}

export type UnoState = {
  phase: 'joining' | 'playing' | 'round-end' | 'game-over'
  players: Record<PlayerId, { id: PlayerId; name: string }>
  playerOrder: PlayerId[]
  currentPlayerIndex: number
  direction: 1 | -1
  deck: Deck<UnoCard>
  discardPile: UnoCard[]
  hands: Record<PlayerId, UnoCard[]>
  currentColor: UnoColor | null
  pendingDraws: number
  calledUno: Record<PlayerId, boolean>
  scores: Record<PlayerId, number>
  targetScore: number
  lastAction: string | null
  appliedActionIds: string[]
}

export const COLORS: UnoColor[] = ['red', 'yellow', 'green', 'blue']
export const VALUES: UnoValue[] = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'skip', 'reverse', 'draw-two',
]
export const WIN_SCORE = 500

let cardCounter = 0
const nextCardId = (): string => {
  const id = cardCounter++
  return `uno:card:${String(id)}`
}

const makeCard = (
  unoColor: UnoColor | null,
  unoValue: UnoValue
): UnoCard =>
  new UnoCard({
    id: nextCardId(),
    unoColor,
    unoValue,
  })

export const buildDeck = (): Deck<UnoCard> => {
  const items: UnoCard[] = []

  for (const color of COLORS) {
    items.push(makeCard(color, '0'))
    for (let i = 0; i < 2; i++) {
      items.push(makeCard(color, '1'))
      items.push(makeCard(color, '2'))
      items.push(makeCard(color, '3'))
      items.push(makeCard(color, '4'))
      items.push(makeCard(color, '5'))
      items.push(makeCard(color, '6'))
      items.push(makeCard(color, '7'))
      items.push(makeCard(color, '8'))
      items.push(makeCard(color, '9'))
      items.push(makeCard(color, 'skip'))
      items.push(makeCard(color, 'reverse'))
      items.push(makeCard(color, 'draw-two'))
    }
  }

  for (let i = 0; i < 4; i++) {
    items.push(makeCard(null, 'wild'))
    items.push(makeCard(null, 'wild-draw-four'))
  }

  return new Deck<UnoCard>({ items, id: 'uno:deck' })
}

export const createInitialState = (): UnoState => ({
  phase: 'joining',
  players: {},
  playerOrder: [],
  currentPlayerIndex: 0,
  direction: 1,
  deck: buildDeck(),
  discardPile: [],
  hands: {},
  currentColor: null,
  pendingDraws: 0,
  calledUno: {},
  scores: {},
  targetScore: WIN_SCORE,
  lastAction: null,
  appliedActionIds: [],
})

export const getCardScore = (card: UnoCard): number => {
  switch (card.unoValue) {
    case '0': return 0
    case '1': return 1
    case '2': return 2
    case '3': return 3
    case '4': return 4
    case '5': return 5
    case '6': return 6
    case '7': return 7
    case '8': return 8
    case '9': return 9
    case 'skip':
    case 'reverse':
    case 'draw-two': return 20
    case 'wild':
    case 'wild-draw-four': return 50
  }
}

registerClass(
  'uno:card',
  UnoCard as unknown as new (data: unknown) => Primitive
)
registerClass('deck', Deck as unknown as new (data: unknown) => Primitive)
