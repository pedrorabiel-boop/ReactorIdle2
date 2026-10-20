/**
 * Taller de sprites: primitivas para dibujar a 32x32 con codigo.
 *
 * Dibujar 27 torres tecleando 32 filas de ASCII a mano es lento y se presta a
 * descuadres de un pixel que no se ven hasta tenerlo en el mapa. Con estas
 * primitivas una torre son diez lineas legibles y el contorno sale solo.
 */
export class Canvas {
  readonly size: number
  private readonly g: string[][]

  constructor(size = 32) {
    this.size = size
    this.g = Array.from({ length: size }, () => Array<string>(size).fill('.'))
  }

  put(x: number, y: number, c: string): void {
    const xi = Math.round(x), yi = Math.round(y)
    if (xi >= 0 && xi < this.size && yi >= 0 && yi < this.size) this.g[yi][xi] = c
  }

  get(x: number, y: number): string {
    return this.g[y]?.[x] ?? '.'
  }

  /** Rectangulo relleno, con `x2`/`y2` incluidos. */
  rect(x1: number, y1: number, x2: number, y2: number, c: string): this {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) this.put(x, y, c)
    return this
  }

  /** Trapecio vertical: ancho que cambia de arriba a abajo. Para torres y mastiles. */
  taper(cx: number, y1: number, y2: number, w1: number, w2: number, c: string): this {
    for (let y = y1; y <= y2; y++) {
      const t = y2 === y1 ? 0 : (y - y1) / (y2 - y1)
      const half = (w1 + (w2 - w1) * t) / 2
      for (let x = Math.round(cx - half); x <= Math.round(cx + half - 0.01); x++) this.put(x, y, c)
    }
    return this
  }

  /** Linea gruesa con extremos de distinto grosor. Para aspas y brazos. */
  blade(x1: number, y1: number, x2: number, y2: number, w1: number, w2: number, c: string): this {
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1)) * 2
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t
      const w = (w1 + (w2 - w1) * t) / 2
      for (let dy = -Math.ceil(w); dy <= Math.ceil(w); dy++) {
        for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) {
          if (dx * dx + dy * dy <= w * w) this.put(x + dx, y + dy, c)
        }
      }
    }
    return this
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: string): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.put(x, y, c)
      }
    }
    return this
  }

  /** Pinta `to` sobre los pixeles `from` que dan a la luz (arriba-izquierda). */
  shadeTop(from: string, to: string, depth = 1): this {
    const hits: Array<[number, number]> = []
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) {
      if (this.get(x, y) !== from) continue
      for (let d = 1; d <= depth; d++) if (this.get(x, y - d) === '.' || this.get(x - d, y) === '.') { hits.push([x, y]); break }
    }
    for (const [x, y] of hits) this.put(x, y, to)
    return this
  }

  /** Igual que `shadeTop` pero del lado opuesto, para la sombra propia. */
  shadeBottom(from: string, to: string, depth = 1): this {
    const hits: Array<[number, number]> = []
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) {
      if (this.get(x, y) !== from) continue
      for (let d = 1; d <= depth; d++) if (this.get(x, y + d) === '.' || this.get(x + d, y) === '.') { hits.push([x, y]); break }
    }
    for (const [x, y] of hits) this.put(x, y, to)
    return this
  }

  /** Contorno de 1 px por fuera de todo lo pintado. */
  outline(c = 'K'): this {
    const solid = (x: number, y: number) => { const v = this.get(x, y); return v !== '.' && v !== c }
    const hits: Array<[number, number]> = []
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) {
      if (this.get(x, y) !== '.') continue
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)
        || solid(x - 1, y - 1) || solid(x + 1, y - 1) || solid(x - 1, y + 1) || solid(x + 1, y + 1)) hits.push([x, y])
    }
    for (const [x, y] of hits) this.put(x, y, c)
    return this
  }

  rows(): string[] {
    return this.g.map((row) => row.join(''))
  }
}

export const draw = (build: (c: Canvas) => void, size = 32): string[] => {
  const canvas = new Canvas(size)
  build(canvas)
  return canvas.rows()
}

/**
 * Rampas de la paleta, de claro a oscuro. Sirven para sombrear sin inventar
 * colores: un pixel solo puede moverse a un vecino de su propia rampa.
 */
const RAMPS: string[][] = [
  ['W', 'L', 'G', 'D'],
  ['e', 'E', 'g'],
  ['t', 'T'],
  ['b', 'B'],
  ['Y', 'O'],
  ['r', 'R'],
  ['p', 'P'],
  ['m', 'M'],
  ['v', 'n'],
]

const step = (ch: string, delta: number): string => {
  for (const ramp of RAMPS) {
    const i = ramp.indexOf(ch)
    if (i < 0) continue
    return ramp[Math.min(ramp.length - 1, Math.max(0, i + delta))]
  }
  return ch
}

/**
 * Da volumen a un sprite ya dibujado: aclara el canto que mira a la luz
 * (arriba-izquierda) y oscurece el opuesto. Es una pasada mecanica, igual para
 * los 27 sprites, y no toca la silueta ni el contorno.
 */
export function shade(rows: string[]): string[] {
  const h = rows.length, w = rows[0].length
  const at = (x: number, y: number) => (y < 0 || y >= h || x < 0 || x >= w) ? '.' : rows[y][x]
  const empty = (x: number, y: number) => { const v = at(x, y); return v === '.' || v === 'K' }
  const out = rows.map((r) => [...r])
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x]
    if (ch === '.' || ch === 'K') continue
    const lit = empty(x, y - 1) || empty(x - 1, y)
    const dark = empty(x, y + 1) || empty(x + 1, y)
    // Un canto que da a los dos lados es una pieza de un pixel: se deja igual.
    if (lit && !dark) out[y][x] = step(ch, -1)
    else if (dark && !lit) out[y][x] = step(ch, +1)
  }
  return out.map((r) => r.join(''))
}

/** Contorno negro de 1 px alrededor de todo lo pintado, sobre filas ya hechas. */
export function outlined(rows: string[], c = 'K'): string[] {
  const h = rows.length, w = rows[0].length
  const at = (x: number, y: number) => (y < 0 || y >= h || x < 0 || x >= w) ? '.' : rows[y][x]
  const solid = (x: number, y: number) => { const v = at(x, y); return v !== '.' && v !== c }
  const out = rows.map((r) => [...r])
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (at(x, y) !== '.') continue
    if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)
      || solid(x - 1, y - 1) || solid(x + 1, y - 1) || solid(x - 1, y + 1) || solid(x + 1, y + 1)) out[y][x] = c
  }
  return out.map((r) => r.join(''))
}

/** Estampa una mini-rejilla ASCII (todo lo que no sea `.`) con un color. */
export function stamp(c: Canvas, x0: number, y0: number, art: string[], color: string, scale = 1): void {
  art.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) c.put(x0 + x * scale + dx, y0 + y * scale + dy, color)
  }))
}

/**
 * Curva de Bezier cuadratica con grosor variable. Es la primitiva que faltaba:
 * las raices aereas de un manglar, las lianas y los tallos arqueados no se
 * pueden hacer con `blade`, que solo traza rectas.
 */
export function curveOn(
  c: Canvas,
  [x0, y0]: [number, number],
  [cx, cy]: [number, number],
  [x1, y1]: [number, number],
  w0: number,
  w1: number,
  color: string,
): void {
  const steps = Math.ceil((Math.hypot(cx - x0, cy - y0) + Math.hypot(x1 - cx, y1 - cy)) * 1.5)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    const x = u * u * x0 + 2 * u * t * cx + t * t * x1
    const y = u * u * y0 + 2 * u * t * cy + t * t * y1
    const r = (w0 + (w1 - w0) * t) / 2
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        if (dx * dx + dy * dy <= r * r) c.put(x + dx, y + dy, color)
      }
    }
  }
}
