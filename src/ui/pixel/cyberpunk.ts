import type { Environment } from './sprites'

/** Paleta nocturna del Distrito Neón. Reutiliza los sprites funcionales y
 * desplaza sus acentos con moderación para conservar una lectura inmediata. */
export const CYBERPUNK_ENVIRONMENT: Environment = {
  name: 'Cyberpunk',
  terrain: {
    1: '#211d38',
    2: '#332957',
    3: '#ff4fd8',
    4: '#080b22',
    5: '#20dff3',
    6: '#51447d',
    7: '#8b32d8',
  },
  recolor: { B: 'P', b: 'C', E: 'C', e: 'p', O: 'R', Y: 'C', R: 'P', r: 'p', T: 'D', t: 'G' },
  decoration: 'pylon',
  glow: 'rgba(255,79,216,.42)',
}
