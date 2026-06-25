export type SeededRng = {
  /** Returns a float in [0, 1) */
  next(): number
  /** Returns an integer in [min, max] inclusive */
  nextInt(min: number, max: number): number
  /** Fisher-Yates shuffle (in-place, returns same array) */
  shuffle<T>(array: T[]): T[]
  /** Pick a random element */
  pick<T>(array: T[]): T
}

const mulberry32 = (seed: number): (() => number) => {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const createSeededRng = (seed: number): SeededRng => {
  const next = mulberry32(seed)
  return {
    next,
    nextInt(min, max) {
      return min + Math.floor(next() * (max - min + 1))
    },
    shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = this.nextInt(0, i)
        ;[array[i], array[j]] = [array[j], array[i]]
      }
      return array
    },
    pick(array) {
      return array[this.nextInt(0, array.length - 1)]
    },
  }
}

export const hashSeed = (...inputs: (string | number)[]): number => {
  let hash = 0
  for (const input of inputs) {
    const str = String(input)
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i)
      hash |= 0
    }
  }
  return Math.abs(hash)
}
