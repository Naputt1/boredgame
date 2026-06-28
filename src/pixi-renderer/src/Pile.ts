import { Collection } from '@boredgame/primitives'
import * as PIXI from 'pixi.js'
import { Card } from './Card'

export class Pile extends Collection<Card> {
  static _type = 'pixi:pile'

  x: number = 0
  y: number = 0
  cardWidth: number = 60
  cardHeight: number = 90
  maxVisible: number = 3

  render(container: PIXI.Container): void {
    const c = new PIXI.Container()
    c.x = this.x
    c.y = this.y

    const visible = Math.min(this.items.length, this.maxVisible)
    for (let i = 0; i < visible; i++) {
      const idx = this.items.length - visible + i
      const card = this.items[idx]
      if (i === visible - 1) {
        card.faceUp = true
        card.width = this.cardWidth
        card.height = this.cardHeight
        card.render(c)
      } else {
        const g = new PIXI.Graphics()
        g.lineStyle(1, 0xffffff, 0.3)
        g.beginFill(0x1e3a5f)
        g.drawRoundedRect(i * 2, i * 2, this.cardWidth, this.cardHeight, 6)
        g.endFill()
        c.addChild(g)
      }
    }

    if (this.items.length === 0) {
      const g = new PIXI.Graphics()
      g.lineStyle(2, 0x4b5563, 0.5)
      g.beginFill(0x1f2937, 0.3)
      g.drawRoundedRect(0, 0, this.cardWidth, this.cardHeight, 6)
      g.endFill()
      c.addChild(g)
    }

    container.addChild(c)
  }
}
