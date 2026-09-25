import { useCallback, useState } from 'react'
import { isTutorialDone, markTutorialDone } from '../../game/tutorial'
import { TUTORIAL_STEPS, type TutorialStep } from './steps'

const INACTIVE = -1

export interface TutorialController {
  step: TutorialStep | null
  next: () => void
  finish: () => void
  restart: () => void
}

/** Avanza la secuencia de inicio y recuerda que ya se completó. */
export function useTutorial(canStart: boolean): TutorialController {
  const [index, setIndex] = useState(() => (canStart && !isTutorialDone() ? 0 : INACTIVE))

  const finish = useCallback(() => {
    markTutorialDone()
    setIndex(INACTIVE)
  }, [])

  const next = useCallback(() => setIndex((current) => {
    if (current === INACTIVE) return current
    const upcoming = current + 1
    if (upcoming >= TUTORIAL_STEPS.length) {
      markTutorialDone()
      return INACTIVE
    }
    return upcoming
  }), [])

  const restart = useCallback(() => setIndex(0), [])

  return { step: index === INACTIVE ? null : TUTORIAL_STEPS[index], next, finish, restart }
}
