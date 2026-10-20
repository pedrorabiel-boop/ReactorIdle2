import type { Coast } from './coast'
import type { Island } from './island'
import { CORAL_PROPS, SWAMP_PROPS, type PropSprite } from './pixel/props'

// ─────────────────────────────────────────────────────────────────────────────
// Reparto de los props de escenario.
//
// Dos reglas, no una, porque son dos problemas distintos:
//
//   La BASE de un prop no puede tapar ninguna casilla construible. Si la tapa,
//   el jugador no puede ver ni pulsar el terreno.
//
//   Lo que vuela por encima sí puede solaparse. Eso no se arregla moviendo el
//   árbol, sino por orden de pintado y transparencia.
//
// La base no es un número a ojo: son los píxeles de tierra propia del prop —el
// montículo de un manglar, la roca de un arrecife— más lo que pinte en el
// quinto inferior del dibujo, que es por donde se apoya. Así la regla sobrevive
// a que el arte cambie de forma.
// ─────────────────────────────────────────────────────────────────────────────

/** Dónde puede plantarse un prop. */
type Ground = 'water' | 'land' | 'shore' | 'open'

interface Spread {
  names: string[]
  on: Ground
  chance: number
  /** Separación mínima con otro del mismo grupo, en casillas. */
  gap?: [number, number]
}

export interface SceneryPlan {
  props: Record<string, PropSprite>
  /** Letras que son suelo propio del prop y por tanto parte de su base. */
  soil: ReadonlySet<string>
  /** Los grandes, repartidos y separados entre sí. */
  anchored: Spread[]
  /** Los pequeños, como mucho uno por casilla. */
  scatter: Spread[]
}

export const SWAMP_PLAN: SceneryPlan = {
  props: SWAMP_PROPS,
  soil: new Set(['G', 'g', 'D', 'N']),
  anchored: [{ names: ['mangrove', 'mangrove-b', 'mangrove-c'], on: 'water', chance: 0.5, gap: [6, 5] }],
  scatter: [
    { names: ['fern', 'fern-b', 'glowshroom', 'glowshroom-b'], on: 'land', chance: 0.5 },
    { names: ['reeds', 'reeds-b'], on: 'shore', chance: 0.26 },
    { names: ['lilypad', 'lilypad-b', 'crystal', 'crystal-b'], on: 'open', chance: 0.14 },
  ],
}

export const CORAL_PLAN: SceneryPlan = {
  props: CORAL_PROPS,
  // La roca del arrecife es su suelo; las palmeras se apoyan en tierra ajena.
  soil: new Set(['R', 'r']),
  anchored: [
    { names: ['reef', 'reef-b', 'reef-c'], on: 'open', chance: 0.45, gap: [5, 4] },
    { names: ['palms', 'palms-b'], on: 'land', chance: 0.72, gap: [3, 3] },
  ],
  scatter: [
    // La tierra fuera de la grilla es poca, asi que se puebla densa: en la
    // referencia nunca hay un claro de hierba pelada.
    { names: ['palm', 'palm-b', 'bush', 'bush-b', 'boulder'], on: 'land', chance: 0.85 },
    { names: ['shell', 'starfish'], on: 'shore', chance: 0.3 },
    { names: ['coral', 'coral-b', 'fish', 'fish-b'], on: 'open', chance: 0.22 },
  ],
}

export interface PlacedProp {
  name: string
  /** Esquina del sprite, en píxeles de arte. */
  x: number
  y: number
  /** Lado en casillas. */
  tiles: number
  /** Fila donde se apoya: decide quién se pinta delante de quién. */
  anchor: number
  /** Casillas que el dibujo pinta, para la transparencia. */
  covers: string[]
}

const hash = (x: number, y: number): number => {
  let h = (x * 73856093) ^ (y * 19349663)
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995)
  return (Math.abs(h ^ (h >>> 15)) % 10000) / 10000
}

function tilesOf(prop: PropSprite, ox: number, oy: number, unit: number, only?: ReadonlySet<string>): string[] {
  const out = new Set<string>()
  const floor = prop.rows.length * 0.78
  prop.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '.') continue
      // La base: el suelo propio, esté donde esté, y todo lo del quinto bajo.
      if (only && !(only.has(ch) || y >= floor)) continue
      out.add(`${Math.floor((ox + x) / unit)},${Math.floor((oy + y) / unit)}`)
    }
  })
  return [...out]
}

export function placeScenery(island: Island, coast: Coast, unit: number, plan: SceneryPlan): PlacedProp[] {
  const buildable = new Set(island.tiles.filter((t) => t.gridIndex !== null).map((t) => `${t.x},${t.y}`))
  const isLand = (tx: number, ty: number) => {
    const px = tx * unit + unit / 2, py = ty * unit + unit / 2
    if (px < 0 || px >= coast.w || py < 0 || py >= coast.h) return false
    return coast.land[py * coast.w + px] === 1
  }
  const touchesShore = (tx: number, ty: number) => {
    const here = isLand(tx, ty)
    return [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => isLand(tx + dx, ty + dy) !== here)
  }
  const fits = (on: Ground, tx: number, ty: number) => {
    const land = isLand(tx, ty)
    if (on === 'land') return land
    if (on === 'water') return !land
    if (on === 'shore') return !land && touchesShore(tx, ty)
    return !land && !touchesShore(tx, ty)
  }

  const placed: PlacedProp[] = []
  const takenBase = new Set<string>()

  const tryPlace = (name: string, tx: number, ty: number): boolean => {
    const prop = plan.props[name]
    if (!prop) return false
    const x = (tx + 0.5) * unit - (prop.tiles * unit) / 2
    const y = (ty + 1) * unit - prop.tiles * unit + 12
    const base = tilesOf(prop, x, y, unit, plan.soil)
    for (const key of base) {
      if (buildable.has(key) || takenBase.has(key)) return false
    }
    for (const key of base) takenBase.add(key)
    placed.push({ name, x, y, tiles: prop.tiles, anchor: ty, covers: tilesOf(prop, x, y, unit) })
    return true
  }

  for (const spread of plan.anchored) {
    const used: Array<[number, number]> = []
    const [gx, gy] = spread.gap ?? [4, 4]
    for (const t of island.tiles) {
      if (!fits(spread.on, t.x, t.y)) continue
      if (t.x < 2 || t.y < 2 || t.x > island.cols - 3) continue
      if (used.some(([ax, ay]) => Math.abs(ax - t.x) < gx && Math.abs(ay - t.y) < gy)) continue
      if (hash(t.x * 31, t.y * 17) > spread.chance) continue
      if (tryPlace(spread.names[used.length % spread.names.length], t.x, t.y)) used.push([t.x, t.y])
    }
  }

  for (const t of island.tiles) {
    const key = `${t.x},${t.y}`
    if (takenBase.has(key) || buildable.has(key)) continue
    const roll = hash(t.x * 7 + 3, t.y * 11 + 5)
    for (const spread of plan.scatter) {
      if (!fits(spread.on, t.x, t.y) || roll >= spread.chance) continue
      const pick = spread.names[Math.floor((roll / spread.chance) * spread.names.length) % spread.names.length]
      if (tryPlace(pick, t.x, t.y)) break
    }
  }

  return placed.sort((a, b) => a.anchor - b.anchor)
}

/** Un reparto por sector: recorre todas las casillas y mide huellas. */
const cache = new Map<string, PlacedProp[]>()

export function sceneryFor(key: string, island: Island, coast: Coast, unit: number, plan: SceneryPlan): PlacedProp[] {
  let scenery = cache.get(key)
  if (!scenery) { scenery = placeScenery(island, coast, unit, plan); cache.set(key, scenery) }
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
