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

  it('aisla el brillo del mar en todos los tiles de agua para poder atenuarlo por igual', () => {
    const markup = renderToStaticMarkup(createElement(TerrainLayer, {
      cols: 2,
      rows: 1,
      tileSize: 48,
      tiles: [
        { x: 0, y: 0, kind: 'water', neighbors: { n: 'water', e: 'water', s: 'water', w: 'water' }, decor: null },
        { x: 1, y: 0, kind: 'water', neighbors: { w: 'land' }, decor: null },
      ],
    }))

    // Mar abierto y transición a tierra llevan la misma capa de brillo…
    expect(markup.match(/sea-sparkle/g)).toHaveLength(2)
    // …y la espuma de la costa queda fuera de ella, en la capa opaca.
    const transition = markup.slice(markup.indexOf('translate(16 0)'))
    expect(transition).toContain('var(--px-8)')
    expect(transition.slice(0, transition.indexOf('sea-sparkle'))).not.toContain('var(--px-5)')
  })
})
