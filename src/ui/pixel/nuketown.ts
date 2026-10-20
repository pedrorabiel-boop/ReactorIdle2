import type { Environment } from './sprites'
import { NUKETOWN_COLORS } from './props'

/**
 * Desierto Nuketown: la estética del Nuclear Test Site.
 *
 * Este sector no es una isla. Lo que en los otros dos biomas es agua, aquí es
 * la roca del fondo, y lo que allí es orilla es el reborde de grava donde el
 * campo despejado se deshace. Las ocho ranuras significan otra cosa, pero el
 * reparto es el mismo y por eso la misma maquinaria sirve.
 *
 * La regla que el sector ya traía escrita —la arena limpia significa siempre
 * suelo construible— es justo la que ahora cumplen los tres biomas.
 */
export const NUKETOWN_ENVIRONMENT: Environment = {
  name: 'Nuketown',
  terrain: {
    1: '#d9c49a', // tierra del campo limpio
    2: '#e6d4ad', // tierra iluminada
    3: '#8f7550', // grava del reborde
    4: '#3a2c22', // roca del fondo
    5: '#4a3a2c', // veta de la roca
    6: '#c2a87e', // tierra en sombra
    7: '#6f5a3c', // grava oscura
    8: '#5a4a33', // polvo contra la roca
    // Tierra removida de fuera de la grilla: el campo limpio es lo construible.
    9: '#ab8f62',
  },
  props: NUKETOWN_COLORS,
  recolor: { E: 'O', e: 'Y', g: 'T', B: 'T', b: 't', C: 'c' },
  decoration: 'cactus',
  glow: 'rgba(255,214,120,.28)',
  coast: {
    base: 6, amplitude: 18, scale: 40, seed: 7,
    land: [{ until: 4, slot: '7' }, { until: 10, slot: '3' }],
    water: [{ until: 3, slot: '8' }, { until: 9, slot: '5' }],
    outside: '9',
    // Tierra agrietada: moteado marcado, nada de verde plano.
    ground: { light: '2', dark: '6', scale: 22, spread: 0.1 },
  },
}
