import { Canvas, curveOn, draw } from './forge'
import { fbm } from './shore'

// ─────────────────────────────────────────────────────────────────────────────
// Props del pantano neon manglar.
//
// A diferencia de la decoracion vieja, estos no son sprites de una casilla: el
// manglar ocupa 4x4 (128 px) porque su sistema de raices es justamente lo que
// lo identifica, y a una casilla no cabe. Los pequenos van a 1x1 y 2x2.
//
// Ninguno pisa la grilla construible: todos viven en el agua o en los islotes
// decorativos de alrededor.
// ─────────────────────────────────────────────────────────────────────────────

/** Paleta propia del bioma, inyectada por `terrain` al renderizar. */
export const SWAMP_COLORS: Record<string, string> = {
  // follaje
  F: '#24402f', // copa en sombra
  f: '#305a3f', // copa
  h: '#437a52', // copa iluminada
  // madera
  W: '#4a3a46', // corteza en sombra
  w: '#67505f', // corteza iluminada
  // neon
  N: '#ff5fc8', // magenta
  n: '#ffa8e0', // magenta claro
  C: '#5ff0d8', // cian
  c: '#b8fff2', // cian claro
  // verdes vivos
  V: '#3f8f4b', // helecho
  v: '#5fb562', // helecho claro
  // piedra
  S: '#2a3b44', // piedra
  J: '#1f5f63', // laminillas del hongo, el bajo del cian
  G: '#243c2c', // tierra del monticulo
  g: '#2d4a36', // tierra iluminada
  D: '#18281f', // tierra en sombra
}

/**
 * Manglar de 4x4 casillas. Copa ancha y baja, tronco corto y un abanico de
 * raices aereas que se clavan en el agua: la silueta de la referencia.
 */
function mangrove(seed: number, scale = 1): string[] {
  const U = 128
  const c = new Canvas(U)
  const rnd = (i: number) => {
    const x = Math.sin(seed * 374.761 + i * 127.1) * 43758.5453
    return x - Math.floor(x)
  }
  const cx = 64
  const trunkTop = Math.round(56 * scale + (1 - scale) * 20)
  const groundY = 118
  const moundY = groundY - 2

  // ─ Raices: se calculan antes de dibujar nada, porque el monticulo se
  // construye a partir de donde aterriza cada una. Asi el suelo sigue a las
  // raices en vez de ser un plato liso debajo del arbol.
  const roots = 11
  const paths: Array<{ start: [number, number]; mid: [number, number]; end: [number, number]; w: number }> = []
  for (let i = 0; i < roots; i++) {
    const dir = i % 2 === 0 ? -1 : 1
    const t = (i + rnd(i)) / roots
    const spread = (14 + t * 36) * scale
    paths.push({
      start: [cx + dir * (2 + t * 6), trunkTop + 14],
      mid: [cx + dir * spread * 0.75, trunkTop + 30 + t * 12],
      end: [cx + dir * spread, groundY - 2 - rnd(i + 20) * 8],
      w: 7 - t * 2.5,
    })
  }

  // ─ Monticulo: union de un bulto por cada raiz mas una masa central, con el
  // borde mordido por ruido.
  const lumps: Array<[number, number, number, number]> = paths.map((p) => [p.end[0], moundY, 13, 7])
  lumps.push([cx, moundY, 26, 11], [cx - 14, moundY - 2, 18, 9], [cx + 14, moundY - 2, 18, 9])
  for (const [bx, by, rx, ry] of lumps) {
    for (let y = Math.round(by - ry - 4); y <= Math.round(by + ry + 4); y++) {
      for (let x = Math.round(bx - rx - 4); x <= Math.round(bx + rx + 4); x++) {
        const nx = (x - bx) / rx, ny = (y - by) / ry
        if (nx * nx + ny * ny > 0.55 + fbm(x * 3, y * 3, 11, seed) * 0.8) continue
        const d = (y - moundY) / 11
        c.put(x, y, d < -0.4 ? 'g' : d > 0.35 ? 'D' : 'G')
      }
    }
  }
  const soil = (ch: string) => ch === 'G' || ch === 'g' || ch === 'D'
  // Filo magenta alrededor del monticulo.
  const rim: Array<[number, number]> = []
  for (let y = 0; y < U; y++) for (let x = 0; x < U; x++) {
    if (!soil(c.get(x, y))) continue
    if (!soil(c.get(x - 1, y)) || !soil(c.get(x + 1, y)) || !soil(c.get(x, y - 1)) || !soil(c.get(x, y + 1))) rim.push([x, y])
  }
  for (const [x, y] of rim) c.put(x, y, 'N')

  // ─ Raices sobre el monticulo.
  for (const p of paths) {
    curveOn(c, p.start, p.mid, p.end, p.w, 2.5, 'W')
    curveOn(c, [p.start[0] - 1, p.start[1] - 1], [p.mid[0] - 1, p.mid[1] - 2], [p.end[0] - 1, p.end[1] - 2], 2.6, 1.2, 'w')
  }
  // Puntas que se escapan del monticulo y se hunden en el agua: son las que
  // evitan que la base se lea como un disco recortado.
  for (let i = 0; i < 5; i++) {
    const dir = i % 2 === 0 ? -1 : 1
    const from = paths[(i * 3 + 1) % paths.length].end
    const reach = 10 + rnd(i + 70) * 14
    curveOn(c, from, [from[0] + dir * reach * 0.6, moundY + 5], [from[0] + dir * reach, moundY + 7 + rnd(i + 80) * 4], 3, 1.2, 'W')
  }
  // Raices colgantes desde la copa, finas y rectas.
  for (let i = 0; i < 9; i++) {
    const x = 18 + i * 11 + Math.round(rnd(i + 40) * 6)
    const top = 44 + Math.round(rnd(i + 50) * 14)
    c.rect(x, top, x + 1, top + 14 + Math.round(rnd(i + 60) * 16), 'W')
  }

  // ─ Tronco: corto, grueso y con ensanche en la base.
  for (let y = trunkTop; y < trunkTop + 30; y++) {
    const half = 7 + ((y - trunkTop) / 30) ** 2 * 9
    c.rect(Math.round(cx - half), y, Math.round(cx + half), y, 'W')
    c.rect(Math.round(cx - half), y, Math.round(cx - half + 2), y, 'w')
  }

  // ─ Copa en tres pasadas: follaje, ramas por encima y unos mechones al frente.
  // Pintada de una sola vez quedaba una masa lisa; las ramas asomando entre el
  // follaje son lo que le da fondo.
  const lift = (v: number) => v * scale + (1 - scale) * 10
  const blobs: Array<[number, number, number, number]> = [
    [cx, 32, 44, 21], [cx - 30, 40, 24, 14], [cx + 30, 40, 24, 14],
    [cx - 16, 20, 24, 13], [cx + 18, 22, 22, 12], [cx - 44, 34, 15, 10],
    [cx + 44, 34, 15, 10], [cx - 6, 12, 17, 9], [cx + 26, 14, 14, 8],
    [cx - 34, 24, 14, 9], [cx + 10, 46, 20, 10], [cx - 20, 46, 18, 9],
  ]
  for (let i = 0; i < blobs.length; i++) {
    const [bx, by, rx, ry] = blobs[i]
    const j = 0.86 + rnd(i + 500) * 0.3
    const ox = bx + (rnd(i + 600) - 0.5) * 7, oy = lift(by)
    // Cada mechon lleva su propio canto oscuro: es lo que separa unos de otros.
    c.ellipse(ox, oy, rx * scale * j + 2, ry * scale * j + 2, 'F')
    c.ellipse(ox, oy, rx * scale * j, ry * scale * j, 'f')
  }
  // Ramas: salen del tronco hacia los mechones principales y se ven entre ellos.
  for (let i = 0; i < 6; i++) {
    const [bx, by] = blobs[i]
    const ex = bx + (rnd(i + 700) - 0.5) * 10, ey = lift(by) + 4
    curveOn(c, [cx, trunkTop + 6], [(cx + ex) / 2, trunkTop - 2], [ex, ey], 6, 2, 'W')
    curveOn(c, [cx - 1, trunkTop + 5], [(cx + ex) / 2 - 1, trunkTop - 3], [ex - 1, ey - 1], 2.4, 1, 'w')
  }
  // Mechones al frente, para que las ramas queden entre hojas y no encima.
  for (let i = 0; i < 7; i++) {
    const a = rnd(i + 800) * Math.PI * 2
    const bx = cx + Math.cos(a) * (14 + rnd(i + 810) * 30)
    const by = lift(26 + Math.sin(a) * 16)
    const r = (9 + rnd(i + 820) * 8) * scale
    c.ellipse(bx, by, r + 1.5, r * 0.66 + 1.5, 'F')
    c.ellipse(bx, by, r, r * 0.66, 'f')
  }
  // Volumen: luz arriba, sombra abajo.
  for (let y = 0; y < U; y++) for (let x = 0; x < U; x++) {
    if (c.get(x, y) !== 'f') continue
    if (c.get(x, y - 5) === '.') c.put(x, y, 'h')
    else if (c.get(x, y + 6) === '.') c.put(x, y, 'F')
  }
  // Motas luminiscentes: el guino neon del bioma, repartidas por la copa.
  for (let i = 0; i < 90; i++) {
    const x = Math.round(rnd(i + 100) * U)
    const y = Math.round(rnd(i + 200) * 70)
    const here = c.get(x, y)
    if (here !== 'f' && here !== 'h' && here !== 'F') continue
    const warm = rnd(i + 300) > 0.45
    c.put(x, y, warm ? 'N' : 'C')
    if (rnd(i + 400) > 0.6) c.put(x + 1, y, warm ? 'n' : 'c')
  }
  return c.rows()
}

/** Helecho de 2x2: mata de frondas abiertas en abanico. */
function fern(seed: number): string[] {
  const U = 64
  const c = new Canvas(U)
  const rnd = (i: number) => { const x = Math.sin(seed * 91.17 + i * 57.3) * 43758.5453; return x - Math.floor(x) }
  for (let i = 0; i < 9; i++) {
    const t = i / 8
    const dir = t < 0.5 ? -1 : 1
    const reach = 10 + rnd(i) * 18
    const top = 16 + rnd(i + 9) * 12
    const end: [number, number] = [32 + dir * reach, top]
    curveOn(c, [32, 58], [32 + dir * reach * 0.4, 36], end, 4, 1.5, 'V')
    // Foliolos a lo largo de la fronda.
    for (let k = 1; k <= 5; k++) {
      const u = k / 6
      const x = 32 + dir * reach * u * u
      const y = 58 - (58 - top) * u
      c.rect(Math.round(x - 3), Math.round(y), Math.round(x + 3), Math.round(y), 'v')
    }
  }
  c.ellipse(32, 59, 7, 3, 'F')
  return c.rows()
}

/** Hongo luminiscente de 2x2: pie visible y sombrero con laminillas. */
function glowshroom(seed: number): string[] {
  const U = 64
  const c = new Canvas(U)
  const rnd = (i: number) => { const x = Math.sin(seed * 33.7 + i * 11.9) * 43758.5453; return x - Math.floor(x) }
  const base = 56
  // De la mas alta a la mas baja: las de delante tapan a las de atras.
  const caps: Array<[number, number, number]> = [[20, 20, 12], [42, 28, 9], [31, 38, 7]]
  for (const [x, capY, r] of caps) {
    // Pie: se ensancha hacia abajo y lleva su lado en sombra.
    for (let y = capY; y <= base; y++) {
      const t = (y - capY) / (base - capY)
      const half = 1.4 + t * 2.2
      c.rect(Math.round(x - half), y, Math.round(x + half), y, 'w')
      c.rect(Math.round(x + half - 1), y, Math.round(x + half), y, 'W')
    }
    // Domo del sombrero, con un canto oscuro que lo separa del de atras.
    for (let d = r + 1; d >= r; d--) {
      for (let y = Math.round(capY - d * 0.8); y <= capY; y++) {
        const t = (capY - y) / (d * 0.8)
        const half = d * Math.sqrt(Math.max(0, 1 - t * t))
        c.rect(Math.round(x - half), y, Math.round(x + half), y, d > r ? 'J' : 'C')
      }
    }
    // Borde del sombrero y laminillas debajo.
    c.rect(Math.round(x - r), capY, Math.round(x + r), capY, 'c')
    c.rect(Math.round(x - r * 0.78), capY + 1, Math.round(x + r * 0.78), capY + 2, 'J')
    for (let k = -2; k <= 2; k++) c.rect(Math.round(x + k * r * 0.3), capY + 1, Math.round(x + k * r * 0.3), capY + 2, 'C')
    // Brillo.
    c.ellipse(x - r * 0.36, capY - r * 0.46, r * 0.3, r * 0.17, 'c')
    // Motas sobre el sombrero.
    for (let i = 0; i < 4; i++) {
      const px = Math.round(x + (rnd(i + x) - 0.5) * r * 1.3)
      const py = Math.round(capY - 2 - rnd(i + x + 9) * r * 0.55)
      if (c.get(px, py) === 'C') c.put(px, py, 'c')
    }
  }
  c.ellipse(31, base + 2, 11, 3.5, 'F')
  return c.rows()
}

/** Cristal de 1x1: esquirlas que salen del suelo. */
function crystal(seed: number): string[] {
  const c = new Canvas(32)
  const rnd = (i: number) => { const x = Math.sin(seed * 17.3 + i * 73.1) * 43758.5453; return x - Math.floor(x) }
  for (let i = 0; i < 4; i++) {
    const x = 7 + i * 6 + Math.round(rnd(i) * 3)
    const h = 9 + Math.round(rnd(i + 4) * 13)
    const tone = rnd(i + 8) > 0.5 ? 'N' : 'C'
    for (let k = 0; k <= h; k++) {
      const half = Math.max(0, 2.2 - (k / h) * 2.2)
      c.rect(Math.round(x - half), 29 - k, Math.round(x + half), 29 - k, tone)
    }
    c.rect(x, 29 - h, x, 29 - Math.round(h * 0.6), rnd(i + 12) > 0.5 ? 'n' : 'c')
  }
  return c.rows()
}

/** Junco de 1x1: tallos finos al borde del agua. */
function reeds(seed: number): string[] {
  const c = new Canvas(32)
  const rnd = (i: number) => { const x = Math.sin(seed * 51.9 + i * 29.7) * 43758.5453; return x - Math.floor(x) }
  for (let i = 0; i < 7; i++) {
    const x = 4 + i * 4 + Math.round(rnd(i) * 2)
    const h = 12 + Math.round(rnd(i + 7) * 14)
    const lean = Math.round((rnd(i + 14) - 0.5) * 5)
    curveOn(c, [x, 30], [x + lean * 0.5, 30 - h * 0.6], [x + lean, 30 - h], 2, 1, rnd(i + 21) > 0.7 ? 'v' : 'V')
  }
  return c.rows()
}

/** Nenufar de 1x1: hoja flotante con una flor. */
function lilypad(seed: number): string[] {
  const c = new Canvas(32)
  const rnd = (i: number) => { const x = Math.sin(seed * 71.1 + i * 13.3) * 43758.5453; return x - Math.floor(x) }
  for (let i = 0; i < 3; i++) {
    const x = 7 + Math.round(rnd(i) * 18), y = 10 + Math.round(rnd(i + 3) * 14)
    const r = 5 + rnd(i + 6) * 3
    c.ellipse(x, y, r, r * 0.72, 'f')
    c.ellipse(x - r * 0.3, y - r * 0.2, r * 0.4, r * 0.3, 'h')
    // Muesca de la hoja.
    c.rect(x, y, Math.round(x + r), y, '.')
  }
  c.ellipse(20, 20, 2.2, 1.8, 'N')
  c.ellipse(20, 20, 1, 0.8, 'n')
  return c.rows()
}

export interface SwampProp { rows: string[]; tiles: number }

export const SWAMP_PROPS: Record<string, SwampProp> = {
  mangrove: { rows: mangrove(1), tiles: 4 },
  'mangrove-b': { rows: mangrove(7, 0.86), tiles: 4 },
  'mangrove-c': { rows: mangrove(13, 0.74), tiles: 4 },
  fern: { rows: fern(2), tiles: 2 },
  'fern-b': { rows: fern(5), tiles: 2 },
  glowshroom: { rows: glowshroom(3), tiles: 2 },
  'glowshroom-b': { rows: glowshroom(9), tiles: 2 },
  crystal: { rows: crystal(4), tiles: 1 },
  'crystal-b': { rows: crystal(8), tiles: 1 },
  reeds: { rows: reeds(6), tiles: 1 },
  'reeds-b': { rows: reeds(11), tiles: 1 },
  lilypad: { rows: lilypad(10), tiles: 1 },
  'lilypad-b': { rows: lilypad(15), tiles: 1 },
}

export { draw }
