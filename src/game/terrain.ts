// Isla inicial: 36 celdas conectadas en una silueta asimétrica dentro de la
// matriz 10×8. Mantener los índices aquí permite migrar partidas sin perder
// edificios y compartir la misma regla entre motor y presentación.
export const COAST_BUILDABLE_INDICES = [
  11, 12,
  18, 19, 20, 21,
  25, 26, 27, 28, 29, 30,
  32, 33, 34, 35, 36, 37, 38,
  41, 42, 43, 44, 45, 46, 47,
  49, 50, 51, 52, 53, 54,
  58, 59, 60, 61,
] as const

export const COAST_BUILDABLE_SET = new Set<number>(COAST_BUILDABLE_INDICES)

// Distrito Neón: 72 celdas (el doble de la costa inicial) separadas por una
// franja completa de agua. La presentación distribuye las 48 celdas principales
// y las 24 secundarias en dos siluetas construibles escalonadas y no rectangulares.
export const CYBERPUNK_BUILDABLE_INDICES = [
  0, 1, 2, 3, 4, 5, 6, 7,
  8, 9, 10, 11, 12, 13, 14, 15,
  16, 17, 18, 19, 20, 21, 22, 23,
  24, 25, 26, 27, 28, 29, 30, 31,
  32, 33, 34, 35, 36, 37, 38, 39,
  40, 41, 42, 43, 44, 45, 46, 47,
  56, 57, 58, 59, 60, 61, 62, 63,
  64, 65, 66, 67, 68, 69, 70, 71,
  72, 73, 74, 75, 76, 77, 78, 79,
] as const

export const CYBERPUNK_BUILDABLE_SET = new Set<number>(CYBERPUNK_BUILDABLE_INDICES)
