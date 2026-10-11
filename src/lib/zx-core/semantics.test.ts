import { describe, expect, it } from 'vitest'
import type { CircuitGate, QuantumCircuit } from '../../types/circuit'
import type { DiagramScalar } from '../../types/zx'
import { validateSync } from '../sync/circuitSync'
import { buildPictureElement } from './pictureElements'
import {
  HALF,
  INV_SQRT2,
  NEG_I,
  PI,
  PI_HALF,
  PI_QUARTER,
  THREE_PI_HALF,
  ZERO,
  addPhases,
  classifyNode,
  copiesArbitraryPhase,
  copyImage,
  diagramOperator,
  diagramState,
  discardGenerator,
  discardState,
  drawingOf,
  emptyDiagram,
  encodeBit,
  encodeGenerator,
  flipPhase,
  gateFromSpider,
  hadamardBox,
  hadamardEdge,
  ketOne,
  ketPlus,
  ketZero,
  measureGenerator,
  nakedCup,
  palette,
  parsePhase,
  phaseFromDegrees,
  phaseLabel,
  phasesEqual,
  producedWire,
  sameMatrix,
  sameScalar,
  sameVector,
  scalarSpider,
  spiderColor,
  spiderMap,
  twoQubitCap,
  applySpider,
  cancelScalar,
} from './semantics'
import { translateCircuit } from './translator'

const s = (re: number, im = 0): DiagramScalar => ({ re, im })
const i = s(0, 1)
const root = 1 / Math.SQRT2

const bit = (index: number, qubit: number, qubits: number) => (index >> (qubits - 1 - qubit)) & 1
const writeBit = (index: number, qubit: number, qubits: number, value: number) => {
  const shift = qubits - 1 - qubit
  return (index & ~(1 << shift)) | (value << shift)
}
const add = (a: DiagramScalar, b: DiagramScalar) => s(a.re + b.re, a.im + b.im)
const mul = (a: DiagramScalar, b: DiagramScalar) => s(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re)

const apply1 = (matrix: number[][], qubit: number, qubits: number, state: DiagramScalar[]) => {
  const out = state.map(() => s(0))
  state.forEach((amplitude, index) => {
    const value = bit(index, qubit, qubits)
    matrix.forEach((row, next) => {
      const target = writeBit(index, qubit, qubits, next)
      out[target] = add(out[target], mul(s(row[value]), amplitude))
    })
  })
  return out
}

const apply2 = (matrix: number[][], first: number, second: number, qubits: number, state: DiagramScalar[]) => {
  const out = state.map(() => s(0))
  state.forEach((amplitude, index) => {
    const local = bit(index, first, qubits) * 2 + bit(index, second, qubits)
    matrix.forEach((row, next) => {
      let target = writeBit(index, first, qubits, (next >> 1) & 1)
      target = writeBit(target, second, qubits, next & 1)
      out[target] = add(out[target], mul(s(row[local]), amplitude))
    })
  })
  return out
}

const H = [[root, root], [root, -root]]
const yMatrix = [[s(0), s(0, -1)], [i, s(0)]]

const phaseGate = (factor: DiagramScalar, qubit: number, qubits: number, state: DiagramScalar[]) => {
  const out = state.map((amplitude) => ({ ...amplitude }))
  for (let index = 0; index < state.length; index += 1) {
    if (bit(index, qubit, qubits) === 1) out[index] = mul(out[index], factor)
  }
  return out
}

const applyComplex = (matrix: DiagramScalar[][], qubit: number, qubits: number, state: DiagramScalar[]) => {
  const out = state.map(() => s(0))
  state.forEach((amplitude, index) => {
    const value = bit(index, qubit, qubits)
    matrix.forEach((row, next) => {
      const target = writeBit(index, qubit, qubits, next)
      out[target] = add(out[target], mul(row[value], amplitude))
    })
  })
  return out
}

const textbook = {
  h: (qubit: number, qubits: number, state: DiagramScalar[]) => apply1(H, qubit, qubits, state),
  s: (qubit: number, qubits: number, state: DiagramScalar[]) => phaseGate(i, qubit, qubits, state),
  t: (qubit: number, qubits: number, state: DiagramScalar[]) => phaseGate(s(root, root), qubit, qubits, state),
  y: (qubit: number, qubits: number, state: DiagramScalar[]) => applyComplex(yMatrix, qubit, qubits, state),
  z: (qubit: number, qubits: number, state: DiagramScalar[]) => phaseGate(s(-1), qubit, qubits, state),
  cnot: (control: number, target: number, qubits: number, state: DiagramScalar[]) => apply2([
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 0, 1],
    [0, 0, 1, 0],
  ], control, target, qubits, state),
  cz: (control: number, target: number, qubits: number, state: DiagramScalar[]) => apply2([
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, -1],
  ], control, target, qubits, state),
  swap: (first: number, second: number, qubits: number, state: DiagramScalar[]) => apply2([
    [1, 0, 0, 0],
    [0, 0, 1, 0],
    [0, 1, 0, 0],
    [0, 0, 0, 1],
  ], first, second, qubits, state),
}

const gate = (name: CircuitGate['name'], qubits: number[], parameter?: string): CircuitGate => ({
  id: `${name}-${qubits.join('')}${parameter ? `-${parameter}` : ''}`,
  name,
  qubits,
  ...(parameter ? { parameter } : {}),
})

const circuit = (qubits: number, gates: CircuitGate[]): QuantumCircuit => ({ qubits, classicalBits: 0, gates })

const operatorOf = (qubits: number, steps: Array<(state: DiagramScalar[]) => DiagramScalar[]>) => {
  const size = 1 << qubits
  const columns = Array.from({ length: size }, (_, index) => {
    const start = Array.from({ length: size }, () => s(0))
    start[index] = s(1)
    return steps.reduce((state, step) => step(state), start)
  })
  return columns[0].map((_, row) => columns.map((column) => column[row]))
}

const expectMatch = (actual: DiagramScalar[][] | DiagramScalar[] | undefined, expected: DiagramScalar[][] | DiagramScalar[]) => {
  expect(actual).toBeDefined()
  if (!actual) return
  if (Array.isArray(actual[0])) expect(sameMatrix(actual as DiagramScalar[][], expected as DiagramScalar[][])).toBe(true)
  else expect(sameVector(actual as DiagramScalar[], expected as DiagramScalar[])).toBe(true)
}

describe('phases', () => {
  it('stores an unmarked phase as 0 and keeps every sum inside [0, 2π)', () => {
    expect(phasesEqual(parsePhase('') ?? PI, ZERO)).toBe(true)
    expect(phasesEqual(parsePhase('0') ?? PI, ZERO)).toBe(true)
    expect(phaseLabel(addPhases([PI_QUARTER, PI_QUARTER, PI_QUARTER, PI_QUARTER]))).toBe('π')
    expect(phasesEqual(parsePhase('-pi/2') ?? ZERO, THREE_PI_HALF)).toBe(true)
    expect(phasesEqual(parsePhase('-π/2') ?? ZERO, parsePhase('3π/2') ?? ZERO)).toBe(true)
    expect(phaseLabel(parsePhase('2*pi') ?? PI)).toBe('0')
  })

  it('treats a degree and the same angle in radians as one phase', () => {
    expect(phasesEqual(phaseFromDegrees(90), PI_HALF)).toBe(true)
    expect(phasesEqual(parsePhase('90°') ?? ZERO, PI_HALF)).toBe(true)
    expect(phasesEqual(parsePhase('270 deg') ?? ZERO, THREE_PI_HALF)).toBe(true)
    expect(phasesEqual(phaseFromDegrees(270), THREE_PI_HALF)).toBe(true)
    expect(phasesEqual(phaseFromDegrees(360), ZERO)).toBe(true)
    expect(phasesEqual(flipPhase(PI_HALF), THREE_PI_HALF)).toBe(true)
    expect(phasesEqual(flipPhase(ZERO), ZERO)).toBe(true)
  })
})

describe('colours and wires', () => {
  it('has two spider colours and no third', () => {
    expect(spiderColor('green')).toBe('z')
    expect(spiderColor('white')).toBe('z')
    expect(spiderColor('red')).toBe('x')
    expect(spiderColor('gray')).toBe('x')
    expect(spiderColor('grey')).toBe('x')
    expect(spiderColor('amber')).toBeUndefined()
    expect(spiderColor('blue')).toBeUndefined()
  })

  it('does not turn a quantum wire into an ordinary one, or the reverse', () => {
    expect(measureGenerator.input).toBe('quantum')
    expect(producedWire(measureGenerator)).toBe('ordinary')
    expect(measureGenerator.storesBit).toBe(true)
    expect(encodeGenerator.flipOf).toBe('measure')
    expect(encodeGenerator.input).toBe('ordinary')
    expect(producedWire(encodeGenerator)).toBe('quantum')
    expect(sameVector(encodeBit(0), ketZero())).toBe(true)
    expect(sameVector(encodeBit(1), ketOne())).toBe(true)
    expect(discardGenerator.storesBit).toBe(false)
    expect(producedWire(discardGenerator)).toBeNull()
    expect(twoQubitCap().legs).toHaveLength(2)
    expect(discardGenerator.type).not.toBe('spider')
  })
})

describe('generators', () => {
  it('denotes the named spiders, including the scalar on a single-leg X spider', () => {
    expect(sameVector(ketZero(), [s(1), s(0)])).toBe(true)
    expect(sameVector(ketOne(), [s(0), s(1)])).toBe(true)
    expect(sameVector(ketPlus(), [s(1), s(1)])).toBe(true)
    expect(sameScalar(spiderMap('x', ZERO, 0, 1).number, INV_SQRT2)).toBe(true)
    expect(sameVector(nakedCup(), [s(1), s(0), s(0), s(1)])).toBe(true)
    expect(sameScalar(scalarSpider(ZERO), s(2))).toBe(true)
    expect(sameScalar(emptyDiagram, s(1))).toBe(true)
    expect(sameScalar(cancelScalar(scalarSpider(ZERO), HALF), emptyDiagram)).toBe(true)
    expect(hadamardBox()).toEqual(hadamardEdge())
  })

  it('copies the computational basis and has no case that copies an arbitrary phase', () => {
    expect(copiesArbitraryPhase).toBe(false)
    const plus = ketPlus()
    const copied = copyImage(plus)
    const square = [s(1), s(1), s(1), s(1)]
    expect(sameVector(copied, [s(1), s(0), s(0), s(1)])).toBe(true)
    expect(sameVector(copied, square)).toBe(false)
    const phase = applySpider('z', PI_QUARTER, 0, 1, [])
    const copiedPhase = copyImage(phase)
    const doubled = [
      mul(phase[0], phase[0]),
      mul(phase[0], phase[1]),
      mul(phase[1], phase[0]),
      mul(phase[1], phase[1]),
    ]
    expect(sameVector(copiedPhase, doubled)).toBe(false)
  })

  it('discards a state to its norm, which is not the two-qubit cap', () => {
    const oneOnSecond = [s(0), s(1), s(0), s(0)]
    expect(sameScalar(discardState(oneOnSecond), s(1))).toBe(true)
    expect(sameVector(applySpider('z', ZERO, 2, 0, oneOnSecond), [s(0)])).toBe(true)
    expect(sameScalar(discardState(nakedCup()), s(2))).toBe(true)
    expect(sameVector(applySpider('z', ZERO, 2, 0, nakedCup()), [s(2)])).toBe(true)
  })
})

describe('palette', () => {
  it('draws each symbol as a generator, a wire, or the discard', () => {
    for (const entry of palette) {
      expect(['spider', 'hadamard', 'wire', 'discard']).toContain(entry.spec.type)
      const graph = buildPictureElement(entry.id, { x: 0, y: 0, z: 0 }, entry.id)
      expect(graph.nodes.every((node) => classifyNode(node) !== undefined)).toBe(true)
    }
    const zero = buildPictureElement('state-zero', { x: 0, y: 0, z: 0 }, 'zero')
    const spider = zero.nodes.find((node) => node.kind === 'x')
    expect(spider?.phase).toBe('0')
    expect(spider?.number && sameScalar(spider.number, INV_SQRT2)).toBe(true)
    const cup = buildPictureElement('cup', { x: 0, y: 0, z: 0 }, 'cup')
    expect(cup.nodes.filter((node) => node.label === 'out')).toHaveLength(2)
    const cap = buildPictureElement('cap', { x: 0, y: 0, z: 0 }, 'cap')
    expect(cap.nodes.filter((node) => node.label === 'in')).toHaveLength(2)
    expect(cap.nodes.some((node) => node.label === '⏚')).toBe(false)
  })
})

describe('circuit diagrams', () => {
  const cases = [
    { name: 'identity', qubits: 1, gates: [], steps: [(state: DiagramScalar[]) => state] },
    { name: 'H', qubits: 1, gates: [gate('h', [0])], steps: [(state: DiagramScalar[]) => textbook.h(0, 1, state)] },
    { name: 'S', qubits: 1, gates: [gate('s', [0])], steps: [(state: DiagramScalar[]) => textbook.s(0, 1, state)] },
    { name: 'T', qubits: 1, gates: [gate('t', [0])], steps: [(state: DiagramScalar[]) => textbook.t(0, 1, state)] },
    { name: 'Y', qubits: 1, gates: [gate('y', [0])], steps: [(state: DiagramScalar[]) => textbook.y(0, 1, state)] },
    { name: 'CNOT', qubits: 2, gates: [gate('cx', [0, 1])], steps: [(state: DiagramScalar[]) => textbook.cnot(0, 1, 2, state)] },
    { name: 'CZ', qubits: 2, gates: [gate('cz', [0, 1])], steps: [(state: DiagramScalar[]) => textbook.cz(0, 1, 2, state)] },
    { name: 'SWAP', qubits: 2, gates: [gate('swap', [0, 1])], steps: [(state: DiagramScalar[]) => textbook.swap(0, 1, 2, state)] },
    {
      name: 'Bell',
      qubits: 2,
      gates: [gate('h', [0]), gate('cx', [0, 1])],
      steps: [
        (state: DiagramScalar[]) => textbook.h(0, 2, state),
        (state: DiagramScalar[]) => textbook.cnot(0, 1, 2, state),
      ],
    },
    {
      name: 'GHZ',
      qubits: 3,
      gates: [gate('h', [0]), gate('cx', [0, 1]), gate('cx', [1, 2])],
      steps: [
        (state: DiagramScalar[]) => textbook.h(0, 3, state),
        (state: DiagramScalar[]) => textbook.cnot(0, 1, 3, state),
        (state: DiagramScalar[]) => textbook.cnot(1, 2, 3, state),
      ],
    },
  ] as const

  it('matches the matrix of each of the ten circuits, number included', () => {
    for (const item of cases) {
      const spec = circuit(item.qubits, [...item.gates])
      const graph = translateCircuit(spec)
      expect(graph.nodes.every((node) => classifyNode(node) !== undefined), item.name).toBe(true)
      expect(validateSync(spec, graph).ok, item.name).toBe(true)
      const expected = operatorOf(item.qubits, [...item.steps])
      const actual = diagramOperator(graph, item.qubits)
      if (!actual || !sameMatrix(actual, expected)) {
        throw new Error(`${item.name}\nactual ${JSON.stringify(actual)}\nexpected ${JSON.stringify(expected)}`)
      }
    }
  })

  it('draws s and rz(π/2) as the same Z spider', () => {
    const sGate = drawingOf(gate('s', [0]))
    const rzGate = drawingOf(gate('rz', [0], 'pi/2'))
    expect(sGate.steps).toEqual(rzGate.steps)
    expect(gateFromSpider('z', 'π/2')?.name).toBe('s')
    expect(gateFromSpider('z', 'pi/2')?.name).toBe('s')
    const sGraph = translateCircuit(circuit(1, [gate('s', [0])]))
    const rzGraph = translateCircuit(circuit(1, [gate('rz', [0], 'pi/2')]))
    const sSpider = sGraph.nodes.find((node) => node.kind === 'z')
    const rzSpider = rzGraph.nodes.find((node) => node.kind === 'z')
    expect(sSpider?.phase).toBe('π/2')
    expect(rzSpider?.phase).toBe(sSpider?.phase)
    expectMatch(diagramOperator(sGraph, 1), diagramOperator(rzGraph, 1) ?? [])
  })

  it('draws swap as three alternating CNOTs and y with the scalar of ZX = iY', () => {
    const swap = drawingOf(gate('swap', [0, 1]))
    expect(swap.steps).toEqual([
      { type: 'cnot', control: 0, target: 1 },
      { type: 'cnot', control: 1, target: 0 },
      { type: 'cnot', control: 0, target: 1 },
    ])
    const y = drawingOf(gate('y', [0]))
    expect(y.numbers).toEqual([NEG_I])
    expect(y.steps.map((step) => step.type === 'x' || step.type === 'z' ? step.type : '')).toEqual(['x', 'z'])
    const graph = translateCircuit(circuit(2, [gate('swap', [0, 1])]))
    const spiders = graph.nodes.filter((node) => node.kind === 'z' || node.kind === 'x')
    expect(spiders.map((node) => `${node.kind}@${node.wire}`)).toEqual(['z@0', 'x@1', 'z@1', 'x@0', 'z@0', 'x@1'])
  })

  it('prepares the normalised Bell state, and the naked cup discards to 2', () => {
    const bell = circuit(2, [gate('h', [0]), gate('cx', [0, 1])])
    const state = diagramState(translateCircuit(bell), 2)
    const expected = nakedCup().map((amplitude) => ({ re: amplitude.re * root, im: amplitude.im * root }))
    if (!state || !sameVector(state, expected)) throw new Error(`bell ${JSON.stringify(state)} expected ${JSON.stringify(expected)}`)
    expect(sameScalar(discardState(nakedCup()), s(2))).toBe(true)
    expect(state && sameScalar(discardState(state), s(1))).toBe(true)
    const ghz = diagramState(translateCircuit(circuit(3, [gate('h', [0]), gate('cx', [0, 1]), gate('cx', [1, 2])])), 3)
    const ghzExpected = Array.from({ length: 8 }, () => s(0))
    ghzExpected[0] = s(root)
    ghzExpected[7] = s(root)
    expectMatch(ghz, ghzExpected)
  })

  it('keeps H|0⟩ normalised, distinct from the bare Z spider', () => {
    const state = diagramState(translateCircuit(circuit(1, [gate('h', [0])])), 1)
    expectMatch(state, [s(root), s(root)])
    expect(state && sameVector(state, ketPlus())).toBe(false)
  })

  it('classifies a measured circuit without turning the incoming wire into a bit', () => {
    const measured = circuit(1, [gate('h', [0]), { id: 'm', name: 'measure', qubits: [0], classicalBit: 0 }])
    measured.classicalBits = 1
    const graph = translateCircuit(measured)
    expect(graph.nodes.every((node) => classifyNode(node) !== undefined)).toBe(true)
    const measurement = graph.nodes.find((node) => classifyNode(node)?.type === 'measure')
    expect(measurement).toBeDefined()
    expect(graph.edges.some((edge) => edge.target === measurement?.id)).toBe(true)
    expect(diagramOperator(graph, 1)).toBeUndefined()
  })
})
