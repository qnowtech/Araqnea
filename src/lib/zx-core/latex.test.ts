import { describe, expect, it } from 'vitest'
import type { CircuitGate, QuantumCircuit } from '../../types/circuit'
import type { DiagramScalar, ZXGraph3D, ZXNode } from '../../types/zx'
import { buildPictureElement } from './pictureElements'
import { apply } from './rewrite'
import {
  ONE,
  SQRT2,
  ZERO_SCALAR,
  diagramOperator,
  sameMatrix,
  sameScalar,
} from './semantics'
import { denote } from './validate'
import { translateCircuit } from './translator'
import { amplitude, explain, probability, sameFormula, stateProbability } from './latex'

const at = { x: 0, y: 0, z: 0 }

const spider = (id: string, kind: 'z' | 'x', phase: string, wire = 0): ZXNode => ({
  id, kind, phase, wire, position: at,
})

const boundary = (id: string, label: string, wire: number): ZXNode => ({
  id, kind: 'boundary', phase: '', wire, label, position: at,
})

const link = (id: string, source: string, target: string, hadamard = false) => ({
  id, source, target, ...(hadamard ? { hadamard: true } : {}),
})

const gate = (id: string, name: CircuitGate['name'], qubits: number[], parameter?: string): CircuitGate => ({
  id, name, qubits, ...(parameter ? { parameter } : {}),
})

const circuit = (qubits: number, gates: CircuitGate[]): QuantumCircuit => ({ qubits, classicalBits: 0, gates })

const leading = (map: DiagramScalar[][]) => {
  for (const row of map) for (const entry of row) if (!sameScalar(entry, ZERO_SCALAR, 1e-8)) return entry
  return ZERO_SCALAR
}

const keepsValue = (before: ZXGraph3D, after: ZXGraph3D) => {
  const left = explain(before)
  const right = explain(after)
  expect(sameMatrix(left.map, right.map)).toBe(true)
  expect(sameScalar(leading(left.map), leading(right.map))).toBe(true)
  expect(left.latex).not.toMatch(/\d\.\d/)
  expect(right.latex).not.toMatch(/\d\.\d/)
}

describe('formula', () => {
  it('writes a Z spider as its generator and a legless spider as 2', () => {
    const phase: ZXGraph3D = {
      nodes: [boundary('in-0', '|0⟩', 0), spider('z', 'z', 'π/2'), boundary('out-0', '⟩', 0)],
      edges: [link('a', 'in-0', 'z'), link('b', 'z', 'out-0')],
    }
    const chosen = explain(phase, 'z')
    expect(chosen.latex).toBe('|0\\dots 0\\rangle\\langle 0\\dots 0| + e^{i\\pi/2}|1\\dots 1\\rangle\\langle 1\\dots 1|')
    expect(chosen.prose).toBe('araña Z')
    expect(explain(phase).latex).not.toBe(chosen.latex)

    const bare: ZXGraph3D = { nodes: [spider('z', 'z', '0')], edges: [] }
    expect(explain(bare).latex).toBe('2')
    expect(explain(bare, 'z').latex).toBe('2')
    expect(sameScalar(explain(bare).map[0][0], { re: 2, im: 0 })).toBe(true)
  })

  it('writes the naked cup and the circuit Bell as different formulas', () => {
    const cup = buildPictureElement('cup', at, 'cup')
    const bell = translateCircuit(circuit(2, [gate('h', 'h', [0]), gate('cx', 'cx', [0, 1])]))
    const cupFormula = explain(cup)
    const bellFormula = explain(bell)
    expect(cupFormula.latex).toBe('|00\\rangle+|11\\rangle')
    expect(bellFormula.latex).toBe('(|00\\rangle+|11\\rangle)/\\sqrt{2}')
    expect(cupFormula.prose).toBe('taza cuántica')
    expect(cupFormula.profession).toBe('estado de Bell')
    expect(sameFormula(cupFormula, bellFormula)).toBe(false)
    expect(stateProbability(cup)?.latex).toBe('2')
    expect(stateProbability(bell)?.latex).toBe('1')
    expect(bellFormula.prose).toBe('seguro')
    expect(bellFormula.profession).toBe('causal')
    expect(sameScalar(bellFormula.number, SQRT2)).toBe(true)
  })

  it('writes the chosen generator, and the whole diagram as the composition', () => {
    const graph = translateCircuit(circuit(1, [gate('h', 'h', [0])]))
    const box = graph.nodes.find((node) => node.kind === 'hadamard')
    const spiderFormula = explain(graph, box?.id)
    const diagram = explain(graph)
    expect(spiderFormula.latex).toBe('\\frac{1}{\\sqrt{2}}\\left(|0\\rangle\\langle 0| + |0\\rangle\\langle 1| + |1\\rangle\\langle 0| - |1\\rangle\\langle 1|\\right)')
    expect(spiderFormula.prose).toBe('caja de cambio de color')
    expect(spiderFormula.profession).toBe('compuerta de Hadamard')
    expect(diagram.latex).toBe('(|0\\rangle+|1\\rangle)/\\sqrt{2}')
    expect(diagram.latex).not.toBe(spiderFormula.latex)
  })

  it('keeps the map from before the stored bit', () => {
    const plain = circuit(2, [gate('h', 'h', [0]), gate('cx', 'cx', [0, 1])])
    const measured = circuit(2, [
      ...plain.gates,
      { id: 'm0', name: 'measure', qubits: [0], classicalBit: 0 },
      { id: 'm1', name: 'measure', qubits: [1], classicalBit: 1 },
    ])
    measured.classicalBits = 2
    const before = explain(translateCircuit(plain))
    const after = explain(translateCircuit(measured))
    expect(after.latex).toBe('(|00\\rangle+|11\\rangle)/\\sqrt{2}')
    expect(after.latex).toBe(before.latex)
    expect(sameMatrix(after.map, before.map)).toBe(true)
    expect(sameScalar(after.number, before.number)).toBe(true)
    expect(after.latex).not.toBe('|00\\rangle')
    expect(after.latex).not.toBe('|11\\rangle')
  })

  it('closes a state with a test, and discards a safe state to 1', () => {
    const prepared = translateCircuit(circuit(1, [gate('h', 'h', [0])]))
    const test = buildPictureElement('effect-zero', at, 'test')
    const closed = amplitude(prepared, test)
    expect(closed).toBeDefined()
    if (!closed) return
    expect(closed.latex).toBe('1/\\sqrt{2}')
    expect(sameScalar(closed.probability, probability(closed.value))).toBe(true)
    expect(closed.probabilityLatex).toBe('1/2')
    const bell = translateCircuit(circuit(2, [gate('h', 'h', [0]), gate('cx', 'cx', [0, 1])]))
    expect(denote(bell).safe).toBe(true)
    expect(sameScalar(stateProbability(bell)?.value ?? ZERO_SCALAR, ONE)).toBe(true)
    expect(stateProbability(bell)?.latex).toBe('1')
    const cup = buildPictureElement('cup', at, 'cup')
    expect(stateProbability(cup)?.latex).toBe('2')
  })

  it('writes angles in π, including Y and the factor from pi', () => {
    const y = explain(translateCircuit(circuit(1, [gate('y', 'y', [0])])))
    expect(y.latex).toContain('i')
    expect(y.latex).not.toMatch(/\d\.\d/)

    const graph = translateCircuit(circuit(1, [gate('x', 'x', [0]), gate('s', 's', [0])]))
    const x = graph.nodes.find((node) => node.kind === 'x')?.id ?? ''
    const z = graph.nodes.find((node) => node.kind === 'z')?.id ?? ''
    const moved = apply(graph, 'pi', { nodes: [x, z] })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    const written = explain(moved.graph)
    expect(written.latex).toContain('e^{i\\pi/2}')
    expect(written.latex).toContain('3\\pi/2')
    expect(written.latex).not.toMatch(/\d\.\d/)
    keepsValue(graph, moved.graph)
  })

  it('matches the circuit and its spiders on Bell, GHZ, Hadamard and two rz', () => {
    const cases = [
      { name: 'Bell', spec: circuit(2, [gate('h', 'h', [0]), gate('cx', 'cx', [0, 1])]), latex: '(|00\\rangle+|11\\rangle)/\\sqrt{2}' },
      { name: 'GHZ', spec: circuit(3, [gate('h', 'h', [0]), gate('cx', 'cx', [0, 1]), gate('cx2', 'cx', [1, 2])]), latex: '(|000\\rangle+|111\\rangle)/\\sqrt{2}' },
      { name: 'Hadamard', spec: circuit(1, [gate('h', 'h', [0])]), latex: '(|0\\rangle+|1\\rangle)/\\sqrt{2}' },
    ]
    for (const item of cases) {
      const graph = translateCircuit(item.spec)
      const formula = explain(graph)
      const report = denote(graph)
      expect(formula.latex, item.name).toBe(item.latex)
      expect(sameMatrix(formula.map, report.map), item.name).toBe(true)
      expect(sameScalar(formula.number, report.number), item.name).toBe(true)
      expect(sameMatrix(formula.map, diagramOperator(graph, item.spec.qubits) ?? []), item.name).toBe(true)
      expect(formula.latex, item.name).not.toMatch(/\d\.\d/)
    }

    const rotations = translateCircuit(circuit(1, [gate('a', 'rz', [0], 'pi/3'), gate('b', 'rz', [0], 'pi/3')]))
    const formula = explain(rotations)
    const report = denote(rotations)
    expect(sameMatrix(formula.map, report.map)).toBe(true)
    expect(sameScalar(formula.number, report.number)).toBe(true)
    expect(sameMatrix(formula.map, diagramOperator(rotations, 1) ?? [])).toBe(true)
    expect(formula.latex).toContain('e^{i2\\pi/3}')
    expect(formula.latex).not.toMatch(/\d\.\d/)
  })

  it('keeps the same matrix and the same number after each rule', () => {
    const fused = translateCircuit(circuit(1, [gate('a', 'rz', [0], 'pi/2'), gate('b', 'rz', [0], 'pi/2')]))
    const fusedAt = fused.nodes.filter((node) => node.kind === 'z').map((node) => node.id)
    const fuse = apply(fused, 'fuse', { nodes: fusedAt })
    expect(fuse.ok).toBe(true)
    if (fuse.ok) {
      keepsValue(fused, fuse.graph)
      expect(sameFormula(explain(fused), explain(fuse.graph))).toBe(true)
    }

    const zero = translateCircuit(circuit(1, [gate('z0', 'rz', [0], '0')]))
    const identity = apply(zero, 'identity', { nodes: [zero.nodes.find((node) => node.kind === 'z')?.id ?? ''] })
    expect(identity.ok).toBe(true)
    if (identity.ok) keepsValue(zero, identity.graph)

    const colored: ZXGraph3D = {
      nodes: [boundary('in-0', '|0⟩', 0), spider('z', 'z', 'π/2'), boundary('out-0', '⟩', 0)],
      edges: [link('e0', 'in-0', 'z', true), link('e1', 'z', 'out-0', true)],
    }
    const color = apply(colored, 'color', { nodes: ['z'] })
    expect(color.ok).toBe(true)
    if (color.ok) keepsValue(colored, color.graph)

    const copied: ZXGraph3D = {
      nodes: [spider('one', 'x', 'π'), spider('z', 'z', '0'), boundary('out0', 'out', 0), boundary('out1', 'out', 1)],
      edges: [link('e0', 'one', 'z'), link('e1', 'z', 'out0'), link('e2', 'z', 'out1')],
    }
    const copy = apply(copied, 'copy', { nodes: ['one', 'z'] })
    expect(copy.ok).toBe(true)
    if (copy.ok) keepsValue(copied, copy.graph)

    const paired: ZXGraph3D = {
      nodes: [boundary('in-0', '|0⟩', 0), spider('z', 'z', '0', 0), spider('x', 'x', '0', 1), boundary('out-0', '⟩', 0), boundary('in-1', '|0⟩', 1), boundary('out-1', '⟩', 1)],
      edges: [link('a', 'in-0', 'z'), link('b', 'z', 'out-0'), link('c', 'in-1', 'x'), link('d', 'x', 'out-1'), link('p', 'z', 'x'), link('q', 'z', 'x')],
    }
    const legs = apply(paired, 'legs', { nodes: ['z', 'x'] })
    expect(legs.ok).toBe(true)
    if (legs.ok) keepsValue(paired, legs.graph)

    const cycle: ZXGraph3D = {
      nodes: [
        spider('z0', 'z', '0', 0), spider('x0', 'x', '0', 1), spider('z1', 'z', '0', 1), spider('x1', 'x', '0', 0),
        boundary('in-0', '|0⟩', 0), boundary('in-1', '|0⟩', 1), boundary('out-0', '⟩', 0), boundary('out-1', '⟩', 1),
      ],
      edges: [
        link('c0', 'z0', 'x0'), link('w1', 'x0', 'z1'), link('c1', 'z1', 'x1'), link('w0', 'x1', 'z0'),
        link('i0', 'in-0', 'z0'), link('i1', 'in-1', 'x0'), link('o0', 'x1', 'out-0'), link('o1', 'z1', 'out-1'),
      ],
    }
    const square = apply(cycle, 'square', { nodes: ['z0', 'x0', 'z1', 'x1'] })
    expect(square.ok).toBe(true)
    if (square.ok) keepsValue(cycle, square.graph)

    const triplet = translateCircuit(circuit(1, [gate('t', 't', [0]), gate('x0', 'rx', [0], '0'), gate('z0', 'rz', [0], '0')]))
    const ids = triplet.nodes.filter((node) => node.kind === 'z' || node.kind === 'x').map((node) => node.id)
    const last = apply(triplet, 'last', { nodes: ids })
    expect(last.ok).toBe(true)
    if (last.ok) keepsValue(triplet, last.graph)
  })
})
