import { Canvas, curveOn, draw } from './forge'
import { fbm } from './shore'

// ─────────────────────────────────────────────────────────────────────────────
// Props del desierto Nuketown.
//
// Aqui lo que identifica al bioma no es vegetacion sino abandono: casas
// desvencijadas, una torre de vigia, camiones varados y crateres. La casa es a
// este bioma lo que el manglar al pantano y el arrecife a la isla coral.
//
// Las letras pueden ser las naturales: cada bioma tiene su propio espacio de
// nombres de color, asi que 'W' de madera no pisa nada de los otros dos.
// ─────────────────────────────────────────────────────────────────────────────

export const NUKETOWN_COLORS: Record<string, string> = {
  K: '#2b2018', // contorno
  W: '#6b4f33', // madera en sombra
  w: '#8f6c45', // madera
  l: '#b0905f', // madera descolorida
  R: '#7a3a2c', // techo
  r: '#9c5240', // techo iluminado
  M: '#55616b', // metal
  m: '#78848e', // metal claro
  O: '#9c5a28', // oxido
  C: '#9a9183', // hormigon
  c: '#b8b0a2', // hormigon claro
  S: '#6a5a46', // roca
  s: '#8a7760', // roca iluminada
  D: '#7d6a4c', // tierra removida
  d: '#5c4c36', // tierra en sombra
  G: '#5f7a42', // cactus
  g: '#445c30', // cactus en sombra
  Y: '#d8c23c', // amarillo de senal
  B: '#2f4a6b', // cristal
}

const rnd = (seed: number) => (i: number) => {
  const x = Math.sin(seed * 374.761 + i * 127.1) * 43758.5453
  return x - Math.floor(x)
}

/** Triangulo con el vertice arriba: tejados y cerros. */
const peak = (c: Canvas, cx: number, top: number, bottom: number, half: number, color: string) => {
  for (let y = top; y <= bottom; y++) {
    const t = (y - top) / Math.max(1, bottom - top)
    const w = half * t
    c.rect(Math.round(cx - w), y, Math.round(cx + w), y, color)
  }
}

/** Casa abandonada de 3x3: tejado a dos aguas, tablas y ventanas rotas. */
function house(seed: number, ruined = false): string[] {
  const U = 96
  const c = new Canvas(U)
  const r = rnd(seed)
  const floor = 86
  const wallTop = 46

  // Cuerpo.
  c.rect(16, wallTop, 79, floor, 'w')
  // Tablas: franjas verticales de tono alterno.
  for (let x = 16; x <= 79; x += 5) c.rect(x, wallTop, x + 1, floor, r(x) > 0.5 ? 'W' : 'l')
  // Tejado a dos aguas, con el alero sobresaliendo.
  peak(c, 48, 16, wallTop, 40, 'R')
  c.rect(6, wallTop - 4, 89, wallTop, 'R')
  c.rect(6, wallTop - 4, 89, wallTop - 2, 'r')
  // Tablones sueltos del tejado.
  for (let i = 0; i < 6; i++) {
    const x = 12 + Math.round(r(i + 30) * 70)
    const y = 20 + Math.round(r(i + 40) * 22)
    if (c.get(x, y) === 'R') c.rect(x, y, x + 3, y + 1, 'W')
  }
  // Ventanas y puerta.
  for (const x of [24, 60]) {
    c.rect(x, 54, x + 13, 68, 'K')
    c.rect(x + 1, 55, x + 12, 67, 'B')
    c.rect(x + 6, 55, x + 7, 67, 'W')
    c.rect(x + 1, 60, x + 12, 61, 'W')
  }
  c.rect(42, 68, 55, floor, 'K')
  c.rect(43, 69, 54, floor, 'W')
  // Ruina: le falta media pared y parte del tejado.
  if (ruined) {
    for (let y = wallTop - 6; y <= floor; y++) {
      const cut = 72 - (y - wallTop) * 0.5 + fbm(y * 4, 0, 9, seed) * 10
      for (let x = Math.round(cut); x <= 92; x++) c.put(x, y, '.')
    }
  }
  c.rect(10, floor, 86, floor + 3, 'd')
  return c.rows()
}

/** Torre de vigia de 3x3: patas en celosia y garita arriba. */
function watchtower(seed: number): string[] {
  const U = 96
  const c = new Canvas(U)
  const r = rnd(seed)
  const cabinY = 20
  // Patas que se abren hacia la base.
  for (const dir of [-1, 1]) {
    curveOn(c, [48 + dir * 12, cabinY + 16], [48 + dir * 18, 56], [48 + dir * 26, 86], 5, 6, 'M')
  }
  // Travesanos.
  for (let y = cabinY + 24; y < 84; y += 11) {
    const half = 12 + ((y - cabinY - 24) / 48) * 14
    c.rect(Math.round(48 - half), y, Math.round(48 + half), y + 2, 'M')
    curveOn(c, [48 - half, y], [48, y + 6], [48 + half, y + 11], 2.4, 2.4, 'm')
  }
  // Garita.
  c.rect(26, cabinY, 69, cabinY + 18, 'M')
  c.rect(28, cabinY + 3, 67, cabinY + 11, 'B')
  c.rect(26, cabinY, 69, cabinY + 2, 'm')
  // Tejadillo.
  c.rect(20, cabinY - 6, 75, cabinY, 'M')
  c.rect(20, cabinY - 6, 75, cabinY - 4, 'm')
  // Foco.
  c.ellipse(70, cabinY + 14, 4, 3.4, 'Y')
  for (let i = 0; i < 3; i++) c.rect(74 + i * 3, cabinY + 12 + i, 76 + i * 3, cabinY + 16 + i, 'Y')
  c.rect(16, 86, 80, 89, 'd')
  return c.rows()
}

/** Camion varado de 2x2. */
function truck(seed: number): string[] {
  const U = 64
  const c = new Canvas(U)
  const r = rnd(seed)
  // Caja y cabina.
  c.rect(6, 22, 40, 44, 'G')
  c.rect(6, 22, 40, 26, 'g')
  for (let x = 9; x < 40; x += 6) c.rect(x, 26, x + 1, 44, 'g')
  c.rect(40, 28, 56, 44, 'g')
  c.rect(43, 31, 54, 38, 'B')
  // Oxido.
  for (let i = 0; i < 10; i++) {
    const x = 8 + Math.round(r(i) * 46), y = 24 + Math.round(r(i + 10) * 18)
    c.ellipse(x, y, 2.4, 1.8, 'O')
  }
  // Ruedas, una reventada.
  c.ellipse(17, 48, 7, 7, 'K')
  c.ellipse(17, 48, 3, 3, 'M')
  c.ellipse(46, 50, 7, 4, 'K')
  c.rect(2, 44, 58, 47, 'd')
  return c.rows()
}

/** Crater de 2x2: tierra levantada y fondo oscuro. */
function crater(seed: number): string[] {
  const U = 64
  const c = new Canvas(U)
  for (let y = 16; y < 56; y++) {
    for (let x = 4; x < 60; x++) {
      const nx = (x - 32) / 26, ny = (y - 36) / 16
      const d = nx * nx + ny * ny
      const wobble = fbm(x * 3, y * 3, 13, seed) * 0.35
      if (d > 1 + wobble) continue
      c.put(x, y, d > 0.66 + wobble ? 'D' : d > 0.3 ? 'd' : 'K')
    }
  }
  // Grietas que salen del borde.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    curveOn(c, [32 + Math.cos(a) * 24, 36 + Math.sin(a) * 15],
      [32 + Math.cos(a) * 28, 36 + Math.sin(a) * 18], [32 + Math.cos(a) * 32, 36 + Math.sin(a) * 20], 2, 1, 'd')
  }
  return c.rows()
}

/** Cerro de roca de 3x3, para el fondo de fuera del marco. */
function mesa(seed: number): string[] {
  const U = 96
  const c = new Canvas(U)
  const r = rnd(seed)
  const tops: Array<[number, number, number]> = [[30, 34, 22], [60, 24, 26], [46, 44, 18]]
  for (const [cx, top, half] of tops) {
    for (let y = top; y < 90; y++) {
      const t = (y - top) / (90 - top)
      const w = half * (0.55 + t * 0.45) + fbm(y * 4, cx, 11, seed) * 6
      c.rect(Math.round(cx - w), y, Math.round(cx + w), y, 'S')
    }
    // Cara iluminada y estratos.
    for (let y = top; y < 90; y += 7) {
      const t = (y - top) / (90 - top)
      const w = half * (0.55 + t * 0.45)
      c.rect(Math.round(cx - w), y, Math.round(cx - w + 4), y + 2, 's')
    }
    c.rect(Math.round(cx - half * 0.55), top, Math.round(cx + half * 0.55), top + 2, 's')
  }
  for (let i = 0; i < 6; i++) c.ellipse(8 + r(i) * 80, 86 + r(i + 6) * 4, 6, 3, 'S')
  return c.rows()
}

/** Cactus seco de 1x1. */
function cactus(seed: number): string[] {
  const c = new Canvas(32)
  const r = rnd(seed)
  c.rect(14, 6, 18, 29, 'G')
  c.rect(14, 6, 15, 29, 'g')
  if (r(0) > 0.4) { c.rect(7, 14, 13, 17, 'G'); c.rect(7, 9, 9, 17, 'G') }
  if (r(1) > 0.4) { c.rect(19, 18, 25, 21, 'G'); c.rect(23, 12, 25, 21, 'G') }
  for (let y = 9; y < 28; y += 4) c.rect(16, y, 16, y + 1, 'g')
  return c.rows()
}

/** Matorral seco de 1x1. */
function shrub(seed: number): string[] {
  const c = new Canvas(32)
  const r = rnd(seed)
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI + (i / 8) * Math.PI
    curveOn(c, [16, 28], [16 + Math.cos(a) * 6, 22], [16 + Math.cos(a) * 12, 14 + r(i) * 8], 2.4, 1, i % 2 ? 'l' : 'W')
  }
  return c.rows()
}

/** Bidon oxidado de 1x1. */
function barrel(): string[] {
  const c = new Canvas(32)
  c.rect(10, 10, 22, 29, 'O')
  c.rect(10, 10, 13, 29, 'M')
  c.ellipse(16, 10, 6.4, 2.4, 'm')
  for (const y of [15, 24]) c.rect(10, y, 22, y + 1, 'M')
  c.rect(14, 18, 18, 22, 'Y')
  return c.rows()
}

/** Senal de radiacion de 1x1. */
function sign(): string[] {
  const c = new Canvas(32)
  c.rect(15, 14, 17, 30, 'W')
  c.rect(6, 6, 26, 18, 'Y')
  c.rect(6, 6, 26, 7, 'K')
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 - Math.PI / 2
    curveOn(c, [16, 12], [16 + Math.cos(a) * 4, 12 + Math.sin(a) * 4], [16 + Math.cos(a) * 7, 12 + Math.sin(a) * 7], 4, 3, 'K')
  }
  c.ellipse(16, 12, 2, 2, 'K')
  return c.rows()
}

/** Escombro de 1x1. */
function rubble(seed: number): string[] {
  const c = new Canvas(32)
  const r = rnd(seed)
  for (let i = 0; i < 4; i++) {
    const x = 6 + r(i) * 20, y = 20 + r(i + 4) * 8
    const w = 3 + r(i + 8) * 4
    c.ellipse(x, y, w, w * 0.7, 'S')
    c.ellipse(x - w * 0.3, y - w * 0.3, w * 0.4, w * 0.3, 's')
  }
  return c.rows()
}

export interface NukeProp { rows: string[]; tiles: number }

export const NUKETOWN_PROPS: Record<string, NukeProp> = {
  house: { rows: house(1), tiles: 3 },
  'house-b': { rows: house(5, true), tiles: 3 },
  watchtower: { rows: watchtower(2), tiles: 3 },
  mesa: { rows: mesa(3), tiles: 3 },
  'mesa-b': { rows: mesa(9), tiles: 3 },
  truck: { rows: truck(4), tiles: 2 },
  crater: { rows: crater(6), tiles: 2 },
  'crater-b': { rows: crater(11), tiles: 2 },
  cactus: { rows: cactus(7), tiles: 1 },
  'cactus-b': { rows: cactus(12), tiles: 1 },
  shrub: { rows: shrub(8), tiles: 1 },
  'shrub-b': { rows: shrub(13), tiles: 1 },
  barrel: { rows: barrel(), tiles: 1 },
  sign: { rows: sign(), tiles: 1 },
  rubble: { rows: rubble(10), tiles: 1 },
  'rubble-b': { rows: rubble(14), tiles: 1 },
}

export { draw }
