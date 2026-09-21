import { memo, useMemo } from 'react'
import { ENVIRONMENTS, envCssVars, rowsToRects, SPRITES, terrainRows, type EnvironmentKey, type Neighbors, type TerrainKind } from './sprites'

const SYMBOL_PREFIX = 'px-'

/** Define cada sprite una sola vez como <symbol>; los <Sprite> lo referencian con <use>. */
export const SpriteDefs = memo(function SpriteDefs() {
  const symbols = useMemo(
    () => Object.entries(SPRITES).map(([name, rows]) => `<symbol id="${SYMBOL_PREFIX}${name}" viewBox="0 0 16 16">${rowsToRects(rows, undefined, true)}</symbol>`).join(''),
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

const terrainCache = new Map<string, string>()

function terrainRects(kind: TerrainKind, neighbors: Neighbors): string {
  const key = kind === 'water' ? `water:${['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'].map((k) => (neighbors[k as keyof Neighbors] === 'land' ? 1 : 0)).join('')}` : kind
  let rects = terrainCache.get(key)
  if (!rects) {
    rects = rowsToRects(terrainRows(kind, neighbors), undefined, true)
    terrainCache.set(key, rects)
  }
  return rects
}

/**
 * Todo el terreno y su decoración en un único SVG: sin costuras entre tiles
 * al escalar y con un solo nodo en el DOM. Las coordenadas van en píxeles
 * lógicos (16 por tile).
 */
export const TerrainLayer = memo(function TerrainLayer({ tiles, cols, rows, tileSize }: TerrainLayerProps) {
  const markup = useMemo(() => tiles.map((tile) => {
    const decor = tile.decor ? `<use href="#${SYMBOL_PREFIX}${tile.decor}" width="16" height="16"/>` : ''
    return `<g transform="translate(${tile.x * 16} ${tile.y * 16})">${terrainRects(tile.kind, tile.neighbors)}${decor}</g>`
  }).join(''), [tiles])
  return (
    <svg
      className="sprite terrain-layer"
      viewBox={`0 0 ${cols * 16} ${rows * 16}`}
      width={cols * tileSize}
      height={rows * tileSize}
      shapeRendering="crispEdges"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
})

/** Variables CSS de la paleta para el ambiente activo. */
export function environmentStyle(env: EnvironmentKey): Record<string, string> {
  const style: Record<string, string> = {}
  for (const decl of envCssVars(ENVIRONMENTS[env]).split(';')) {
    const [name, value] = decl.split(':')
    style[name] = value
  }
  style['--glow'] = ENVIRONMENTS[env].glow
  return style
}
