import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TerrainLayer } from './Sprite'
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

  it('marks only open-water tiles so the cyberpunk texture can be dimmed independently', () => {
    const markup = renderToStaticMarkup(createElement(TerrainLayer, {
      cols: 2,
      rows: 1,
      tileSize: 48,
      tiles: [
        { x: 0, y: 0, kind: 'water', neighbors: { n: 'water', e: 'water', s: 'water', w: 'water' }, decor: null },
        { x: 1, y: 0, kind: 'water', neighbors: { w: 'land' }, decor: null },
      ],
    }))

    expect(markup.match(/terrain-water-open/g)).toHaveLength(1)
  })
})
