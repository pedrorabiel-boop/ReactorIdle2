import { describe, expect, it } from 'vitest'
import { buildIsland } from './island'
import { buildCoast } from './coast'
import { CORAL_PLAN, fadedProps, placeScenery, SWAMP_PLAN } from './scenery'
import { CYBERPUNK_ENVIRONMENT } from './pixel/cyberpunk'
import { CORAL_ENVIRONMENT } from './pixel/coral'
import { SWAMP_PROPS } from './pixel/props'
import { TERRAIN_UNIT } from './pixel/sprites'

const SOIL = new Set(['G', 'g', 'D', 'N'])

const swamp = () => {
  const island = buildIsland(10, 8, 'desert')
  const cells = island.tiles.filter((t) => t.kind === 'land').map((t) => [t.x, t.y] as [number, number])
  const grid = island.tiles.filter((t) => t.gridIndex !== null).map((t) => [t.x, t.y] as [number, number])
  const coast = buildCoast(cells, TERRAIN_UNIT, island.cols * TERRAIN_UNIT, island.rows * TERRAIN_UNIT, CYBERPUNK_ENVIRONMENT.coast)
  return { island, coast, buildable: new Set(grid.map(([x, y]) => `${x},${y}`)) }
}

describe('costa organica', () => {
  it('nunca le quita tierra a una casilla construible', () => {
    const { island, coast, buildable } = swamp()
    // Esta es la garantia que hace seguro mover el borde con ruido: puede
    // crecer hacia las casillas inutiles, pero jamas morder la grilla.
    for (const key of buildable) {
      const [tx, ty] = key.split(',').map(Number)
      for (let y = ty * TERRAIN_UNIT; y < (ty + 1) * TERRAIN_UNIT; y++) {
        for (let x = tx * TERRAIN_UNIT; x < (tx + 1) * TERRAIN_UNIT; x++) {
          expect(coast.land[y * coast.w + x]).toBe(1)
        }
      }
    }
    expect(island.tiles.length).toBeGreaterThan(0)
  })

  it('deja el borde irregular y no en escalera', () => {
    const { coast, buildable } = swamp()
    // La tierra crece mas alla de la grilla, y de forma desigual: si el avance
    // fuese constante el contorno volveria a ser la escalera de siempre.
    const grown = new Set<number>()
    for (let y = 0; y < coast.h; y++) {
      let run = 0
      for (let x = 0; x < coast.w; x++) {
        const land = coast.land[y * coast.w + x] === 1
        const tile = `${Math.floor(x / TERRAIN_UNIT)},${Math.floor(y / TERRAIN_UNIT)}`
        if (land && !buildable.has(tile)) run++
        else if (run) { grown.add(run); run = 0 }
      }
    }
    expect(grown.size).toBeGreaterThan(10)
  })
})

describe('reparto del escenario', () => {
  it('no planta el suelo de ningun prop sobre una casilla construible', () => {
    const { island, coast, buildable } = swamp()
    const placed = placeScenery(island, coast, TERRAIN_UNIT, SWAMP_PLAN)
    expect(placed.length).toBeGreaterThan(10)

    for (const prop of placed) {
      const rows = SWAMP_PROPS[prop.name].rows
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          if (!SOIL.has(row[x])) continue
          const tile = `${Math.floor((prop.x + x) / TERRAIN_UNIT)},${Math.floor((prop.y + y) / TERRAIN_UNIT)}`
          expect(buildable.has(tile), `${prop.name} tapa la casilla ${tile}`).toBe(false)
        }
      })
    }
  })

  it('deja que las copas vuelen sobre la grilla, que es cosa de profundidad', () => {
    const { island, coast, buildable } = swamp()
    const placed = placeScenery(island, coast, TERRAIN_UNIT, SWAMP_PLAN)
    // Si ninguna copa volase sobre la grilla no haria falta transparencia, y
    // el reparto estaria siendo mas timido de la cuenta.
    const overhang = placed.filter((p) => p.covers.some((key) => buildable.has(key)))
    expect(overhang.length).toBeGreaterThan(0)
  })

  it('reparte el mismo escenario en cada partida', () => {
    const a = swamp(), b = swamp()
    expect(placeScenery(a.island, a.coast, TERRAIN_UNIT, SWAMP_PLAN)).toEqual(placeScenery(b.island, b.coast, TERRAIN_UNIT, SWAMP_PLAN))
  })
})

describe('transparencia de copa', () => {
  it('al mirar una casilla solo aparta lo que tapa esa casilla', () => {
    const { island, coast, buildable } = swamp()
    const placed = placeScenery(island, coast, TERRAIN_UNIT, SWAMP_PLAN)
    const overhang = placed.filter((p) => p.covers.some((key) => buildable.has(key)))
    expect(overhang.length).toBeGreaterThan(0)

    const target = overhang[0].covers.find((key) => buildable.has(key))!
    const faded = fadedProps(placed, { building: false, buildable, inspected: target })
    expect(faded.size).toBeGreaterThan(0)
    // Nada que no tape esa casilla concreta se desvanece.
    for (const i of faded) expect(placed[i].covers).toContain(target)
  })

  it('con la herramienta armada aparta todo lo que vuela sobre la grilla', () => {
    const { island, coast, buildable } = swamp()
    const placed = placeScenery(island, coast, TERRAIN_UNIT, SWAMP_PLAN)
    const faded = fadedProps(placed, { building: true, buildable, inspected: null })
    const overhang = placed.filter((p) => p.covers.some((key) => buildable.has(key)))
    expect(faded.size).toBe(overhang.length)
    // Y lo que esta sobre agua abierta se queda entero: si no, seria un
    // parpadeo de todo el escenario cada vez que abres construir.
    expect(faded.size).toBeLessThan(placed.length)
  })

  it('no aparta nada cuando no estas tocando el mapa', () => {
    const { island, coast, buildable } = swamp()
    const placed = placeScenery(island, coast, TERRAIN_UNIT, SWAMP_PLAN)
    expect(fadedProps(placed, { building: false, buildable, inspected: null }).size).toBe(0)
  })
})
