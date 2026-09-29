import { describe, expect, it } from 'vitest'
import { MUSIC_LAYERS, layersForTechs } from './music'
import { EMPTY_TECHS, TECH_ORDER } from '../game/balance'

describe('music layers', () => {
  it('ships one base layer and one per unlocking technology', () => {
    expect(MUSIC_LAYERS).toHaveLength(5)
    const base = MUSIC_LAYERS.filter((layer) => !layer.tech)
    expect(base).toHaveLength(1)
    expect(base[0].id).toBe('a')
    for (const layer of MUSIC_LAYERS) {
      if (layer.tech) expect(TECH_ORDER).toContain(layer.tech)
      expect(layer.file).toMatch(/^nucleus-[a-e]\.mp3$/)
      // La corrección de nivel solo sube pistas bajas; nunca atenúa.
      expect(layer.gain).toBeGreaterThanOrEqual(1)
      expect(layer.gain).toBeLessThanOrEqual(4)
    }
    // Ninguna tecnología manda dos capas a la vez.
    const techs = MUSIC_LAYERS.map((layer) => layer.tech).filter(Boolean)
    expect(new Set(techs).size).toBe(techs.length)
  })

  it('plays only the base layer on a fresh game', () => {
    expect([...layersForTechs(EMPTY_TECHS)]).toEqual(['a'])
  })

  it('adds a layer with solar, thorium, expansion and fusion', () => {
    const steps: Array<[keyof typeof EMPTY_TECHS, string]> = [['solar', 'b'], ['thorium', 'c'], ['expansion', 'd'], ['fusion', 'e']]
    const unlocked = { ...EMPTY_TECHS }
    const expected = ['a']
    for (const [tech, layer] of steps) {
      unlocked[tech] = true
      expected.push(layer)
      expect([...layersForTechs(unlocked)].sort()).toEqual(expected.slice().sort())
    }
  })

  it('leaves the thermal and test site licences without a layer of their own', () => {
    const unlocked = { ...EMPTY_TECHS, thermal: true, testsite: true }
    expect([...layersForTechs(unlocked)]).toEqual(['a'])
  })
})
