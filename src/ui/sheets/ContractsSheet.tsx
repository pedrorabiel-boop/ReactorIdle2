import type { GameState } from '../../game/types'
import { formatDecimal, formatNumber } from '../format'
import { Sprite } from '../pixel/Sprite'
import { Sheet } from '../Sheet'

export interface MissionStep {
  label: string
  done: boolean
}

interface ContractsSheetProps {
  game: GameState
  missions: MissionStep[]
  missionHint: string
  onClose: () => void
  onClaim: () => void
}

const KIND_LABEL = { renewable: 'RENOVABLE', thermal: 'TÉRMICO', energy: 'GENERAL', sales: 'VENTAS', research: 'I+D' } as const

export function ContractsSheet({ game, missions, missionHint, onClose, onClaim }: ContractsSheetProps) {
  const contract = game.activeContract
  const complete = contract.progress >= contract.target
  const progress = Math.min(100, (contract.progress / contract.target) * 100)
  const missionsDone = missions.filter((step) => step.done).length

  return (
    <Sheet title="Contratos" eyebrow={`CONTRATO #${game.contractsCompleted + 1}`} onClose={onClose} className="contracts">
      <article className={`contract frame ${complete ? 'complete' : ''}`}>
        <div className="contract-head"><strong>{contract.title}</strong><span className="tag">{KIND_LABEL[contract.kind]}</span></div>
        <p>{contract.description}</p>
        <div className="bar contract-bar" role="progressbar" aria-valuemin={0} aria-valuemax={contract.target} aria-valuenow={contract.progress}><i style={{ width: `${progress}%` }} /></div>
        <div className="contract-values">
          <span>{formatNumber(contract.progress)} / {formatNumber(contract.target)} MW</span>
          <span><Sprite name="icon-coin" size={10} />{formatNumber(contract.rewardCredits)} · <Sprite name="icon-flask" size={10} />{formatDecimal(contract.rewardResearch)}</span>
        </div>
        <button className="btn frame gold wide" disabled={!complete} onClick={onClaim}>{complete ? 'Reclamar recompensa' : 'En progreso…'}</button>
      </article>

      <section className="missions">
        <div className="missions-head">
          <strong>Protocolo de arranque</strong>
          <span>{missionsDone}/{missions.length}</span>
        </div>
        <div className="bar mission-bar" role="progressbar" aria-valuemin={0} aria-valuemax={missions.length} aria-valuenow={missionsDone}><i style={{ width: `${(missionsDone / missions.length) * 100}%` }} /></div>
        <p className="hint">{missionHint}</p>
        <ol>
          {missions.map((step, index) => (
            <li key={step.label} className={step.done ? 'done' : ''}><span>{step.done ? '✓' : index + 1}</span>{step.label}</li>
          ))}
        </ol>
      </section>
    </Sheet>
  )
}
