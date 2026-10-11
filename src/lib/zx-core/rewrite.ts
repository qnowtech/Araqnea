import type { CircuitGate, QuantumCircuit } from '../../types/circuit'
import type { DiagramScalar, ZXEdge, ZXGraph3D, ZXNode } from '../../types/zx'
import {
  HALF,
  INV_SQRT2,
  ONE,
  PI,
  ZERO,
  addPhase,
  flipPhase,
  gateFromSpider,
  mulScalar,
  parsePhase,
  phaseFromTurns,
  phaseLabel,
  phaseScalar,
  phasesEqual,
  sameScalar,
  spiderMap,
  type Phase,
  type SpiderColor,
} from './semantics'

export type RuleName = 'fuse' | 'identity' | 'color' | 'copy' | 'pi' | 'legs' | 'square' | 'last'

export interface RewriteAt {
  nodes: string[]
  /** Edge ids that the second spider takes when fuse is read backwards. */
  legs?: string[]
  /** Neighbour, or edge, through which a Hadamard is pushed. */
  through?: string
}

export type RewriteResult =
  | { ok: true; rule: RuleName; graph: ZXGraph3D }
  | { ok: false; rule: RuleName; error: string }

const fail = (rule: RuleName, error: string): RewriteResult => ({ ok: false, rule, error })

const clone = (graph: ZXGraph3D): ZXGraph3D => ({
  nodes: graph.nodes.map((node) => ({
    ...node,
    position: { ...node.position },
    ...(node.number ? { number: { ...node.number } } : {}),
  })),
  edges: graph.edges.map((edge) => ({ ...edge })),
  ...(graph.numbers ? { numbers: graph.numbers.map((number) => ({ ...number })) } : {}),
})

const byId = (graph: ZXGraph3D, id: string) => graph.nodes.find((node) => node.id === id)

const phaseOf = (node: ZXNode): Phase | undefined => parsePhase(node.phase || '0')

const isSpider = (node: ZXNode | undefined): node is ZXNode => node?.kind === 'z' || node?.kind === 'x'

const touching = (edge: ZXEdge, id: string) => edge.source === id || edge.target === id

const incident = (graph: ZXGraph3D, id: string) => graph.edges.filter((edge) => touching(edge, id))

const between = (graph: ZXGraph3D, left: string, right: string) =>
  graph.edges.filter((edge) => (edge.source === left && edge.target === right) || (edge.source === right && edge.target === left))

const plainBetween = (graph: ZXGraph3D, left: string, right: string) => between(graph, left, right).filter((edge) => !edge.hadamard)

const otherEnd = (edge: ZXEdge, id: string) => (edge.source === id ? edge.target : edge.source)

const product = (values: DiagramScalar[]) => values.reduce(mulScalar, ONE)

const giveNumber = (graph: ZXGraph3D, factor: DiagramScalar) => {
  if (sameScalar(factor, ONE)) return
  graph.numbers = [...(graph.numbers ?? []), factor]
}

const dropNode = (graph: ZXGraph3D, id: string) => {
  graph.nodes = graph.nodes.filter((node) => node.id !== id)
  graph.edges = graph.edges.filter((edge) => !touching(edge, id))
}

/**
 * Cites one rule and returns the other diagram. The OpenQASM is not part of this
 * diagram, so the text of the circuit stays where it was.
 */
export function apply(graph: ZXGraph3D, rule: RuleName, at: RewriteAt): RewriteResult {
  const next = clone(graph)
  if (rule === 'fuse') return at.legs ? unfuse(next, at) : fuse(next, at)
  if (rule === 'identity') return identity(next, at)
  if (rule === 'color') return color(next, at)
  if (rule === 'copy') return copy(next, at)
  if (rule === 'pi') return pi(next, at)
  if (rule === 'legs') return legs(next, at)
  if (rule === 'square') return square(next, at)
  return last(next, at)
}

function fuse(graph: ZXGraph3D, at: RewriteAt): RewriteResult {
  const [leftId, rightId] = at.nodes
  const left = byId(graph, leftId ?? '')
  const right = byId(graph, rightId ?? '')
  if (!isSpider(left) || !isSpider(right)) return fail('fuse', 'Fusion joins two spiders.')
  if (left.kind !== right.kind) return fail('fuse', 'Different colours do not fuse.')
  const shared = between(graph, left.id, right.id)
  if (!shared.length) return fail('fuse', 'These spiders do not touch.')
  const plain = shared.filter((edge) => !edge.hadamard)
  if (!plain.length) return fail('fuse', 'A Hadamard edge is not a fusion wire.')
  const leftPhase = phaseOf(left)
  const rightPhase = phaseOf(right)
  if (!leftPhase || !rightPhase) return fail('fuse', 'The phase cannot be read.')
  const id = `fuse-${left.id}-${right.id}`
  const fused: ZXNode = {
    id,
    kind: left.kind,
    phase: phaseLabel(addPhase(leftPhase, rightPhase)),
    wire: left.wire,
    position: {
      x: (left.position.x + right.position.x) / 2,
      y: (left.position.y + right.position.y) / 2,
      z: (left.position.z + right.position.z) / 2,
    },
    ...(left.number || right.number ? { number: product([left.number ?? ONE, right.number ?? ONE]) } : {}),
  }
  const sharedIds = new Set(plain.map((edge) => edge.id))
  for (const edge of graph.edges) {
    if (sharedIds.has(edge.id)) continue
    if (edge.source === left.id || edge.source === right.id) edge.source = id
    if (edge.target === left.id || edge.target === right.id) edge.target = id
  }
  graph.edges = graph.edges.filter((edge) => !sharedIds.has(edge.id))
  graph.nodes = graph.nodes.filter((node) => node.id !== left.id && node.id !== right.id)
  graph.nodes.push(fused)
  return { ok: true, rule: 'fuse', graph }
}

function unfuse(graph: ZXGraph3D, at: RewriteAt): RewriteResult {
  const spider = byId(graph, at.nodes[0] ?? '')
  if (!isSpider(spider)) return fail('fuse', 'Fusion joins two spiders.')
  const phase = phaseOf(spider)
  if (!phase) return fail('fuse', 'The phase cannot be read.')
  const owned = new Set(at.legs ?? [])
  const legs = incident(graph, spider.id)
  if (!owned.size || legs.every((edge) => owned.has(edge.id)) || legs.every((edge) => !owned.has(edge.id))) {
    return fail('fuse', 'The split has to give each spider some of the legs.')
  }
  const first: ZXNode = { ...spider, id: `${spider.id}-a`, phase: phaseLabel(phase) }
  const second: ZXNode = { ...spider, id: `${spider.id}-b`, phase: '0', position: { ...spider.position, x: spider.position.x + 40 }, number: undefined }
  delete second.number
  for (const edge of legs) {
    const host = owned.has(edge.id) ? second.id : first.id
    if (edge.source === spider.id) edge.source = host
    if (edge.target === spider.id) edge.target = host
  }
  graph.edges.push({ id: `${spider.id}-join`, source: first.id, target: second.id })
  graph.nodes = graph.nodes.filter((node) => node.id !== spider.id)
  graph.nodes.push(first, second)
  return { ok: true, rule: 'fuse', graph }
}

function identity(graph: ZXGraph3D, at: RewriteAt): RewriteResult {
  if (at.nodes.length === 2) return cancelHadamards(graph, at.nodes[0], at.nodes[1])
  const node = byId(graph, at.nodes[0] ?? '')
  if (!node) return fail('identity', 'That spider is not in the diagram.')
  if (node.kind === 'hadamard') return fail('identity', 'Two Hadamards in a row are the wire.')
  if (!isSpider(node)) return fail('identity', 'Only a phase-0 spider with one input and one output is the wire.')
  const phase = phaseOf(node)
  if (!phase || !phasesEqual(phase, ZERO)) return fail('identity', 'Only a phase of 0 is the wire.')
  const incoming = incident(graph, node.id).filter((edge) => edge.target === node.id)
  const outgoing = incident(graph, node.id).filter((edge) => edge.source === node.id)
  if (incoming.length === 0 && outgoing.length === 2) return fail('identity', 'The cup stays. It is not the wire.')
  if (incoming.length === 2 && outgoing.length === 0) return fail('identity', 'The cap stays. It is not the wire.')
  if (incoming.length !== 1 || outgoing.length !== 1) return fail('identity', 'Only a phase-0 spider with one input and one output is the wire.')
  if (incoming[0].hadamard || outgoing[0].hadamard) return fail('identity', 'Only a phase-0 spider with one input and one output is the wire.')
  const source = incoming[0].source
  const target = outgoing[0].target
  giveNumber(graph, node.number ?? ONE)
  graph.edges = graph.edges.filter((edge) => edge.id !== incoming[0].id && edge.id !== outgoing[0].id)
  graph.edges.push({ id: `${node.id}-wire`, source, target })
  graph.nodes = graph.nodes.filter((item) => item.id !== node.id)
  return { ok: true, rule: 'identity', graph }
}

function cancelHadamards(graph: ZXGraph3D, leftId: string, rightId: string): RewriteResult {
  const left = byId(graph, leftId)
  const right = byId(graph, rightId)
  if (left?.kind !== 'hadamard' || right?.kind !== 'hadamard') return fail('identity', 'Two Hadamards in a row are the wire.')
  const middle = between(graph, left.id, right.id).filter((edge) => !edge.hadamard)
  if (middle.length !== 1) return fail('identity', 'Two Hadamards in a row are the wire.')
  const outer = (id: string) => incident(graph, id).filter((edge) => edge.id !== middle[0].id)
  const leftOuter = outer(left.id)
  const rightOuter = outer(right.id)
  if (leftOuter.length !== 1 || rightOuter.length !== 1) return fail('identity', 'Two Hadamards in a row are the wire.')
  const entering = (edge: ZXEdge, id: string) => edge.target === id
  const upstream = entering(leftOuter[0], left.id) ? leftOuter[0].source : otherEnd(rightOuter[0], right.id)
  const downstream = entering(leftOuter[0], left.id) ? otherEnd(rightOuter[0], right.id) : leftOuter[0].source
  graph.edges = graph.edges.filter((edge) => !touching(edge, left.id) && !touching(edge, right.id))
  graph.edges.push({ id: `${left.id}-wire`, source: upstream, target: downstream })
  graph.nodes = graph.nodes.filter((node) => node.id !== left.id && node.id !== right.id)
  return { ok: true, rule: 'identity', graph }
}

interface Decoration {
  kind: 'edge' | 'box'
  boxId?: string
}

function decoration(graph: ZXGraph3D, edge: ZXEdge, spiderId: string): Decoration | undefined {
  if (edge.hadamard) return { kind: 'edge' }
  const neighbour = byId(graph, otherEnd(edge, spiderId))
  if (neighbour?.kind !== 'hadamard') return undefined
  if (incident(graph, neighbour.id).length !== 2) return undefined
  return { kind: 'box', boxId: neighbour.id }
}

function removeBox(graph: ZXGraph3D, spiderId: string, edge: ZXEdge, boxId: string) {
  const boxEdges = incident(graph, boxId)
  const outer = boxEdges.find((item) => item.id !== edge.id)
  const outside = outer ? otherEnd(outer, boxId) : spiderId
  const spiderIsSource = edge.source === spiderId || outer?.target === spiderId
  graph.edges = graph.edges.filter((item) => item.id !== edge.id && item.id !== outer?.id)
  graph.nodes = graph.nodes.filter((node) => node.id !== boxId)
  graph.edges.push({
    id: `${boxId}-plain`,
    source: spiderIsSource ? spiderId : outside,
    target: spiderIsSource ? outside : spiderId,
  })
}

function clearDecoration(graph: ZXGraph3D, spiderId: string, edge: ZXEdge, mark: Decoration) {
  if (mark.kind === 'edge') {
    edge.hadamard = false
    return edge
  }
  removeBox(graph, spiderId, edge, mark.boxId ?? '')
  return incident(graph, spiderId).find((item) => item.id.endsWith('-plain'))
}

function color(graph: ZXGraph3D, at: RewriteAt): RewriteResult {
  const spider = byId(graph, at.nodes[0] ?? '')
  if (!isSpider(spider)) return fail('color', 'Hadamard changes the colour of a spider.')
  const marked = () => incident(graph, spider.id).map((edge) => ({ edge, mark: decoration(graph, edge, spider.id) }))
  const legs = marked()
  if (!at.through) {
    if (legs.some((item) => !item.mark)) return fail('color', 'Hadamard on every leg changes the colour.')
    for (const item of legs) if (item.mark) clearDecoration(graph, spider.id, item.edge, item.mark)
    spider.kind = spider.kind === 'z' ? 'x' : 'z'
    return { ok: true, rule: 'color', graph }
  }
  const entry = legs.find((item) => item.edge.id === at.through || otherEnd(item.edge, spider.id) === at.through)
  if (!entry?.mark) return fail('color', 'That leg has no Hadamard to push.')
  const outside = entry.mark.kind === 'box'
    ? otherEnd(incident(graph, entry.mark.boxId ?? '').find((edge) => edge.id !== entry.edge.id) ?? entry.edge, entry.mark.boxId ?? '')
    : otherEnd(entry.edge, spider.id)
  clearDecoration(graph, spider.id, entry.edge, entry.mark)
  spider.kind = spider.kind === 'z' ? 'x' : 'z'
  for (const item of marked()) {
    if (otherEnd(item.edge, spider.id) === outside) continue
    if (item.mark?.kind === 'edge') item.edge.hadamard = false
    else if (item.mark?.boxId) clearDecoration(graph, spider.id, item.edge, item.mark)
    else item.edge.hadamard = true
  }
  return { ok: true, rule: 'color', graph }
}

function copy(graph: ZXGraph3D, at: RewriteAt): RewriteResult {
  const [stateId, spiderId] = at.nodes
  const state = byId(graph, stateId ?? '')
  const spider = byId(graph, spiderId ?? '')
  if (!isSpider(state) || !isSpider(spider)) return fail('copy', 'Copy uses a one-leg spider and a spider of the other colour.')
  if (state.kind === spider.kind) return fail('copy', 'The same colour does not copy. It fuses.')
  const stateLegs = incident(graph, state.id)
  if (stateLegs.length !== 1) return fail('copy', 'Only a one-leg spider is copied.')
  const link = plainBetween(graph, state.id, spider.id)
  if (link.length !== 1) return fail('copy', 'A Hadamard edge is not a wire of copy.')
  const others = incident(graph, spider.id).filter((edge) => edge.id !== link[0].id)
  if (!others.length) return fail('copy', 'There is no leg left to copy onto.')
  others.forEach((edge, index) => {
    const copyId = `${state.id}-copy-${index}`
    const neighbour = otherEnd(edge, spider.id)
    const spiderWasSource = edge.source === spider.id
    graph.nodes.push({
      ...state,
      id: copyId,
      position: { ...state.position, y: state.position.y + index },
      ...(state.number ? { number: { ...state.number } } : {}),
    })
    edge.source = spiderWasSource ? copyId : neighbour
    edge.target = spiderWasSource ? neighbour : copyId
  })
  giveNumber(graph, spider.number ?? ONE)
  // Each copy past the first brings an extra 1/√2 from the spider normalisation.
  for (let index = 1; index < others.length; index += 1) giveNumber(graph, INV_SQRT2)
  dropNode(graph, state.id)
  dropNode(graph, spider.id)
  return { ok: true, rule: 'copy', graph }
}

function pi(graph: ZXGraph3D, at: RewriteAt): RewriteResult {
  const [upstreamId, downstreamId] = at.nodes
  const upstream = byId(graph, upstreamId ?? '')
  const downstream = byId(graph, downstreamId ?? '')
  if (!isSpider(upstream) || !isSpider(downstream)) return fail('pi', 'Only a spider of phase π passes through the other colour.')
  if (upstream.kind === downstream.kind) return fail('pi', 'Only a spider of phase π passes through the other colour.')
  const link = plainBetween(graph, upstream.id, downstream.id)
  if (link.length !== 1) return fail('pi', 'These spiders do not touch by a plain wire.')
  const upPhase = phaseOf(upstream)
  const downPhase = phaseOf(downstream)
  if (!upPhase || !downPhase) return fail('pi', 'The phase cannot be read.')
  const passesUp = phasesEqual(upPhase, PI)
  const passesDown = phasesEqual(downPhase, PI)
  if (!passesUp && !passesDown) return fail('pi', 'Only the phase π passes through the other colour.')
  if (incident(graph, upstream.id).length !== 2 || incident(graph, downstream.id).length !== 2) {
    return fail('pi', 'Only the phase π passes through the other colour.')
  }
  const other = passesUp ? downstream : upstream
  const otherPhase = passesUp ? downPhase : upPhase
  giveNumber(graph, phaseScalar(otherPhase))
  other.phase = phaseLabel(flipPhase(otherPhase))
  const upExternal = incident(graph, upstream.id).filter((edge) => edge.id !== link[0].id)
  const downExternal = incident(graph, downstream.id).filter((edge) => edge.id !== link[0].id)
  for (const edge of upExternal) {
    if (edge.target === upstream.id) edge.target = downstream.id
    else edge.source = downstream.id
  }
  for (const edge of downExternal) {
    if (edge.source === downstream.id) edge.source = upstream.id
    else edge.target = upstream.id
  }
  const middle = link[0]
  const source = middle.source
  middle.source = middle.target
  middle.target = source
  return { ok: true, rule: 'pi', graph }
}

function legs(graph: ZXGraph3D, at: RewriteAt): RewriteResult {
  const [leftId, rightId] = at.nodes
  const left = byId(graph, leftId ?? '')
  const right = byId(graph, rightId ?? '')
  if (!isSpider(left) || !isSpider(right) || left.kind === right.kind) return fail('legs', 'The leg rule needs one green spider and one red spider.')
  const wires = plainBetween(graph, left.id, right.id)
  if (wires.length < 2) return fail('legs', 'With a single leg there is no pair to cut.')
  const pairs = Math.floor(wires.length / 2)
  for (let index = 0; index < pairs * 2; index += 1) graph.edges = graph.edges.filter((edge) => edge.id !== wires[index].id)
  // Each pair that disappears contributes 1/2, so two bare CNOTs still denote the identity.
  for (let index = 0; index < pairs; index += 1) giveNumber(graph, HALF)
  return { ok: true, rule: 'legs', graph }
}

function square(graph: ZXGraph3D, at: RewriteAt): RewriteResult {
  const ids = at.nodes
  if (ids.length !== 4) return fail('square', 'The square is four spiders.')
  const spiders = ids.map((id) => byId(graph, id))
  if (spiders.some((node) => !isSpider(node))) return fail('square', 'The square is four spiders.')
  const cycle = spiders as ZXNode[]
  if (cycle.some((node) => node.kind === cycle[(cycle.indexOf(node) + 1) % 4].kind)) return fail('square', 'The colours of the square alternate.')
  for (let index = 0; index < 4; index += 1) {
    const phase = phaseOf(cycle[index])
    if (!phase || !phasesEqual(phase, ZERO)) return fail('square', 'The square spiders have phase 0.')
    if (plainBetween(graph, cycle[index].id, cycle[(index + 1) % 4].id).length !== 1) return fail('square', 'Neighbours in the square share one plain wire.')
  }
  const cycleIds = new Set(ids)
  const internal = new Set(graph.edges.filter((edge) => cycleIds.has(edge.source) && cycleIds.has(edge.target)).map((edge) => edge.id))
  const green: ZXNode = { id: `square-${ids.join('-')}-z`, kind: 'z', phase: '0', wire: cycle[0].wire, position: { ...cycle[0].position } }
  const red: ZXNode = { id: `square-${ids.join('-')}-x`, kind: 'x', phase: '0', wire: cycle[1].wire, position: { ...cycle[1].position } }
  for (const edge of graph.edges) {
    if (internal.has(edge.id)) continue
    for (const node of cycle) {
      if (edge.source !== node.id && edge.target !== node.id) continue
      const host = node.kind === 'z' ? red.id : green.id
      if (edge.source === node.id) edge.source = host
      if (edge.target === node.id) edge.target = host
    }
  }
  graph.edges = graph.edges.filter((edge) => !internal.has(edge.id))
  graph.nodes = graph.nodes.filter((node) => !cycleIds.has(node.id))
  graph.nodes.push(green, red)
  graph.edges.push({ id: `${green.id}-link`, source: green.id, target: red.id })
  // The four-cycle denotes the same map as the single wire only together with 1/√2.
  giveNumber(graph, INV_SQRT2)
  return { ok: true, rule: 'square', graph }
}

function matrixOf(color: SpiderColor, phase: Phase): DiagramScalar[][] {
  const data = spiderMap(color, phase, 1, 1).map
  return [
    [data[0], data[1]],
    [data[2], data[3]],
  ]
}

const times = (left: DiagramScalar[][], right: DiagramScalar[][]) =>
  left.map((row) => right[0].map((_, column) => row.reduce((sum, entry, index) => ({
    re: sum.re + entry.re * right[index][column].re - entry.im * right[index][column].im,
    im: sum.im + entry.re * right[index][column].im + entry.im * right[index][column].re,
  }), { re: 0, im: 0 })))

const chainMatrix = (colors: SpiderColor[], phases: Phase[]) =>
  colors.reduce((acc, color, index) => times(matrixOf(color, phases[index]), acc), [[ONE, { re: 0, im: 0 }], [{ re: 0, im: 0 }, ONE]])

function scalarRatio(left: DiagramScalar[][], right: DiagramScalar[][]): DiagramScalar | undefined {
  let ratio: DiagramScalar | undefined
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 2; column += 1) {
      const goal = left[row][column]
      const got = right[row][column]
      const goalZero = sameScalar(goal, { re: 0, im: 0 })
      const gotZero = sameScalar(got, { re: 0, im: 0 })
      if (goalZero && gotZero) continue
      if (goalZero || gotZero) return undefined
      const den = got.re * got.re + got.im * got.im
      const next = { re: (goal.re * got.re + goal.im * got.im) / den, im: (goal.im * got.re - goal.re * got.im) / den }
      if (ratio && !sameScalar(ratio, next, 1e-6)) return undefined
      ratio = next
    }
  }
  return ratio
}

function last(graph: ZXGraph3D, at: RewriteAt): RewriteResult {
  const nodes = at.nodes.map((id) => byId(graph, id))
  if (nodes.length !== 3 || nodes.some((node) => !isSpider(node))) return fail('last', 'The last rule needs three spiders of alternating colours.')
  const spiders = nodes as ZXNode[]
  if (spiders[0].kind === spiders[1].kind || spiders[1].kind === spiders[2].kind) return fail('last', 'The three colours alternate.')
  if (!plainBetween(graph, spiders[0].id, spiders[1].id).length || !plainBetween(graph, spiders[1].id, spiders[2].id).length) {
    return fail('last', 'The three spiders stand in a row.')
  }
  const phases = spiders.map(phaseOf)
  if (phases.some((phase) => !phase)) return fail('last', 'The phase cannot be read.')
  const colors = spiders.map((node) => node.kind as SpiderColor)
  const current = chainMatrix(colors, phases as Phase[])
  const flipped = colors.map((color) => (color === 'z' ? 'x' : 'z')) as SpiderColor[]
  const quarters = [0, 1, 2, 3, 4, 5, 6, 7].map((step) => phaseFromTurns(step, 4))
  let found: { phases: Phase[]; ratio: DiagramScalar } | undefined
  for (const first of quarters) {
    for (const second of quarters) {
      for (const third of quarters) {
        const candidate = chainMatrix(flipped, [first, second, third])
        const ratio = scalarRatio(current, candidate)
        if (!ratio) continue
        found = { phases: [first, second, third], ratio }
      }
    }
  }
  if (!found) return fail('last', 'These three phases have no match on the other colour.')
  spiders.forEach((node, index) => {
    node.kind = flipped[index]
    node.phase = phaseLabel(found.phases[index])
  })
  giveNumber(graph, found.ratio)
  return { ok: true, rule: 'last', graph }
}

const boundaryWire = (node: ZXNode, prefix: 'in' | 'out') => {
  if (node.kind !== 'boundary') return undefined
  if (prefix === 'in' && (node.label === '|0⟩' || node.id.startsWith('in-'))) return node.wire
  if (prefix === 'out' && (node.label === '⟩' || node.id.startsWith('out-'))) return node.wire
  return undefined
}

/**
 * Writes gates only when the diagram is one list from the BL-0 dictionary.
 * A cup is not that list. The circuit this returns is a new one.
 */
export function synthesize(graph: ZXGraph3D): { ok: true; circuit: QuantumCircuit } | { ok: false; error: string } {
  const inputs = graph.nodes.filter((node) => boundaryWire(node, 'in') !== undefined)
  const outputs = graph.nodes.filter((node) => boundaryWire(node, 'out') !== undefined)
  if (!inputs.length || inputs.length !== outputs.length) return { ok: false, error: 'This diagram does not have a unique gate list.' }
  const claimed = new Set<string>()
  const gates: CircuitGate[] = []
  const spiders = graph.nodes.filter(isSpider)
  const boxes = graph.nodes.filter((node) => node.kind === 'hadamard')
  for (const box of boxes) {
    const legs = incident(graph, box.id)
    if (legs.length !== 2) return { ok: false, error: 'This diagram does not have a unique gate list.' }
    claimed.add(box.id)
    gates.push({ id: box.id, name: 'h', qubits: [box.wire] })
  }
  for (const spider of spiders) {
    if (claimed.has(spider.id)) continue
    const partner = spiders.find((other) => other.id !== spider.id && !claimed.has(other.id) && plainBetween(graph, spider.id, other.id).length === 1 && spider.kind !== other.kind)
    if (partner && spider.kind === 'z') {
      const phase = phaseOf(spider)
      const otherPhase = phaseOf(partner)
      if (!phase || !otherPhase || !phasesEqual(phase, ZERO) || !phasesEqual(otherPhase, ZERO)) return { ok: false, error: 'This diagram does not have a unique gate list.' }
      claimed.add(spider.id)
      claimed.add(partner.id)
      gates.push({ id: `${spider.id}-cx`, name: 'cx', qubits: [spider.wire, partner.wire] })
      continue
    }
    if (partner) continue
    const hadamardPartner = spiders.find((other) => other.id !== spider.id && !claimed.has(other.id) && between(graph, spider.id, other.id).some((edge) => edge.hadamard))
    if (hadamardPartner) return { ok: false, error: 'This diagram does not have a unique gate list.' }
    const legs = incident(graph, spider.id)
    const incoming = legs.filter((edge) => edge.target === spider.id && !edge.hadamard)
    const outgoing = legs.filter((edge) => edge.source === spider.id && !edge.hadamard)
    if (incoming.length !== 1 || outgoing.length !== 1) return { ok: false, error: 'This diagram does not have a unique gate list.' }
    const mapped = gateFromSpider(spider.kind, spider.phase)
    if (!mapped) return { ok: false, error: 'This diagram does not have a unique gate list.' }
    claimed.add(spider.id)
    gates.push({ id: spider.id, name: mapped.name, qubits: [spider.wire], ...(mapped.parameter ? { parameter: mapped.parameter } : {}) })
  }
  if (spiders.some((spider) => !claimed.has(spider.id)) || boxes.some((box) => !claimed.has(box.id))) {
    return { ok: false, error: 'This diagram does not have a unique gate list.' }
  }
  const qubits = Math.max(...inputs.map((node) => node.wire)) + 1
  return { ok: true, circuit: { qubits, classicalBits: 0, gates } }
}
