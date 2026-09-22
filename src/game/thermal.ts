import type { ComponentKind, Tile } from './types'

const THERMAL_CARRIERS = new Set<ComponentKind>(['core', 'thorium', 'fusion', 'exchanger', 'pipe', 'accumulator'])
const CACHE_LIMIT = 64
const MIN_RESISTANCE = 0.000_001
const EPSILON = 0.000_000_1

export interface ThermalEdge { a: number; b: number }
export interface ThermalTopology { signature: string; nodes: number[]; edges: ThermalEdge[] }

const topologyCache = new Map<string, ThermalTopology>()

export const isThermalCarrier = (tile: Tile | null | undefined): tile is Tile => Boolean(tile && THERMAL_CARRIERS.has(tile.kind) && tile.enabled && !tile.damaged)

function topologySignature(tiles: Array<Tile | null>, rows: number, cols: number): string {
  return `${rows}x${cols}:${tiles.map((tile) => isThermalCarrier(tile) ? tile.kind : '.').join(',')}`
}

/** Builds only when placement/enabled/damaged topology changes; heat changes reuse the cached graph. */
export function getThermalTopology(tiles: Array<Tile | null>, rows: number, cols: number): ThermalTopology {
  const signature = topologySignature(tiles, rows, cols)
  const cached = topologyCache.get(signature)
  if (cached) return cached

  const nodes: number[] = []
  const edges: ThermalEdge[] = []
  for (let index = 0; index < tiles.length; index += 1) {
    if (!isThermalCarrier(tiles[index])) continue
    nodes.push(index)
    const row = Math.floor(index / cols)
    const col = index % cols
    if (col < cols - 1 && isThermalCarrier(tiles[index + 1])) edges.push({ a: index, b: index + 1 })
    if (row < rows - 1 && isThermalCarrier(tiles[index + cols])) edges.push({ a: index, b: index + cols })
  }

  const topology = { signature, nodes, edges }
  topologyCache.set(signature, topology)
  if (topologyCache.size > CACHE_LIMIT) topologyCache.delete(topologyCache.keys().next().value!)
  return topology
}

export function clearThermalTopologyCache(): void { topologyCache.clear() }

interface HeatFlow { source: number; destination: number; amount: number }

/**
 * Stable graph diffusion. Heat potential is heat/capacity and every edge is
 * evaluated from the same snapshot, so array order cannot select a preferred path.
 */
export function diffuseThermalNetwork(
  tiles: Array<Tile | null>,
  topology: ThermalTopology,
  capacityAt: (index: number) => number,
  resistanceAt: (index: number) => number,
  substeps = 4,
): number {
  let totalMoved = 0
  const iterations = Math.max(1, Math.floor(substeps))

  for (let step = 0; step < iterations; step += 1) {
    const proposals: HeatFlow[] = []
    const outbound = new Map<number, number>()

    for (const edge of topology.edges) {
      const tileA = tiles[edge.a]
      const tileB = tiles[edge.b]
      const capacityA = capacityAt(edge.a)
      const capacityB = capacityAt(edge.b)
      if (!tileA || !tileB || capacityA <= 0 || capacityB <= 0) continue

      const potentialA = Math.max(0, tileA.heat) / capacityA
      const potentialB = Math.max(0, tileB.heat) / capacityB
      if (Math.abs(potentialA - potentialB) <= EPSILON) continue

      const source = potentialA > potentialB ? edge.a : edge.b
      const destination = source === edge.a ? edge.b : edge.a
      const sourceCapacity = source === edge.a ? capacityA : capacityB
      const destinationCapacity = destination === edge.a ? capacityA : capacityB
      const equilibriumTransfer = Math.abs(potentialA - potentialB) / (1 / sourceCapacity + 1 / destinationCapacity)
      const edgeResistance = Math.max(MIN_RESISTANCE, resistanceAt(edge.a) + resistanceAt(edge.b))
      const coupling = 1 - Math.exp(-1 / (edgeResistance * iterations))
      const amount = equilibriumTransfer * coupling
      if (amount <= EPSILON) continue
      proposals.push({ source, destination, amount })
      outbound.set(source, (outbound.get(source) ?? 0) + amount)
    }

    if (proposals.length === 0) break
    const deltas = new Map<number, number>()
    for (const proposal of proposals) {
      const sourceTile = tiles[proposal.source]
      if (!sourceTile) continue
      const requested = outbound.get(proposal.source) ?? proposal.amount
      const scale = requested > sourceTile.heat ? Math.max(0, sourceTile.heat) / requested : 1
      const moved = proposal.amount * scale
      if (moved <= EPSILON) continue
      deltas.set(proposal.source, (deltas.get(proposal.source) ?? 0) - moved)
      deltas.set(proposal.destination, (deltas.get(proposal.destination) ?? 0) + moved)
      sourceTile.flow += moved
      const destinationTile = tiles[proposal.destination]
      if (destinationTile) destinationTile.flow += moved
      totalMoved += moved
    }

    for (const [index, delta] of deltas) {
      const tile = tiles[index]
      if (tile) tile.heat = Math.max(0, tile.heat + delta)
    }
  }

  return totalMoved
}

/** Distributes a converter/cooler demand among all adjacent sources by potential and conductance. */
export function drainHeatByResistance(
  tiles: Array<Tile | null>,
  sourceIndices: number[],
  requested: number,
  capacityAt: (index: number) => number,
  resistanceAt: (index: number) => number,
): number {
  let remaining = Math.max(0, requested)
  let drained = 0
  let active = sourceIndices.filter((index) => (tiles[index]?.heat ?? 0) > EPSILON)

  while (remaining > EPSILON && active.length > 0) {
    const weights = active.map((index) => {
      const tile = tiles[index]!
      const capacity = capacityAt(index)
      const potential = capacity > 0 ? tile.heat / capacity : 0
      return Math.max(EPSILON, potential / Math.max(MIN_RESISTANCE, resistanceAt(index)))
    })
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
    let movedThisPass = 0
    for (let i = 0; i < active.length; i += 1) {
      const tile = tiles[active[i]]!
      const amount = Math.min(tile.heat, remaining * weights[i] / totalWeight)
      tile.heat -= amount
      tile.flow += amount
      drained += amount
      movedThisPass += amount
    }
    remaining -= movedThisPass
    if (movedThisPass <= EPSILON) break
    active = active.filter((index) => (tiles[index]?.heat ?? 0) > EPSILON)
  }

  return drained
}
