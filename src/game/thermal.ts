import type { ComponentKind, Tile } from './types'

const THERMAL_CARRIERS = new Set<ComponentKind>(['core', 'thorium', 'fusion', 'exchanger', 'pipe', 'accumulator'])
const CACHE_LIMIT = 64
const MIN_RESISTANCE = 0.000_001
const EPSILON = 0.000_000_1

export interface ThermalEdge { a: number; b: number }
export interface ThermalTopology { signature: string; nodes: number[]; edges: ThermalEdge[] }
export interface ThermalSinkEdge { source: number; sink: number }
export interface ThermalDemandResult { totalMoved: number; received: Map<number, number> }

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

/**
 * Diffuses heat into directional terminal nodes. Sinks receive using the same
 * potential/resistance model as the pipe graph, but can never return heat.
 */
export function absorbHeatIntoSinks(
  tiles: Array<Tile | null>,
  edges: ThermalSinkEdge[],
  capacityAt: (index: number) => number,
  resistanceAt: (index: number) => number,
  substeps = 4,
): number {
  let totalMoved = 0
  const iterations = Math.max(1, Math.floor(substeps))

  for (let step = 0; step < iterations; step += 1) {
    const proposals: HeatFlow[] = []
    const outbound = new Map<number, number>()
    for (const edge of edges) {
      const sourceTile = tiles[edge.source]
      const sinkTile = tiles[edge.sink]
      const sourceCapacity = capacityAt(edge.source)
      const sinkCapacity = capacityAt(edge.sink)
      if (!sourceTile || !sinkTile || sourceCapacity <= 0 || sinkCapacity <= 0) continue
      const sourcePotential = Math.max(0, sourceTile.heat) / sourceCapacity
      const sinkPotential = Math.max(0, sinkTile.heat) / sinkCapacity
      if (sourcePotential <= sinkPotential + EPSILON) continue
      const equilibriumTransfer = (sourcePotential - sinkPotential) / (1 / sourceCapacity + 1 / sinkCapacity)
      const edgeResistance = Math.max(MIN_RESISTANCE, resistanceAt(edge.source) + resistanceAt(edge.sink))
      const coupling = 1 - Math.exp(-1 / (edgeResistance * iterations))
      const amount = equilibriumTransfer * coupling
      if (amount <= EPSILON) continue
      proposals.push({ source: edge.source, destination: edge.sink, amount })
      outbound.set(edge.source, (outbound.get(edge.source) ?? 0) + amount)
    }

    if (proposals.length === 0) break
    const deltas = new Map<number, number>()
    for (const proposal of proposals) {
      const sourceTile = tiles[proposal.source]
      const sinkTile = tiles[proposal.destination]
      if (!sourceTile || !sinkTile) continue
      const requested = outbound.get(proposal.source) ?? proposal.amount
      const scale = requested > sourceTile.heat ? Math.max(0, sourceTile.heat) / requested : 1
      const moved = proposal.amount * scale
      if (moved <= EPSILON) continue
      deltas.set(proposal.source, (deltas.get(proposal.source) ?? 0) - moved)
      deltas.set(proposal.destination, (deltas.get(proposal.destination) ?? 0) + moved)
      sourceTile.flow += moved
      sinkTile.flow += moved
      totalMoved += moved
    }
    for (const [index, delta] of deltas) {
      const tile = tiles[index]
      if (tile) tile.heat = Math.max(0, tile.heat + delta)
    }
  }
  return totalMoved
}

interface DemandComponent { edges: ThermalSinkEdge[]; sources: number[]; sinks: number[] }

function demandComponents(edges: ThermalSinkEdge[]): DemandComponent[] {
  const adjacent = new Map<string, Set<string>>()
  const connect = (a: string, b: string) => {
    if (!adjacent.has(a)) adjacent.set(a, new Set())
    adjacent.get(a)!.add(b)
  }
  for (const { source, sink } of edges) {
    const sourceKey = `s${source}`
    const sinkKey = `k${sink}`
    connect(sourceKey, sinkKey)
    connect(sinkKey, sourceKey)
  }

  const visited = new Set<string>()
  const components: DemandComponent[] = []
  for (const start of adjacent.keys()) {
    if (visited.has(start)) continue
    const queue = [start]
    const keys = new Set<string>()
    visited.add(start)
    while (queue.length > 0) {
      const key = queue.shift()!
      keys.add(key)
      for (const neighbour of adjacent.get(key) ?? []) if (!visited.has(neighbour)) {
        visited.add(neighbour)
        queue.push(neighbour)
      }
    }
    const sources = [...keys].filter((key) => key.startsWith('s')).map((key) => Number(key.slice(1)))
    const sinks = [...keys].filter((key) => key.startsWith('k')).map((key) => Number(key.slice(1)))
    components.push({ sources, sinks, edges: edges.filter(({ source, sink }) => keys.has(`s${source}`) && keys.has(`k${sink}`)) })
  }
  return components
}

/** Maximum flow for one small source/sink component; capacities may be fractional. */
function allocateDemand(
  edges: ThermalSinkEdge[],
  available: Map<number, number>,
  demand: Map<number, number>,
): Map<string, number> {
  const sources = [...new Set(edges.map(({ source }) => source))]
  const sinks = [...new Set(edges.map(({ sink }) => sink))]
  const nodeCount = 2 + sources.length + sinks.length
  const start = 0
  const finish = nodeCount - 1
  const sourceNode = new Map(sources.map((source, index) => [source, 1 + index]))
  const sinkNode = new Map(sinks.map((sink, index) => [sink, 1 + sources.length + index]))
  const residual = Array.from({ length: nodeCount }, () => new Float64Array(nodeCount))
  const neighbours = Array.from({ length: nodeCount }, () => new Set<number>())
  const addEdge = (from: number, to: number, capacity: number) => {
    residual[from][to] += Math.max(0, capacity)
    neighbours[from].add(to)
    neighbours[to].add(from)
  }
  const totalAvailable = sources.reduce((sum, source) => sum + (available.get(source) ?? 0), 0)
  for (const source of sources) addEdge(start, sourceNode.get(source)!, available.get(source) ?? 0)
  for (const { source, sink } of edges) {
    const from = sourceNode.get(source)!
    const to = sinkNode.get(sink)!
    if (residual[from][to] <= EPSILON) addEdge(from, to, totalAvailable)
  }
  for (const sink of sinks) addEdge(sinkNode.get(sink)!, finish, demand.get(sink) ?? 0)

  while (true) {
    const parent = new Int32Array(nodeCount).fill(-1)
    parent[start] = start
    const queue = [start]
    while (queue.length > 0 && parent[finish] === -1) {
      const node = queue.shift()!
      for (const next of neighbours[node]) if (parent[next] === -1 && residual[node][next] > EPSILON) {
        parent[next] = node
        queue.push(next)
        if (next === finish) break
      }
    }
    if (parent[finish] === -1) break
    let amount = Number.POSITIVE_INFINITY
    for (let node = finish; node !== start; node = parent[node]) amount = Math.min(amount, residual[parent[node]][node])
    if (amount <= EPSILON) break
    for (let node = finish; node !== start; node = parent[node]) {
      residual[parent[node]][node] -= amount
      residual[node][parent[node]] += amount
    }
  }

  const allocation = new Map<string, number>()
  for (const { source, sink } of edges) {
    const from = sourceNode.get(source)!
    const to = sinkNode.get(sink)!
    const moved = Math.max(0, totalAvailable - residual[from][to])
    if (moved > EPSILON) allocation.set(`${source}:${sink}`, moved)
  }
  return allocation
}

/**
 * Supplies terminal converters up to their immediate conversion demand. The
 * terminal edge has no resistance and transferred heat is consumed directly,
 * so it never occupies the sink's thermal buffer. Equal demands receive an
 * equal share whenever the component topology permits it.
 */
export function pullHeatForConversion(
  tiles: Array<Tile | null>,
  edges: ThermalSinkEdge[],
  demandAt: (index: number) => number,
): ThermalDemandResult {
  const validEdges = [...new Map(edges
    .filter(({ source, sink }) => tiles[source] && tiles[sink] && (tiles[source]?.heat ?? 0) > EPSILON && demandAt(sink) > EPSILON)
    .map((edge) => [`${edge.source}:${edge.sink}`, edge])).values()]
  const received = new Map<number, number>()
  let totalMoved = 0

  for (const component of demandComponents(validEdges)) {
    const available = new Map(component.sources.map((source) => [source, Math.max(0, tiles[source]?.heat ?? 0)]))
    const remainingDemand = new Map(component.sinks.map((sink) => [sink, Math.max(0, demandAt(sink))]))
    const totalAvailable = component.sources.reduce((sum, source) => sum + (available.get(source) ?? 0), 0)
    const totalDemand = component.sinks.reduce((sum, sink) => sum + (remainingDemand.get(sink) ?? 0), 0)
    if (totalAvailable <= EPSILON || totalDemand <= EPSILON) continue

    const fairShare = Math.min(1, totalAvailable / totalDemand)
    const fairDemand = new Map(component.sinks.map((sink) => [sink, (remainingDemand.get(sink) ?? 0) * fairShare]))
    const stages = [fairDemand, remainingDemand]
    for (const stageDemand of stages) {
      const allocation = allocateDemand(component.edges, available, stageDemand)
      for (const { source, sink } of component.edges) {
        const moved = allocation.get(`${source}:${sink}`) ?? 0
        if (moved <= EPSILON) continue
        available.set(source, Math.max(0, (available.get(source) ?? 0) - moved))
        remainingDemand.set(sink, Math.max(0, (remainingDemand.get(sink) ?? 0) - moved))
        const sourceTile = tiles[source]
        const sinkTile = tiles[sink]
        if (sourceTile) {
          sourceTile.heat = Math.max(0, sourceTile.heat - moved)
          sourceTile.flow += moved
        }
        if (sinkTile) sinkTile.flow += moved
        received.set(sink, (received.get(sink) ?? 0) + moved)
        totalMoved += moved
      }
    }
  }
  return { totalMoved, received }
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
