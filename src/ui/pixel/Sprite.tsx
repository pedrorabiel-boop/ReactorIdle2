import { memo, useEffect, useMemo, useRef } from 'react'
import { fbm, type Coast } from '../coast'
import { ALL_PROPS } from './props'
import type { PlacedProp } from '../scenery'
import { ENVIRONMENTS, envCssVars, PALETTE, rowsToRects, SPRITES, spriteBox, terrainRows, toDataUri, type Band, type PaletteKey, type CoastStyle, type Environment, type EnvironmentKey, type Neighbors, type TerrainKind } from './sprites'

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
  /** Si viene, el terreno se dibuja con costa organica en vez de autotilearse. */
  coast?: Coast
  coastStyle?: CoastStyle
  /** Hace falta para resolver colores: dentro de una imagen no hay variables CSS. */
  env?: Environment
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
 * Terreno de costa organica.
 *
 * Clasifica cada pixel del mapa contra las distancias de la costa y lo saca
 * como un <path> por color, con las tiradas de cada fila. Un <rect> por tirada
 * costaria cuatro veces mas nodos, y aqui no hay casillas que deduplicar:
 * ninguna orilla se repite.
 *
 * Los colores siguen siendo las ocho ranuras de siempre, asi que el cambio de
 * ambiente se mantiene por variables CSS: 3 es el filo, 7 su resplandor sobre
 * el agua, 8 el halo, 1/2/6 el suelo y 4/5 el agua.
 */
const propCache = new Map<string, string>()

/** Define un prop una vez, con un <path> por color igual que el terreno. */
function propSymbol(name: string): string {
  const cached = propCache.get(name)
  if (cached) return cached
  const prop = ALL_PROPS[name]
  const byColor = new Map<string, string[]>()
  prop.rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      if (ch === '.') { x++; continue }
      let len = 1
      while (x + len < row.length && row[x + len] === ch) len++
      const key = `var(--pp-${ch})`
      if (!byColor.has(key)) byColor.set(key, [])
      byColor.get(key)!.push(`M${x} ${y}h${len}v1h-${len}z`)
      x += len
    }
  })
  const markup = `<symbol id="${SYMBOL_PREFIX}prop-${name}" viewBox="0 0 ${prop.rows[0].length} ${prop.rows.length}">`
    + [...byColor].map(([fill, d]) => `<path fill="${fill}" d="${d.join('')}"/>`).join('') + '</symbol>'
  propCache.set(name, markup)
  return markup
}

const organicCache = new Map<Coast, Map<CoastStyle, string>>()

/**
 * Terreno de costa organica.
 *
 * Clasifica cada pixel del mapa contra la distancia al limite entre tierra y
 * agua y lo saca como un <path> por color, con las tiradas de cada fila. Un
 * <rect> por tirada costaria cuatro veces mas nodos, y aqui no hay casillas que
 * deduplicar: ninguna orilla se repite.
 *
 * Las franjas vienen del ambiente, no cableadas: el pantano quiere un filo de
 * tres pixeles y la isla tropical una playa ancha con espuma y bajo.
 */
function organicTerrain(coast: Coast, style: CoastStyle, colorOf: (slot: string) => string): string {
  const byStyle = organicCache.get(coast) ?? new Map<CoastStyle, string>()
  const cached = byStyle.get(style)
  if (cached) return cached

  const { w, h, land, toEdge, toGrid } = coast
  const slots = [...new Set([
    ...style.land.map((b) => b.slot), ...style.water.map((b) => b.slot),
    style.ground.light, style.ground.dark, style.outside, '1', '4', ...(style.open ? [style.open.slot] : []),
  ])]
  const index = new Map(slots.map((slot, i) => [slot, i]))
  const pick = new Uint8Array(w * h)
  const bandOf = (bands: Band[], d: number) => bands.find((b) => d < b.until)?.slot

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const d = toEdge[i]
      let slot: string
      if (land[i]) {
        // Dentro de la grilla siempre es suelo, pase lo que pase con las
        // franjas: asi el suelo del interior significa exactamente "aqui se
        // puede construir", y lo que crecio fuera se ve distinto.
        //
        // El limite se denta dos pixeles para que no sea una escalera de
        // angulos rectos al lado de una costa organica. A esa escala la casilla
        // sigue siendo inconfundiblemente de un lado o del otro.
        const inside = toGrid[i] === 0 || (toGrid[i] < 2.5 && fbm(x * 2, y * 2, 9, 31) > toGrid[i] / 2.5)
        if (inside) {
          const n = fbm(x, y, style.ground.scale, 5)
          const edge = style.ground.spread
          slot = n > 0.5 + edge ? style.ground.light : n < 0.5 - edge ? style.ground.dark : '1'
        } else slot = bandOf(style.land, d) ?? style.outside
      } else {
        slot = bandOf(style.water, d)
          ?? (style.open && fbm(x * style.open.stretch, y * 2.1, 22, 9) > style.open.amount ? style.open.slot : '4')
      }
      pick[i] = index.get(slot)!
    }
  }

  // Tiradas fusionadas tambien en vertical. Emitiendo un rectangulo por fila,
  // un area lisa de agua se convertia en cientos de tiras de un pixel: miles de
  // subtrazados que el navegador tiene que rasterizar cada vez que rehace una
  // baldosa al desplazar el mapa, y por eso el terreno tardaba en reaparecer.
  interface Span { x: number; len: number; k: number; top: number }
  const runs: string[][] = slots.map(() => [])
  const close = (s: Span, bottom: number) =>
    runs[s.k].push(`M${s.x} ${s.top}h${s.len}v${bottom - s.top}h-${s.len}z`)

  let open: Span[] = []
  for (let y = 0; y < h; y++) {
    const row: Span[] = []
    let x = 0
    while (x < w) {
      const k = pick[y * w + x]
      let len = 1
      while (x + len < w && pick[y * w + x + len] === k) len++
      row.push({ x, len, k, top: y })
      x += len
    }
    const next: Span[] = []
    let i = 0
    for (const cur of row) {
      while (i < open.length && open[i].x < cur.x) close(open[i++], y)
      if (i < open.length && open[i].x === cur.x) {
        if (open[i].len === cur.len && open[i].k === cur.k) next.push(open[i++])
        else { close(open[i++], y); next.push(cur) }
      } else next.push(cur)
    }
    while (i < open.length) close(open[i++], y)
    open = next
  }
  for (const s of open) close(s, h)

  const path = (k: number) => runs[k].length ? `<path fill="${colorOf(slots[k])}" d="${runs[k].join('')}"/>` : ''
  // El destello del mar lleva su atenuado horneado: dentro de una imagen la
  // regla CSS que lo atenuaba no llega.
  const soft = style.open && style.open.dim < 1 ? index.get(style.open.slot) : undefined
  const markup = slots.map((_, k) => k === soft ? '' : path(k)).join('')
    + (soft !== undefined && runs[soft].length ? `<g opacity="${style.open!.dim}">${path(soft)}</g>` : '')

  byStyle.set(style, markup)
  organicCache.set(coast, byStyle)
  return markup
}

/**
 * Todo el terreno en un unico nodo.
 *
 * Con costa organica sale a un <canvas>, no a un SVG. El dibujo es estatico y
 * tiene casi diez mil subtrazados; dejandolo como SVG dentro de una capa
 * escalada, el navegador lo rerasteriza cada vez que rehace una baldosa al
 * desplazar el mapa, y el terreno tardaba en reaparecer al volver a una zona
 * que habia salido de pantalla. Un bitmap se compone y ya.
 *
 * Eso obliga a resolver los colores aqui: dentro de una imagen las variables
 * CSS del ambiente no existen.
 */
export const TerrainLayer = memo(function TerrainLayer({ tiles, cols, rows, tileSize, coast, coastStyle, env }: TerrainLayerProps) {
  const unit = terrainUnit()
  const width = cols * unit, height = rows * unit

  const organic = useMemo(() => {
    if (!coast || !coastStyle || !env) return null
    const colorOf = (slot: string) => slot in env.terrain ? env.terrain[slot] : PALETTE[(env.recolor[slot] ?? slot) as PaletteKey]
    return organicTerrain(coast, coastStyle, colorOf)
  }, [coast, coastStyle, env])

  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const target = canvas.current
    if (!target || !organic) return
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${organic}</svg>`
    const image = new Image()
    let vivo = true
    image.onload = () => {
      if (!vivo) return
      const ctx = target.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(image, 0, 0)
    }
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    return () => { vivo = false }
  }, [organic, width, height])

  const tiled = useMemo(() => {
    if (organic) return null
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
  }, [tiles, organic, unit])

  if (organic) {
    return (
      <canvas
        className="sprite terrain-layer"
        ref={canvas}
        width={width}
        height={height}
        style={{ width: cols * tileSize, height: rows * tileSize, imageRendering: 'pixelated' }}
        aria-hidden="true"
      />
    )
  }
  return (
    <svg
      className="sprite terrain-layer"
      viewBox={`0 0 ${width} ${height}`}
      width={cols * tileSize}
      height={rows * tileSize}
      shapeRendering="crispEdges"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: tiled ?? '' }}
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

interface SceneryLayerProps {
  scenery: PlacedProp[]
  tileSize: number
  /** Indices de los props que deben atenuarse ahora mismo. */
  faded: ReadonlySet<number>
}

/**
 * Los props de escenario, cada uno en su propio elemento posicionado.
 *
 * No van dentro del SVG del terreno porque entonces quedarian todos por debajo
 * de todas las torres, y la profundidad no funciona asi: un manglar tapa a la
 * torre que tiene detras y queda tapado por la que tiene delante. El `z-index`
 * sale de la fila donde se apoya cada cosa -lo que esta mas abajo en pantalla
 * esta mas cerca de la camara- y el navegador hace el orden de pintor solo.
 *
 * Las casillas usan `fila * 2 + 1` y los props `fila * 2`, asi que en un empate
 * la torre de esa misma fila queda delante del prop anclado ahi.
 */
export const SceneryLayer = memo(function SceneryLayer({ scenery, tileSize, faded }: SceneryLayerProps) {
  const unit = terrainUnit()
  const defs = useMemo(
    () => [...new Set(scenery.map((prop) => prop.name))].map(propSymbol).join(''),
    [scenery],
  )
  const scale = tileSize / unit
  return <>
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: defs }} />
    {scenery.map((prop, i) => (
      <svg
        key={`${prop.name}-${prop.x}-${prop.y}`}
        className={faded.has(i) ? 'prop faded' : 'prop'}
        viewBox={`0 0 ${prop.tiles * unit} ${prop.tiles * unit}`}
        shapeRendering="crispEdges"
        aria-hidden="true"
        style={{
          left: prop.x * scale,
          top: prop.y * scale,
          width: prop.tiles * tileSize,
          height: prop.tiles * tileSize,
          zIndex: prop.anchor * 2,
        }}
      >
        <use href={`#${SYMBOL_PREFIX}prop-${prop.name}`} />
      </svg>
    ))}
  </>
})
