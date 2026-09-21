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
