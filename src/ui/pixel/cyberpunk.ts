import type { Environment } from './sprites'
import { PROP_COLORS } from './props'

/**
 * Pantano neón manglar: la estética del Distrito Neón.
 *
 * Las ocho ranuras de terreno siguen siendo las mismas, así que el cambio de
 * ambiente se mantiene por variables CSS. Lo que cambia es qué significa cada
 * una cuando el terreno se dibuja con costa orgánica: la 3, que en la isla
 * tropical es arena, aquí es el filo magenta, y la 7 su resplandor sobre el
 * agua.
 */
export const CYBERPUNK_ENVIRONMENT: Environment = {
  name: 'Pantano neón',
  terrain: {
    1: '#2c4733', // suelo
    2: '#35563c', // suelo iluminado
    3: '#ff5fc8', // filo neón
    4: '#0c1b24', // agua profunda
    5: '#16323c', // veta del agua
    6: '#21372a', // suelo en sombra
    7: '#a3387a', // resplandor del filo sobre el agua
    8: '#15303a', // halo del agua junto a la orilla
  },
  // Letras de los props del bioma: manglares, helechos, hongos.
  props: PROP_COLORS,
  recolor: { B: 'P', b: 'C', E: 'C', e: 'p', O: 'R', Y: 'C', R: 'P', r: 'p', T: 'D', t: 'G' },
  decoration: 'pylon',
  glow: 'rgba(255,95,200,.26)',
  // Cuánto avanza la tierra hacia las casillas inútiles: un mínimo fijo más un
  // término de ruido, que es lo que produce los entrantes y salientes.
  coast: {
    base: 7, amplitude: 22, scale: 46, seed: 1,
    // Un filo estrecho, no una playa: aquí la orilla es una línea de luz.
    land: [{ until: 3, slot: '3' }],
    water: [{ until: 2, slot: '7' }, { until: 5, slot: '8' }],
    ground: { light: '2', dark: '6', scale: 26, spread: 0.13 },
    open: { slot: '5', amount: 0.69, stretch: 0.28, sparkle: true },
  },
}
