import type { Environment } from './sprites'
import { CORAL_COLORS } from './props'

/**
 * Isla coral: la estética de la Costa.
 *
 * Las ocho ranuras de terreno se reparten la playa, que es lo que distingue a
 * este bioma del pantano. Allí la orilla es una línea de luz de tres píxeles;
 * aquí hay cuatro franjas antes de llegar al mar abierto —arena mojada, arena
 * seca, espuma y bajo— y eso es la mitad de la lectura de una playa tropical.
 */
export const CORAL_ENVIRONMENT: Environment = {
  name: 'Isla coral',
  terrain: {
    1: '#5ec23a', // hierba
    2: '#74d94e', // hierba iluminada
    3: '#f6e9c4', // arena seca
    4: '#1fa8d8', // mar abierto
    5: '#49d8e8', // bajo turquesa
    6: '#49a233', // hierba en sombra
    7: '#e3d0a0', // arena mojada, junto al agua
    8: '#eafaff', // espuma
  },
  // Letras de los props del bioma: arrecifes, palmeras, peces.
  props: CORAL_COLORS,
  recolor: {},
  decoration: 'tree',
  glow: 'rgba(255,255,255,0)',
  coast: {
    base: 7, amplitude: 20, scale: 42, seed: 4,
    // Playa ancha: la arena es el rasgo del bioma, no un canto.
    land: [{ until: 3, slot: '7' }, { until: 9, slot: '3' }],
    water: [{ until: 2, slot: '8' }, { until: 11, slot: '5' }],
    // Fuera de la grilla, arena: la hierba queda reservada a lo construible.
    outside: '3',
    // Apenas moteado: aquí el verde plano es parte de la lectura.
    ground: { light: '2', dark: '6', scale: 30, spread: 0.2 },
  },
}
