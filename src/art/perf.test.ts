import { describe, it } from 'vitest'
import { buildIsland } from '../ui/island'
import { buildCoast, distanceTo, fbm } from '../ui/coast'
import { CYBERPUNK_ENVIRONMENT } from '../ui/pixel/cyberpunk'
import { TERRAIN_UNIT } from '../ui/pixel/sprites'

describe('coste de la costa organica', () => {
  it('mide el calculo', () => {
    const island = buildIsland(10, 8, 'desert')
    const cells = island.tiles.filter((t) => t.gridIndex !== null).map((t) => [t.x, t.y] as [number, number])
    const w = island.cols * TERRAIN_UNIT, h = island.rows * TERRAIN_UNIT
    const runs: number[] = []
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now()
      buildCoast(cells, cells, TERRAIN_UNIT, w, h, CYBERPUNK_ENVIRONMENT.coast)
      runs.push(performance.now() - t0)
    }
    const best = Math.min(...runs)
    const avg = runs.reduce((a, b) => a + b, 0) / runs.length

    const seed = new Uint8Array(w * h)
    for (let i = 0; i < seed.length; i += 997) seed[i] = 1
    let t0 = performance.now()
    distanceTo(seed, w, h)
    const dt = performance.now() - t0

    t0 = performance.now()
    let acc = 0
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) acc += fbm(x, y, 46, 1)
    const noise = performance.now() - t0

    const lines = [
      '',
      `  mapa ${w}x${h} = ${Math.round(w * h / 1000)}k pixeles`,
      `  buildCoast total:      ${best.toFixed(0)} ms el mejor, ${avg.toFixed(0)} ms de media`,
      `  una transformada:      ${dt.toFixed(0)} ms  (se hacen 3)`,
      `  medio millon de fbm:   ${noise.toFixed(0)} ms  ${acc > 0 ? '' : '?'}`,
      '',
    ]
    for (const line of lines) console.log(line)
  })
})
