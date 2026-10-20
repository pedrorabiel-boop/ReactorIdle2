import { describe, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { SWAMP_COLORS, SWAMP_PROPS } from './swampprops'
import { CORAL_COLORS, CORAL_PROPS } from './coralprops'

/**
 * Vuelca los props de los biomas a un modulo de la app.
 *
 * Las letras de los props no chocan con las de las torres porque viven en otro
 * espacio de nombres (`--pp-X` frente a `--px-X`). Antes compartian uno solo y
 * hacia falta una tabla de reasignacion: 'T' era marron de tronco para un prop
 * y marron de puerta para una torre, y el bioma terminaba repintando torres.
 * Cada bioma puede ahora usar las letras que le convengan.
 */
interface Bank {
  nombre: string
  colors: Record<string, string>
  props: Record<string, { rows: string[]; tiles: number }>
}

function emit(bank: Bank) {
  const used = new Set<string>()
  const entries = Object.entries(bank.props).map(([name, prop]) => {
    for (const row of prop.rows) {
      if (row.length !== prop.rows.length) throw new Error(`${bank.nombre}/${name}: la rejilla no es cuadrada`)
      for (const ch of row) if (ch !== '.') used.add(ch)
    }
    const body = prop.rows.map((row) => `    '${row}',`).join('\n')
    return `  '${name}': { tiles: ${prop.tiles}, rows: [\n${body}\n  ] },`
  })
  for (const ch of used) {
    if (!(ch in bank.colors)) throw new Error(`${bank.nombre}: la letra ${ch} no tiene color`)
  }
  return { entries }
}

describe('props de los biomas', () => {
  it('los escribe en la app', () => {
    const swamp = emit({ nombre: 'pantano', colors: SWAMP_COLORS, props: SWAMP_PROPS })
    const coral = emit({ nombre: 'coral', colors: CORAL_COLORS, props: CORAL_PROPS })
    const dump = (colors: Record<string, string>) => JSON.stringify(colors, null, 2).replace(/"/g, "'")

    writeFileSync('src/ui/pixel/props.ts', [
      '// GENERADO por `npm run art`. No editar a mano.',
      '//',
      '// Props de escenario. A diferencia de la decoracion vieja, no son sprites de',
      '// una casilla: un manglar ocupa 4x4 y un arrecife 3x3, porque lo que los',
      '// identifica -las raices, los corales- no cabe en 32 px.',
      '',
      'export interface PropSprite {',
      '  /** Lado de la huella, en casillas. */',
      '  tiles: number',
      '  rows: string[]',
      '}',
      '',
      '/** Colores del pantano. Salen como --pp-X, aparte de la paleta de torres. */',
      `export const PROP_COLORS: Record<string, string> = ${dump(SWAMP_COLORS)}`,
      '',
      '/** Colores de la isla coral. */',
      `export const CORAL_COLORS: Record<string, string> = ${dump(CORAL_COLORS)}`,
      '',
      'export const SWAMP_PROPS: Record<string, PropSprite> = {',
      swamp.entries.join('\n'),
      '}',
      '',
      'export const CORAL_PROPS: Record<string, PropSprite> = {',
      coral.entries.join('\n'),
      '}',
      '',
    ].join('\n'))
  })
})
