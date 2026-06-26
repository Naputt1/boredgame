const registry = new Map<string, new (data: unknown) => Primitive>()

export function registerClass(
  type: string,
  ctor: new (data: unknown) => Primitive
): void {
  registry.set(type, ctor)
}

function reconstruct(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(reconstruct)
  }
  if (
    value !== null &&
    typeof value === 'object' &&
    '_type' in (value as Record<string, unknown>)
  ) {
    return Primitive.fromJSON(value as Record<string, unknown>)
  }
  return value
}

export abstract class Primitive<
  T extends Record<string, unknown> & { id: string } = Record<
    string,
    unknown
  > & { id: string },
> {
  static _type: string = ''
  id!: string

  constructor(data: T) {
    Object.assign(this, data)
  }

  toJSON(): T & { _type: string } {
    const _type = (this.constructor as typeof Primitive)._type || ''
    const result: Record<string, unknown> = { _type }
    for (const key of Object.keys(this)) {
      const value = (this as unknown as Record<string, unknown>)[key]
      if (value === undefined) continue
      result[key] = serialize(value)
    }
    return result as T & { _type: string }
  }

  static fromJSON(data: Record<string, unknown>): Primitive {
    const _type = data._type as string | undefined
    if (!_type) throw new Error('Primitive.fromJSON: missing _type in data')
    const ctor = registry.get(_type)
    if (!ctor)
      throw new Error(`Primitive.fromJSON: unregistered type "${_type}"`)
    const reconstructed: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      if (key === '_type') continue
      reconstructed[key] = reconstruct(value)
    }
    const instance = new ctor(reconstructed)
    return instance
  }
}

function serialize(value: unknown): unknown {
  if (value instanceof Primitive) return value.toJSON()
  if (Array.isArray(value)) return value.map(serialize)
  if (value instanceof Set) return [...value]
  if (value instanceof Map) return Object.fromEntries(value)
  return value
}
