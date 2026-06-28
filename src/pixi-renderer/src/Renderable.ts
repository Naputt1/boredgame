import { Primitive, registerClass } from '@boredgame/primitives'
import * as PIXI from 'pixi.js'

export abstract class Renderable extends Primitive<{
  id: string
  x: number
  y: number
  width: number
  height: number
  visible: boolean
  rotation: number
  alpha: number
}> {
  static _type = 'renderable'

  x: number = 0
  y: number = 0
  width: number = 0
  height: number = 0
  visible: boolean = true
  rotation: number = 0
  alpha: number = 1

  constructor(data?: Partial<Renderable>) {
    super((data ?? { id: '' }) as never)
  }

  abstract render(container: PIXI.Container): void

  renderAt(container: PIXI.Container, x: number, y: number): void {
    this.x = x
    this.y = y
    this.render(container)
  }

  protected createContainer(parent?: PIXI.Container): PIXI.Container {
    const c = new PIXI.Container()
    c.x = this.x
    c.y = this.y
    c.visible = this.visible
    c.rotation = (this.rotation * Math.PI) / 180
    c.alpha = this.alpha
    if (parent) parent.addChild(c)
    return c
  }

  protected drawRoundedRect(
    g: PIXI.Graphics,
    w: number,
    h: number,
    fill: number,
    stroke?: number,
    strokeWidth?: number,
    radius?: number
  ): void {
    const r = radius ?? 8
    g.clear()
    if (stroke !== undefined && strokeWidth) {
      g.lineStyle(strokeWidth, stroke, 1)
    }
    g.beginFill(fill)
    g.drawRoundedRect(0, 0, w, h, r)
    g.endFill()
  }

  protected drawText(
    text: string,
    style?: Partial<PIXI.TextStyle>
  ): PIXI.Text {
    return new PIXI.Text(
      text,
      new PIXI.TextStyle({
        fontFamily: 'Inter, system-ui, sans-serif',
        fill: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
        ...style,
      })
    )
  }
}

registerClass('renderable', Renderable as unknown as new (data: unknown) => Primitive)
