import { describe, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { ENVIRONMENTS, PALETTE, type PaletteKey } from '../ui/pixel/sprites'
import { SPRITES as OLD } from './old-sprites'
import { outlined, shade } from './forge'
import { ART } from './towers'

// ─────────────────────────────────────────────────────────────────────────────
/** Comprobacion: ningun sprite debe quedarse sin contorno contra un borde. */
const DUMP = (() => {
  const solid = (ch: string) => ch !== '.' && ch !== 'K'
  return Object.entries(ART).map(([name, raw]) => {
    const rows = shade(outlined(raw))
    const bad: string[] = []
    if ([...rows[0]].some(solid)) bad.push('arriba')
    if ([...rows[31]].some(solid)) bad.push('abajo')
    if (rows.some((r) => solid(r[0]))) bad.push('izquierda')
    if (rows.some((r) => solid(r[31]))) bad.push('derecha')
    return `${name.padEnd(12)} ${bad.length ? 'SIN CONTORNO: ' + bad.join(', ') : 'ok'}`
  }).join('\n')
})()

const CLASSES = new Map<string, string>()
const SYMBOLS: string[] = []

/** Cada sprite se define una vez como <symbol> y se usa en los dos tamanos. */
const define = (id: string, rows: string[]) => {
  const env = ENVIRONMENTS.terrestrial
  const colorOf = (ch: string) => ch in env.terrain ? env.terrain[ch] : PALETTE[(env.recolor[ch] ?? ch) as PaletteKey]
  const rects: string[] = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      if (ch === '.') { x++; continue }
      let w = 1
      while (x + w < row.length && row[x + w] === ch) w++
      const color = colorOf(ch)
      let cls = CLASSES.get(color)
      if (!cls) { cls = `k${CLASSES.size}`; CLASSES.set(color, cls) }
      rects.push(`<rect x="${x}" y="${y}" width="${w}" class="${cls}"/>`)
      x += w
    }
  })
  SYMBOLS.push(`<symbol id="${id}" viewBox="0 0 ${rows[0].length} ${rows.length}">${rects.join('')}</symbol>`)
}

const px = (id: string, size: number) =>
  `<svg viewBox="0 0 32 32" width="${size}" height="${size}" shape-rendering="crispEdges"><use href="#${id}"/></svg>`

describe('arte a 32x32', () => {
  it('genera la grilla de redibujados', () => {
    const names = Object.keys(ART)
    const ALL: Record<string, string[]> = ART
    const cards = names.map((name, i) => {
      // Contorno primero y sombra despues: la sombra mira los cantos que dan
      // al vacio o al contorno.
      const rows = shade(outlined(ALL[name]))
      if (rows.length !== 32 || rows.some((r) => r.length !== 32)) throw new Error(`${name}: rejilla mal formada`)
      define(`o-${name}`, OLD[name] ?? OLD[name.split('-')[0]])
      define(`n-${name}`, rows)
      return `<div class="set">
        <h3><b>${i + 1}</b> ${name}</h3>
        <div class="pair">
          <figure>${px(`o-${name}`, 104)}<figcaption>hoy</figcaption></figure>
          <figure class="pick">${px(`n-${name}`, 104)}<figcaption>nueva</figcaption></figure>
        </div>
        <div class="pair real">
          <figure>${px(`o-${name}`, 48)}<figcaption>real</figcaption></figure>
          <figure class="pick">${px(`n-${name}`, 48)}<figcaption>real</figcaption></figure>
        </div>
      </div>`
    }).join('')

    writeFileSync('docs/edges.txt', DUMP)
    writeFileSync('docs/mockup-arte.html', `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Torres 32×32</title><style>
:root{color-scheme:dark}
body{margin:0;padding:22px;background:#0d1117;color:#e9eef5;font:15px/1.5 ui-sans-serif,system-ui,sans-serif}
h1{font-size:23px;margin:0 0 6px}
p{color:#8b98a8;font-size:13.5px;margin:0 0 18px;max-width:76ch}
h3{margin:0 0 9px;font-size:12px;color:#8b98a8;font-weight:500}
h3 b{color:#ffd53d;font-size:13px;margin-right:4px}
.grid{display:flex;flex-wrap:wrap;gap:12px}
.set{background:#151c26;border:1px solid #243041;border-radius:12px;padding:12px}
.pair{display:flex;gap:8px;align-items:flex-end}
.pair.real{margin-top:10px;padding-top:10px;border-top:1px solid #243041}
figure{margin:0;text-align:center;background:#5fc531;border-radius:7px;padding:4px}
figure.pick{outline:2px solid #ffd53d}
figcaption{margin-top:3px;color:#0d1117;font-size:9px;font-weight:700}
svg{display:block}
rect{height:1px}
${[...CLASSES].map(([color, cls]) => `.${cls}{fill:${color}}`).join('')}
</style></head><body>
<h1>Torres y decoraciones a 32×32</h1>
<p>Izquierda la de hoy, derecha la redibujada. Abajo, las dos al tamaño real en el mapa. Dime por número qué cambiar de cada una.</p>
<svg width="0" height="0" style="position:absolute">${SYMBOLS.join('')}</svg>
<div class="grid">${cards}</div>
</body></html>`)
  })
})
