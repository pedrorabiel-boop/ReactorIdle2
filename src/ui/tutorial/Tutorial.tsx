import { useEffect, useState } from 'react'
import { COMPONENTS } from '../../game/catalog'
import { directEnergyRate, fuelCapacity } from '../../game/research'
import type { GameState } from '../../game/types'
import { formatDecimal, formatNumber, formatShort } from '../format'
import { Sprite } from '../pixel/Sprite'
import { WELCOME_TEXT, WELCOME_TITLE } from '../welcome'
import type { TutorialSignal, TutorialStep } from './steps'

export interface TutorialProgress extends Record<TutorialSignal, boolean> {
  buildOpen: boolean
  windSelected: boolean
  windBuilt: boolean
}

interface TutorialProps {
  step: TutorialStep
  game: GameState
  progress: TutorialProgress
  onNext: () => void
  onFinish: () => void
}

interface Box { top: number; left: number; width: number; height: number }

const BUBBLE_WIDTH = 280
const GAP = 14
const HAND = 34

/** Sigue al elemento marcado con `data-tour` mientras el paso está activo. */
function useTargetBox(target: string | undefined): Box | null {
  const [box, setBox] = useState<Box | null>(null)
  useEffect(() => {
    if (!target) {
      setBox(null)
      return
    }
    let frame = 0
    let previous = ''
    const measure = () => {
      const element = document.querySelector<HTMLElement>(`[data-tour="${target}"]`)
      if (element) {
        const rect = element.getBoundingClientRect()
        const key = `${Math.round(rect.top)}|${Math.round(rect.left)}|${Math.round(rect.width)}|${Math.round(rect.height)}`
        if (key !== previous) {
          previous = key
          setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
        }
      } else if (previous !== '') {
        previous = ''
        setBox(null)
      }
      frame = requestAnimationFrame(measure)
    }
    frame = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(frame)
  }, [target])
  return box
}

/** Ficha ampliada de la turbina eólica: cada dato se puede señalar por separado. */
function WindCard({ game, highlight }: { game: GameState; highlight?: string }) {
  const definition = COMPONENTS.wind
  const rows = [
    { tour: 'zoom-cost', icon: 'icon-coin', label: 'Precio', value: formatNumber(definition.cost) },
    { tour: 'zoom-output', icon: 'icon-bolt', label: 'Productividad', value: `${formatDecimal(directEnergyRate(game, 'wind'))} E/s` },
    { tour: 'zoom-life', icon: 'icon-clock', label: 'Vida útil', value: `${formatShort(fuelCapacity(game, 'wind'))} s` },
  ]
  return (
    <div className="tour-card frame" data-tour="zoom-card" role="presentation">
      <div className={`tour-card-head ${highlight === 'zoom-name' ? 'on' : ''}`} data-tour="zoom-name">
        <Sprite name="wind" size={64} />
        <strong>{definition.name}</strong>
      </div>
      {rows.map((row) => (
        <div className={`tour-card-row ${highlight === row.tour ? 'on' : ''}`} data-tour={row.tour} key={row.tour}>
          <Sprite name={row.icon} size={16} />
          <span>{row.label}</span>
          <b>{row.value}</b>
        </div>
      ))}
    </div>
  )
}

/**
 * Tapa la interfaz para que el paso no se pueda saltar tocando el juego.
 * `hole` deja libre el objetivo cuando el paso espera esa acción; `cap` vuelve
 * a cubrirlo, sin oscurecerlo, cuando el paso avanza con el botón.
 */
function Blocker({ hole, cap }: { hole: Box | null; cap: boolean }) {
  if (!hole) return <div className="tour-block" style={{ inset: 0 }} />
  const pad = 6
  const top = Math.max(0, hole.top - pad)
  const left = Math.max(0, hole.left - pad)
  const right = hole.left + hole.width + pad
  const bottom = hole.top + hole.height + pad
  return (
    <>
      <div className="tour-block" style={{ top: 0, left: 0, right: 0, height: top }} />
      <div className="tour-block" style={{ top: bottom, left: 0, right: 0, bottom: 0 }} />
      <div className="tour-block" style={{ top, left: 0, width: left, height: bottom - top }} />
      <div className="tour-block" style={{ top, left: right, right: 0, height: bottom - top }} />
      {cap && <div className="tour-block clear" style={{ top, left, width: right - left, height: bottom - top }} />}
    </>
  )
}

export function Tutorial({ step, game, progress, onNext, onFinish }: TutorialProps) {
  const rawBox = useTargetBox(step.target)
  // En los pasos con ficha ampliada la burbuja se ancla a la ficha entera para
  // no tapar los datos que quedan por explicar.
  const cardBox = useTargetBox(step.zoom ? 'zoom-card' : undefined)

  // Los pasos que esperan una acción avanzan solos en cuanto ocurre.
  useEffect(() => {
    if (step.awaits && progress[step.awaits]) onNext()
  }, [step, progress, onNext])

  // La casilla marcada es el único punto tocable del paso, así que se acerca
  // al centro si el mapa quedó desplazado.
  useEffect(() => {
    if (step.id !== 'place') return
    const cell = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
    const rect = cell?.getBoundingClientRect()
    if (!cell || !rect) return
    if (rect.top < 100 || rect.bottom > window.innerHeight - 140 || rect.left < 8 || rect.right > window.innerWidth - 8) {
      cell.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
    }
  }, [step])

  const viewportWidth = typeof window === 'undefined' ? 360 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 640 : window.innerHeight
  // Un objetivo más grande que la pantalla no se puede señalar: la burbuja se centra sola.
  const box = !rawBox || (rawBox.width < viewportWidth * 0.8 && rawBox.height < viewportHeight * 0.6) ? rawBox : null

  if (step.id === 'welcome') {
    return (
      <div className="tour-backdrop">
        <section className="tour-welcome frame" role="dialog" aria-modal="true" aria-label={WELCOME_TITLE}>
          <strong>{WELCOME_TITLE}</strong>
          <p>{WELCOME_TEXT}</p>
          <button className="btn frame gold wide" onClick={onNext}>{step.button}</button>
          <button className="tour-skip" onClick={onFinish}>Saltar tutorial</button>
        </section>
      </div>
    )
  }

  const anchor = cardBox ?? box
  const handGap = step.zoom ? 0 : GAP + HAND
  const below = anchor ? anchor.top + anchor.height / 2 < viewportHeight / 2 : true
  const bubbleWidth = Math.min(BUBBLE_WIDTH, viewportWidth - 24)
  const anchorX = anchor ? anchor.left + anchor.width / 2 : viewportWidth / 2
  const bubbleLeft = Math.max(12, Math.min(anchorX - bubbleWidth / 2, viewportWidth - bubbleWidth - 12))
  const bubbleTop = anchor
    ? below ? anchor.top + anchor.height + GAP + handGap : undefined
    : viewportHeight / 2
  const bubbleBottom = anchor && !below ? viewportHeight - anchor.top + GAP + handGap : undefined
  // Sobre la ficha ampliada la manito apunta desde la derecha; en el resto del
  // GUI apunta desde arriba o desde abajo según dónde quepa la burbuja.
  const handSide = step.zoom ? 'left' : below ? 'up' : 'down'
  const handTop = box ? (step.zoom ? box.top + box.height / 2 - HAND / 2 : below ? box.top + box.height + 4 : box.top - HAND - 4) : 0
  const handLeft = box ? (step.zoom ? box.left + box.width + 2 : box.left + box.width / 2 - HAND / 2) : 0

  return (
    <div className="tour-layer" aria-live="polite">
      <Blocker hole={box} cap={!step.awaits} />
      {step.zoom && <div className="tour-zoom"><WindCard game={game} highlight={step.target} /></div>}
      {box && <div className="tour-ring" style={{ top: box.top - 5, left: box.left - 5, width: box.width + 10, height: box.height + 10 }} aria-hidden="true" />}
      {box && (
        <span className={`tour-hand ${handSide}`} style={{ top: handTop, left: handLeft }} aria-hidden="true">
          <Sprite name="icon-hand" size={HAND} />
        </span>
      )}
      <section
        className="tour-bubble frame"
        style={{ width: bubbleWidth, left: bubbleLeft, top: bubbleTop, bottom: bubbleBottom }}
        role="dialog"
        aria-live="assertive"
        aria-label="Guía de inicio"
      >
        <p>{step.text}</p>
        {step.button
          ? <button className="btn frame gold wide" onClick={step.id === 'sell' ? onFinish : onNext}>{step.button}</button>
          : <span className="tour-waiting">Te espero…</span>}
        <button className="tour-skip" onClick={onFinish}>Saltar tutorial</button>
      </section>
    </div>
  )
}
