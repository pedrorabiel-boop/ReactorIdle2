import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../game/engine'
import { ManualSheet } from './ManualSheet'

describe('ManualSheet', () => {
  it('presents the national energy brief, the four resources and every building', () => {
    const markup = renderToStaticMarkup(<ManualSheet game={createInitialState()} onClose={() => undefined} />)

    expect(markup).toContain('Ministerio de Energía')
    for (const resource of ['ENERGÍA', 'DINERO', 'INVESTIGACIÓN', 'CALOR']) expect(markup).toContain(resource)
    for (const tower of ['Turbina eólica', 'Panel solar', 'Núcleo térmico', 'Reactor de torio', 'Reactor de fusión', 'Turbina generadora II', 'Tubería térmica II', 'Intercambiador', 'Acumulador térmico', 'Torre de enfriamiento', 'Oficina de ventas II', 'Batería de red', 'Controlador de red', 'Centro de investigación II']) expect(markup).toContain(tower)
    for (const tierOneName of ['Turbina generadora I', 'Tubería térmica I', 'Oficina de ventas I', '>I+D<']) expect(markup).toContain(tierOneName)
    expect(markup.match(/class="manual-entry frame/g)).toHaveLength(18)
  })
})
