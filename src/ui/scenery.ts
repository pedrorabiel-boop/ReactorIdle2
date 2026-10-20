import type { Coast } from './coast'
import type { Island } from './island'
import { SWAMP_PROPS, type PropSprite } from './pixel/props'

// ─────────────────────────────────────────────────────────────────────────────
// Reparto de los props de escenario.
//
// Dos reglas, no una, porque son dos problemas distintos:
//
//   El SUELO de un prop -su montículo- no puede tapar ninguna casilla
//   construible. Si la tapa, el jugador no puede ver ni pulsar el terreno.
//
//   La COPA sí puede volar por encima. Eso no se arregla moviendo el árbol,
//   sino por orden de pintado y transparencia.
//
// La huella del suelo no es un número a ojo: se deduce de los propios píxeles
// de tierra del dibujo, así que si el montículo cambia de forma la regla sigue
// valiendo sin tocar nada.
// ─────────────────────────────────────────────────────────────────────────────

/** Letras de tierra y filo del montículo, tras el remapeo del generador. */
const SOIL = new Set(['d', 'x', 'y', 'N'])

export interface PlacedProp {
  name: string
  /** Esquina del sprite, en píxeles de arte. */
  x: number
  y: number
  /** Lado en casillas. */
  tiles: number
  /** Fila donde se apoya: decide quién se pinta delante de quién. */
  anchor: number
  /** Casillas que el dibujo pinta, para la transparencia de copa. */
  covers: string[]
}

const hash = (x: number, y: number): number => {
  let h = (x * 73856093) ^ (y * 19349663)
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995)
  return (Math.abs(h ^ (h >>> 15)) % 10000) / 10000
}

/** Casillas que pinta un sprite, filtrando por un juego de letras. */
function tilesOf(prop: PropSprite, ox: number, oy: number, unit: number, only?: Set<string>): string[] {
  const out = new Set<string>()
  prop.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '.' || (only && !only.has(ch))) continue
      out.add(`${Math.floor((ox + x) / unit)},${Math.floor((oy + y) / unit)}`)
    }
  })
  return [...out]
}

export function placeScenery(island: Island, coast: Coast, unit: number): PlacedProp[] {
  const buildable = new Set(island.tiles.filter((t) => t.gridIndex !== null).map((t) => `${t.x},${t.y}`))
  const isLand = (tx: number, ty: number) => {
    const px = tx * unit + unit / 2, py = ty * unit + unit / 2
    if (px < 0 || px >= coast.w || py < 0 || py >= coast.h) return false
    return coast.land[py * coast.w + px] === 1
  }

  const placed: PlacedProp[] = []
  const takenSoil = new Set<string>()

  const tryPlace = (name: string, tx: number, ty: number): boolean => {
    const prop = SWAMP_PROPS[name]
    if (!prop) return false
    const x = (tx + 0.5) * unit - (prop.tiles * unit) / 2
    const y = (ty + 1) * unit - prop.tiles * unit + 12
    const soil = tilesOf(prop, x, y, unit, SOIL)
    for (const key of soil) {
      if (buildable.has(key) || takenSoil.has(key)) return false
      const [sx, sy] = key.split(',').map(Number)
      // El montículo es suelo propio sobre agua: tampoco se mete en la isla.
      if (isLand(sx, sy)) return false
    }
    for (const key of soil) takenSoil.add(key)
    placed.push({ name, x, y, tiles: prop.tiles, anchor: ty, covers: tilesOf(prop, x, y, unit) })
    return true
  }

  // Manglares: repartidos por el agua abierta y separados entre sí.
  const variants = ['mangrove', 'mangrove-b', 'mangrove-c']
  const anchors: Array<[number, number]> = []
  for (const t of island.tiles) {
    if (isLand(t.x, t.y) || t.x < 2 || t.y < 2 || t.x > island.cols - 3) continue
    if (anchors.some(([ax, ay]) => Math.abs(ax - t.x) < 6 && Math.abs(ay - t.y) < 5)) continue
    if (hash(t.x * 31, t.y * 17) > 0.5) continue
    if (tryPlace(variants[anchors.length % variants.length], t.x, t.y)) anchors.push([t.x, t.y])
  }

  // Lo pequeño: helechos y hongos en tierra inútil, juncos en la orilla,
  // nenúfares y cristales en el agua abierta.
  for (const t of island.tiles) {
    const key = `${t.x},${t.y}`
    if (takenSoil.has(key) || buildable.has(key)) continue
    const land = isLand(t.x, t.y)
    const r = hash(t.x * 7 + 3, t.y * 11 + 5)
    const nearShore = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => isLand(t.x + dx, t.y + dy) !== land)
    let pick: string | null = null
    if (land) pick = r < 0.3 ? (r < 0.15 ? 'fern' : 'fern-b') : r < 0.5 ? (r < 0.4 ? 'glowshroom' : 'glowshroom-b') : null
    else if (nearShore) pick = r < 0.26 ? (r < 0.13 ? 'reeds' : 'reeds-b') : null
    else pick = r < 0.06 ? 'lilypad' : r < 0.09 ? 'lilypad-b' : r < 0.12 ? 'crystal' : r < 0.14 ? 'crystal-b' : null
    if (pick) tryPlace(pick, t.x, t.y)
  }

  return placed.sort((a, b) => a.anchor - b.anchor)
}

/** Un reparto por sector: recorre todas las casillas y mide huellas. */
const cache = new Map<string, PlacedProp[]>()

export function sceneryFor(key: string, island: Island, coast: Coast, unit: number): PlacedProp[] {
  let scenery = cache.get(key)
  if (!scenery) { scenery = placeScenery(island, coast, unit); cache.set(key, scenery) }
  return scenery
}

export interface FadeContext {
  /** La herramienta de construir esta armada: hace falta ver el tablero entero. */
  building: boolean
  /** Casillas construibles del mapa. */
  buildable: ReadonlySet<string>
  /** Casilla que el jugador esta mirando, si hay alguna. */
  inspected: string | null
}

/**
 * Que props deben desvanecerse ahora mismo.
 *
 * Son dos disparadores distintos a proposito. Al mirar una casilla solo se
 * aparta lo que tapa ESA casilla; con la herramienta armada se apartan todos
 * los que vuelan sobre la grilla, porque entonces hace falta leer el tablero
 * completo. Desvanecerlos todos siempre seria un parpadeo constante.
 */
export function fadedProps(scenery: PlacedProp[], { building, buildable, inspected }: FadeContext): Set<number> {
  const out = new Set<number>()
  scenery.forEach((prop, i) => {
    const hides = building
      ? prop.covers.some((key) => buildable.has(key))
      : inspected !== null && prop.covers.includes(inspected)
    if (hides) out.add(i)
  })
  return out
}
