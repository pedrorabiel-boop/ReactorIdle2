import type { GameState } from './types'

const TUTORIAL_KEY = 'nucleus-idle-tutorial-v1'

/** Una partida es virgen mientras no se haya construido, producido ni vendido nada. */
export function isPristineGame(state: GameState): boolean {
  if (state.tick > 0 || state.totalEnergy > 0 || state.totalEnergySold > 0 || state.totalCreditsEarned > 0) return false
  if (state.researchPoints > 0 || state.contractsCompleted > 0) return false
  return Object.values(state.sectorLayouts).every((tiles) => tiles.every((tile) => tile === null))
}

export function isTutorialDone(): boolean {
  try {
    return window.localStorage.getItem(TUTORIAL_KEY) === 'done'
  } catch {
    return false
  }
}

export function markTutorialDone(): void {
  try {
    window.localStorage.setItem(TUTORIAL_KEY, 'done')
  } catch {
    // Sin almacenamiento el tutorial simplemente volverá a ofrecerse.
  }
}

export function clearTutorialDone(): void {
  try {
    window.localStorage.removeItem(TUTORIAL_KEY)
  } catch {
    // Igual que arriba: no hay nada que limpiar si el almacenamiento falla.
  }
}
