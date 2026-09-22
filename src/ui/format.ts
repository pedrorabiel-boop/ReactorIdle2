const integer = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 })

export const formatNumber = (value: number) => integer.format(value)
export const formatDecimal = (value: number) => decimal.format(value)

/** 1.234 → "1.234", 12.345 → "12,3k", 1.234.567 → "1,23M". Pensado para el HUD. */
export function formatCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs < 10000) return integer.format(value)
  if (abs < 1_000_000) return `${decimal.format(value / 1000)}k`
  if (abs < 1_000_000_000) return `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(value / 1_000_000)}M`
  if (abs < 1_000_000_000_000) return `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(value / 1_000_000_000)}G`
  if (abs < 1_000_000_000_000_000) return `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(value / 1_000_000_000_000)}T`
  return `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(value / 1_000_000_000_000_000)}P`
}

export function formatRate(perMinute: number): string {
  const sign = perMinute > 0 ? '+' : perMinute < 0 ? '−' : ''
  return `${sign}${formatShort(Math.abs(perMinute))}/min`
}

/** Versión corta para etiquetas estrechas: 1.500 → "1,5k", 50.000 → "50k". */
export function formatShort(value: number): string {
  if (Math.abs(value) < 1000) return integer.format(value)
  if (Math.abs(value) < 1_000_000) return `${decimal.format(value / 1000)}k`
  return formatCompact(value)
}
