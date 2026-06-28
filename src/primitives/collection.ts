import { Primitive } from './primitive'

export abstract class Collection<T extends Primitive> extends Primitive<{
  items: T[]
  id: string
}> {
  declare items: T[]

  get size(): number {
    return this.items.length
  }

  get isEmpty(): boolean {
    return this.items.length === 0
  }

  add(item: T): this {
    return this.clone({ items: [...this.items, item] })
  }

  addMany(items: T[]): this {
    return this.clone({ items: [...this.items, ...items] })
  }

  remove(id: string): this {
    return this.clone({ items: this.items.filter((i) => i.id !== id) })
  }

  removeMany(predicate: (item: T) => boolean): this {
    return this.clone({ items: this.items.filter((i) => !predicate(i)) })
  }

  find(id: string): T | undefined {
    return this.items.find((i) => i.id === id)
  }

  indexOf(id: string): number {
    return this.items.findIndex((i) => i.id === id)
  }

  contains(id: string): boolean {
    return this.items.some((i) => i.id === id)
  }

  clear(): this {
    return this.clone({ items: [] })
  }

  filter(predicate: (item: T) => boolean): this {
    return this.clone({ items: this.items.filter(predicate) })
  }

  protected clone(overrides?: Partial<{ items: T[] }>): this {
    const ctor = this.constructor as new (...args: unknown[]) => this
    const instance = new ctor()
    for (const key of Object.keys(this) as (keyof this)[]) {
      instance[key] = this[key]
    }
    if (overrides) {
      for (const key of Object.keys(overrides) as (keyof typeof overrides)[]) {
        instance[key as keyof this] = overrides[key] as this[keyof this]
      }
    }
    return instance
  }
}
