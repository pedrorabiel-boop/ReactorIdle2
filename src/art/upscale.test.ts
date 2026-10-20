import { describe, it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { SPRITES } from '../ui/pixel/sprites'

/**
 * Sube a 32x32 los sprites que todavia estan a 16x16, con Scale2x (EPX).
 *
 * Scale2x no inventa detalle, pero conserva la silueta exacta y redondea las
 * diagonales, que es justo lo que hace falta como base: deja cada torre
 * reconocible y con el mismo tamano de pixel que el terreno, y sobre eso se
 * puede dibujar a mano. Un escalado a lo bruto habria dejado los pixeles del
 * doble de grandes que el suelo.
 */
function scale2x(rows: string[]): string[] {
  const h = rows.length, w = rows[0].length
  const at = (x: number, y: number) => rows[Math.min(h - 1, Math.max(0, y))][Math.min(w - 1, Math.max(0, x))]
  const out: string[] = []
  for (let y = 0; y < h; y++) {
    let top = '', bottom = ''
    for (let x = 0; x < w; x++) {
      const p = at(x, y), a = at(x, y - 1), b = at(x + 1, y), c = at(x - 1, y), d = at(x, y + 1)
      top += (c === a && c !== d && a !== b ? a : p) + (a === b && a !== c && b !== d ? b : p)
      bottom += (d === c && d !== b && c !== a ? c : p) + (b === d && b !== a && d !== c ? d : p)
    }
    out.push(top, bottom)
  }
  return out
}

describe('subir el arte a 32x32', () => {
  it('reescribe los sprites de 16 que quedan', () => {
    const path = 'src/ui/pixel/sprites.ts'
    let source = readFileSync(path, 'utf8')
    const done: string[] = []

    for (const [name, rows] of Object.entries(SPRITES)) {
      if (rows.length !== 16) continue
      const scaled = scale2x(rows)
      if (scaled.length !== 32 || scaled.some((r) => r.length !== 32)) throw new Error(`${name}: salida mal formada`)
      const key = /^[a-z0-9]+$/i.test(name) ? name : `'${name}'`
      const pattern = new RegExp(`(  ${key}: S\\(\\[\\n)(?:    '[^']*',\\n)+(  \\]\\),)`)
      if (!pattern.test(source)) throw new Error(`${name}: no se encontro en el archivo`)
      source = source.replace(pattern, (_m, head: string, tail: string) =>
        head + scaled.map((r) => `    '${r}',`).join('\n') + '\n' + tail)
      done.push(name)
    }

    writeFileSync(path, source)
    writeFileSync('docs/upscale-report.txt', `${done.length} sprites subidos a 32x32:\n${done.join('\n')}\n`)
  })
})
