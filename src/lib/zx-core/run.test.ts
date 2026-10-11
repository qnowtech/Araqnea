import { describe, expect, it } from 'vitest'
import type { CircuitGate, QuantumCircuit } from '../../types/circuit'
import type { ZXGraph3D } from '../../types/zx'
import { toQasm } from '../exporters/circuitExporters'
import { buildPictureElement } from './pictureElements'
import { explain } from './latex'
import { apply } from './rewrite'
import { run } from './run'
import {
  HALF,
  ONE,
  ZERO_SCALAR,
  nakedCup,
  sameMatrix,
  sameScalar,
  sameVector,
} from './semantics'
import { denote } from './validate'
import { translateCircuit } from './translator'

const at = { x: 0, y: 0, z: 0 }

const gate = (id: string, name: CircuitGate['name'], qubits: number[], parameter?: string, classicalBit?: number): CircuitGate => ({
  id, name, qubits, ...(parameter ? { parameter } : {}), ...(classicalBit !== undefined ? { classicalBit } : {}),
})

const circuit = (qubits: number, gates: CircuitGate[], classicalBits = 0): QuantumCircuit => ({ qubits, classicalBits, gates })

const bell = () => circuit(2, [gate('h', 'h', [0]), gate('cx', 'cx', [0, 1])])

const chain = (qubits: number) => circuit(qubits, [
  gate('h', 'h', [0]),
  ...Array.from({ length: qubits - 1 }, (_, index) => gate(`cx${index}`, 'cx', [index, index + 1])),
])

describe('run', () => {
  it('returns amplitudes of a pure map, the trace of a discard, and counts from the stored bit', () => {
    const graph = translateCircuit(bell())
    const prepared = run({ mode: 'simulator', graph, circuit: bell() })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok || prepared.method !== 'statevector') return
    expect(prepared.safe).toBe(true)
    expect(sameScalar(prepared.weight, ONE)).toBe(true)
    expect(explain(graph).latex).toBe('(|00\\rangle+|11\\rangle)/\\sqrt{2}')
    expect(sameVector(prepared.amplitudes, denote(graph).state ?? [])).toBe(true)
    expect(sameVector(prepared.amplitudes, nakedCup())).toBe(false)
    Object.entries(prepared.probabilities).forEach(([bits, chance]) => {
      const amplitude = prepared.amplitudes[Number.parseInt(bits, 2)]
      expect(chance).toBeCloseTo(amplitude.re * amplitude.re + amplitude.im * amplitude.im)
    })

    const measured = circuit(2, [...bell().gates, gate('m0', 'measure', [0], undefined, 0), gate('m1', 'measure', [1], undefined, 1)], 2)
    const counted = run({ mode: 'simulator', graph: translateCircuit(measured), circuit: measured, shots: 200, seed: 1 })
    expect(counted.ok).toBe(true)
    if (!counted.ok || counted.method !== 'statevector') return
    expect(sameVector(counted.amplitudes, prepared.amplitudes)).toBe(true)
    expect(counted.counts?.['00']).toBeGreaterThan(0)
    expect(counted.counts?.['11']).toBeGreaterThan(0)
    expect(counted.counts?.['01'] ?? 0).toBe(0)
    expect(counted.counts?.['10'] ?? 0).toBe(0)
    expect((counted.counts?.['00'] ?? 0) + (counted.counts?.['11'] ?? 0)).toBe(200)
    expect(counted.probabilities['00']).toBeCloseTo(1 / 2)
    expect(counted.probabilities['11']).toBeCloseTo(1 / 2)

    const leaked: ZXGraph3D = {
      ...graph,
      nodes: graph.nodes.map((node) => (node.id === 'out-1' ? { ...node, label: '⏚' } : node)),
    }
    const traced = run({ mode: 'simulator', graph: leaked })
    expect(traced.ok).toBe(true)
    if (!traced.ok || traced.method !== 'density') return
    expect(sameMatrix(traced.density, [[HALF, ZERO_SCALAR], [ZERO_SCALAR, HALF]])).toBe(true)
  })

  it('does not run the naked cup as a safe state', () => {
    const cup = run({ mode: 'simulator', graph: buildPictureElement('cup', at, 'cup') })
    expect(cup.ok).toBe(true)
    if (!cup.ok || cup.method !== 'statevector') return
    expect(cup.safe).toBe(false)
    expect(sameScalar(cup.weight, { re: 2, im: 0 })).toBe(true)
    expect(sameVector(cup.amplitudes, nakedCup())).toBe(true)
    expect(cup.counts).toBeUndefined()
  })

  it('returns no amplitudes and no counts for a cap or a phase-0 test', () => {
    for (const id of ['cap', 'effect-zero', 'effect-plus'] as const) {
      const result = run({ mode: 'simulator', graph: buildPictureElement(id, at, id) })
      expect(result.ok, id).toBe(false)
      expect('amplitudes' in result, id).toBe(false)
      expect('counts' in result, id).toBe(false)
    }
    const broken: ZXGraph3D = {
      nodes: [{ id: 'z', kind: 'z', phase: '0', wire: 0, position: at }],
      edges: [{ id: 'e', source: 'z', target: 'missing' }],
    }
    expect(run({ mode: 'simulator', graph: broken }).ok).toBe(false)
  })

  it('runs thirteen qubits as an MPS, and stops when the bond limit is too small', () => {
    const spec = chain(13)
    const graph = translateCircuit(spec)
    const fitted = run({ mode: 'simulator', graph, circuit: spec, bond: 2 })
    expect(fitted.ok).toBe(true)
    if (!fitted.ok || fitted.method !== 'mps') return
    expect(fitted.exact).toBe(false)
    expect(fitted.bond).toBe(2)
    expect(fitted.qubits).toBe(13)
    expect(run({ mode: 'simulator', graph, circuit: spec, bond: 1 }).ok).toBe(false)
  })

  it('sends the original OpenQASM to hardware and returns only counts', () => {
    const spec = circuit(2, [...bell().gates, gate('m0', 'measure', [0], undefined, 0), gate('m1', 'measure', [1], undefined, 1)], 2)
    const qasm = toQasm(spec)
    const graph = translateCircuit(spec)
    const token = 'ibm-secret-key'
    const sent = run({ mode: 'hardware', graph, circuit: spec, token, shots: 40, seed: 3 })
    expect(sent.ok).toBe(true)
    if (!sent.ok || sent.mode !== 'hardware') return
    expect(sent.qasm).toBe(qasm)
    expect(sent.counts['00'] + sent.counts['11']).toBe(40)
    expect(sent.counts['01'] ?? 0).toBe(0)
    expect(sent.counts['10'] ?? 0).toBe(0)
    expect('amplitudes' in sent).toBe(false)
    expect('density' in sent).toBe(false)
    expect(JSON.stringify(sent)).not.toContain(token)
    expect(sent.qasm).not.toContain(token)
    expect(toQasm(spec)).not.toContain(token)

    const rotations = circuit(1, [gate('a', 'rz', [0], 'pi/2'), gate('b', 'rz', [0], 'pi/2'), gate('m', 'measure', [0], undefined, 0)], 1)
    const before = toQasm(rotations)
    const spiders = translateCircuit(rotations)
    const zs = spiders.nodes.filter((node) => node.kind === 'z').map((node) => node.id)
    const fused = apply(spiders, 'fuse', { nodes: zs })
    expect(fused.ok).toBe(true)
    expect(toQasm(rotations)).toBe(before)
    const original = run({ mode: 'hardware', graph: spiders, circuit: rotations, shots: 8, seed: 1 })
    expect(original.ok).toBe(true)
    if (original.ok && original.mode === 'hardware') expect(original.qasm).toBe(before)
    if (fused.ok) expect(run({ mode: 'hardware', graph: fused.graph, circuit: rotations }).ok).toBe(false)
    expect(run({ mode: 'hardware', graph, circuit: bell() }).ok).toBe(false)
  })
})
