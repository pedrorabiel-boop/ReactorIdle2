import { beforeEach, describe, expect, it } from 'vitest'
import { COMPONENTS } from './catalog'
import { clearThermalTopologyCache, diffuseThermalNetwork, drainHeatByResistance, getThermalTopology } from './thermal'
import type { ComponentKind, Tile } from './types'

let nextTileId = 0
const makeTile = (kind: ComponentKind = 'pipe', heat = 0): Tile => ({ id: `${kind}-${nextTileId++}`, kind, heat, enabled: true, damaged: false, flow: 0, fuel: 0, autoRefuel: false })
const totalHeat = (tiles: Array<Tile | null>) => tiles.reduce((sum, tile) => sum + (tile?.heat ?? 0), 0)
const capacityAt = () => 100
const resistanceAt = () => 1

describe('resistive thermal graph', () => {
  beforeEach(() => { clearThermalTopologyCache(); nextTileId = 0 })

  it('derives resistance from the previous capacity and throughput scale', () => {
    for (const kind of ['pipe', 'exchanger', 'accumulator'] as const) {
      const definition = COMPONENTS[kind]
      const resistance = definition.thermalResistance!
      const fullGradientTransfer = definition.capacity / 2 * (1 - Math.exp(-1 / (resistance * 2)))
      expect(fullGradientTransfer).toBeCloseTo(definition.referenceTransferRate!, 6)
    }
  })

  it('conserves heat exactly while redistributing it', () => {
    const tiles = [makeTile('core', 100), makeTile(), makeTile(), makeTile(), makeTile(), makeTile()]
    const before = totalHeat(tiles)
    const moved = diffuseThermalNetwork(tiles, getThermalTopology(tiles, 1, 6), capacityAt, resistanceAt)
    expect(moved).toBeGreaterThan(0)
    expect(totalHeat(tiles)).toBeCloseTo(before, 8)
  })

  it('forms a decreasing gradient along a long line', () => {
    const tiles = [makeTile('core', 100), makeTile(), makeTile(), makeTile(), makeTile(), makeTile()]
    diffuseThermalNetwork(tiles, getThermalTopology(tiles, 1, 6), capacityAt, resistanceAt)
    const heat = tiles.map((tile) => tile!.heat)
    for (let index = 1; index < heat.length; index += 1) expect(heat[index - 1]).toBeGreaterThan(heat[index])
  })

  it('keeps diagonal pipes cooler than the four orthogonal pipes around a source', () => {
    const tiles = Array.from({ length: 9 }, (_, index) => makeTile('pipe', index === 4 ? 100 : 0))
    tiles[4] = makeTile('core', 100)
    diffuseThermalNetwork(tiles, getThermalTopology(tiles, 3, 3), capacityAt, resistanceAt)
    const orthogonalAverage = [1, 3, 5, 7].reduce((sum, index) => sum + tiles[index]!.heat, 0) / 4
    const diagonalAverage = [0, 2, 6, 8].reduce((sum, index) => sum + tiles[index]!.heat, 0) / 4
    expect(orthogonalAverage).toBeGreaterThan(diagonalAverage)
  })

  it('delivers more heat through two parallel routes than through a dead-end branch', () => {
    const parallel = Array.from({ length: 16 }, () => null) as Array<Tile | null>
    parallel[4] = makeTile('core', 100)
    for (const index of [0, 1, 2, 3, 8, 9, 10, 11]) parallel[index] = makeTile()
    diffuseThermalNetwork(parallel, getThermalTopology(parallel, 4, 4), capacityAt, resistanceAt)
    const parallelDelivered = drainHeatByResistance(parallel, [3, 11], 100, capacityAt, resistanceAt)

    const bottleneck = Array.from({ length: 16 }, () => null) as Array<Tile | null>
    bottleneck[4] = makeTile('core', 100)
    for (const index of [0, 1, 2, 3, 8, 9, 10, 14]) bottleneck[index] = makeTile()
    diffuseThermalNetwork(bottleneck, getThermalTopology(bottleneck, 4, 4), capacityAt, resistanceAt)
    const bottleneckDelivered = drainHeatByResistance(bottleneck, [3], 100, capacityAt, resistanceAt)

    expect(parallelDelivered).toBeGreaterThan(bottleneckDelivered)
    expect(totalHeat(parallel) + parallelDelivered).toBeCloseTo(100, 8)
    expect(totalHeat(bottleneck) + bottleneckDelivered).toBeCloseTo(100, 8)
  })

  it('moves more heat through lower resistance without changing total heat', () => {
    const lowResistance = [makeTile('pipe', 100), makeTile()]
    const highResistance = [makeTile('pipe', 100), makeTile()]
    const lowBefore = totalHeat(lowResistance)
    const highBefore = totalHeat(highResistance)
    const lowMoved = diffuseThermalNetwork(lowResistance, getThermalTopology(lowResistance, 1, 2), capacityAt, () => 0.5)
    const highMoved = diffuseThermalNetwork(highResistance, getThermalTopology(highResistance, 1, 2), capacityAt, () => 5)
    expect(lowMoved).toBeGreaterThan(highMoved)
    expect(totalHeat(lowResistance)).toBeCloseTo(lowBefore, 8)
    expect(totalHeat(highResistance)).toBeCloseTo(highBefore, 8)
  })

  it('reuses graph structure until topology changes', () => {
    const tiles = [makeTile('core', 100), makeTile(), makeTile()]
    const first = getThermalTopology(tiles, 1, 3)
    tiles[0]!.heat = 25
    expect(getThermalTopology(tiles, 1, 3)).toBe(first)
    tiles[1]!.damaged = true
    const split = getThermalTopology(tiles, 1, 3)
    expect(split).not.toBe(first)
    expect(split.edges).toHaveLength(0)
  })
})
