import { describe, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { PALETTE } from '../ui/pixel/sprites'
import { SWAMP_COLORS, SWAMP_PROPS } from './swampprops'

/**
 * Vuelca los props del pantano a un modulo de la app.
 *
 * Los props se dibujan con sus propias letras, y ocho de ellas chocaban con la
 * paleta de las torres: 'W' es blanco para una torre y corteza en sombra para
 * un manglar. Como el color se resuelve por variable CSS a partir de la letra,
 * compartirlas habria teñido de corteza el blanco de todas las torres. Aqui se
 * reasignan a letras libres antes de salir.
 */
const REMAP: Record<string, string> = {
  W: 'u', C: 'i', c: 'j', v: 'q', n: 'z', G: 'd', g: 'x', D: 'y',
}

describe('props del pantano', () => {
  it('los escribe en la app con letras que no chocan', () => {
    const taken = new Set(Object.keys(PALETTE))
    for (const to of Object.values(REMAP)) {
      if (taken.has(to)) throw new Error(`la letra ${to} ya esta en la paleta`)
    }

    const colors: Record<string, string> = {}
    for (const [ch, color] of Object.entries(SWAMP_COLORS)) colors[REMAP[ch] ?? ch] = color

    const used = new Set<string>()
    const entries = Object.entries(SWAMP_PROPS).map(([name, prop]) => {
      const rows = prop.rows.map((row) => [...row].map((ch) => {
        if (ch === '.') return ch
        const out = REMAP[ch] ?? ch
        used.add(out)
        return out
      }).join(''))
      return `  '${name}': { tiles: ${prop.tiles}, rows: [\n${rows.map((r) => `    '${r}',`).join('\n')}\n  ] },`
    })
    for (const ch of used) {
      if (!(ch in colors)) throw new Error(`la letra ${ch} no tiene color`)
      if (taken.has(ch)) throw new Error(`la letra ${ch} choca con la paleta de torres`)
    }

    writeFileSync('src/ui/pixel/props.ts', `// GENERADO por \`npm run art\` desde src/art/swampprops.ts. No editar a mano.
//
// Props de escenario del pantano. A diferencia de la decoracion vieja, no son
// sprites de una casilla: el manglar ocupa 4x4 porque su sistema de raices es
// lo que lo identifica, y a 32 px no cabe.

export interface PropSprite {
  /** Lado de la huella, en casillas. */
  tiles: number
  rows: string[]
}

/** Colores propios del bioma, con letras que no chocan con las de las torres. */
export const PROP_COLORS: Record<string, string> = ${JSON.stringify(colors, null, 2).replace(/"/g, "'")}

export const SWAMP_PROPS: Record<string, PropSprite> = {
${entries.join('\n')}
}
`)
  })
})
