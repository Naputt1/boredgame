import { describe, expect, it } from 'vitest'
import { createSeededRng, hashSeed } from './rng'

describe('createSeededRng', () => {
  it('produces deterministic sequences from the same seed', () => {
    const a = createSeededRng(42)
    const b = createSeededRng(42)

    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next())
    }
  })

  it('produces different sequences from different seeds', () => {
    const a = createSeededRng(1)
    const b = createSeededRng(2)

    const seqA = Array.from({ length: 10 }, () => a.next())
    const seqB = Array.from({ length: 10 }, () => b.next())

    expect(seqA).not.toEqual(seqB)
  })

  it('nextInt returns values within [min, max]', () => {
    const rng = createSeededRng(99)

    for (let i = 0; i < 1000; i++) {
      const val = rng.nextInt(3, 7)
      expect(val).toBeGreaterThanOrEqual(3)
      expect(val).toBeLessThanOrEqual(7)
    }
  })

  it('shuffle returns all elements', () => {
    const rng = createSeededRng(7)
    const input = [1, 2, 3, 4, 5]
    const shuffled = rng.shuffle([...input])

    expect(shuffled.sort()).toEqual(input)
  })

  it('shuffle is deterministic for same seed', () => {
    const input = ['a', 'b', 'c', 'd', 'e']
    const resultA = createSeededRng(10).shuffle([...input])
    const resultB = createSeededRng(10).shuffle([...input])

    expect(resultA).toEqual(resultB)
  })

  it('pick returns an element from the array', () => {
    const rng = createSeededRng(5)
    const array = [10, 20, 30, 40]

    for (let i = 0; i < 50; i++) {
      expect(array).toContain(rng.pick(array))
    }
  })

  it('next returns values in [0, 1)', () => {
    const rng = createSeededRng(1)

    for (let i = 0; i < 10000; i++) {
      const val = rng.next()
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(1)
    }
  })
})

describe('hashSeed', () => {
  it('produces consistent hashes for same inputs', () => {
    expect(hashSeed('hello', 42)).toBe(hashSeed('hello', 42))
  })

  it('produces different hashes for different inputs', () => {
    expect(hashSeed('hello', 1)).not.toBe(hashSeed('hello', 2))
  })

  it('handles a single string', () => {
    expect(hashSeed('test')).toBeGreaterThanOrEqual(0)
  })

  it('handles a single number', () => {
    expect(hashSeed(12345)).toBeGreaterThanOrEqual(0)
  })
})
