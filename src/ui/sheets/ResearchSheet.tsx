import { useState } from 'react'
import { LIFETIME_ORDER, TECH_ORDER, TECHNOLOGIES } from '../../game/balance'
import { COMPONENTS } from '../../game/catalog'
import { pendingAutoRebuilds, pendingTechs } from '../../game/engine'
import { autoRebuildCost, canUnlockAutoRebuild, canUnlockTech } from '../../game/research'
import type { ComponentKind, GameState, TechKey } from '../../game/types'
import { formatDecimal, formatNumber } from '../format'
import { Sprite } from '../pixel/Sprite'
import { Sheet } from '../Sheet'

interface Props { game: GameState; onClose: () => void; onResearch: (key: TechKey) => void; onAutoRebuild: (kind: ComponentKind) => void }

const techIcon = (key: TechKey) => key === 'solar' ? 'solar' : key === 'thorium' ? 'thorium' : key === 'fusion' ? 'fusion' : 'icon-flask'

interface CardProps {
  id: string
  icon: string
  title: string
  description: string
  cost: number
  affordable: boolean
  open: boolean
  onToggleInfo: (id: string) => void
  onBuy: () => void
}

/** Icono · (título sobre el botón) · información. El precio vive solo en el botón. */
function ResearchCard({ id, icon, title, description, cost, affordable, open, onToggleInfo, onBuy }: CardProps) {
  return <article className="upgrade frame">
    <span className="upgrade-icon frame"><Sprite name={icon} size={28} /></span>
    <div className="upgrade-main">
      <strong>{title}</strong>
      <button className="btn frame gold" disabled={!affordable} onClick={onBuy}>{formatNumber(cost)} RP</button>
    </div>
    <button
      type="button"
      className={`upgrade-info frame ${open ? 'on' : ''}`}
      aria-expanded={open}
      aria-label={`${open ? 'Ocultar' : 'Ver'} la descripción de ${title}`}
      onClick={() => onToggleInfo(id)}
    ><Sprite name="icon-info" size={16} /></button>
    {open && <p className="upgrade-note">{description}</p>}
  </article>
}

export function ResearchSheet({ game, onClose, onResearch, onAutoRebuild }: Props) {
  // El laboratorio solo enseña lo que se puede comprar ahora: ni lo ya
  // investigado, ni los escalones que todavía no tienen su requisito.
  const techs = pendingTechs(game)
  const licences = pendingAutoRebuilds(game)
  const [openInfo, setOpenInfo] = useState<string | null>(null)
  const toggleInfo = (id: string) => setOpenInfo((current) => current === id ? null : id)

  const doneTechs = TECH_ORDER.filter((key) => game.unlockedTechs[key]).length
  const doneLicences = LIFETIME_ORDER.filter((kind) => game.autoRebuilds[kind]).length

  return <Sheet title="Laboratorio" eyebrow="SIGUIENTE PASO" onClose={onClose} className="lab">
    <div className="balance frame"><Sprite name="icon-flask" size={22} /><div><strong>{formatDecimal(game.researchPoints)} RP</strong><small>Solo las instalaciones de I+D generan RP.</small></div></div>

    <p className="research-progress">{doneTechs} de {TECH_ORDER.length} tecnologías · {doneLicences} de {LIFETIME_ORDER.length} licencias</p>

    {techs.length > 0 && <>
      <h3 className="research-section-title">Tecnologías</h3>
      <div className="upgrades">{techs.map((key) => <ResearchCard
        key={key}
        id={`tech-${key}`}
        icon={techIcon(key)}
        title={TECHNOLOGIES[key].name}
        description={TECHNOLOGIES[key].description}
        cost={TECHNOLOGIES[key].cost}
        affordable={canUnlockTech(game, key)}
        open={openInfo === `tech-${key}`}
        onToggleInfo={toggleInfo}
        onBuy={() => onResearch(key)}
      />)}</div>
    </>}

    {licences.length > 0 && <>
      <h3 className="research-section-title">Auto rebuild</h3>
      <div className="upgrades">{licences.map((kind) => <ResearchCard
        key={kind}
        id={`licence-${kind}`}
        icon={kind}
        title={`Auto rebuild · ${COMPONENTS[kind].shortName}`}
        description="Reconstruye las unidades caducadas de este tipo cuando haya créditos, por el costo completo del edificio."
        cost={autoRebuildCost(game, kind)}
        affordable={canUnlockAutoRebuild(game, kind)}
        open={openInfo === `licence-${kind}`}
        onToggleInfo={toggleInfo}
        onBuy={() => onAutoRebuild(kind)}
      />)}</div>
    </>}

    {techs.length === 0 && licences.length === 0
      && <p className="hint upgrades-empty">No queda nada por investigar aquí. Lo siguiente se abrirá cuando desbloquees nuevas torres.</p>}
  </Sheet>
}
