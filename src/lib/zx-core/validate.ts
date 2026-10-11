import type { DiagramScalar, ZXEdge, ZXGraph3D, ZXNode } from '../../types/zx'
import {
  HALF,
  ONE,
  PI,
  ZERO,
  ZERO_SCALAR,
  addScalar,
  classifyNode,
  conjScalar,
  contractNetwork,
  discardState,
  hadamardMatrix,
  ketZero,
  mulScalar,
  parsePhase,
  sameMatrix,
  sameScalar,
  spiderAmplitudes,
  spiderMap,
  type SpiderColor,
} from './semantics'

/** Book words. seguro: causal. tal vez: postselected. fugas: a quantum wire lost inside. ruido: the discard turned upside down. */
export type DiagramClass = 'seguro' | 'tal vez' | 'fugas' | 'ruido'

export interface Denotation {
  wellFormed: boolean
  reason?: string
  /** Legless factor, kept visible even when the linear map already includes it. */
  number: DiagramScalar
  /** Generator scalars baked into `map`. A scalar placed beside a diagram is not. */
  numberInMap: boolean
  inputs: number
  outputs: number
  /** Linear map with generator scalars included. A state is a single column. */
  map: DiagramScalar[][]
  state?: DiagramScalar[]
  /** Mixed state. Set when a wire is lost inside, or when the discard is flipped into noise. */
  density?: DiagramScalar[][]
  /** Discard of a pure state. The naked cup closes to 2. */
  closed?: DiagramScalar
  pure: boolean
  safe: boolean
  mark?: DiagramClass
  circuit: boolean
  /** Measure, then encode: the phase is gone. */
  erasesPhase?: boolean
}

interface Tensor {
  legs: string[]
  data: DiagramScalar[]
}

const bitAt = (index: number, qubit: number, qubits: number) => (index >> (qubits - 1 - qubit)) & 1

const portIndex = (node: ZXNode) => {
  if (node.wire >= 0) return node.wire
  const match = /(\d+)$/.exec(node.id)
  return match ? Number(match[1]) : 0
}

const isCircuitInput = (node: ZXNode) =>
  node.kind === 'boundary' && (node.label === '|0⟩' || (!node.custom && node.id.startsWith('in-')))

const isInBoundary = (node: ZXNode) => {
  if (node.kind !== 'boundary') return false
  if (node.label === 'in' || node.label === '|0⟩') return true
  return !node.custom && node.id.startsWith('in-')
}

const isOutBoundary = (node: ZXNode) => {
  if (node.kind !== 'boundary') return false
  const kind = classifyNode(node)?.type
  if (kind === 'discard' || kind === 'measure' || kind === 'encode') return false
  if (node.label === 'out' || node.label === '⟩') return true
  return !node.custom && node.id.startsWith('out-')
}

const isCircuit = (graph: ZXGraph3D) =>
  graph.nodes.some((node) => node.gateId !== undefined || (!node.custom && (node.id.startsWith('in-') || node.id.startsWith('out-'))))

const numberOf = (graph: ZXGraph3D) => (graph.numbers ?? []).reduce(mulScalar, ONE)

/** A Hadamard edge is a generator. Using it as the plain wire of a fusion is not. */
export function fusionAlong(edge: ZXEdge): { wellFormed: boolean; reason?: string } {
  if (edge.hadamard) return { wellFormed: false, reason: 'A Hadamard edge cannot be the wire of a fusion.' }
  return { wellFormed: true }
}

function malformed(graph: ZXGraph3D): string | undefined {
  const ids = new Set(graph.nodes.map((node) => node.id))
  for (const edge of graph.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) return 'An edge names a node that is not in the diagram.'
  }
  for (const node of graph.nodes) {
    if (node.kind !== 'z' && node.kind !== 'x' && node.kind !== 'hadamard' && node.kind !== 'boundary') {
      return 'A spider only has two colours.'
    }
    if ((node.kind === 'z' || node.kind === 'x') && parsePhase(node.phase) === undefined) return 'The phase cannot be read.'
    if (classifyNode(node) === undefined) return 'This node is not a generator.'
  }
  return undefined
}

function downstreamOfMeasure(graph: ZXGraph3D): Set<string> {
  const pending = graph.nodes.filter((node) => classifyNode(node)?.type === 'measure').map((node) => node.id)
  const seen = new Set<string>()
  while (pending.length) {
    const id = pending.pop()
    if (id === undefined || seen.has(id)) continue
    seen.add(id)
    for (const edge of graph.edges) if (edge.source === id) pending.push(edge.target)
  }
  return seen
}

function wiresOf(nodes: ZXNode[]): number[] {
  if (!nodes.length) return []
  return [...new Set(nodes.map(portIndex))].sort((left, right) => left - right)
}

function inputNodes(graph: ZXGraph3D, downstream: Set<string>) {
  return graph.nodes.filter((node) => !downstream.has(node.id) && isInBoundary(node))
}

function outputNodes(graph: ZXGraph3D, downstream: Set<string>) {
  return graph.nodes.filter((node) => {
    const kind = classifyNode(node)?.type
    if (kind === 'measure') return true
    if (downstream.has(node.id)) return false
    return kind === 'discard' || isOutBoundary(node)
  })
}

const identityTensor = (left: string, right: string): Tensor => ({
  legs: [left, right],
  data: [ONE, ZERO_SCALAR, ZERO_SCALAR, ONE],
})

const hadamardTensor = (left: string, right: string): Tensor => {
  const [row0, row1] = hadamardMatrix()
  return { legs: [left, right], data: [row0[0], row1[0], row0[1], row1[1]] }
}

function legName(node: ZXNode, edgeId: string): string {
  const kind = classifyNode(node)?.type
  if (kind === 'measure' || kind === 'discard') return `out:${portIndex(node)}`
  if (isCircuitInput(node)) return `in:${node.wire}`
  if (isInBoundary(node)) return `in:${portIndex(node)}`
  if (isOutBoundary(node) || (!node.custom && node.id.startsWith('out-'))) return `out:${portIndex(node)}`
  return `${edgeId}@${node.id}`
}

function network(graph: ZXGraph3D, plugZeros: boolean): Tensor {
  const downstream = downstreamOfMeasure(graph)
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
  const tensors: Tensor[] = []
  for (const edge of graph.edges) {
    if (downstream.has(edge.source)) continue
    const source = nodes.get(edge.source)
    const target = nodes.get(edge.target)
    if (!source || !target) continue
    const left = legName(source, edge.id)
    const right = downstream.has(edge.target) ? `out:${target.wire}` : legName(target, edge.id)
    tensors.push(edge.hadamard ? hadamardTensor(left, right) : identityTensor(left, right))
  }
  for (const node of graph.nodes) {
    if (downstream.has(node.id)) continue
    if (node.kind !== 'z' && node.kind !== 'x' && node.kind !== 'hadamard') continue
    const legs = graph.edges
      .filter((edge) => !downstream.has(edge.source) && (edge.source === node.id || edge.target === node.id))
      .map((edge) => `${edge.id}@${node.id}`)
    if (node.kind === 'hadamard') {
      const [row0, row1] = hadamardMatrix()
      tensors.push({ legs, data: legs.length === 2 ? [row0[0], row1[0], row0[1], row1[1]] : [ONE] })
      continue
    }
    const phase = parsePhase(node.phase || '0') ?? ZERO
    const data = spiderAmplitudes(node.kind, phase, legs.length).map((entry) => mulScalar(entry, node.number ?? ONE))
    tensors.push({ legs, data })
  }
  if (plugZeros) {
    for (const node of graph.nodes) {
      if (!isCircuitInput(node) || downstream.has(node.id)) continue
      tensors.push({ legs: [`in:${node.wire}`], data: ketZero() })
    }
  }
  const contracted = contractNetwork(tensors)
  const number = numberOf(graph)
  return { legs: contracted.legs, data: contracted.data.map((entry) => mulScalar(entry, number)) }
}

function amplitudeAt(tensor: Tensor, assignment: Record<string, number>) {
  const index = tensor.legs.reduce((bits, leg, place) => bits | ((assignment[leg] ?? 0) << place), 0)
  return tensor.data[index] ?? ZERO_SCALAR
}

function readMap(tensor: Tensor, inputs: number, outputs: number): DiagramScalar[][] {
  const rows = outputs === 0 ? 1 : 1 << outputs
  const columns = inputs === 0 ? 1 : 1 << inputs
  return Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => {
    const assignment: Record<string, number> = {}
    for (let qubit = 0; qubit < inputs; qubit += 1) assignment[`in:${qubit}`] = bitAt(column, qubit, inputs)
    for (let qubit = 0; qubit < outputs; qubit += 1) assignment[`out:${qubit}`] = bitAt(row, qubit, outputs)
    return amplitudeAt(tensor, assignment)
  }))
}

function unitColumns(map: DiagramScalar[][]): boolean {
  if (!map.length || !map[0].length) return false
  for (let column = 0; column < map[0].length; column += 1) {
    let norm = ZERO_SCALAR
    for (const row of map) norm = addScalar(norm, mulScalar(conjScalar(row[column]), row[column]))
    if (!sameScalar(norm, ONE)) return false
  }
  return true
}

function isFlippedDiscard(graph: ZXGraph3D) {
  return graph.nodes.some((node) => {
    if (classifyNode(node)?.type !== 'discard' && node.label !== 'ruido') return false
    const outgoing = graph.edges.some((edge) => edge.source === node.id)
    const incoming = graph.edges.some((edge) => edge.target === node.id)
    return outgoing && !incoming
  })
}

function isLoneDiscard(graph: ZXGraph3D) {
  const discards = graph.nodes.filter((node) => classifyNode(node)?.type === 'discard')
  return discards.length === 1 && graph.nodes.length === 2 && graph.edges.length === 1 && graph.nodes.some(isInBoundary)
}

function isPostselected(graph: ZXGraph3D) {
  const spiders = graph.nodes.filter((node) => node.kind === 'z' || node.kind === 'x')
  if (spiders.length !== 1) return false
  const inputs = graph.nodes.filter(isInBoundary).length
  const outputs = graph.nodes.filter((node) => isOutBoundary(node) || classifyNode(node)?.type === 'measure').length
  return inputs >= 1 && outputs === 0
}

function forgetsBit(graph: ZXGraph3D) {
  return graph.nodes.some((node) => {
    if (classifyNode(node)?.type !== 'measure') return false
    return graph.edges.some((edge) => {
      if (edge.source !== node.id) return false
      const target = graph.nodes.find((item) => item.id === edge.target)
      return target !== undefined && classifyNode(target)?.type === 'encode'
    })
  })
}

function withoutQubit(index: number, qubit: number, qubits: number) {
  const shift = qubits - 1 - qubit
  const lower = index & ((1 << shift) - 1)
  const upper = index >> (shift + 1)
  return (upper << shift) | lower
}

/** Partial trace of a pure state. Qubit 0 is the left ket index. The traced qubit is dropped. */
export function partialTrace(state: DiagramScalar[], qubits: number, drop: number): DiagramScalar[][] {
  const kept = qubits - 1
  const size = 1 << Math.max(kept, 0)
  const density = Array.from({ length: size }, () => Array.from({ length: size }, () => ZERO_SCALAR))
  for (let left = 0; left < state.length; left += 1) {
    for (let right = 0; right < state.length; right += 1) {
      if (bitAt(left, drop, qubits) !== bitAt(right, drop, qubits)) continue
      const row = withoutQubit(left, drop, qubits)
      const column = withoutQubit(right, drop, qubits)
      density[row][column] = addScalar(density[row][column], mulScalar(state[left], conjScalar(state[right])))
    }
  }
  return density
}

/** One-qubit noise: the discard turned upside down. It is the partial trace of a normalised Bell state. */
export function noise(): DiagramScalar[][] {
  return [
    [HALF, ZERO_SCALAR],
    [ZERO_SCALAR, HALF],
  ]
}

/**
 * Phase-0 test and phase-π test, same colour, close to the discard.
 * X effects already include 1/√2. Z effects are the raw spiders, so their probabilities are halved.
 */
export function phaseTestsDiscard(color: SpiderColor, state: DiagramScalar[]): DiagramScalar {
  const amplitude = (effect: DiagramScalar[]) =>
    state.reduce((sum, entry, index) => addScalar(sum, mulScalar(effect[index] ?? ZERO_SCALAR, entry)), ZERO_SCALAR)
  const probability = (effect: DiagramScalar[]) => {
    const value = amplitude(effect)
    return mulScalar(conjScalar(value), value)
  }
  const sum = addScalar(probability(spiderMap(color, ZERO, 1, 0).map), probability(spiderMap(color, PI, 1, 0).map))
  return color === 'z' ? mulScalar(HALF, sum) : sum
}

/** Measure, then encode. Populations stay. The phase between them does not. */
export function forgetPhase(state: DiagramScalar[]): DiagramScalar[][] {
  return state.map((amplitude, row) => state.map((_, column) => {
    if (row !== column) return ZERO_SCALAR
    return mulScalar(amplitude, conjScalar(amplitude))
  }))
}

function blank(graph: ZXGraph3D, reason: string): Denotation {
  return {
    wellFormed: false,
    reason,
    number: ONE,
    numberInMap: true,
    inputs: 0,
    outputs: 0,
    map: [],
    pure: false,
    safe: false,
    circuit: isCircuit(graph),
  }
}

function fixed(graph: ZXGraph3D, mark: DiagramClass, map: DiagramScalar[][], extra: Partial<Denotation> = {}): Denotation {
  return {
    wellFormed: true,
    number: numberOf(graph),
    numberInMap: true,
    inputs: extra.inputs ?? 0,
    outputs: extra.outputs ?? 0,
    map,
    pure: extra.pure ?? (mark === 'seguro' || mark === 'tal vez'),
    safe: extra.safe ?? mark === 'seguro',
    mark,
    circuit: isCircuit(graph),
    ...(extra.density ? { density: extra.density } : {}),
  }
}

/**
 * Map and number of a diagram. Positions are ignored. The diagram is not rewritten:
 * two drawings with the same map stay two drawings until a rule of BL-4 is cited.
 * Measurement is not part of the unitary map. The map stops at the boundary that stores the bit.
 */
export function denote(graph: ZXGraph3D): Denotation {
  const reason = malformed(graph)
  if (reason) return blank(graph, reason)
  if (isFlippedDiscard(graph)) {
    return fixed(graph, 'ruido', noise(), { inputs: 0, outputs: 1, density: noise(), pure: false, safe: false })
  }
  if (isLoneDiscard(graph)) {
    return fixed(graph, 'seguro', [[ONE]], { inputs: 1, outputs: 0, pure: true, safe: true })
  }

  const downstream = downstreamOfMeasure(graph)
  const inputs = wiresOf(inputNodes(graph, downstream))
  const outputs = wiresOf(outputNodes(graph, downstream))
  const number = numberOf(graph)
  const map = readMap(network(graph, false), inputs.length, outputs.length)
  const plugs = graph.nodes.some((node) => isCircuitInput(node) && !downstream.has(node.id))
  const state = plugs
    ? readMap(network(graph, true), 0, outputs.length).map((row) => row[0])
    : inputs.length === 0
      ? map.map((row) => row[0])
      : undefined
  const closed = state ? discardState(state) : undefined
  const base: Denotation = {
    wellFormed: true,
    number,
    numberInMap: true,
    inputs: inputs.length,
    outputs: outputs.length,
    map,
    ...(state ? { state, closed } : {}),
    pure: true,
    safe: false,
    circuit: isCircuit(graph),
  }

  if (forgetsBit(graph)) return { ...base, mark: 'fugas', erasesPhase: true, pure: false, safe: false }
  if (isPostselected(graph)) return { ...base, mark: 'tal vez', safe: false }

  const discarded = graph.nodes.filter((node) => !downstream.has(node.id) && classifyNode(node)?.type === 'discard')
  if (discarded.length && state && outputs.length > discarded.length) {
    const drop = outputs.indexOf(portIndex(discarded[0]))
    const density = partialTrace(state, outputs.length, drop)
    const kept = outputs.length - 1
    return {
      ...base,
      inputs: 0,
      outputs: kept,
      map: density,
      state: undefined,
      closed: undefined,
      density,
      pure: false,
      safe: false,
      mark: 'fugas',
    }
  }

  const safe = inputs.length > 0 ? unitColumns(map) : state !== undefined && sameScalar(discardState(state), ONE)
  return { ...base, safe, ...(safe ? { mark: 'seguro' as const } : {}) }
}

/** Denotations agree only when the linear map and the number both agree. */
export function sameDenotation(left: Denotation, right: Denotation): boolean {
  if (!left.wellFormed || !right.wellFormed) return false
  return sameScalar(left.number, right.number) && sameMatrix(left.map, right.map)
}

/** Same wires and spiders. A node that only changed its place on the page is the same diagram. */
export function sameConnections(left: ZXGraph3D, right: ZXGraph3D): boolean {
  const signature = (graph: ZXGraph3D) => JSON.stringify({
    nodes: graph.nodes
      .map(({ id, kind, phase, wire, label, gateId, custom, symbol, number }) => ({ id, kind, phase, wire, label, gateId, custom, symbol, number }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    edges: graph.edges
      .map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, hadamard: edge.hadamard ?? false }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    numbers: graph.numbers ?? [],
  })
  return signature(left) === signature(right)
}

/**
 * A legless scalar placed beside a state multiplies the closed diagram once.
 * It is not a coefficient of the ket, so the cup's 1/2 turns the discard 2 into 1.
 */
export function beside(report: Denotation, side: DiagramScalar): Denotation {
  if (!report.wellFormed || !report.state) return report
  const closed = mulScalar(side, discardState(report.state))
  const safe = sameScalar(closed, ONE)
  return {
    ...report,
    number: side,
    numberInMap: false,
    closed,
    safe,
    mark: safe ? 'seguro' : report.mark,
  }
}
