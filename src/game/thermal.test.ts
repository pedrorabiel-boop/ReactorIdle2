import { beforeEach, describe, expect, it } from 'vitest'
import { COMPONENTS } from './catalog'
import { absorbHeatIntoSinks, clearThermalTopologyCache, diffuseThermalNetwork, drainHeatByResistance, getThermalTopology, pullHeatForConversion, pumpHeatThroughActivePipes } from './thermal'
import type { ComponentKind, Tile } from './types'

let nextTileId = 0
const makeTile = (kind: ComponentKind = 'pipe', heat = 0): Tile => ({ id: `${kind}-${nextTileId++}`, kind, heat, enabled: true, damaged: false, flow: 0, fuel: 0, autoRefuel: false })
const totalHeat = (tiles: Array<Tile | null>) => tiles.reduce((sum, tile) => sum + (tile?.heat ?? 0), 0)
const capacityAt = () => 100
const resistanceAt = () => 1

describe('resistive thermal graph', () => {
  beforeEach(() => { clearThermalTopologyCache(); nextTileId = 0 })

  it('keeps derived storage-node resistance and the promoted pipe tuning', () => {
    for (const kind of ['exchanger', 'accumulator'] as const) {
      const definition = COMPONENTS[kind]
      const resistance = definition.thermalResistance!
      const fullGradientTransfer = definition.capacity / 2 * (1 - Math.exp(-1 / (resistance * 2)))
      expect(fullGradientTransfer / definition.referenceTransferRate!).toBeCloseTo(1, 12)
    }
    expect(COMPONENTS.pipe.capacity).toBe(200_000)
    expect(COMPONENTS.pipe.thermalResistance).toBe(0.25)
    expect(COMPONENTS.pipe2.thermalResistance).toBeCloseTo(1.233151731188216, 12)
    expect(COMPONENTS.pipe2.referenceTransferRate).toBe(12_500_000_000)
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

  it('keeps Pipe II outside passive diffusion so its active throughput cannot be bypassed', () => {
    const tiles = [makeTile('core', 100), makeTile('pipe2'), makeTile('pipe2')]
    const topology = getThermalTopology(tiles, 1, 3)
    expect(topology.nodes).toEqual([0])
    expect(topology.edges).toHaveLength(0)
    expect(diffuseThermalNetwork(tiles, topology, capacityAt, resistanceAt)).toBe(0)
    expect(tiles[0]!.heat).toBe(100)
  })

  it('feeds terminal converters without ever returning their stored heat', () => {
    const receiving = [makeTile('pipe', 100), makeTile('generator', 0)]
    const before = totalHeat(receiving)
    const moved = absorbHeatIntoSinks(receiving, [{ source: 0, sink: 1 }], capacityAt, resistanceAt)
    expect(moved).toBeGreaterThan(0)
    expect(receiving[1]!.heat).toBeGreaterThan(0)
    expect(totalHeat(receiving)).toBeCloseTo(before, 8)

    const blockedReturn = [makeTile('pipe', 0), makeTile('generator', 100)]
    expect(absorbHeatIntoSinks(blockedReturn, [{ source: 0, sink: 1 }], capacityAt, resistanceAt)).toBe(0)
    expect(blockedReturn[0]!.heat).toBe(0)
    expect(blockedReturn[1]!.heat).toBe(100)
  })

  it('satisfies matched terminal conversion without occupying thermal buffers', () => {
    const tiles = [makeTile('core', 1_000), ...Array.from({ length: 4 }, () => makeTile('generator'))]
    const edges = [1, 2, 3, 4].map((sink) => ({ source: 0, sink }))
    const result = pullHeatForConversion(tiles, edges, () => 250)
    expect(result.totalMoved).toBeCloseTo(1_000)
    expect(tiles[0]!.heat).toBeCloseTo(0)
    for (const sink of [1, 2, 3, 4]) {
      expect(result.received.get(sink)).toBeCloseTo(250)
      expect(tiles[sink]!.heat).toBe(0)
    }
  })

  it('shares a conversion deficit equally and conserves unreachable heat', () => {
    const tiles = [makeTile('core', 600), ...Array.from({ length: 4 }, () => makeTile('generator'))]
    const edges = [1, 2, 3, 4].map((sink) => ({ source: 0, sink }))
    const result = pullHeatForConversion(tiles, edges, () => 250)
    expect(result.totalMoved).toBeCloseTo(600)
    for (const sink of [1, 2, 3, 4]) expect(result.received.get(sink)).toBeCloseTo(150)

    const isolated = [makeTile('core', 100), null, makeTile('generator')]
    expect(pullHeatForConversion(isolated, [], () => 250).totalMoved).toBe(0)
    expect(totalHeat(isolated)).toBe(100)
  })

  it('reroutes active demand around constrained terminal connections', () => {
    const tiles = [makeTile('pipe', 100), makeTile('pipe', 100), makeTile('generator'), makeTile('generator')]
    const edges = [{ source: 0, sink: 2 }, { source: 0, sink: 3 }, { source: 1, sink: 2 }]
    const result = pullHeatForConversion(tiles, edges, () => 100)
    expect(result.totalMoved).toBeCloseTo(200)
    expect(result.received.get(2)).toBeCloseTo(100)
    expect(result.received.get(3)).toBeCloseTo(100)
    expect(tiles[0]!.heat + tiles[1]!.heat).toBeCloseTo(0)
  })

  it('pumps heat through a continuous Pipe II route without filling its buffers', () => {
    const tiles = [makeTile('core', 1_000), makeTile('pipe2'), makeTile('pipe2'), makeTile('pipe2'), makeTile('generator')]
    const result = pumpHeatThroughActivePipes(tiles, 1, 5, () => 250, () => 1_000, () => 250)
    expect(result.totalMoved).toBeCloseTo(250)
    expect(result.received.get(4)).toBeCloseTo(250)
    expect(tiles[0]!.heat).toBeCloseTo(750)
    expect(tiles.slice(1, 4).every((tile) => tile!.heat === 0)).toBe(true)
    expect(totalHeat(tiles) + result.totalMoved).toBeCloseTo(1_000)
  })

  it('shares a Pipe II bottleneck fairly between demanding turbines', () => {
    const tiles = Array.from({ length: 9 }, () => null) as Array<Tile | null>
    tiles[3] = makeTile('core', 200)
    for (const index of [1, 4, 7]) tiles[index] = makeTile('pipe2')
    tiles[0] = makeTile('generator')
    tiles[6] = makeTile('generator')
    const result = pumpHeatThroughActivePipes(tiles, 3, 3, () => 100, () => 100, () => 100)
    expect(result.totalMoved).toBeCloseTo(100, 5)
    expect(result.received.get(0)).toBeCloseTo(50, 5)
    expect(result.received.get(6)).toBeCloseTo(50, 5)
    expect(tiles[3]!.heat).toBeCloseTo(100, 5)
  })

  it('extracts first from the source with the highest normalized thermal potential', () => {
    const tiles = [makeTile('core', 80), makeTile('pipe2'), makeTile('accumulator', 50), null, makeTile('generator'), null]
    const result = pumpHeatThroughActivePipes(tiles, 2, 3, () => 60, () => 100, () => 100)
    expect(result.totalMoved).toBeCloseTo(60)
    expect(tiles[0]!.heat).toBeCloseTo(20)
    expect(tiles[2]!.heat).toBeCloseTo(50)
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
