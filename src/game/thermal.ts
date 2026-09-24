import type { ComponentKind, Tile } from './types'

const THERMAL_CARRIERS = new Set<ComponentKind>(['core', 'thorium', 'fusion', 'exchanger', 'pipe', 'pipe2', 'accumulator'])
const CACHE_LIMIT = 64
const MIN_RESISTANCE = 0.000_001
const EPSILON = 0.000_000_1

export interface ThermalEdge { a: number; b: number }
export interface ThermalTopology { signature: string; nodes: number[]; edges: ThermalEdge[] }
export interface ThermalSinkEdge { source: number; sink: number }
export interface ThermalDemandResult { totalMoved: number; received: Map<number, number> }

const topologyCache = new Map<string, ThermalTopology>()

export const isThermalCarrier = (tile: Tile | null | undefined): tile is Tile => Boolean(tile && THERMAL_CARRIERS.has(tile.kind) && tile.enabled && !tile.damaged)
const isPassiveThermalCarrier = (tile: Tile | null | undefined): tile is Tile => isThermalCarrier(tile) && tile.kind !== 'pipe2'

function topologySignature(tiles: Array<Tile | null>, rows: number, cols: number): string {
  return `${rows}x${cols}:${tiles.map((tile) => isPassiveThermalCarrier(tile) ? tile.kind : '.').join(',')}`
}

/** Builds only when placement/enabled/damaged topology changes; heat changes reuse the cached graph. */
export function getThermalTopology(tiles: Array<Tile | null>, rows: number, cols: number): ThermalTopology {
  const signature = topologySignature(tiles, rows, cols)
  const cached = topologyCache.get(signature)
  if (cached) return cached

  const nodes: number[] = []
  const edges: ThermalEdge[] = []
  for (let index = 0; index < tiles.length; index += 1) {
    if (!isPassiveThermalCarrier(tiles[index])) continue
    nodes.push(index)
    const row = Math.floor(index / cols)
    const col = index % cols
    if (col < cols - 1 && isPassiveThermalCarrier(tiles[index + 1])) edges.push({ a: index, b: index + 1 })
    if (row < rows - 1 && isPassiveThermalCarrier(tiles[index + cols])) edges.push({ a: index, b: index + cols })
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

interface ActivePipeSource { index: number; entries: number[]; available: number; potential: number }
interface ActivePipeSink { index: number; entries: number[]; demand: number }
interface ResidualEdge { to: number; reverse: number; capacity: number; initial: number }
interface ActiveFlowResult { totalMoved: number; sourceMoved: Map<number, number>; sinkReceived: Map<number, number>; pipeUsed: Map<number, number> }

function orthogonalIndices(index: number, rows: number, cols: number): number[] {
  const row = Math.floor(index / cols)
  const col = index % cols
  return [row > 0 ? index - cols : -1, row < rows - 1 ? index + cols : -1, col > 0 ? index - 1 : -1, col < cols - 1 ? index + 1 : -1].filter((value) => value >= 0)
}

function activePipeComponents(tiles: Array<Tile | null>, rows: number, cols: number): number[][] {
  const active = new Set<number>()
  for (let index = 0; index < tiles.length; index += 1) {
    const tile = tiles[index]
    if (tile?.kind === 'pipe2' && tile.enabled && !tile.damaged) active.add(index)
  }
  const components: number[][] = []
  while (active.size > 0) {
    const start = active.values().next().value!
    const queue = [start]
    const component: number[] = []
    active.delete(start)
    while (queue.length > 0) {
      const index = queue.shift()!
      component.push(index)
      for (const adjacent of orthogonalIndices(index, rows, cols)) if (active.delete(adjacent)) queue.push(adjacent)
    }
    components.push(component)
  }
  return components
}

function runActiveFlow(
  component: number[],
  rows: number,
  cols: number,
  sources: ActivePipeSource[],
  sinks: ActivePipeSink[],
  pipeRemaining: Map<number, number>,
  sinkCaps: Map<number, number>,
): ActiveFlowResult {
  const orderedSources = [...sources].filter((source) => source.available > EPSILON).sort((a, b) => b.potential - a.potential || a.index - b.index)
  const orderedSinks = [...sinks].filter((sink) => (sinkCaps.get(sink.index) ?? 0) > EPSILON).sort((a, b) => a.index - b.index)
  const totalAvailable = orderedSources.reduce((sum, source) => sum + source.available, 0)
  const totalDemand = orderedSinks.reduce((sum, sink) => sum + (sinkCaps.get(sink.index) ?? 0), 0)
  const flowLimit = Math.min(totalAvailable, totalDemand)
  if (flowLimit <= EPSILON) return { totalMoved: 0, sourceMoved: new Map(), sinkReceived: new Map(), pipeUsed: new Map() }

  const sourceNode = 0
  let nextNode = 1
  const sourceNodes = new Map<number, number>()
  for (const source of orderedSources) sourceNodes.set(source.index, nextNode++)
  const pipeNodes = new Map<number, { input: number; output: number }>()
  for (const pipe of component) pipeNodes.set(pipe, { input: nextNode++, output: nextNode++ })
  const sinkNodes = new Map<number, number>()
  for (const sink of orderedSinks) sinkNodes.set(sink.index, nextNode++)
  const sinkNode = nextNode++
  const graph: ResidualEdge[][] = Array.from({ length: nextNode }, () => [])
  const addEdge = (from: number, to: number, capacity: number): ResidualEdge => {
    const forward: ResidualEdge = { to, reverse: graph[to].length, capacity, initial: capacity }
    const reverse: ResidualEdge = { to: from, reverse: graph[from].length, capacity: 0, initial: 0 }
    graph[from].push(forward)
    graph[to].push(reverse)
    return forward
  }
  const sourceEdges = new Map<number, ResidualEdge>()
  const pipeEdges = new Map<number, ResidualEdge>()
  const sinkEdges = new Map<number, ResidualEdge>()
  for (const source of orderedSources) {
    const node = sourceNodes.get(source.index)!
    sourceEdges.set(source.index, addEdge(sourceNode, node, source.available))
    for (const entry of source.entries) {
      const pipe = pipeNodes.get(entry)
      if (pipe) addEdge(node, pipe.input, flowLimit)
    }
  }
  for (const pipeIndex of component) {
    const pipe = pipeNodes.get(pipeIndex)!
    pipeEdges.set(pipeIndex, addEdge(pipe.input, pipe.output, Math.max(0, pipeRemaining.get(pipeIndex) ?? 0)))
    for (const adjacent of orthogonalIndices(pipeIndex, rows, cols)) {
      const neighbour = pipeNodes.get(adjacent)
      if (neighbour) addEdge(pipe.output, neighbour.input, flowLimit)
    }
  }
  for (const sink of orderedSinks) {
    const node = sinkNodes.get(sink.index)!
    for (const entry of sink.entries) {
      const pipe = pipeNodes.get(entry)
      if (pipe) addEdge(pipe.output, node, flowLimit)
    }
    sinkEdges.set(sink.index, addEdge(node, sinkNode, sinkCaps.get(sink.index) ?? 0))
  }

  let totalMoved = 0
  while (true) {
    const parentNode = new Int32Array(graph.length).fill(-1)
    const parentEdge = new Int32Array(graph.length).fill(-1)
    parentNode[sourceNode] = sourceNode
    const queue = [sourceNode]
    while (queue.length > 0 && parentNode[sinkNode] === -1) {
      const node = queue.shift()!
      for (let edgeIndex = 0; edgeIndex < graph[node].length; edgeIndex += 1) {
        const edge = graph[node][edgeIndex]
        if (parentNode[edge.to] !== -1 || edge.capacity <= EPSILON) continue
        parentNode[edge.to] = node
        parentEdge[edge.to] = edgeIndex
        queue.push(edge.to)
        if (edge.to === sinkNode) break
      }
    }
    if (parentNode[sinkNode] === -1) break
    let amount = Number.POSITIVE_INFINITY
    for (let node = sinkNode; node !== sourceNode; node = parentNode[node]) amount = Math.min(amount, graph[parentNode[node]][parentEdge[node]].capacity)
    if (amount <= EPSILON) break
    for (let node = sinkNode; node !== sourceNode; node = parentNode[node]) {
      const edge = graph[parentNode[node]][parentEdge[node]]
      edge.capacity -= amount
      graph[node][edge.reverse].capacity += amount
    }
    totalMoved += amount
  }

  const used = (edge: ResidualEdge) => Math.max(0, edge.initial - edge.capacity)
  return {
    totalMoved,
    sourceMoved: new Map([...sourceEdges].map(([index, edge]) => [index, used(edge)])),
    sinkReceived: new Map([...sinkEdges].map(([index, edge]) => [index, used(edge)])),
    pipeUsed: new Map([...pipeEdges].map(([index, edge]) => [index, used(edge)])),
  }
}

/**
 * Active Tier-II pipe transport. A continuous Pipe II component pulls from the
 * highest thermal potential first and routes heat only toward converters with
 * immediate demand. Every traversed pipe enforces its own per-tick throughput.
 */
export function pumpHeatThroughActivePipes(
  tiles: Array<Tile | null>,
  rows: number,
  cols: number,
  demandAt: (index: number) => number,
  capacityAt: (index: number) => number,
  throughputAt: (index: number) => number,
): ThermalDemandResult {
  const received = new Map<number, number>()
  const remainingDemand = new Map<number, number>()
  let totalMoved = 0

  for (let index = 0; index < tiles.length; index += 1) {
    const tile = tiles[index]
    if (tile && (tile.kind === 'generator' || tile.kind === 'generator2') && tile.enabled && !tile.damaged) remainingDemand.set(index, Math.max(0, demandAt(index)))
  }

  for (const component of activePipeComponents(tiles, rows, cols)) {
    const componentSet = new Set(component)
    const externalEntries = new Map<number, Set<number>>()
    const sinkEntries = new Map<number, Set<number>>()
    for (const pipeIndex of component) {
      for (const adjacent of orthogonalIndices(pipeIndex, rows, cols)) {
        const tile = tiles[adjacent]
        if (!tile || !tile.enabled || tile.damaged) continue
        if ((tile.kind === 'generator' || tile.kind === 'generator2') && (remainingDemand.get(adjacent) ?? 0) > EPSILON) {
          if (!sinkEntries.has(adjacent)) sinkEntries.set(adjacent, new Set())
          sinkEntries.get(adjacent)!.add(pipeIndex)
        } else if (!componentSet.has(adjacent) && isThermalCarrier(tile) && tile.heat > EPSILON) {
          if (!externalEntries.has(adjacent)) externalEntries.set(adjacent, new Set())
          externalEntries.get(adjacent)!.add(pipeIndex)
        }
      }
    }
    const sources: ActivePipeSource[] = []
    for (const [index, entries] of externalEntries) {
      const tile = tiles[index]!
      const capacity = capacityAt(index)
      sources.push({ index, entries: [...entries], available: Math.max(0, tile.heat), potential: capacity > 0 ? Math.max(0, tile.heat) / capacity : 0 })
    }
    for (const index of component) {
      const tile = tiles[index]!
      if (tile.heat <= EPSILON) continue
      const capacity = capacityAt(index)
      sources.push({ index, entries: [index], available: Math.max(0, tile.heat), potential: capacity > 0 ? Math.max(0, tile.heat) / capacity : 0 })
    }
    const sinks: ActivePipeSink[] = [...sinkEntries].map(([index, entries]) => ({ index, entries: [...entries], demand: remainingDemand.get(index) ?? 0 }))
    if (sources.length === 0 || sinks.length === 0) continue
    const pipeRemaining = new Map(component.map((index) => [index, Math.max(0, throughputAt(index))]))
    const totalDemand = sinks.reduce((sum, sink) => sum + sink.demand, 0)
    const totalAvailable = sources.reduce((sum, source) => sum + source.available, 0)
    let low = 0
    let high = Math.min(1, totalDemand > 0 ? totalAvailable / totalDemand : 0)
    // A single sink needs no fairness search, which keeps ordinary and offline
    // simulation cheap. Multiple sinks use max-min fairness before leftovers.
    if (sinks.length > 1) {
      for (let iteration = 0; iteration < 24; iteration += 1) {
        const fraction = (low + high) / 2
        const caps = new Map(sinks.map((sink) => [sink.index, sink.demand * fraction]))
        const result = runActiveFlow(component, rows, cols, sources, sinks, pipeRemaining, caps)
        const target = sinks.reduce((sum, sink) => sum + sink.demand * fraction, 0)
        if (result.totalMoved + Math.max(EPSILON, target * 1e-9) >= target) low = fraction
        else high = fraction
      }
    }

    const applyResult = (result: ActiveFlowResult) => {
      totalMoved += result.totalMoved
      for (const source of sources) {
        const moved = result.sourceMoved.get(source.index) ?? 0
        source.available = Math.max(0, source.available - moved)
        const tile = tiles[source.index]
        if (tile) {
          tile.heat = Math.max(0, tile.heat - moved)
          if (tile.kind !== 'pipe2') tile.flow += moved
        }
      }
      for (const [index, amount] of result.sinkReceived) {
        remainingDemand.set(index, Math.max(0, (remainingDemand.get(index) ?? 0) - amount))
        received.set(index, (received.get(index) ?? 0) + amount)
        const tile = tiles[index]
        if (tile) tile.flow += amount
      }
      for (const [index, amount] of result.pipeUsed) {
        pipeRemaining.set(index, Math.max(0, (pipeRemaining.get(index) ?? 0) - amount))
        const tile = tiles[index]
        if (tile) tile.flow += amount
      }
    }

    if (low > EPSILON) applyResult(runActiveFlow(component, rows, cols, sources, sinks, pipeRemaining, new Map(sinks.map((sink) => [sink.index, sink.demand * low]))))
    const remainingCaps = new Map(sinks.map((sink) => [sink.index, remainingDemand.get(sink.index) ?? 0]))
    applyResult(runActiveFlow(component, rows, cols, sources, sinks, pipeRemaining, remainingCaps))
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
