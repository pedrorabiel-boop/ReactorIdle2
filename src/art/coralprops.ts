import { Canvas, curveOn, draw } from './forge'
import { fbm } from './shore'

// ─────────────────────────────────────────────────────────────────────────────
// Props de la isla coral.
//
// El arrecife es a este bioma lo que el manglar al pantano: lo que se ve de
// lejos y lo que lo identifica. Ocupa 3x3 y vive en el agua abierta, donde en
// el pantano solo habia vetas.
//
// En tierra la clave es que las palmeras vayan en grupo y no sueltas: en la
// referencia nunca hay una palmera aislada.
// ─────────────────────────────────────────────────────────────────────────────

export const CORAL_COLORS: Record<string, string> = {
  // roca sumergida
  R: '#1d4f70', // roca del arrecife
  r: '#2e6d8f', // roca iluminada
  // corales
  A: '#ff5f8f', // coral rosa
  a: '#ff9ec0', // coral rosa claro
  O: '#ff8a3d', // coral naranja
  o: '#ffb979', // coral naranja claro
  U: '#9a6ad8', // coral morado
  u: '#c2a0f0', // coral morado claro
  // vegetacion
  T: '#6b4324', // tronco
  t: '#8f5c33', // tronco iluminado
  E: '#2f8f3a', // fronda en sombra
  e: '#45b84d', // fronda
  h: '#6fd862', // fronda iluminada
  // flores y fauna
  F: '#e8343f', // hibisco
  W: '#fdfbf0', // blanco de concha y flor
  Y: '#ffd451', // amarillo de pez y centro de flor
  S: '#8fa3b0', // pez gris
  K: '#13303f', // contorno bajo el agua
}

const rnd = (seed: number) => (i: number) => {
  const x = Math.sin(seed * 374.761 + i * 127.1) * 43758.5453
  return x - Math.floor(x)
}

/** Arrecife de 3x3: masa de roca con corales encima y algun pez. */
function reef(seed: number): string[] {
  const U = 96
  const c = new Canvas(U)
  const r = rnd(seed)

  // Roca: varios bultos unidos, con el borde mordido por ruido.
  const lumps: Array<[number, number, number, number]> = [
    [48, 62, 30, 16], [26, 68, 18, 11], [70, 66, 20, 12], [46, 50, 20, 12],
  ]
  for (const [bx, by, rx, ry] of lumps) {
    for (let y = by - ry - 4; y <= by + ry + 4; y++) {
      for (let x = bx - rx - 4; x <= bx + rx + 4; x++) {
        const nx = (x - bx) / rx, ny = (y - by) / ry
        if (nx * nx + ny * ny > 0.6 + fbm(x * 3, y * 3, 13, seed) * 0.7) continue
        c.put(x, y, ny < -0.3 ? 'r' : 'R')
      }
    }
  }

  // Corales: abanicos y ramas sobre la roca.
  const tones: Array<[string, string]> = [['A', 'a'], ['O', 'o'], ['U', 'u']]
  for (let i = 0; i < 9; i++) {
    const [dark, light] = tones[i % 3]
    const x = 12 + Math.round(r(i) * 70)
    // Se planta donde haya roca debajo.
    let y = 20
    while (y < U && c.get(x, y) !== 'R' && c.get(x, y) !== 'r') y++
    if (y >= U - 6) continue
    const height = 10 + r(i + 20) * 16
    if (r(i + 40) > 0.45) {
      // Abanico: un semicirculo de ramas cortas.
      for (let k = -3; k <= 3; k++) {
        const end: [number, number] = [x + k * 3, y - height + Math.abs(k) * 2.4]
        curveOn(c, [x, y], [x + k * 1.5, y - height * 0.6], end, 3, 1.6, dark)
      }
      c.ellipse(x, y - height * 0.75, 7, 3, light)
    } else {
      // Rama: un tallo que se bifurca.
      curveOn(c, [x, y], [x - 2, y - height * 0.6], [x - 4, y - height], 4, 2, dark)
      curveOn(c, [x, y - height * 0.4], [x + 4, y - height * 0.7], [x + 6, y - height * 0.9], 3, 1.6, dark)
      c.ellipse(x - 4, y - height, 2.4, 2, light)
      c.ellipse(x + 6, y - height * 0.9, 2, 1.6, light)
    }
  }
  return c.rows()
}

/** Coral suelto de 1x1, para salpicar el agua abierta. */
function coral(seed: number): string[] {
  const c = new Canvas(32)
  const r = rnd(seed)
  const tones: Array<[string, string]> = [['A', 'a'], ['O', 'o'], ['U', 'u']]
  const [dark, light] = tones[Math.floor(r(0) * 3)]
  c.ellipse(16, 29, 8, 3, 'R')
  for (let k = -2; k <= 2; k++) {
    const height = 10 + r(k + 5) * 8
    curveOn(c, [16, 27], [16 + k * 2, 27 - height * 0.6], [16 + k * 4, 27 - height], 3.4, 1.6, dark)
  }
  c.ellipse(16, 27 - 12, 5, 2.4, light)
  return c.rows()
}

/** Banco de peces de 1x1: dashes orientados, no sprites de pez. */
function fish(seed: number): string[] {
  const c = new Canvas(32)
  const r = rnd(seed)
  for (let i = 0; i < 7; i++) {
    const x = 3 + Math.round(r(i) * 24)
    const y = 4 + Math.round(r(i + 7) * 24)
    const gold = r(i + 14) > 0.7
    c.rect(x, y, x + 2, y, gold ? 'Y' : 'S')
    c.rect(x + 3, y, x + 3, y, gold ? 'Y' : 'S')
    c.put(x - 1, y + (r(i + 21) > 0.5 ? 1 : -1), gold ? 'Y' : 'S')
  }
  return c.rows()
}

/** Estrella de mar de 1x1, para la arena. */
function starfish(seed: number): string[] {
  const c = new Canvas(32)
  const r = rnd(seed)
  const turn = r(0) * Math.PI
  for (let k = 0; k < 5; k++) {
    const a = turn + (k * Math.PI * 2) / 5
    curveOn(c, [16, 20], [16 + Math.cos(a) * 4, 20 + Math.sin(a) * 4], [16 + Math.cos(a) * 9, 20 + Math.sin(a) * 9], 5, 2, 'O')
  }
  c.ellipse(16, 20, 3.4, 3.4, 'o')
  return c.rows()
}

/** Concha de 1x1. */
function shell(): string[] {
  const c = new Canvas(32)
  for (let k = -3; k <= 3; k++) {
    curveOn(c, [16, 26], [16 + k * 2, 20], [16 + k * 3.4, 15], 3, 2, k % 2 === 0 ? 'W' : 'a')
  }
  c.ellipse(16, 26, 4, 2, 'W')
  return c.rows()
}

/** Palmera de 2x2: tronco curvo y corona de frondas. */
function palm(seed: number, lean = 1): string[] {
  const U = 64
  const c = new Canvas(U)
  const r = rnd(seed)
  const topX = 32 + lean * 7, topY = 16
  // Tronco, con sus anillos.
  curveOn(c, [32, 60], [32 + lean * 2, 38], [topX, topY], 7, 4, 'T')
  curveOn(c, [31, 60], [31 + lean * 2, 38], [topX - 1, topY], 2.6, 1.6, 't')
  // Frondas: siete, cayendo en arco.
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI + (k / 6) * Math.PI
    const reach = 15 + r(k) * 9
    const end: [number, number] = [topX + Math.cos(a) * reach, topY + Math.sin(a) * reach * 0.55 + 7]
    const tone = k % 3 === 0 ? 'h' : k % 3 === 1 ? 'e' : 'E'
    curveOn(c, [topX, topY], [topX + Math.cos(a) * reach * 0.6, topY + Math.sin(a) * reach * 0.5 - 4], end, 6, 1.6, tone)
  }
  // Cocos bajo la corona.
  for (let k = 0; k < 3; k++) c.ellipse(topX - 4 + k * 4, topY + 6, 2.4, 2.4, 'T')
  return c.rows()
}

/** Grupo de palmeras de 3x3: en la referencia nunca hay una sola. */
function palms(seed: number): string[] {
  const U = 96
  const c = new Canvas(U)
  const r = rnd(seed)
  const trees: Array<[number, number, number]> = [[26, 0, -1], [62, 6, 1], [44, 12, 1]]
  for (const [ox, oy, lean] of trees) {
    const rows = palm(seed + ox, lean)
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== '.') c.put(ox + x - 32, oy + y + 20, ch)
    }))
  }
  // Matorral a los pies.
  for (let i = 0; i < 5; i++) c.ellipse(14 + r(i) * 68, 86 + r(i + 5) * 4, 7, 3.4, 'E')
  return c.rows()
}

/** Mata de hibisco de 1x1, con sus flores rojas. */
function bush(seed: number): string[] {
  const c = new Canvas(32)
  const r = rnd(seed)
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI + (i / 5) * Math.PI
    curveOn(c, [16, 28], [16 + Math.cos(a) * 7, 22], [16 + Math.cos(a) * 12, 16 + Math.sin(a) * 4 + 6], 6, 2.4, i % 2 ? 'e' : 'E')
  }
  for (let i = 0; i < 3; i++) {
    const x = 8 + Math.round(r(i) * 16), y = 16 + Math.round(r(i + 3) * 8)
    c.ellipse(x, y, 3, 2.6, 'F')
    c.put(x, y, 'Y')
  }
  return c.rows()
}

/** Roca de 2x2, de las que asoman entre la hierba. */
function boulder(seed: number): string[] {
  const U = 64
  const c = new Canvas(U)
  for (const [bx, by, rx, ry] of [[32, 44, 20, 14], [20, 36, 11, 9], [44, 38, 12, 9]] as const) {
    for (let y = by - ry - 3; y <= by + ry + 3; y++) {
      for (let x = bx - rx - 3; x <= bx + rx + 3; x++) {
        const nx = (x - bx) / rx, ny = (y - by) / ry
        if (nx * nx + ny * ny > 0.62 + fbm(x * 3, y * 3, 15, seed) * 0.6) continue
        c.put(x, y, ny < -0.35 ? 'S' : 'R')
      }
    }
  }
  return c.rows()
}

export interface CoralProp { rows: string[]; tiles: number }

export const CORAL_PROPS: Record<string, CoralProp> = {
  reef: { rows: reef(1), tiles: 3 },
  'reef-b': { rows: reef(6), tiles: 3 },
  'reef-c': { rows: reef(11), tiles: 3 },
  coral: { rows: coral(2), tiles: 1 },
  'coral-b': { rows: coral(7), tiles: 1 },
  fish: { rows: fish(3), tiles: 1 },
  'fish-b': { rows: fish(8), tiles: 1 },
  starfish: { rows: starfish(4), tiles: 1 },
  shell: { rows: shell(), tiles: 1 },
  palms: { rows: palms(5), tiles: 3 },
  'palms-b': { rows: palms(9), tiles: 3 },
  palm: { rows: palm(10), tiles: 2 },
  'palm-b': { rows: palm(12, -1), tiles: 2 },
  bush: { rows: bush(13), tiles: 1 },
  'bush-b': { rows: bush(15), tiles: 1 },
  boulder: { rows: boulder(14), tiles: 2 },
}

export { draw }
