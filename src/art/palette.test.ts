import { describe, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { PALETTE, SPRITES, type PaletteKey } from '../ui/pixel/sprites'
import { CYBERPUNK_ENVIRONMENT } from '../ui/pixel/cyberpunk'

// ─────────────────────────────────────────────────────────────────────────────
// Tres repaletas de las torres para el pantano.
//
// La actual manda azul claro, verde y amarillo a la MISMA ranura de cian, y el
// naranja al rojo. Asi que ademas de dar un conjunto frio y chillon, tres
// colores que distinguian funciones distintas se funden en uno: una turbina
// generadora y un centro de investigacion acaban del mismo color.
//
// Las tres propuestas parten de esa base: ninguna colapsa dos funciones en un
// mismo tono, y ninguna usa cian ni rojo saturado.
// ─────────────────────────────────────────────────────────────────────────────

interface Propuesta { nombre: string; idea: string; recolor: Record<string, string> }

const PROPUESTAS: Propuesta[] = [
  {
    nombre: 'Musgo y oro',
    idea: 'La propuesta tal como la viste: cuerpos en verde musgo y acentos en oro.',
    recolor: { B: 'n', b: 'v', E: 'v', e: 'e', O: 'Y', Y: 'Y', R: 'O', r: 'Y', C: 'e', P: 'n', p: 'v', T: 'n', t: 'v' },
  },
  {
    nombre: 'Afinada · panel subido',
    idea: 'Igual que la siguiente, pero con los azules un tono más arriba para que el panel '
      + 'solar no se funda con el suelo.',
    recolor: { B: 'v', b: 'e', E: 'E', e: 'e', O: 'O', Y: 'Y', R: 'O', r: 'Y', C: 'c', P: 'P', p: 'p', T: 'n', t: 'v' },
  },
  {
    nombre: 'Afinada · centro ámbar',
    idea: 'Igual, pero el rojo va a ámbar encendido: el núcleo vuelve a leerse caliente, '
      + 'y el tejado de la casita y el acumulador no se apagan.',
    recolor: { B: 'n', b: 'v', E: 'E', e: 'e', O: 'O', Y: 'Y', R: 'O', r: 'Y', C: 'c', P: 'P', p: 'p', T: 'n', t: 'v' },
  },
]

const TORRES = [
  'wind', 'solar', 'battery', 'controller', 'core', 'thorium', 'fusion', 'planck',
  'generator', 'generator2', 'cooler', 'exchanger', 'pipe', 'pipe2', 'accumulator',
  'sales', 'sales2', 'research', 'research2', 'insulator',
]

const dibujar = (rows: string[], recolor: Record<string, string>, size: number) => {
  const color = (ch: string) => PALETTE[(recolor[ch] ?? ch) as PaletteKey] ?? '#f0f'
  const porColor = new Map<string, string[]>()
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      if (ch === '.') { x++; continue }
      let len = 1
      while (x + len < row.length && row[x + len] === ch) len++
      const fill = color(ch)
      if (!porColor.has(fill)) porColor.set(fill, [])
      porColor.get(fill)!.push(`M${x} ${y}h${len}v1h-${len}z`)
      x += len
    }
  })
  const u = rows[0].length
  return `<svg viewBox="0 0 ${u} ${u}" width="${size}" height="${size}" shape-rendering="crispEdges">`
    + [...porColor].map(([fill, d]) => `<path fill="${fill}" d="${d.join('')}"/>`).join('') + '</svg>'
}

describe('repaleta del pantano', () => {
  it('genera la hoja de propuestas', () => {
    const suelo = CYBERPUNK_ENVIRONMENT.terrain['1']
    const actual = CYBERPUNK_ENVIRONMENT.recolor
    const columnas = [{ nombre: 'Actual', idea: '', recolor: actual }, ...PROPUESTAS]

    const filas = TORRES.map((name) => {
      const celdas = columnas.map((c) => `<td><div class="t">${dibujar(SPRITES[name], c.recolor, 76)}</div></td>`).join('')
      return `<tr><th>${name}</th>${celdas}</tr>`
    }).join('')

    const cabecera = columnas.map((c) => `<th>${c.nombre}</th>`).join('')
    const fichas = PROPUESTAS.map((p, i) => `<div class="card"><h3>${i + 1} · ${p.nombre}</h3><p>${p.idea}</p></div>`).join('')

    writeFileSync('docs/mockup-paleta.html', `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Repaleta · pantano</title><style>
:root{color-scheme:dark}
body{margin:0;padding:24px;background:#0a1016;color:#e6f5f0;font:15px/1.55 ui-sans-serif,system-ui,sans-serif}
h1{font-size:24px;margin:0 0 6px}
h3{margin:0 0 6px;font-size:14px;color:#ff5fc8}
p{color:#8fb3ad;font-size:13px;margin:0 0 14px;max-width:74ch}
.cards{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:24px}
.card{background:#0e1b22;border:1px solid #1d3540;border-radius:12px;padding:14px;max-width:270px}
.card p{margin:0}
table{border-collapse:collapse}
th{font:12px ui-sans-serif;color:#8fb3ad;font-weight:500;padding:6px 10px;text-align:center}
tbody th{text-align:right;color:#6f9089}
td{padding:4px}
.t{background:${suelo};border-radius:8px;padding:5px;line-height:0}
thead th:nth-child(2){color:#6f9089}
svg{display:block}
</style></head><body>
<h1>Repaleta de las torres · pantano</h1>
<p>Sobre el suelo real del bioma. La columna <b>Actual</b> manda azul claro, verde y amarillo al mismo cian, así que tres funciones distintas acaban del mismo color; las tres propuestas no colapsan ningún par y no usan cian ni rojo saturado.</p>
<div class="cards">${fichas}</div>
<table><thead><tr><th></th>${cabecera}</tr></thead><tbody>${filas}</tbody></table>
</body></html>`)
  })
})
