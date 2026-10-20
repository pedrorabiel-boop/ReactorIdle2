// ─────────────────────────────────────────────────────────────────────────────
// Costa organica.
//
// El autotiler dibuja cada casilla por separado, asi que el contorno de la isla
// siempre sale como una escalera de rectas. Para el borde enmarañado del
// pantano hace falta lo contrario: una mascara de tierra a nivel de pixel sobre
// todo el mapa, con el limite movido por ruido.
//
// La regla que no se negocia: toda casilla construible es tierra entera. El
// ruido solo puede anadir tierra hacia afuera, nunca quitarla, asi que la
// grilla del motor queda intacta y lo organico ocurre en las casillas inutiles.
// ─────────────────────────────────────────────────────────────────────────────

const hash2 = (x: number, y: number, seed: number): number => {
  let h = (x * 374761393) ^ (y * 668265263) ^ (seed * 362437)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const smooth = (t: number) => t * t * (3 - 2 * t)
const mix = (a: number, b: number, t: number) => a + (b - a) * t

/** Ruido de valor interpolado: manchas suaves, no sal y pimienta. */
export function noise(x: number, y: number, scale: number, seed = 0): number {
  const gx = Math.floor(x / scale), gy = Math.floor(y / scale)
  const fx = smooth(x / scale - gx), fy = smooth(y / scale - gy)
  return mix(
    mix(hash2(gx, gy, seed), hash2(gx + 1, gy, seed), fx),
    mix(hash2(gx, gy + 1, seed), hash2(gx + 1, gy + 1, seed), fx),
    fy,
  )
}

/** Dos octavas: una da los lobulos grandes y la otra el mordisqueo del borde. */
export const fbm = (x: number, y: number, scale: number, seed = 0): number =>
  noise(x, y, scale, seed) * 0.68 + noise(x, y, scale / 3, seed + 11) * 0.32

/**
 * Distancia al pixel semilla mas cercano, por chamfer de dos pasadas.
 * Aproxima la euclidea con error de un 2 %, que para un borde dibujado a mano
 * alzada es de sobra.
 */
export interface Box { x0: number; y0: number; x1: number; y1: number }

export function distanceTo(seed: Uint8Array, w: number, h: number, box?: Box): Float32Array {
  const D = new Float32Array(w * h).fill(1e9)
  const D1 = 1, D2 = 1.4142
  for (let i = 0; i < seed.length; i++) if (seed[i]) D[i] = 0
  // Solo se barre el recuadro que interesa. Fuera de el no hay semillas y la
  // distancia es tan grande que ningun umbral la mira, asi que recorrerlo era
  // trabajo tirado: la grilla ocupa un tercio del mapa.
  const x0 = Math.max(0, box ? box.x0 : 0), y0 = Math.max(0, box ? box.y0 : 0)
  const x1 = Math.min(w - 1, box ? box.x1 : w - 1), y1 = Math.min(h - 1, box ? box.y1 : h - 1)
  const relax = (i: number, j: number, cost: number) => { if (D[j] + cost < D[i]) D[i] = D[j] + cost }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * w + x
    if (x > x0) relax(i, i - 1, D1)
    if (y > y0) relax(i, i - w, D1)
    if (x > x0 && y > y0) relax(i, i - w - 1, D2)
    if (x < x1 && y > y0) relax(i, i - w + 1, D2)
  }
  for (let y = y1; y >= y0; y--) for (let x = x1; x >= x0; x--) {
    const i = y * w + x
    if (x < x1) relax(i, i + 1, D1)
    if (y < y1) relax(i, i + w, D1)
    if (x < x1 && y < y1) relax(i, i + w + 1, D2)
    if (x > x0 && y < y1) relax(i, i + w - 1, D2)
  }
  return D
}

export interface Coast {
  w: number
  h: number
  land: Uint8Array
  /**
   * Distancia al limite entre tierra y agua, valida a los dos lados. Antes eran
   * dos campos -uno al agua y otro a la tierra-, que son dos transformadas de
   * distancia. Sembrando los pixeles del propio limite basta una: difiere de la
   * exacta en menos de un pixel, y los umbrales que la usan son el grosor del
   * filo y del halo, no medidas finas.
   */
  toEdge: Float32Array
  /**
   * Distancia a la casilla construible mas cercana; 0 dentro de una. Permite
   * pintar distinto la tierra que el ruido hizo crecer fuera de la grilla: sin
   * eso se ve igual que la construible y promete un sitio donde no se puede
   * construir.
   */
  toGrid: Float32Array
}

/**
 * Construye la costa a partir de los rectangulos construibles.
 * `grow` es cuanto avanza la tierra hacia las casillas inutiles: un minimo fijo
 * mas un termino de ruido, que es lo que produce los entrantes y salientes.
 */
export function buildCoast(
  cells: Array<[number, number]>,
  unit: number,
  w: number,
  h: number,
  { base = 7, amplitude = 22, scale = 46, seed = 1 } = {},
): Coast {
  const grid = new Uint8Array(w * h)
  for (const [cx, cy] of cells) {
    for (let y = cy * unit; y < (cy + 1) * unit; y++) {
      for (let x = cx * unit; x < (cx + 1) * unit; x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) grid[y * w + x] = 1
      }
    }
  }
  // Recuadro de trabajo: la grilla mas todo lo que la tierra puede crecer.
  const reach = base + amplitude
  const xs = cells.map(([cx]) => cx), ys = cells.map(([, cy]) => cy)
  const pad = Math.ceil(reach) + 4
  const box: Box = {
    x0: Math.min(...xs) * unit - pad, y0: Math.min(...ys) * unit - pad,
    x1: (Math.max(...xs) + 1) * unit + pad, y1: (Math.max(...ys) + 1) * unit + pad,
  }
  const toGrid = distanceTo(grid, w, h, box)

  // El ruido solo decide dentro de la franja donde la respuesta esta en duda.
  // Por debajo de `base` es tierra seguro y por encima del maximo es agua
  // seguro, asi que la mayor parte del mapa no necesita evaluarlo.
  const land = new Uint8Array(w * h)
  for (let y = Math.max(0, box.y0); y <= Math.min(h - 1, box.y1); y++)
  for (let x = Math.max(0, box.x0); x <= Math.min(w - 1, box.x1); x++) {
    const i = y * w + x
    const d = toGrid[i]
    if (grid[i] || d < base) { land[i] = 1; continue }
    if (d >= reach) continue
    // La casilla construible es tierra si o si; el ruido solo crece hacia fuera.
    land[i] = d < base + amplitude * fbm(x, y, scale, seed) ? 1 : 0
  }

  // Limite: los pixeles que tocan el otro medio, por los cuatro lados.
  const edge = new Uint8Array(w * h)
  for (let y = Math.max(1, box.y0); y <= Math.min(h - 2, box.y1); y++)
  for (let x = Math.max(1, box.x0); x <= Math.min(w - 2, box.x1); x++) {
    const i = y * w + x
    const here = land[i]
    if (land[i - 1] !== here || land[i + 1] !== here || land[i - w] !== here || land[i + w] !== here) edge[i] = 1
  }
  return { w, h, land, toEdge: distanceTo(edge, w, h, box), toGrid }
}

/** Una costa por sector: calcularla cuesta medio millon de pixeles. */
const cache = new Map<string, Coast>()

export function coastFor(
  key: string,
  cells: Array<[number, number]>,
  unit: number,
  w: number,
  h: number,
  options?: Parameters<typeof buildCoast>[4],
): Coast {
  const id = `${key}:${w}x${h}:${cells.length}`
  let coast = cache.get(id)
  if (!coast) { coast = buildCoast(cells, unit, w, h, options); cache.set(id, coast) }
  return coast
}
