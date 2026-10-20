import { memo, useMemo } from 'react'
import { ENVIRONMENTS, envCssVars, rowsToRects, SPRITES, spriteBox, terrainRows, toDataUri, type Environment, type EnvironmentKey, type Neighbors, type TerrainKind } from './sprites'

const SYMBOL_PREFIX = 'px-'

/** Define cada sprite una sola vez como <symbol>; los <Sprite> lo referencian con <use>. */
export const SpriteDefs = memo(function SpriteDefs() {
  const symbols = useMemo(
    () => Object.entries(SPRITES).map(([name, rows]) => `<symbol id="${SYMBOL_PREFIX}${name}" viewBox="${spriteBox(rows)}">${rowsToRects(rows, undefined, true)}</symbol>`).join(''),
    [],
  )
  return <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute' }} dangerouslySetInnerHTML={{ __html: symbols }} />
})

interface SpriteProps {
  name: string
  size?: number
  className?: string
  title?: string
}

export function Sprite({ name, size = 16, className, title }: SpriteProps) {
  return (
    <svg className={className ? `sprite ${className}` : 'sprite'} viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <use href={`#${SYMBOL_PREFIX}${name}`} />
    </svg>
  )
}

export interface TerrainLayerTile {
  x: number
  y: number
  kind: TerrainKind
  neighbors: Neighbors
  decor: string | null
}

interface TerrainLayerProps {
  tiles: TerrainLayerTile[]
  cols: number
  rows: number
  tileSize: number
}

const terrainCache = new Map<string, { base: string; sparkle: string }>()

/** Lado del tile de terreno en píxeles de arte, tomado del propio sprite. */
const terrainUnit = () => SPRITES.water.length

/** Identifica la forma de un tile: los que comparten vecinos comparten dibujo. */
const terrainKey = (kind: TerrainKind, neighbors: Neighbors) =>
  kind === 'water' ? `w${['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'].map((k) => (neighbors[k as keyof Neighbors] === 'land' ? 1 : 0)).join('')}` : kind

/**
 * Separa el brillo del mar abierto (color 5) del resto del tile para poder
 * atenuarlo por CSS en cualquier tile, también en los de transición a tierra.
 * La espuma de la costa usa el color 8 y se queda en la capa opaca.
 */
function terrainRects(kind: TerrainKind, neighbors: Neighbors): { base: string; sparkle: string } {
  const key = terrainKey(kind, neighbors)
  let rects = terrainCache.get(key)
  if (!rects) {
    const rows = terrainRows(kind, neighbors)
    const mask = (keep: boolean) => rows.map((row) => [...row].map((ch) => (ch === '5') === keep ? ch : '.').join(''))
    rects = {
      base: rowsToRects(mask(false), undefined, true),
      sparkle: rowsToRects(mask(true), undefined, true),
    }
    terrainCache.set(key, rects)
  }
  return rects
}

/**
 * Todo el terreno y su decoración en un único SVG: sin costuras entre tiles
 * al escalar y con un solo nodo en el DOM.
 *
 * Cada forma de tile se define UNA vez en <defs> y los cientos de tiles la
 * referencian con <use>. Antes se repetían los rects en cada tile: con el
 * terreno a 32×32 eso serían más de cien mil nodos, y así son unas pocas
 * decenas de definiciones.
 */
export const TerrainLayer = memo(function TerrainLayer({ tiles, cols, rows, tileSize }: TerrainLayerProps) {
  const markup = useMemo(() => {
    const unit = terrainUnit()
    const defs = new Map<string, string>()
    const bases: string[] = []
    const sparkles: string[] = []
    const decors: string[] = []
    for (const tile of tiles) {
      const key = terrainKey(tile.kind, tile.neighbors)
      const { base, sparkle } = terrainRects(tile.kind, tile.neighbors)
      const at = `x="${tile.x * unit}" y="${tile.y * unit}"`
      if (!defs.has(key)) {
        defs.set(key, `<g id="t-${key}">${base}</g>${sparkle ? `<g id="s-${key}">${sparkle}</g>` : ''}`)
      }
      bases.push(`<use href="#t-${key}" ${at}/>`)
      if (sparkle) sparkles.push(`<use href="#s-${key}" ${at}/>`)
      // La decoración se escala al tile: sigue viniendo de sprites de 32.
      if (tile.decor) decors.push(`<use href="#${SYMBOL_PREFIX}${tile.decor}" ${at} width="${unit}" height="${unit}"/>`)
    }
    return `<defs>${[...defs.values()].join('')}</defs>${bases.join('')}`
      + (sparkles.length ? `<g class="sea-sparkle">${sparkles.join('')}</g>` : '')
      + decors.join('')
  }, [tiles])
  const unit = terrainUnit()
  return (
    <svg
      className="sprite terrain-layer"
      viewBox={`0 0 ${cols * unit} ${rows * unit}`}
      width={cols * tileSize}
      height={rows * tileSize}
      shapeRendering="crispEdges"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
})

/** Variables CSS de la paleta para el ambiente activo. */
export function environmentStyle(env: EnvironmentKey | Environment): Record<string, string> {
  const environment = typeof env === 'string' ? ENVIRONMENTS[env] : env
  const style: Record<string, string> = {}
  for (const decl of envCssVars(environment).split(';')) {
    const [name, value] = decl.split(':')
    style[name] = value
  }
  style['--glow'] = environment.glow
  // Tile de mar abierto para empapelar todo el viewport detrás de la isla.
  style['--sea'] = `url("${toDataUri('water', environment)}")`
  return style
}
