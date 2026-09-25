import type { Environment } from './sprites'

/** Paleta nocturna del Distrito Neón. Reutiliza los sprites funcionales y
 * desplaza sus acentos con moderación para conservar una lectura inmediata. */
export const CYBERPUNK_ENVIRONMENT: Environment = {
  name: 'Cyberpunk',
  terrain: {
    1: '#211d38',
    2: '#332957',
    3: '#c968b1',
    4: '#080b22',
    5: '#63a8b8',
    6: '#554c6d',
    7: '#73508c',
    8: '#63a8b8',
  },
  recolor: { B: 'P', b: 'C', E: 'C', e: 'p', O: 'R', Y: 'C', R: 'P', r: 'p', T: 'D', t: 'G' },
  decoration: 'pylon',
  glow: 'rgba(201,104,177,.26)',
}
