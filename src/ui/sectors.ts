import type { SectorKey } from '../game/types'

/** Nombre de cada región. Fuente única: ya se nos escapó una hoja con el nombre equivocado. */
export const SECTOR_LABELS: Record<SectorKey, { code: string; name: string }> = {
  coast: { code: 'A-01', name: 'Costa' },
  desert: { code: 'B-02', name: 'Distrito Neón' },
  testsite: { code: 'C-03', name: 'Nuclear Test Site' },
}

export const sectorLabel = (sector: SectorKey) => `${SECTOR_LABELS[sector].code} ${SECTOR_LABELS[sector].name}`
