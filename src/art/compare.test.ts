import { describe, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { buildIsland } from '../ui/island'
import { rowsToRects as newRects, terrainRows as newTerrain } from '../ui/pixel/sprites'
import { rowsToRects as oldRects, terrainRows as oldTerrain } from './old-sprites'

/** Cuenta los rects que cada version mete en el SVG del terreno, isla por isla. */
describe('costo del terreno en el DOM', () => {
  it('compara antes y despues', () => {
    const lines: string[] = []
    for (const sector of ['coast', 'desert', 'testsite'] as const) {
      const island = buildIsland(10, 8, sector)
      // Antes: los rects se repetian dentro de cada tile, sin deduplicar.
      let before = 0
      for (const t of island.tiles) before += oldRects(oldTerrain(t.kind, t.neighbors), undefined, true).split('<rect').length - 1
      // Ahora: una definicion por forma de tile y un <use> por tile.
      const shapes = new Map<string, number>()
      for (const t of island.tiles) {
        const key = t.kind === 'water' ? `w${['n','e','s','w','ne','nw','se','sw'].map((k) => t.neighbors[k as 'n'] === 'land' ? 1 : 0).join('')}` : t.kind
        if (!shapes.has(key)) shapes.set(key, newRects(newTerrain(t.kind, t.neighbors), undefined, true).split('<rect').length - 1)
      }
      const after = [...shapes.values()].reduce((a, b) => a + b, 0)
      lines.push(`${sector}: ${island.tiles.length} tiles | antes ${before} rects (16px) | ahora ${after} rects en ${shapes.size} definiciones (32px) | ${(before / after).toFixed(2)}x menos`)
    }
    writeFileSync('docs/dom-cost.txt', lines.join('\n') + '\n')
    console.log('\n' + lines.join('\n'))
  })
})
