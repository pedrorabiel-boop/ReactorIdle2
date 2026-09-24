import { describe, expect, it } from 'vitest'
import { SPRITES, validate } from './sprites'

describe('pixel sprites', () => {
  it('keeps every sprite inside the 16 by 16 palette contract', () => {
    expect(() => validate()).not.toThrow()
  })

  it('gives each tier-II building a distinct visual identity', () => {
    expect(SPRITES.sales2).not.toEqual(SPRITES.sales)
    expect(SPRITES.research2).not.toEqual(SPRITES.research)
    expect(SPRITES.generator2).not.toEqual(SPRITES.generator)
    expect(SPRITES.pipe2).not.toEqual(SPRITES.pipe)
  })
})
