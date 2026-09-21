import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { COMPONENTS } from '../game/catalog'
import { usesAutonomy } from '../game/engine'
import { componentCapacity, directEnergyRate, fuelCapacity } from '../game/research'
import type { ComponentKind, GameState, Tile, ToolMode } from '../game/types'
import { formatDecimal } from './format'
import { TILE, type Island } from './island'
import { Sprite, TerrainLayer } from './pixel/Sprite'

interface MapViewportProps {
  game: GameState
  island: Island
  decoration: string
  armed: boolean
  toolMode: ToolMode
  selectedKind: ComponentKind
  inspectedIndex: number | null
  minimalUi?: boolean
  onCellPointerDown: (event: PointerEvent<HTMLButtonElement>, index: number) => void
  onCellClick: (index: number) => void
  onGridPointerMove: (event: PointerEvent<HTMLDivElement>) => void
}

function heatLevel(heat: number, capacity: number): 0 | 1 | 2 | 3 | 4 | 5 {
  const ratio = heat / capacity
  if (ratio > 0.82) return 5
  if (ratio > 0.62) return 4
  if (ratio > 0.42) return 3
  if (ratio > 0.2) return 2
  if (ratio > 0.02) return 1
  return 0
}

function cellLabel(tile: Tile | null, game: GameState, index: number): string {
  if (!tile) return `Casilla vacía ${index + 1}`
  const definition = COMPONENTS[tile.kind]
  if (usesAutonomy(tile.kind) && tile.fuel <= 0) return `${definition.name}, caducada; reconstruye el mismo tipo o demuele la casilla`
  const capacity = componentCapacity(game, tile.kind)
  if (capacity > 0) return `${definition.name}, calor ${Math.round(tile.heat)} de ${capacity}`
  if (tile.damaged) return `${definition.name}, averiado`
  if (tile.kind === 'controller') return `${definition.name}, prioridad automática`
  return `${definition.name}, producción ${formatDecimal(directEnergyRate(game, tile.kind))} por segundo`
}

interface CellProps {
  game: GameState
  tile: Tile | null
  index: number
  x: number
  y: number
  armed: boolean
  toolMode: ToolMode
  selectedKind: ComponentKind
  inspected: boolean
  onPointerDown: (event: PointerEvent<HTMLButtonElement>, index: number) => void
  onClick: (index: number) => void
}

const Cell = memo(function Cell({ game, tile, index, x, y, armed, toolMode, selectedKind, inspected, onPointerDown, onClick }: CellProps) {
  const capacity = tile ? componentCapacity(game, tile.kind) : 0
  const thermal = capacity > 0
  const level = tile && thermal ? heatLevel(tile.heat, capacity) : 0
  const hasAutonomy = tile ? usesAutonomy(tile.kind) : false
  const fuelMax = tile && hasAutonomy ? fuelCapacity(game, tile.kind) : 0
  const expired = Boolean(tile && hasAutonomy && tile.fuel <= 0)
  const classes = ['cell']
  if (tile) {
    classes.push('occupied', tile.kind, `heat-${level}`)
    if (!tile.enabled) classes.push('off')
    if (tile.damaged) classes.push('damaged')
    if (tile.flow !== 0) classes.push('flowing')
    if (expired) classes.push('empty-fuel', 'expired')
    if (expired && armed && toolMode === 'build' && selectedKind === tile.kind) classes.push('rebuildable')
  } else if (armed && toolMode === 'build') classes.push('buildable')
  if (inspected) classes.push('inspected')
  if (toolMode === 'demolish' && tile) classes.push('demolish-target')

  return (
    <button
      className={classes.join(' ')}
      style={{ left: x * TILE, top: y * TILE }}
      data-cell-index={index}
      aria-label={cellLabel(tile, game, index)}
      onPointerDown={(event) => onPointerDown(event, index)}
      onClick={() => onClick(index)}
    >
      {tile ? (
        <>
          <Sprite name={tile.kind} size={TILE} className="piece" />
          {thermal && (
            <span className={`heat-bar h${level}`} aria-hidden="true"><i /><i /><i /><i /><i /></span>
          )}
          {hasAutonomy && fuelMax > 0 && <span className="fuel-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (tile.fuel / fuelMax) * 100)}%` }} /></span>}
          {tile.flow !== 0 && <span className="flow-tag" aria-hidden="true">{tile.flow < 0 ? '−' : '+'}{Math.round(Math.abs(tile.flow))}</span>}
          {tile.damaged && <span className="worn-tag" aria-hidden="true" title="Avería térmica">⚠</span>}
          {!tile.enabled && <span className="off-tag" aria-hidden="true">⏻</span>}
        </>
      ) : (
        armed && toolMode === 'build' && <Sprite name={selectedKind} size={TILE} className="ghost" />
      )}
    </button>
  )
})

export function MapViewport({ game, island, decoration, armed, toolMode, selectedKind, inspectedIndex, minimalUi = false, onCellPointerDown, onCellClick, onGridPointerMove }: MapViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const changeZoom = (delta: number) => setZoom((current) => Math.max(0.6, Math.min(1.6, Math.round((current + delta) * 10) / 10)))
  const terrainTiles = useMemo(
    () => island.tiles.map((tile) => ({ x: tile.x, y: tile.y, kind: tile.kind, neighbors: tile.neighbors, decor: tile.decor === 'ambient' ? decoration : tile.decor })),
    [island, decoration],
  )

  // Centrar la grilla al montar y al cambiar de sector.
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const gridCenterX = (island.grid.x + island.grid.cols / 2) * TILE * zoom
    const gridCenterY = (island.grid.y + island.grid.rows / 2) * TILE * zoom
    viewport.scrollLeft = gridCenterX - viewport.clientWidth / 2
    viewport.scrollTop = gridCenterY - viewport.clientHeight / 2 + 40
  }, [island, game.activeSector, zoom])

  // Al inspeccionar, asegurar que la pieza quede visible por encima del panel inferior.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || inspectedIndex === null) return
    const cell = viewport.querySelector<HTMLElement>(`[data-cell-index="${inspectedIndex}"]`)
    if (!cell) return
    const rect = cell.getBoundingClientRect()
    const bounds = viewport.getBoundingClientRect()
    const visibleTop = bounds.top + 110
    const visibleBottom = bounds.top + Math.max(200, bounds.height * 0.34)
    if (rect.top >= visibleTop && rect.bottom <= visibleBottom && rect.left >= bounds.left && rect.right <= bounds.right) return
    viewport.scrollTo({
      top: viewport.scrollTop + rect.top - bounds.top - (visibleTop - bounds.top) - (visibleBottom - visibleTop - rect.height) / 2,
      left: viewport.scrollLeft + rect.left - bounds.left - bounds.width / 2 + rect.width / 2,
      behavior: 'smooth',
    })
  }, [inspectedIndex])

  return (
    <div className={`viewport ${armed ? 'armed' : ''} mode-${toolMode}`} ref={viewportRef}>
      {!minimalUi && <div className="zoom-controls frame" role="group" aria-label="Zoom del mapa"><button onClick={() => changeZoom(-0.1)} disabled={zoom <= 0.6}>−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => changeZoom(0.1)} disabled={zoom >= 1.6}>+</button></div>}
      <div className="world-stage" style={{ width: island.cols * TILE * zoom, height: island.rows * TILE * zoom }}>
      <div className="world" style={{ width: island.cols * TILE, height: island.rows * TILE, transform: `scale(${zoom})` }} onPointerMove={onGridPointerMove}>
        <TerrainLayer tiles={terrainTiles} cols={island.cols} rows={island.rows} tileSize={TILE} />
        {island.tiles.filter((tile) => tile.gridIndex !== null).map((tile) => {
          const index = tile.gridIndex as number
          return (
            <Cell
              key={index}
              game={game}
              tile={game.tiles[index]}
              index={index}
              x={tile.x}
              y={tile.y}
              armed={armed}
              toolMode={toolMode}
              selectedKind={selectedKind}
              inspected={inspectedIndex === index}
              onPointerDown={onCellPointerDown}
              onClick={onCellClick}
            />
          )
        })}
      </div>
      </div>
    </div>
  )
}
