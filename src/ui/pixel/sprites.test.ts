import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TerrainLayer } from './Sprite'
import { SPRITES, validate } from './sprites'

/** Clave de forma de un tile: n,e,s,w,ne,nw,se,sw. */
const OPEN_SEA = 'w00000000'
const LAND_TO_THE_WEST = 'w00010000'

describe('pixel sprites', () => {
  it('mantiene cada sprite cuadrado y dentro de la paleta', () => {
    expect(() => validate()).not.toThrow()
  })

  it('dibuja el terreno a 32 px de arte por casilla', () => {
    for (const kind of ['land', 'water', 'shore']) {
      expect(SPRITES[kind]).toHaveLength(32)
      expect(SPRITES[kind][0]).toHaveLength(32)
    }
  })

  it('gives each tier-II building a distinct visual identity', () => {
    expect(SPRITES.sales2).not.toEqual(SPRITES.sales)
    expect(SPRITES.research2).not.toEqual(SPRITES.research)
    expect(SPRITES.generator2).not.toEqual(SPRITES.generator)
    expect(SPRITES.pipe2).not.toEqual(SPRITES.pipe)
  })

  const render = () => renderToStaticMarkup(createElement(TerrainLayer, {
    cols: 2,
    rows: 1,
    tileSize: 64,
    tiles: [
      { x: 0, y: 0, kind: 'water', neighbors: { n: 'water', e: 'water', s: 'water', w: 'water' }, decor: null },
      { x: 1, y: 0, kind: 'water', neighbors: { w: 'land' }, decor: null },
    ],
  }))

  it('define cada forma de tile una sola vez y la reusa con <use>', () => {
    const markup = render()
    const defs = markup.slice(markup.indexOf('<defs>'), markup.indexOf('</defs>'))
    // Dos formas distintas de agua: mar abierto y transición a tierra.
    expect(defs.match(/<g id="t-/g)).toHaveLength(2)
    expect(defs).toContain(`id="t-${OPEN_SEA}"`)
    expect(defs).toContain(`id="t-${LAND_TO_THE_WEST}"`)
    // Y ningún rect fuera de <defs>: los tiles son solo referencias.
    expect(markup.slice(markup.indexOf('</defs>'))).not.toContain('<rect')
  })

  it('aisla el brillo del mar en todos los tiles de agua para poder atenuarlo por igual', () => {
    const markup = render()
    const defs = markup.slice(0, markup.indexOf('</defs>'))
    const defOf = (id: string) => {
      const from = defs.indexOf(`<g id="${id}">`)
      return from < 0 ? '' : defs.slice(from, defs.indexOf('</g>', from))
    }

    // Una sola capa de brillo, con un uso por tile de agua: mar abierto y
    // transición a tierra entran los dos.
    expect(markup.match(/class="sea-sparkle"/g)).toHaveLength(1)
    const layer = markup.slice(markup.indexOf('class="sea-sparkle"'))
    expect(layer.match(/<use/g)).toHaveLength(2)
    expect(defOf(`s-${OPEN_SEA}`)).toContain('var(--px-5)')
    expect(defOf(`s-${LAND_TO_THE_WEST}`)).toContain('var(--px-5)')

    // …y la espuma de la costa queda fuera de ella, en la capa opaca.
    expect(defOf(`t-${LAND_TO_THE_WEST}`)).toContain('var(--px-8)')
    expect(defOf(`t-${LAND_TO_THE_WEST}`)).not.toContain('var(--px-5)')
  })
})
