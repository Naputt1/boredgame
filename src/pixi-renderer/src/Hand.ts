import { Collection } from '@boredgame/primitives'
import * as PIXI from 'pixi.js'
import { Card } from './Card'

export type DrawCardFn = (
  g: PIXI.Graphics,
  card: Card,
  w: number,
  h: number,
  faceUp: boolean,
  highlight: boolean
) => void

export type HandRenderCurvedOptions = {
  centerX: number
  canvasHeight: number
  canvasWidth: number
  cardWidth: number
  cardHeight: number
  selectedCardId: string | null
  hoveredCardId: string | null
  drawCard: DrawCardFn
  onCardClick?: (cardId: string) => void
  onCardHover?: (cardId: string | null) => void
}

const CARD_CONTAINER_MAP = new Map<string, PIXI.Container>()
const CARD_BASE = new Map<string, { y: number; z: number }>()
const CARD_POSITIONS: Array<{ x: number; y: number; rot: number }> = []
const CARD_IDS: string[] = []
let CARD_WIDTH = 60
let CARD_HEIGHT = 90
const PUSH_RADIUS = 3
const PUSH_AMOUNT = 22
const LIFT_HOVER = 16
const LIFT_SELECT = 32

export class Hand extends Collection<Card> {
  static _type = 'pixi:hand'

  spread: number = 75
  stacked: boolean = false
  label: string = ''

  constructor(data?: Partial<Hand>) {
    super({ items: data?.items ?? [], id: data?.id ?? '' })
    if (data) {
      if (data.spread !== undefined) this.spread = data.spread
      if (data.stacked !== undefined) this.stacked = data.stacked
      if (data.label !== undefined) this.label = data.label
    }
  }

  render(container: PIXI.Container, x: number, y: number): void {
    const c = new PIXI.Container()
    c.x = x
    c.y = y

    if (this.label) {
      const labelText = new PIXI.Text(
        this.label,
        new PIXI.TextStyle({
          fontFamily: 'Inter, system-ui, sans-serif',
          fill: '#d1d5db',
          fontSize: 12,
        })
      )
      c.addChild(labelText)
    }

    const cards = this.items
    if (this.stacked) {
      for (let i = cards.length - 1; i >= 0; i--) {
        const cardContainer = new PIXI.Container()
        cardContainer.x = i * 2
        cardContainer.y = i * 2
        cards[i].render(cardContainer)
        c.addChild(cardContainer)
      }
    } else {
      const totalWidth = (cards.length - 1) * this.spread
      const startX = -totalWidth / 2
      for (let i = 0; i < cards.length; i++) {
        const cardContainer = new PIXI.Container()
        cardContainer.x = startX + i * this.spread
        cardContainer.y = 20
        cards[i].render(cardContainer)
        c.addChild(cardContainer)
      }
    }

    container.addChild(c)
  }

  renderCurved(
    container: PIXI.Container,
    opts: HandRenderCurvedOptions
  ): void {
    const {
      centerX,
      canvasHeight,
      canvasWidth,
      cardWidth,
      cardHeight,
      drawCard,
      onCardClick,
    } = opts

    CARD_WIDTH = cardWidth
    CARD_HEIGHT = cardHeight
    CARD_CONTAINER_MAP.clear()
    CARD_BASE.clear()
    CARD_POSITIONS.length = 0
    CARD_IDS.length = 0

    const n = this.items.length
    if (n === 0) return

    const handY = canvasHeight - cardHeight - 40
    const ARC_RISE = 28
    const CARD_OVERLAP = 0.7

    const overlapW = cardWidth * CARD_OVERLAP
    const totalW = Math.min(n * overlapW, canvasWidth * 0.8)

    const basePositions = this.items.map((card, i) => {
      const flatStartX = centerX - totalW / 2
      const flatX = flatStartX + i * Math.min(overlapW, totalW / Math.max(n - 1, 1))
      const t = (i / Math.max(n - 1, 1)) * 2 - 1
      const arcY = handY - ARC_RISE * (1 - t * t)
      const rot = -t * 6
      return { x: flatX, y: arcY, rot }
    })

    for (const card of this.items) {
      CARD_IDS.push(card.id)
    }

    const pushPos = this.computePushes(null, null, basePositions)

    for (let i = 0; i < n; i++) {
      const pos = pushPos[i]
      CARD_POSITIONS.push({ x: pos.x, y: pos.y, rot: pos.rot })
    }

    const cardEntries = this.items.map((card, i) => {
      const entry = pushPos[i]
      CARD_BASE.set(card.id, { y: entry.y, z: i })
      return { card, i, x: entry.x, y: entry.y, rot: entry.rot, z: i }
    })

    cardEntries.sort((a, b) => (a.z - b.z) || (a.i - b.i))

    for (const entry of cardEntries) {
      const cardContainer = new PIXI.Container()
      cardContainer.x = entry.x
      cardContainer.y = entry.y
      cardContainer.rotation = entry.rot * (Math.PI / 180)
      cardContainer.zIndex = entry.z
      cardContainer.sortableChildren = true

      const g = new PIXI.Graphics()
      cardContainer.addChild(g)
      drawCard(g, entry.card, cardWidth, cardHeight, true, false)

      if (onCardClick) {
        cardContainer.eventMode = 'static'
        cardContainer.cursor = 'pointer'
        const cid = entry.card.id
        cardContainer.on('pointerdown', () => { onCardClick(cid) })
      }

      container.addChild(cardContainer)
      CARD_CONTAINER_MAP.set(entry.card.id, cardContainer)
    }

    container.eventMode = 'static'
    container.on('pointermove', (e) => {
      if (!opts.onCardHover) return
      const gp = e.getLocalPosition(container)
      let hitId: string | null = null
      let bestZ = -1
      for (const [id, cont] of CARD_CONTAINER_MAP) {
        if (
          gp.x >= cont.x && gp.x <= cont.x + CARD_WIDTH &&
          gp.y >= cont.y && gp.y <= cont.y + CARD_HEIGHT &&
          cont.zIndex > bestZ
        ) {
          hitId = id
          bestZ = cont.zIndex
        }
      }
      opts.onCardHover(hitId)
    })
    container.on('pointerleave', () => {
      opts.onCardHover?.(null)
    })
  }

  private computePushes(
    hoveredId: string | null,
    selectedId: string | null,
    baseP: Array<{ x: number; y: number; rot: number }>,
  ): Array<{ x: number; y: number; rot: number }> {
    const liftedSet = new Set<string>()
    if (selectedId) liftedSet.add(selectedId)
    if (hoveredId) liftedSet.add(hoveredId)

    const n = CARD_IDS.length
    return CARD_IDS.map((id, i) => {
      let pushX = 0
      let pushY = 0
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        if (!liftedSet.has(CARD_IDS[j])) continue
        const dist = j - i
        const absDist = Math.abs(dist)
        if (absDist > PUSH_RADIUS) continue
        const strength = (1 - absDist / PUSH_RADIUS) * PUSH_AMOUNT
        const dir = dist > 0 ? -1 : 1
        pushX += dir * strength * 0.7
        pushY -= strength * 0.15
      }

      const lift = id === selectedId
        ? LIFT_SELECT
        : id === hoveredId
          ? LIFT_HOVER
          : 0

      return {
        x: baseP[i].x + pushX,
        y: baseP[i].y - lift + pushY,
        rot: baseP[i].rot,
      }
    })
  }

  applyHighlight(hoveredId: string | null, selectedId: string | null): void {
    const positions = this.computePushes(hoveredId, selectedId, CARD_POSITIONS)
    const n = CARD_IDS.length
    for (let i = 0; i < n; i++) {
      const id = CARD_IDS[i]
      const cont = CARD_CONTAINER_MAP.get(id)
      if (!cont) continue
      const pos = positions[i]
      cont.x = pos.x
      cont.y = pos.y
      cont.zIndex = id === selectedId
        ? n + 2
        : id === hoveredId
          ? n + 1
          : (CARD_BASE.get(id)?.z ?? i)
    }
  }
}
