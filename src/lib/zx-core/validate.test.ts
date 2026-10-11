import { describe, expect, it } from 'vitest'
import type { CircuitGate, QuantumCircuit } from '../../types/circuit'
import type { DiagramScalar, ZXGraph3D, ZXNode } from '../../types/zx'
import { buildPictureElement } from './pictureElements'
import {
  HALF,
  NEG_I,
  ONE,
  SQRT2,
  ZERO_SCALAR,
  diagramOperator,
  diagramState,
  discardState,
  ketPlus,
  ketZero,
  nakedCup,
  sameMatrix,
  sameScalar,
  sameVector,
} from './semantics'
import { translateCircuit } from './translator'
import {
  beside,
  denote,
  forgetPhase,
  fusionAlong,
  noise,
  phaseTestsDiscard,
  sameConnections,
  sameDenotation,
} from './validate'

const at = { x: 0, y: 0, z: 0 }
const root = 1 / Math.SQRT2

const gate = (name: CircuitGate['name'], qubits: number[], parameter?: string): CircuitGate => ({
  id: `${name}-${qubits.join('')}${parameter ? `-${parameter}` : ''}`,
  name,
  qubits,
  ...(parameter ? { parameter } : {}),
})

const measure = (wire: number): CircuitGate => ({
  id: `measure-${wire}`,
  name: 'measure',
  qubits: [wire],
  classicalBit: wire,
})

const circuit = (qubits: number, gates: CircuitGate[], classicalBits = 0): QuantumCircuit => ({
  qubits,
  classicalBits,
  gates,
})

const bell = () => circuit(2, [gate('h', [0]), gate('cx', [0, 1])])
const ghz = () => circuit(3, [gate('h', [0]), gate('cx', [0, 1]), gate('cx', [1, 2])])

const node = (id: string, kind: ZXNode['kind'], label?: string, wire = 0): ZXNode => ({
  id,
  kind,
  phase: '',
  wire,
  ...(label ? { label } : {}),
  position: at,
})

const openSpider = (color: 'z' | 'x', phase: string, inputs: number, outputs: number): ZXGraph3D => {
  const nodes: ZXNode[] = [{ id: 'spider', kind: color, phase, wire: 0, position: at, custom: true }]
  const edges = []
  for (let index = 0; index < inputs; index += 1) {
    nodes.push({ id: `in${index}`, kind: 'boundary', phase: '', wire: -1, label: 'in', position: at, custom: true })
    edges.push({ id: `ei${index}`, source: `in${index}`, target: 'spider', custom: true })
  }
  for (let index = 0; index < outputs; index += 1) {
    nodes.push({ id: `out${index}`, kind: 'boundary', phase: '', wire: -1, label: 'out', position: at, custom: true })
    edges.push({ id: `eo${index}`, source: 'spider', target: `out${index}`, custom: true })
  }
  return { nodes, edges }
}

describe('denotation', () => {
  it('keeps H and CNOT safe, with the circuit matrix', () => {
    const hadamard = translateCircuit(circuit(1, [gate('h', [0])]))
    const cnot = translateCircuit(circuit(2, [gate('cx', [0, 1])]))
    const h = denote(hadamard)
    const cx = denote(cnot)
    expect(h.mark).toBe('seguro')
    expect(h.safe).toBe(true)
    expect(cx.mark).toBe('seguro')
    expect(cx.safe).toBe(true)
    expect(sameMatrix(h.map, diagramOperator(hadamard, 1) ?? [])).toBe(true)
    expect(sameMatrix(cx.map, diagramOperator(cnot, 2) ?? [])).toBe(true)
  })

  it('reads Bell and GHZ as the pure circuit state, and stops the map before a stored bit', () => {
    const bareBell = translateCircuit(bell())
    const measuredBell = translateCircuit(circuit(2, [...bell().gates, measure(0), measure(1)], 2))
    const bareGhz = translateCircuit(ghz())
    const measuredGhz = translateCircuit(circuit(3, [...ghz().gates, measure(0), measure(1), measure(2)], 3))
    const bellReport = denote(bareBell)
    const ghzReport = denote(bareGhz)
    expect(bellReport.pure).toBe(true)
    expect(bellReport.circuit).toBe(true)
    expect(sameScalar(bellReport.number, SQRT2)).toBe(true)
    expect(sameVector(bellReport.state ?? [], diagramState(bareBell, 2) ?? [])).toBe(true)
    expect(sameScalar(ghzReport.number, { re: 2, im: 0 })).toBe(true)
    expect(sameVector(ghzReport.state ?? [], diagramState(bareGhz, 3) ?? [])).toBe(true)
    expect(diagramOperator(measuredBell, 2)).toBeUndefined()
    expect(sameVector(denote(measuredBell).state ?? [], bellReport.state ?? [])).toBe(true)
    expect(sameVector(denote(measuredGhz).state ?? [], ghzReport.state ?? [])).toBe(true)
  })

  it('traces one qubit of Bell out to noise, and treats the flipped discard as that noise', () => {
    const graph = translateCircuit(bell())
    const leaked = {
      ...graph,
      nodes: graph.nodes.map((item) => (item.id === 'out-1' ? { ...item, label: '⏚' } : item)),
    }
    const flipped: ZXGraph3D = {
      nodes: [node('ground', 'boundary', '⏚'), { ...node('out0', 'boundary', 'out'), custom: true }],
      edges: [{ id: 'e0', source: 'ground', target: 'out0' }],
    }
    const report = denote(leaked)
    const mixed = [[HALF, ZERO_SCALAR], [ZERO_SCALAR, HALF]]
    expect(report.mark).toBe('fugas')
    expect(report.pure).toBe(false)
    expect(sameMatrix(report.density ?? [], mixed)).toBe(true)
    expect(denote(flipped).mark).toBe('ruido')
    expect(sameMatrix(denote(flipped).density ?? [], noise())).toBe(true)
    expect(sameMatrix(report.density ?? [], denote(flipped).density ?? [])).toBe(true)
  })

  it('marks the cap and the phase-0 test as only sometimes, and the discard as the safe test', () => {
    expect(denote(buildPictureElement('cap', at, 'cap')).mark).toBe('tal vez')
    expect(denote(buildPictureElement('cap', at, 'cap')).safe).toBe(false)
    expect(denote(buildPictureElement('effect-plus', at, 'plus')).mark).toBe('tal vez')
    expect(denote(buildPictureElement('effect-plus', at, 'plus')).safe).toBe(false)
    expect(denote(buildPictureElement('effect-zero', at, 'zero')).mark).toBe('tal vez')
    expect(denote(buildPictureElement('discard', at, 'ground')).mark).toBe('seguro')
    expect(denote(buildPictureElement('discard', at, 'ground')).safe).toBe(true)
  })

  it('gives a palette diagram its own map, and does not call it a circuit', () => {
    const cup = denote(buildPictureElement('cup', at, 'cup'))
    expect(cup.circuit).toBe(false)
    expect(cup.wellFormed).toBe(true)
    expect(sameVector(cup.state ?? [], nakedCup())).toBe(true)
    expect(cup.safe).toBe(false)
    expect(sameScalar(cup.closed ?? ZERO_SCALAR, { re: 2, im: 0 })).toBe(true)
    const withHalf = beside(cup, HALF)
    expect(withHalf.safe).toBe(true)
    expect(withHalf.mark).toBe('seguro')
    expect(sameScalar(withHalf.closed ?? ZERO_SCALAR, ONE)).toBe(true)
    expect(sameScalar(withHalf.number, HALF)).toBe(true)
  })

  it('treats a phase-0 spider of one input and one output as the wire, and not the cup or the cap', () => {
    const wire = denote(buildPictureElement('wire', at, 'wire'))
    const spider = openSpider('z', '0', 1, 1)
    const before = spider.nodes.map((item) => item.kind)
    expect(sameDenotation(denote(spider), wire)).toBe(true)
    expect(sameDenotation(denote(openSpider('x', '0', 1, 1)), wire)).toBe(true)
    expect(spider.nodes.map((item) => item.kind)).toEqual(before)
    expect(sameDenotation(denote(buildPictureElement('cup', at, 'cup')), wire)).toBe(false)
    expect(sameDenotation(denote(buildPictureElement('cap', at, 'cap')), wire)).toBe(false)
    expect(sameConnections(spider, buildPictureElement('wire', at, 'wire'))).toBe(false)
  })

  it('does not fuse two Bell diagrams that denote the same state', () => {
    const first = translateCircuit(bell())
    const second = translateCircuit(circuit(2, [gate('h', [1]), gate('cx', [1, 0])]))
    const firstCopy = JSON.stringify(first)
    const secondCopy = JSON.stringify(second)
    const left = denote(first)
    const right = denote(second)
    expect(JSON.stringify(first)).toBe(firstCopy)
    expect(JSON.stringify(second)).toBe(secondCopy)
    expect(sameVector(left.state ?? [], right.state ?? [])).toBe(true)
    expect(sameScalar(left.number, right.number)).toBe(true)
    expect(sameConnections(first, second)).toBe(false)
  })

  it('ignores a move on the page', () => {
    const graph = translateCircuit(circuit(1, [gate('h', [0])]))
    const moved = {
      ...graph,
      nodes: graph.nodes.map((item) => ({ ...item, position: { x: item.position.x + 40, y: 3, z: 9 } })),
    }
    expect(sameConnections(graph, moved)).toBe(true)
    expect(sameDenotation(denote(graph), denote(moved))).toBe(true)
  })

  it('rejects Y drawn without the factor −i', () => {
    const drawn = translateCircuit(circuit(1, [gate('y', [0])]))
    const stripped = { ...drawn, numbers: [] as DiagramScalar[] }
    const report = denote(drawn)
    expect(sameScalar(report.number, NEG_I)).toBe(true)
    expect(sameMatrix(report.map, diagramOperator(drawn, 1) ?? [])).toBe(true)
    expect(sameDenotation(report, denote(stripped))).toBe(false)
  })

  it('adds the phase-0 and phase-π tests into the discard', () => {
    expect(sameScalar(phaseTestsDiscard('x', ketPlus()), discardState(ketPlus()))).toBe(true)
    expect(sameScalar(phaseTestsDiscard('z', ketPlus()), discardState(ketPlus()))).toBe(true)
    expect(sameScalar(phaseTestsDiscard('x', ketZero()), discardState(ketZero()))).toBe(true)
    expect(sameScalar(phaseTestsDiscard('z', ketZero()), discardState(ketZero()))).toBe(true)
  })

  it('forgets the phase when a bit is measured and encoded again', () => {
    const graph: ZXGraph3D = {
      nodes: [
        node('in-0', 'boundary', '|0⟩'),
        node('m', 'boundary', 'measure'),
        node('enc', 'boundary', 'encode'),
        node('out-0', 'boundary', '⟩'),
      ],
      edges: [
        { id: 'e0', source: 'in-0', target: 'm' },
        { id: 'e1', source: 'm', target: 'enc' },
        { id: 'e2', source: 'enc', target: 'out-0' },
      ],
    }
    const report = denote(graph)
    expect(report.mark).toBe('fugas')
    expect(report.erasesPhase).toBe(true)
    const phased = [{ re: root, im: 0 }, { re: 0, im: root }]
    const forgotten = forgetPhase(phased)
    const coherence = phased[0].re * phased[1].im
    expect(coherence).not.toBe(0)
    expect(sameScalar(forgotten[0][1], ZERO_SCALAR)).toBe(true)
    expect(sameScalar(forgotten[0][0], HALF)).toBe(true)
    expect(sameScalar(forgotten[1][1], HALF)).toBe(true)
  })

  it('leaves an illegible phase, a fourth colour, or a dangling edge ill-formed', () => {
    const graph = translateCircuit(circuit(1, [gate('z', [0])]))
    const copy = JSON.stringify(graph)
    const badPhase = { ...graph, nodes: graph.nodes.map((item) => (item.kind === 'z' ? { ...item, phase: 'foo' } : item)) }
    const alien: ZXGraph3D = { nodes: [{ ...node('p', 'z'), kind: 'w' as ZXNode['kind'] }], edges: [] }
    const dangling: ZXGraph3D = {
      nodes: [node('p', 'z')],
      edges: [{ id: 'e', source: 'p', target: 'missing' }],
    }
    expect(denote(badPhase).wellFormed).toBe(false)
    expect(denote(alien).wellFormed).toBe(false)
    expect(denote(dangling).wellFormed).toBe(false)
    expect(JSON.stringify(graph)).toBe(copy)
  })

  it('keeps a Hadamard edge in CZ, and rejects that edge when it is used as a fusion wire', () => {
    const cz = translateCircuit(circuit(2, [gate('cz', [0, 1])]))
    const link = cz.edges.find((edge) => edge.hadamard)
    expect(link).toBeDefined()
    expect(denote(cz).wellFormed).toBe(true)
    expect(denote(cz).mark).toBe('seguro')
    expect(fusionAlong(link ?? cz.edges[0]).wellFormed).toBe(false)
    expect(fusionAlong({ id: 'plain', source: 'a', target: 'b' }).wellFormed).toBe(true)
  })
})
