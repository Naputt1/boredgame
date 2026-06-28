import { registerClass, Primitive } from '@boredgame/primitives'
import * as PIXI from 'pixi.js'
import { Renderable } from './Renderable'

export type CardSuit = string
export type CardRank = string

export class Card extends Renderable {
  static _type = 'pixi:card'

  suit: CardSuit = ''
  rank: CardRank = ''
  color: number = 0xcccccc
  faceUp: boolean = true
  label: string = ''
  backColor: number = 0x1e3a5f

  constructor(data?: Partial<Card>) {
    super(data)
    if (data) Object.assign(this, data)
  }

  render(container: PIXI.Container): void {
    const c = this.createContainer(container)
    const g = new PIXI.Graphics()

    if (this.faceUp) {
      this.drawRoundedRect(g, this.width, this.height, this.color, 0xffffff, 2)
      c.addChild(g)

      const rankText = this.drawText(this.rank || this.label, {
        fontSize: Math.max(10, this.width * 0.25),
        fill: this.getTextColor(),
      })
      rankText.anchor.set(0.5)
      rankText.x = this.width / 2
      rankText.y = this.height / 2
      c.addChild(rankText)

      if (this.label) {
        const labelText = this.drawText(this.label, {
          fontSize: Math.max(8, this.width * 0.15),
          fill: '#ffffff',
        })
        labelText.anchor.set(0.5)
        labelText.x = this.width / 2
        labelText.y = this.height * 0.15
        c.addChild(labelText)
      }
    } else {
      this.drawRoundedRect(g, this.width, this.height, this.backColor, 0xffffff, 2)
      c.addChild(g)

      const backText = this.drawText('?', {
        fontSize: Math.max(14, this.width * 0.35),
        fill: '#ffffff',
        fontWeight: '900',
      })
      backText.anchor.set(0.5)
      backText.x = this.width / 2
      backText.y = this.height / 2
      c.addChild(backText)
    }
  }

  private getTextColor(): number {
    const r = (this.color >> 16) & 0xff
    const g = (this.color >> 8) & 0xff
    const b = this.color & 0xff
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b
    return luminance > 160 ? 0x1a1a2e : 0xffffff
  }
}

registerClass('pixi:card', Card as unknown as new (data: unknown) => Primitive)
