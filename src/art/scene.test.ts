import { describe, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { buildIsland } from '../ui/island'
import { PALETTE, SPRITES, type PaletteKey } from '../ui/pixel/sprites'
import { SWAMP_COLORS, SWAMP_PROPS } from './swampprops'
import { buildCoast, fbm } from './shore'

// ─────────────────────────────────────────────────────────────────────────────
// Escena del pantano neon manglar.
//
// El terreno ya no se arma casilla por casilla: se calcula una mascara de
// tierra para todo el mapa a nivel de pixel y se dibuja de una pieza. Esa es la
// unica forma de que el contorno quede enmaranado en vez de escalonado.
//
// Las casillas construibles siguen siendo tierra entera, asi que el motor ve
// exactamente el mismo mapa; lo organico pasa en las casillas inutiles.
// ─────────────────────────────────────────────────────────────────────────────

const UNIT = 32

const COLORS: Record<string, string> = {
  '1': '#2c4733', // suelo
  '2': '#35563c', // suelo iluminado
  a: '#21372a', // suelo en sombra
  N: '#ff5fc8', // filo neon
  m: '#a3387a', // resplandor del filo sobre el agua
  '8': '#15303a', // halo del agua junto a la orilla
  '4': '#0c1b24', // agua profunda
  '5': '#16323c', // veta del agua
  ...SWAMP_COLORS,
}

// Caracteres del monticulo: la huella del suelo de un prop se deduce del propio
// dibujo, no de un numero a ojo. Si manana el monticulo crece, la regla sigue
// valiendo sin tocar nada.
const SOIL_CHARS = new Set(['G', 'g', 'D', 'N'])

/** Casillas que el dibujo de un prop pinta, filtrando por un juego de colores. */
function tilesOf(rows: string[], ox: number, oy: number, only?: Set<string>): Set<string> {
  const out = new Set<string>()
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '.' || (only && !only.has(ch))) continue
      out.add(`${Math.floor((ox + x) / UNIT)},${Math.floor((oy + y) / UNIT)}`)
    }
  })
  return out
}

const hash = (x: number, y: number) => {
  let h = (x * 73856093) ^ (y * 19349663)
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995)
  return (Math.abs(h ^ (h >>> 15)) % 10000) / 10000
}

describe('escena del pantano', () => {
  it('genera la pagina', () => {
    const island = buildIsland(10, 8, 'desert')
    const w = island.cols * UNIT, h = island.rows * UNIT
    const cells = island.tiles.filter((t) => t.gridIndex !== null).map((t) => [t.x, t.y] as [number, number])
    const coast = buildCoast(cells, UNIT, w, h)

    // Clasificar cada pixel del mapa.
    const KEYS = ['4', '5', '8', 'm', 'N', '1', '2', 'a']
    const chars = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x
      let ch: string
      if (coast.land[i]) {
        if (coast.toWater[i] < 3.5) ch = 'N'
        else {
          const n = fbm(x, y, 26, 5)
          ch = n > 0.63 ? '2' : n < 0.37 ? 'a' : '1'
        }
      } else {
        const edge = coast.toLand[i]
        if (edge < 2.2) ch = 'm'
        else if (edge < 5.5) ch = '8'
        // Vetas horizontales: el ruido se estira en x y se comprime en y.
        else ch = fbm(x * 0.28, y * 2.1, 22, 9) > 0.69 ? '5' : '4'
      }
      chars[i] = KEYS.indexOf(ch)
    }

    // Un <path> por color, con las tiradas de cada fila. Frente a un <rect> por
    // tirada ahorra tres cuartas partes del peso del archivo.
    const runs: string[][] = KEYS.map(() => [])
    for (let y = 0; y < h; y++) {
      let x = 0
      while (x < w) {
        const k = chars[y * w + x]
        let len = 1
        while (x + len < w && chars[y * w + x + len] === k) len++
        runs[k].push(`M${x} ${y}h${len}v1h-${len}z`)
        x += len
      }
    }
    const terrain = KEYS.map((key, k) => runs[k].length
      ? `<path fill="${COLORS[key]}" d="${runs[k].join('')}"/>` : '').join('')

    // Igual que el terreno: un <path> por color en vez de un <rect> por tirada.
    const symbols = Object.entries(SWAMP_PROPS).map(([name, prop]) => {
      const byColor = new Map<string, string[]>()
      prop.rows.forEach((row, y) => {
        let x = 0
        while (x < row.length) {
          const ch = row[x]
          if (ch === '.') { x++; continue }
          let len = 1
          while (x + len < row.length && row[x + len] === ch) len++
          const color = COLORS[ch] ?? '#f0f'
          if (!byColor.has(color)) byColor.set(color, [])
          byColor.get(color)!.push(`M${x} ${y}h${len}v1h-${len}z`)
          x += len
        }
      })
      return `<symbol id="p-${name}" viewBox="0 0 ${prop.rows[0].length} ${prop.rows.length}">`
        + [...byColor].map(([color, d]) => `<path fill="${color}" d="${d.join('')}"/>`).join('')
        + '</symbol>'
    }).join('')

    // ─ Colocacion de props.
    //
    // Dos reglas, no una. La huella del SUELO de un prop (el monticulo) no
    // puede tocar ninguna casilla construible: si la tapa, el jugador no puede
    // ver ni pulsar el terreno. La huella de la COPA si puede solaparse, porque
    // se resuelve por profundidad y transparencia, no moviendo el arbol.
    const buildable = new Set(island.tiles.filter((t) => t.gridIndex !== null).map((t) => `${t.x},${t.y}`))
    const isLandTile = (tx: number, ty: number) => {
      const px = tx * UNIT + 16, py = ty * UNIT + 16
      if (px < 0 || px >= w || py < 0 || py >= h) return false
      return coast.land[py * w + px] === 1
    }

    interface Placed { name: string; x: number; y: number; size: number; anchor: number; covers: Set<string> }
    const placed: Placed[] = []
    const takenSoil = new Set<string>()

    const tryPlace = (name: string, tx: number, ty: number): boolean => {
      const prop = SWAMP_PROPS[name]
      const px = (tx + 0.5) * UNIT - (prop.tiles * UNIT) / 2
      const py = (ty + 1) * UNIT - prop.tiles * UNIT + 12
      const soil = tilesOf(prop.rows, px, py, SOIL_CHARS)
      for (const key of soil) {
        if (buildable.has(key) || takenSoil.has(key)) return false
        const [sx, sy] = key.split(',').map(Number)
        // El monticulo tampoco se mete en la isla: es suelo propio sobre agua.
        if (isLandTile(sx, sy)) return false
      }
      for (const key of soil) takenSoil.add(key)
      placed.push({ name, x: px, y: py, size: prop.tiles, anchor: ty, covers: tilesOf(prop.rows, px, py) })
      return true
    }

    // Manglares: se reparten por el agua abierta, separados entre si.
    const variants = ['mangrove', 'mangrove-b', 'mangrove-c']
    const anchors: Array<[number, number]> = []
    for (const t of island.tiles) {
      if (isLandTile(t.x, t.y) || t.x < 2 || t.y < 2 || t.x > island.cols - 3) continue
      if (anchors.some(([ax, ay]) => Math.abs(ax - t.x) < 6 && Math.abs(ay - t.y) < 5)) continue
      if (hash(t.x * 31, t.y * 17) > 0.5) continue
      if (tryPlace(variants[anchors.length % 3], t.x, t.y)) anchors.push([t.x, t.y])
    }

    // Props chicos sobre la orilla y el agua abierta.
    for (const t of island.tiles) {
      const key = `${t.x},${t.y}`
      if (takenSoil.has(key) || buildable.has(key)) continue
      const land = isLandTile(t.x, t.y)
      const r = hash(t.x * 7 + 3, t.y * 11 + 5)
      const nearShore = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => isLandTile(t.x + dx, t.y + dy) !== land)
      let pick: string | null = null
      if (land) pick = r < 0.3 ? (r < 0.15 ? 'fern' : 'fern-b') : r < 0.5 ? (r < 0.4 ? 'glowshroom' : 'glowshroom-b') : null
      else if (nearShore) pick = r < 0.26 ? (r < 0.13 ? 'reeds' : 'reeds-b') : null
      else pick = r < 0.06 ? 'lilypad' : r < 0.09 ? 'lilypad-b' : r < 0.12 ? 'crystal' : r < 0.14 ? 'crystal-b' : null
      if (pick) tryPlace(pick, t.x, t.y)
    }

    // ─ Torres de muestra, para ver la profundidad.
    const grid = island.tiles.filter((t) => t.gridIndex !== null)
    const TOWERS = ['core', 'generator', 'pipe', 'thorium', 'pipe2', 'cooler', 'battery', 'sales', 'wind', 'research2']
    const towers = grid.filter((t) => hash(t.x * 13 + 1, t.y * 7 + 2) < 0.3)
      .map((t, i) => ({ name: TOWERS[i % TOWERS.length], tx: t.x, ty: t.y }))

    // ─ Orden de pintado: todo se ordena por la fila donde se apoya. Lo que esta
    // mas abajo en pantalla esta mas cerca de la camara y se pinta encima, asi
    // que una torre por delante del manglar lo tapa y una por detras queda
    // tapada por la copa. Es el criterio que decide quien va delante de quien.
    type Draw = { anchor: number; order: number; svg: string }
    const draws: Draw[] = []
    placed.forEach((p, i) => {
      const overhangs = [...p.covers].some((key) => buildable.has(key))
      draws.push({
        anchor: p.anchor,
        order: i,
        svg: `<use class="prop${overhangs ? ' overhang' : ''}" href="#p-${p.name}" x="${p.x}" y="${p.y}" width="${p.size * UNIT}" height="${p.size * UNIT}"/>`,
      })
    })
    towers.forEach((t, i) => draws.push({
      anchor: t.ty,
      order: 1000 + i,
      svg: `<use href="#t-${t.name}" x="${t.tx * UNIT}" y="${t.ty * UNIT}" width="${UNIT}" height="${UNIT}"/>`,
    }))
    draws.sort((a, b) => a.anchor - b.anchor || a.order - b.order)
    const body = draws.map((d) => d.svg)

    // El terreno se define una vez como <symbol> y las tres vistas lo
    // referencian: dibujarlo tres veces habria triplicado el peso.
    const terrainSymbol = `<symbol id="scene-terrain" viewBox="0 0 ${w} ${h}">${terrain}</symbol>`

    // Torres de muestra, con la paleta del juego.
    const towerSymbols = [...new Set(towers.map((t) => t.name))].map((name) => {
      const rows = SPRITES[name]
      const byColor = new Map<string, string[]>()
      rows.forEach((row, y) => {
        let x = 0
        while (x < row.length) {
          const ch = row[x]
          if (ch === '.') { x++; continue }
          let len = 1
          while (x + len < row.length && row[x + len] === ch) len++
          const color = PALETTE[ch as PaletteKey] ?? '#f0f'
          if (!byColor.has(color)) byColor.set(color, [])
          byColor.get(color)!.push(`M${x} ${y}h${len}v1h-${len}z`)
          x += len
        }
      })
      return `<symbol id="t-${name}" viewBox="0 0 ${rows[0].length} ${rows.length}">`
        + [...byColor].map(([color, d]) => `<path fill="${color}" d="${d.join('')}"/>`).join('') + '</symbol>'
    }).join('')

    const view = (vx: number, vy: number, vw: number, vh: number, zoom: number, armed = false) =>
      `<svg class="${armed ? 'armed' : ''}" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw * zoom}" height="${vh * zoom}" shape-rendering="crispEdges">`
      + `<use href="#scene-terrain" x="0" y="0" width="${w}" height="${h}"/>${body.join('')}</svg>`

    // Recorte sobre la isla de la derecha, que es donde se ve el solape.
    const rightCells = island.tiles.filter((t) => t.gridIndex !== null && t.x > island.cols / 2)
    const cx0 = Math.min(...rightCells.map((t) => t.x)) - 3, cy0 = Math.min(...rightCells.map((t) => t.y)) - 4
    const cx1 = Math.max(...rightCells.map((t) => t.x)) + 4, cy1 = Math.max(...rightCells.map((t) => t.y)) + 3
    const crop: [number, number, number, number] = [cx0 * UNIT, cy0 * UNIT, (cx1 - cx0) * UNIT, (cy1 - cy0) * UNIT]

    const scene = view(0, 0, w, h, 1)
    const cropPlain = view(...crop, 1.5)
    const cropArmed = view(...crop, 1.5, true)

    const sheet = Object.entries(SWAMP_PROPS).map(([name, prop]) => {
      const size = prop.tiles * 48
      return `<figure><div class="tile"><svg viewBox="0 0 ${prop.rows[0].length} ${prop.rows.length}" width="${size}" height="${size}" shape-rendering="crispEdges"><use href="#p-${name}"/></svg></div><figcaption>${name} · ${prop.tiles}×${prop.tiles}</figcaption></figure>`
    }).join('')

    writeFileSync('docs/mockup-pantano.html', `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Pantano neón</title><style>
:root{color-scheme:dark}
body{margin:0;padding:22px;background:#0a1016;color:#e6f5f0;font:15px/1.5 ui-sans-serif,system-ui,sans-serif}
h1{font-size:24px;margin:0 0 6px}
h2{font-size:16px;margin:28px 0 10px;color:#ff5fc8;border-bottom:1px solid #1d3540;padding-bottom:6px}
p{color:#8fb3ad;font-size:13.5px;margin:0 0 16px;max-width:76ch}
.card{background:#0e1b22;border:1px solid #1d3540;border-radius:12px;padding:12px;display:inline-block;vertical-align:top}
.card h3{margin:0 0 8px;font-size:13px;color:#8fb3ad;font-weight:500}
.row{display:flex;gap:14px;flex-wrap:wrap}
/* La copa que vuela sobre casillas construibles se desvanece al interactuar. */
.prop{transition:opacity .18s ease}
.armed .overhang{opacity:.3}
.props{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end}
figure{margin:0;text-align:center}
figcaption{margin-top:6px;color:#8fb3ad;font-size:11px}
.tile{background:#0c1b24;border:1px solid #1d3540;border-radius:8px;padding:6px;line-height:0}
svg{display:block}
rect{height:1px}
</style></head><body>
<h1>B-02 · Pantano neón manglar</h1>
<p>La costa ya no se dibuja casilla por casilla: es una máscara de tierra calculada a nivel de píxel sobre todo el mapa, con el límite movido por ruido. Toda casilla construible sigue siendo tierra entera, así que el motor ve el mismo mapa; lo enmarañado pasa en las casillas inútiles.</p>

<svg width="0" height="0" style="position:absolute">${symbols}${terrainSymbol}${towerSymbols}</svg>

<h2>La escena</h2>
<div class="card">${scene}</div>

<h2>Profundidad y solape</h2>
<p>Dos reglas distintas, porque son dos problemas distintos. El <b>suelo</b> de un manglar nunca puede tapar una casilla construible: la colocación lo rechaza. La <b>copa</b> sí puede volar por encima, y eso se resuelve por orden de pintado y transparencia.</p>
<p>El orden lo decide la fila donde se apoya cada cosa: lo que está más abajo en pantalla está más cerca de la cámara y se pinta encima. Una torre por delante del manglar lo tapa; una por detrás queda bajo la copa.</p>
<div class="row">
  <div class="card"><h3>Normal</h3>${cropPlain}</div>
  <div class="card"><h3>Al interactuar con las casillas tapadas</h3>${cropArmed}</div>
</div>

<h2>Los props</h2>
<p>Los manglares traen su propio montículo de tierra con su filo magenta, así que se plantan directamente sobre el agua oscura y ya no necesitan un islote cuadrado debajo.</p>
<div class="card"><div class="props">${sheet}</div></div>
</body></html>`)
  })
})
