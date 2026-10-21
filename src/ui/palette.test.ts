import { describe, expect, it } from 'vitest'
import { CYBERPUNK_ENVIRONMENT } from './pixel/cyberpunk'
import { CORAL_ENVIRONMENT } from './pixel/coral'
import { NUKETOWN_ENVIRONMENT } from './pixel/nuketown'
import { PALETTE, SPRITES, envCssVars, type Environment } from './pixel/sprites'

/**
 * Fija la repaleta elegida para cada bioma.
 *
 * Existe porque ya se escribio mal una vez: el commit que decia aplicar "Musgo
 * y oro" al pantano dejo la tabla de otra propuesta, con el comentario de la
 * elegida encima. Las hojas de propuestas viven en `src/art`, que esta fuera de
 * `npm test`, asi que nada comparaba lo aprobado con lo aplicado y el desfase
 * sobrevivio al despliegue.
 */
const MUSGO_Y_ORO: Record<string, string> = {
  B: 'n', b: 'v', // azules -> musgo
  E: 'v', e: 'e', // el verde propio baja a musgo
  O: 'Y', Y: 'Y', // el naranja sube a oro
  R: 'O', r: 'Y', // el rojo pasa por ambar hasta el oro
  C: 'e', // cian -> verde claro
  P: 'n', p: 'v', // purpura -> musgo
  T: 'n', t: 'v', // maderas -> musgo
}

const BIOMAS: Array<[string, Environment]> = [
  ['pantano', CYBERPUNK_ENVIRONMENT],
  ['coral', CORAL_ENVIRONMENT],
  ['nuketown', NUKETOWN_ENVIRONMENT],
]

describe('repaleta de los biomas', () => {
  it('el pantano lleva exactamente "Musgo y oro"', () => {
    expect(CYBERPUNK_ENVIRONMENT.recolor).toEqual(MUSGO_Y_ORO)
  })

  it('no deja nada frio encendido en el pantano', () => {
    // La idea de la propuesta, dicha en colores y no en letras: ni cian ni
    // purpura ni azul sobreviven, y lo unico que brilla es el oro.
    const destino = (ch: string) => PALETTE[(CYBERPUNK_ENVIRONMENT.recolor[ch] ?? ch) as keyof typeof PALETTE]
    for (const frio of ['B', 'b', 'C', 'P', 'p']) {
      expect([PALETTE.B, PALETTE.b, PALETTE.C, PALETTE.P, PALETTE.p]).not.toContain(destino(frio))
    }
    expect(destino('O')).toBe(PALETTE.Y)
  })

  it('cada letra de destino existe en la paleta', () => {
    for (const [nombre, env] of BIOMAS) {
      for (const [origen, destino] of Object.entries(env.recolor)) {
        expect(PALETTE[destino as keyof typeof PALETTE], `${nombre}: ${origen} apunta a '${destino}'`).toBeDefined()
      }
    }
  })

  it('ninguna torre usa digitos, que el terreno le ganaria a la repaleta', () => {
    // `envCssVars` resuelve el terreno ANTES que el recolor, asi que un sprite
    // de torre con un digito saldria del color del suelo y la repaleta no
    // podria tocarlo. Hoy no pasa; esto lo mantiene asi.
    const torres = ['wind', 'solar', 'battery', 'controller', 'core', 'thorium', 'fusion', 'planck',
      'generator', 'generator2', 'cooler', 'exchanger', 'pipe', 'pipe2', 'accumulator',
      'sales', 'sales2', 'research', 'research2', 'insulator']
    for (const torre of torres) {
      expect(SPRITES[torre].join('')).not.toMatch(/[0-9]/)
    }
  })

  it('cada bioma declara una variable por color de la paleta', () => {
    for (const [nombre, env] of BIOMAS) {
      const vars = envCssVars(env)
      for (const ch of Object.keys(PALETTE)) {
        expect(vars, `${nombre}: falta --px-${ch}`).toContain(`--px-${ch}:`)
      }
    }
  })
})
