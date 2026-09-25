import { TECHNOLOGIES } from '../../game/balance'
import { COMPONENTS } from '../../game/catalog'
import { isComponentUnlocked } from '../../game/engine'
import { componentCapacity, componentMultiplier, conversionRate, coolingRate, directEnergyRate, fuelCapacity, productionRate, researchPerFacility, salesPerOffice, storagePerBattery, thermalResistance, thermalTransferRate } from '../../game/research'
import type { ComponentKind, GameState } from '../../game/types'
import { formatDecimal, formatShort } from '../format'
import { Sprite } from '../pixel/Sprite'
import { Sheet } from '../Sheet'

const CATEGORIES: Array<{ title: string; description: string; kinds: ComponentKind[] }> = [
  { title: 'Energía directa', description: 'Generan energía sin producir calor. Son el punto de partida de tu red nacional.', kinds: ['wind', 'solar'] },
  { title: 'Energía térmica', description: 'Generan calor durante su vida útil. Necesitan una red capaz de transportarlo y convertirlo.', kinds: ['core', 'thorium', 'fusion'] },
  { title: 'Torres de conversión', description: 'Reciben calor y lo transforman en energía. No retransmiten el calor hacia otras torres.', kinds: ['generator', 'generator2'] },
  { title: 'Tuberías', description: 'Conectan las fuentes térmicas con las turbinas y determinan cómo fluye el calor por la planta.', kinds: ['pipe', 'pipe2'] },
  { title: 'Control térmico', description: 'Almacenan, redistribuyen o disipan calor para estabilizar las redes más exigentes.', kinds: ['exchanger', 'accumulator', 'cooler'] },
  { title: 'Comercio e infraestructura', description: 'Almacenan y venden energía o amplifican la capacidad económica del mapa.', kinds: ['sales', 'sales2', 'battery', 'controller'] },
  { title: 'Investigación', description: 'Generan los puntos de investigación necesarios para acceder a tecnologías más avanzadas.', kinds: ['research', 'research2'] },
]

const MANUAL_DESCRIPTIONS: Record<ComponentKind, string> = {
  wind: 'Tecnología disponible desde el inicio. Produce energía directamente sin utilizar calor: una excelente puerta de entrada al desarrollo energético del país.',
  solar: 'El siguiente nivel de generación directa. Es más eficiente e intensa que la energía eólica y permite dar un salto importante en la escala de tu red.',
  core: 'Primer desarrollo energético basado en calor. Produce calor que debes llevar hasta turbinas generadoras para transformarlo en energía vendible.',
  thorium: 'Segunda fase de la generación térmica. Entrega mucho más calor que el núcleo térmico y exige una red cuidadosamente dimensionada.',
  fusion: 'Tercera fase de los generadores térmicos. La fusión alcanza niveles extraordinarios de calor; una red mal diseñada puede sobrecalentarse con rapidez.',
  generator: 'Tecnología básica de conversión. Recibe calor, transforma hasta su capacidad por tick y almacena solamente el excedente que no logra procesar.',
  generator2: 'Conversor avanzado capaz de procesar una demanda térmica muy superior. Es la contraparte natural de las redes y reactores de Fusión.',
  pipe: 'Conductor pasivo que crea un gradiente de temperatura desde el reactor hacia las turbinas. Diseña caminos adecuados para aprovechar mejor cada fuente.',
  pipe2: 'Más que una mejora de capacidad: forma redes presurizadas que extraen calor activamente y lo llevan hacia las turbinas que lo demandan. Rinde mejor junto a las fuentes más calientes.',
  exchanger: 'Nodo de distribución con mayor capacidad que una tubería convencional. Recibe, amortigua y redistribuye calor entre varios ramales de una red compleja.',
  accumulator: 'Gran depósito térmico que conserva el calor excedente para entregarlo nuevamente a la red. Ayuda a estabilizar diferencias entre producción y conversión.',
  cooler: 'Disipa el calor de las piezas adyacentes. Instálalo en puntos críticos para reducir la acumulación y evitar averías por sobrecalentamiento.',
  sales: 'Funcionarios dedicados a comercializar automáticamente la energía producida en su mapa antes de que el excedente llegue al banco energético.',
  sales2: 'Una oficina especializada con mayor potencial comercial. Permite vender automáticamente redes de energía mucho más productivas.',
  battery: 'Amplía el banco energético del mapa. Guarda la energía que no puede venderse en el momento y evita que una parte valiosa de la producción se desperdicie.',
  controller: 'Coordina la infraestructura empresarial del mapa. Cada unidad amplifica la capacidad de almacenamiento y la potencia de venta, hasta alcanzar su límite.',
  research: 'Instalación de investigación y desarrollo. Reúne especialistas que producen RP para descubrir reactores, turbinas e infraestructura más avanzada.',
  research2: 'Centro científico especializado y más productivo. Genera investigación a un ritmo acelerado para sostener la siguiente etapa tecnológica del país.',
}

const MANUAL_NAMES: Partial<Record<ComponentKind, string>> = {
  generator: 'Turbina generadora I',
  pipe: 'Tubería térmica I',
  sales: 'Oficina de ventas I',
  research: 'I+D',
}

const PRINCIPLES = [
  { title: 'ENERGÍA', icon: 'icon-bolt', text: 'Es el elemento fundamental del sistema. Se obtiene directamente de turbinas eólicas y paneles solares, o convirtiendo el calor de los reactores mediante turbinas generadoras. Necesitas oficinas de ventas o la venta manual para transformarla en dinero.' },
  { title: 'DINERO', icon: 'icon-coin', text: 'Se obtiene al vender energía manualmente o mediante oficinas de ventas. Es la moneda fundamental para ampliar tus redes, reconstruir torres y mejorar tus edificios.' },
  { title: 'INVESTIGACIÓN', icon: 'icon-flask', text: 'Reúne a los mejores investigadores del país. Sus RP permiten desarrollar edificios más avanzados e integrados, ampliar la potencia de tu red y acceder a nuevas tecnologías.' },
  { title: 'CALOR', icon: 'icon-flame', text: 'Lo producen el núcleo térmico y los reactores de Torio y Fusión. Distribúyelo mediante tuberías y aprovéchalo con turbinas. Si una torre supera su capacidad térmica, quedará averiada.' },
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
      <section className="manual-welcome frame">
        <strong>¡BIENVENIDO!</strong>
        <p>Has llegado a esta región como el nuevo encargado de Gestión Energética del Ministerio de Energía. Como eres un funcionario caracterizado por su eficiencia y probidad, harás un uso responsable y adecuado de los recursos públicos para desarrollar la energía a nivel nacional. ¡Los ciudadanos dependemos de ti!</p>
      </section>
      <section className="manual-principles">
        {PRINCIPLES.map((principle) => <article className="frame" key={principle.title}><span className="manual-principle-title"><Sprite name={principle.icon} size={18} /><strong>{principle.title}</strong></span><p>{principle.text}</p></article>)}
      </section>
      <h2 className="manual-types-title">TIPOS DE TORRES</h2>
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
                  <div><strong>{MANUAL_NAMES[kind] ?? definition.name}</strong><small>{definition.tech ? `${unlocked ? 'Desbloqueado' : 'Requiere'} · ${TECHNOLOGIES[definition.tech].name}` : 'Disponible desde el inicio'}</small></div>
                </div>
                <p>{MANUAL_DESCRIPTIONS[kind]}</p>
                <div className="manual-stats">{stats(game, kind).map((value) => <span key={value}>{value}</span>)}</div>
              </article>
            })}
          </div>
        </section>
      ))}
    </Sheet>
  )
}
