import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createInitialState, placeTile } from '../../game/engine'
import { isPristineGame } from '../../game/tutorial'
import { Tutorial, type TutorialProgress } from './Tutorial'
import { TUTORIAL_STEPS } from './steps'

const IDLE: TutorialProgress = { buildOpen: false, windSelected: false, windBuilt: false }
const step = (id: string) => TUTORIAL_STEPS.find((candidate) => candidate.id === id)!
const render = (id: string) => renderToStaticMarkup(
  <Tutorial step={step(id)} game={createInitialState()} progress={IDLE} onNext={() => undefined} onFinish={() => undefined} />,
)

describe('secuencia de inicio', () => {
  it('solo considera virgen una partida sin construir, producir ni vender', () => {
    const fresh = createInitialState()
    expect(isPristineGame(fresh)).toBe(true)
    expect(isPristineGame(placeTile(fresh, 11, 'wind'))).toBe(false)
    expect(isPristineGame({ ...fresh, tick: 1 })).toBe(false)
    expect(isPristineGame({ ...fresh, totalCreditsEarned: 1 })).toBe(false)
  })

  it('recorre bienvenida, los tres recursos, la ficha de la eólica y la venta', () => {
    expect(TUTORIAL_STEPS.map((entry) => entry.id)).toEqual([
      'welcome', 'credits', 'energy', 'research', 'openBuild',
      'cardName', 'cardCost', 'cardOutput', 'cardLife',
      'pickCard', 'place', 'sell',
    ])
  })

  it('espera una acción del jugador en vez de un botón al abrir, elegir y construir', () => {
    for (const id of ['openBuild', 'pickCard', 'place']) {
      expect(step(id).awaits).toBeDefined()
      expect(step(id).button).toBeUndefined()
    }
    for (const id of ['credits', 'energy', 'research', 'cardCost', 'sell']) {
      expect(step(id).button).toBeDefined()
      expect(step(id).awaits).toBeUndefined()
    }
  })

  it('abre con el mismo texto de bienvenida del manual', () => {
    const markup = render('welcome')
    expect(markup).toContain('¡BIENVENIDO!')
    expect(markup).toContain('Ministerio de Energía')
    expect(markup).toContain('Comenzar')
  })

  it('despliega la ficha ampliada con precio, productividad y vida útil', () => {
    const markup = render('cardOutput')
    expect(markup).toContain('data-tour="zoom-card"')
    for (const label of ['Precio', 'Productividad', 'Vida útil']) expect(markup).toContain(label)
    // El dato explicado en este paso es el único resaltado.
    expect(markup.match(/tour-card-row on/g)).toHaveLength(1)
    expect(markup).toContain('0,2 E/s')
  })

  it('tapa el resto de la interfaz en todos los pasos', () => {
    for (const entry of TUTORIAL_STEPS) {
      const markup = renderToStaticMarkup(
        <Tutorial step={entry} game={createInitialState()} progress={IDLE} onNext={() => undefined} onFinish={() => undefined} />,
      )
      // La bienvenida usa su propio fondo modal; el resto, la capa de bloqueo.
      expect(markup.includes('tour-block') || markup.includes('tour-backdrop')).toBe(true)
    }
  })

  it('no muestra la ficha ampliada fuera de esos pasos', () => {
    expect(render('sell')).not.toContain('tour-card')
    expect(render('sell')).toContain('Finalizar')
  })
})
