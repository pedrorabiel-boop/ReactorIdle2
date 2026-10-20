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
export function distanceTo(seed: Uint8Array, w: number, h: number): Float32Array {
  const D = new Float32Array(w * h).fill(1e9)
  const D1 = 1, D2 = 1.4142
  for (let i = 0; i < seed.length; i++) if (seed[i]) D[i] = 0
  const relax = (i: number, j: number, cost: number) => { if (D[j] + cost < D[i]) D[i] = D[j] + cost }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x
    if (x > 0) relax(i, i - 1, D1)
    if (y > 0) relax(i, i - w, D1)
    if (x > 0 && y > 0) relax(i, i - w - 1, D2)
    if (x < w - 1 && y > 0) relax(i, i - w + 1, D2)
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x
    if (x < w - 1) relax(i, i + 1, D1)
    if (y < h - 1) relax(i, i + w, D1)
    if (x < w - 1 && y < h - 1) relax(i, i + w + 1, D2)
    if (x > 0 && y < h - 1) relax(i, i + w - 1, D2)
  }
  return D
}

export interface Coast {
  w: number
  h: number
  land: Uint8Array
  /** Para pixeles de tierra: distancia al agua. */
  toWater: Float32Array
  /** Para pixeles de agua: distancia a la tierra. */
  toLand: Float32Array
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
  const toGrid = distanceTo(grid, w, h)

  const land = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x
    // La casilla construible es tierra si o si; el ruido solo crece hacia fuera.
    land[i] = grid[i] || toGrid[i] < base + amplitude * fbm(x, y, scale, seed) ? 1 : 0
  }

  const water = new Uint8Array(w * h)
  for (let i = 0; i < land.length; i++) water[i] = land[i] ? 0 : 1
  return { w, h, land, toWater: distanceTo(water, w, h), toLand: distanceTo(land, w, h) }
}
