import { Deck, registerClass, Primitive } from '@boredgame/primitives'
import * as PIXI from 'pixi.js'
import { Card } from './Card'

export class DeckRenderable extends Deck<Card> {
  static _type = 'pixi:deck'

  x: number = 0
  y: number = 0
  cardWidth: number = 60
  cardHeight: number = 90
  stackOffset: number = 3

  constructor(data?: Partial<DeckRenderable>) {
    super({ items: data?.items ?? [], id: data?.id ?? 'deck' })
    if (data) {
      if (data.x !== undefined) this.x = data.x
      if (data.y !== undefined) this.y = data.y
      if (data.cardWidth !== undefined) this.cardWidth = data.cardWidth
      if (data.cardHeight !== undefined) this.cardHeight = data.cardHeight
      if (data.stackOffset !== undefined) this.stackOffset = data.stackOffset
    }
  }

  render(container: PIXI.Container): void {
    const c = new PIXI.Container()
    c.x = this.x
    c.y = this.y

    const layers = Math.min(this.items.length, 5)
    for (let i = 0; i < layers; i++) {
      const g = new PIXI.Graphics()
      const offset = (layers - 1 - i) * this.stackOffset
      g.lineStyle(1, 0xffffff, 0.5)
      g.beginFill(this.items.length > 0 ? 0x1e3a5f : 0x374151)
      g.drawRoundedRect(
        offset,
        offset,
        this.cardWidth,
        this.cardHeight,
        6
      )
      g.endFill()
      c.addChild(g)
    }

    const countText = new PIXI.Text(
      String(this.items.length),
      new PIXI.TextStyle({
        fontFamily: 'Inter, system-ui, sans-serif',
        fill: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
      })
    )
    countText.anchor.set(0.5)
    countText.x = this.cardWidth / 2 + (layers - 1) * this.stackOffset
    countText.y = this.cardHeight / 2 + (layers - 1) * this.stackOffset
    c.addChild(countText)

    container.addChild(c)
  }
}

registerClass(
  'pixi:deck',
  DeckRenderable as unknown as new (data: unknown) => Primitive
)
