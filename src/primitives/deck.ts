import type { SeededRng } from '@boredgame/utils'
import { Primitive } from './primitive'
import { Collection } from './collection'

export class Deck<T extends Primitive> extends Collection<T> {
  static _type = 'deck'

  shuffle(rng?: SeededRng): this {
    const copy = [...this.items]
    if (rng) {
      rng.shuffle(copy)
    } else {
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
      }
    }

    return this.clone({ items: copy })
  }

  draw(count: number = 1): { drawn: T[]; deck: Deck<T> } {
    const drawn = this.items.slice(0, count)
    const remaining = this.items.slice(count)

    return {
      drawn,
      deck: this.clone({ items: remaining }),
    }
  }

  drawOne(): { drawn: T | undefined; deck: Deck<T> } {
    const { drawn, deck } = this.draw(1)
    return { drawn: drawn[0], deck }
  }

  top(n: number = 1): T[] {
    return this.items.slice(0, n)
  }

  deal(
    cardsPerHand: number,
    handCount: number
  ): { hands: T[][]; deck: Deck<T> } {
    const total = cardsPerHand * handCount
    const dealt = Array.from({ length: handCount }, () => [] as T[])
    const drawn = this.items.slice(0, total)
    const remaining = this.items.slice(total)

    for (let i = 0; i < drawn.length; i++) {
      dealt[i % handCount].push(drawn[i])
    }

    return {
      hands: dealt,
      deck: this.clone({ items: remaining }),
    }
  }
}
