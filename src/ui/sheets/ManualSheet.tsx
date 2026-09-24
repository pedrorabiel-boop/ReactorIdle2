import { TECHNOLOGIES } from '../../game/balance'
import { COMPONENTS } from '../../game/catalog'
import { isComponentUnlocked } from '../../game/engine'
import { componentCapacity, componentMultiplier, conversionRate, coolingRate, directEnergyRate, fuelCapacity, productionRate, researchPerFacility, salesPerOffice, storagePerBattery, thermalResistance, thermalTransferRate } from '../../game/research'
import type { ComponentKind, GameState } from '../../game/types'
import { formatDecimal, formatShort } from '../format'
import { Sprite } from '../pixel/Sprite'
import { Sheet } from '../Sheet'

const CATEGORIES: Array<{ title: string; description: string; kinds: ComponentKind[] }> = [
  { title: 'Energía renovable', description: 'Produce energía directamente. No usa calor, pero sus equipos tienen vida útil.', kinds: ['wind', 'solar'] },
  { title: 'Fuentes térmicas', description: 'Consumen autonomía y generan calor. Necesitan turbinas para convertirlo en energía.', kinds: ['core', 'thorium', 'fusion'] },
  { title: 'Conversión y red térmica', description: 'Transporta, almacena, convierte o elimina calor dentro de la grilla.', kinds: ['generator', 'generator2', 'pipe', 'pipe2', 'exchanger', 'accumulator', 'cooler'] },
  { title: 'Empresa e infraestructura', description: 'Almacena y vende energía, genera RP o amplifica la red comercial.', kinds: ['sales', 'sales2', 'battery', 'research', 'research2', 'controller'] },
]
const formatStat = (value: number) => Math.abs(value) < 10 ? formatDecimal(value) : formatShort(value)

function stats(game: GameState, kind: ComponentKind): string[] {
  const definition = COMPONENTS[kind]
  const values: string[] = [`Costo ₡${formatShort(definition.cost)}`]
  if (definition.directEnergy) values.push(`${formatStat(directEnergyRate(game, kind))} E/s`)
  if (definition.production) values.push(`${formatStat(productionRate(game, kind))} calor/s`)
  if (definition.conversionRate) values.push(`${formatStat(conversionRate(game, kind as 'generator' | 'generator2'))} E/s`)
  if (definition.referenceTransferRate) values.push(`${kind === 'pipe2' ? 'Bombeo' : 'Caudal ref.'} ${formatStat(thermalTransferRate(game, kind))}/s`)
  if (definition.coolingRate) values.push(`Disipa ${formatStat(coolingRate(game))}/s`)
  if (definition.storageCapacity) values.push(`+${formatStat(storagePerBattery(game))} E`)
  if (definition.salesRate) values.push(`Vende ${formatStat(salesPerOffice(game, kind as 'sales' | 'sales2'))} E/s`)
  if (definition.researchRate) values.push(`${formatStat(researchPerFacility(game, kind as 'research' | 'research2'))} RP/s`)
  if (definition.controllerBonus) values.push(`+${formatDecimal(definition.controllerBonus * componentMultiplier(game, kind) * 100)}% red`)
  if (definition.capacity > 0) values.push(`Máx. ${formatShort(componentCapacity(game, kind))} calor`)
  if (definition.thermalResistance && kind !== 'pipe2') values.push(`${formatDecimal(thermalResistance(game, kind))} R`)
  if (definition.fuelCycles) values.push(`${formatShort(fuelCapacity(game, kind))} s de vida`)
  return values
}

export function ManualSheet({ game, onClose }: { game: GameState; onClose: () => void }) {
  return (
    <Sheet title="Manual" eyebrow="GUÍA DE LA PLANTA" onClose={onClose} className="manual-sheet">
      <section className="manual-principles">
        <article className="frame"><strong>ENERGÍA</strong><p>La producción entra al banco del mapa. Véndela manualmente o instala oficinas para venderla cada tick.</p></article>
        <article className="frame"><strong>CALOR</strong><p>Los reactores producen calor local. Las turbinas lo convierten; si una pieza supera su capacidad queda averiada.</p></article>
        <article className="frame"><strong>TUBERÍA II</strong><p>Su red presurizada extrae primero desde el mayor potencial térmico y bombea solo cuando una turbina conectada demanda calor.</p></article>
      </section>
      {CATEGORIES.map((category) => (
        <section className="manual-category" key={category.title}>
          <h3>{category.title}</h3>
          <p>{category.description}</p>
          <div className="manual-list">
            {category.kinds.map((kind) => {
              const definition = COMPONENTS[kind]
              const unlocked = isComponentUnlocked(game, kind)
              return <article className={`manual-entry frame ${unlocked ? '' : 'locked'}`} key={kind}>
                <div className="manual-entry-head">
                  <span className="manual-sprite frame"><Sprite name={kind} size={32} /></span>
                  <div><strong>{definition.name}</strong><small>{definition.tech ? `${unlocked ? 'Desbloqueado' : 'Requiere'} · ${TECHNOLOGIES[definition.tech].name}` : 'Disponible desde el inicio'}</small></div>
                </div>
                <p>{definition.description}</p>
                <div className="manual-stats">{stats(game, kind).map((value) => <span key={value}>{value}</span>)}</div>
              </article>
            })}
          </div>
        </section>
      ))}
    </Sheet>
  )
}
