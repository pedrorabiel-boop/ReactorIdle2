/** Señales de juego que un paso puede esperar en vez de un botón «Siguiente». */
export type TutorialSignal = 'buildOpen' | 'windSelected' | 'windBuilt'

export type TutorialStepId =
  | 'welcome' | 'credits' | 'energy' | 'research' | 'openBuild'
  | 'cardName' | 'cardCost' | 'cardOutput' | 'cardLife'
  | 'pickCard' | 'place' | 'sell'

export interface TutorialStep {
  id: TutorialStepId
  /** Valor de `data-tour` del elemento señalado por la manito. */
  target?: string
  text: string
  /** Si está presente, el paso avanza con esa señal en vez de con el botón. */
  awaits?: TutorialSignal
  /** Rótulo del botón cuando el paso avanza manualmente. */
  button?: string
  /** Muestra la ficha ampliada de la turbina eólica. */
  zoom?: boolean
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { id: 'welcome', text: '', button: 'Comenzar' },
  { id: 'credits', target: 'hud-credits', text: 'Este es tu dinero. Lo ganas vendiendo la energía que produces y lo gastas en construir y mantener la planta.', button: 'Siguiente' },
  { id: 'energy', target: 'hud-energy', text: 'Esta es tu energía almacenada y su capacidad máxima. Si el depósito se llena, la producción sobrante se pierde.', button: 'Siguiente' },
  { id: 'research', target: 'hud-research', text: 'Estos son tus puntos de investigación. Se generan en las instalaciones de I+D y desbloquean nuevas tecnologías.', button: 'Siguiente' },
  { id: 'openBuild', target: 'tab-build', text: 'Toca aquí para construir una turbina eólica.', awaits: 'buildOpen' },
  { id: 'cardName', target: 'zoom-name', text: 'Esta es la turbina eólica, tu primera fuente de energía.', button: 'Siguiente', zoom: true },
  { id: 'cardCost', target: 'zoom-cost', text: 'Este es su precio: lo que se descuenta de tu dinero al construirla.', button: 'Siguiente', zoom: true },
  { id: 'cardOutput', target: 'zoom-output', text: 'Esta es su productividad: la energía que aporta cada segundo.', button: 'Siguiente', zoom: true },
  { id: 'cardLife', target: 'zoom-life', text: 'Esta es su vida útil. Cuando se agota, la turbina deja de producir hasta que la reconstruyas.', button: 'Siguiente', zoom: true },
  { id: 'pickCard', target: 'card-wind', text: 'Toca la turbina eólica para elegirla.', awaits: 'windSelected' },
  { id: 'place', target: 'first-cell', text: 'Ahora toca la casilla marcada para levantarla.', awaits: 'windBuilt' },
  { id: 'sell', target: 'hud-sell', text: 'Este botón se encarga de transformar tu energía almacenada en ganancias. ¡No dejes que se acumule la energía!', button: 'Finalizar' },
]
