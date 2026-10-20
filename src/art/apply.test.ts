import { describe, it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { ART } from './towers'
import { outlined, shade } from './forge'

/** Escribe las 20 torres redibujadas dentro de sprites.ts, en su sitio. */
describe('aplicar el arte', () => {
  it('reemplaza las torres en sprites.ts', () => {
    const path = 'src/ui/pixel/sprites.ts'
    let source = readFileSync(path, 'utf8')
    const done: string[] = []

    for (const [name, raw] of Object.entries(ART)) {
      const rows = shade(outlined(raw))
      if (rows.length !== 32 || rows.some((r) => r.length !== 32)) throw new Error(`${name}: rejilla mal formada`)
      const pattern = new RegExp(`(  ${name}: S\\(\\[\\n)(?:    '[^']*',\\n)+(  \\]\\),)`)
      if (!pattern.test(source)) throw new Error(`${name}: no se encontro en sprites.ts`)
      source = source.replace(pattern, (_m, head: string, tail: string) =>
        head + rows.map((r) => `    '${r}',`).join('\n') + '\n' + tail)
      done.push(name)
    }

    writeFileSync(path, source)
    writeFileSync('docs/applied.txt', `${done.length} torres aplicadas:\n${done.join('\n')}\n`)
  })
})
