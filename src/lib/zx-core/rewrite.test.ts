import { describe, expect, it } from 'vitest'
import type { CircuitGate, QuantumCircuit } from '../../types/circuit'
import type { DiagramScalar, ZXGraph3D, ZXNode } from '../../types/zx'
import { toQasm } from '../exporters/circuitExporters'
import { validateSync } from '../sync/circuitSync'
import {
  HALF,
  INV_SQRT2,
  ONE,
  PI_HALF,
  ZERO_SCALAR,
  phaseScalar,
  sameMatrix,
  sameScalar,
  sameVector,
} from './semantics'
import { denote } from './validate'
import { translateCircuit } from './translator'
import { apply, synthesize } from './rewrite'

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

const sound = (before: ZXGraph3D, after: ZXGraph3D) => {
  const left = denote(before)
  const right = denote(after)
  expect(left.wellFormed, left.reason).toBe(true)
  expect(right.wellFormed, right.reason).toBe(true)
  expect(right.inputs).toBe(left.inputs)
  expect(right.outputs).toBe(left.outputs)
  if (!sameMatrix(left.map, right.map)) {
    throw new Error(JSON.stringify({
      inputs: left.inputs,
      outputs: left.outputs,
      leftNumber: left.number,
      rightNumber: right.number,
      left: left.map,
      right: right.map,
    }))
  }
}

describe('rewrite rules', () => {
  it('fuses two phases of the same colour, and refuses the other cases', () => {
    const spec = circuit(1, [gate('a', 'rz', [0], 'pi/2'), gate('b', 'rz', [0], 'pi/2')])
    const graph = translateCircuit(spec)
    const zs = graph.nodes.filter((node) => node.kind === 'z').map((node) => node.id)
    const fused = apply(graph, 'fuse', { nodes: zs })
    expect(fused.ok).toBe(true)
    if (!fused.ok) return
    sound(graph, fused.graph)
    expect(fused.graph.nodes.find((node) => node.kind === 'z')?.phase).toBe('π')
    expect(apply(graph, 'fuse', { nodes: [zs[0], graph.nodes.find((node) => node.kind === 'boundary')?.id ?? ''] }).ok).toBe(false)
    const leg = graph.edges.find((edge) => edge.source === zs[1] || edge.target === zs[1])
    const split = apply(graph, 'fuse', { nodes: [zs[1]], legs: leg ? [leg.id] : [] })
    expect(split.ok).toBe(true)
    if (split.ok) sound(graph, split.graph)

    const different = apply(translateCircuit(circuit(2, [gate('cx', 'cx', [0, 1])])), 'fuse', {
      nodes: ['cx-c0-q0-z', 'cx-c0-q1-x'],
    })
    expect(different.ok).toBe(false)

    const apart = {
      nodes: [spider('a', 'z', '0'), spider('b', 'z', '0'), boundary('in-0', '|0⟩', 0), boundary('out-0', '⟩', 0)],
      edges: [link('e0', 'in-0', 'a'), link('e1', 'b', 'out-0')],
    }
    expect(apply(apart, 'fuse', { nodes: ['a', 'b'] }).ok).toBe(false)

    const hadamard = {
      nodes: [spider('a', 'z', '0'), spider('b', 'z', '0'), boundary('in-0', '|0⟩', 0), boundary('out-0', '⟩', 0)],
      edges: [link('e0', 'in-0', 'a'), link('e1', 'a', 'b', true), link('e2', 'b', 'out-0')],
    }
    expect(apply(hadamard, 'fuse', { nodes: ['a', 'b'] }).ok).toBe(false)
  })

  it('fuses four T gates into phase π and two S gates into the same phase', () => {
    const four = circuit(1, [0, 1, 2, 3].map((index) => gate(`t${index}`, 't', [0])))
    let graph = translateCircuit(four)
    for (let step = 0; step < 3; step += 1) {
      const zs = graph.nodes.filter((node) => node.kind === 'z').map((node) => node.id)
      const next = apply(graph, 'fuse', { nodes: [zs[0], zs[1]] })
      expect(next.ok).toBe(true)
      if (!next.ok) return
      sound(graph, next.graph)
      graph = next.graph
    }
    expect(graph.nodes.find((node) => node.kind === 'z')?.phase).toBe('π')
  })

  it('drops a phase of 0 and a pair of Hadamards, and keeps the cup', () => {
    const zero = translateCircuit(circuit(1, [gate('z0', 'rz', [0], '0')]))
    const spiderId = zero.nodes.find((node) => node.kind === 'z')?.id ?? ''
    const removed = apply(zero, 'identity', { nodes: [spiderId] })
    expect(removed.ok).toBe(true)
    if (!removed.ok) return
    sound(zero, removed.graph)
    expect(removed.graph.nodes.some((node) => node.kind === 'z')).toBe(false)

    const pair = translateCircuit(circuit(1, [gate('h0', 'h', [0]), gate('h1', 'h', [0])]))
    const boxes = pair.nodes.filter((node) => node.kind === 'hadamard').map((node) => node.id)
    const cancelled = apply(pair, 'identity', { nodes: boxes })
    expect(cancelled.ok).toBe(true)
    if (!cancelled.ok) return
    sound(pair, cancelled.graph)
    expect(cancelled.graph.nodes.some((node) => node.kind === 'hadamard')).toBe(false)

    const cup: ZXGraph3D = {
      nodes: [spider('cup', 'z', '0'), boundary('out0', 'out', 0), boundary('out1', 'out', 1)],
      edges: [link('e0', 'cup', 'out0'), link('e1', 'cup', 'out1')],
    }
    expect(apply(cup, 'identity', { nodes: ['cup'] }).ok).toBe(false)
  })

  it('turns a Z spider with Hadamard on every leg into the X spider of the same phase', () => {
    const graph: ZXGraph3D = {
      nodes: [boundary('in-0', '|0⟩', 0), spider('z', 'z', 'π/2'), boundary('out-0', '⟩', 0)],
      edges: [link('e0', 'in-0', 'z', true), link('e1', 'z', 'out-0', true)],
    }
    const turned = apply(graph, 'color', { nodes: ['z'] })
    expect(turned.ok).toBe(true)
    if (!turned.ok) return
    sound(graph, turned.graph)
    expect(turned.graph.nodes.find((node) => node.id === 'z')?.kind).toBe('x')
    expect(turned.graph.nodes.find((node) => node.id === 'z')?.phase).toBe('π/2')

    const pushed: ZXGraph3D = {
      nodes: [boundary('in-0', '|0⟩', 0), { id: 'h', kind: 'hadamard', phase: '', wire: 0, position: at }, spider('z', 'z', 'π/2'), boundary('out-0', '⟩', 0)],
      edges: [link('e0', 'in-0', 'h'), link('e1', 'h', 'z'), link('e2', 'z', 'out-0')],
    }
    const through = apply(pushed, 'color', { nodes: ['z'], through: 'h' })
    expect(through.ok).toBe(true)
    if (!through.ok) return
    sound(pushed, through.graph)
    expect(through.graph.nodes.find((node) => node.id === 'z')?.kind).toBe('x')
    expect(through.graph.edges.some((edge) => edge.hadamard)).toBe(true)
  })

  it('copies |1⟩ through the other colour and refuses the same colour', () => {
    const copied: ZXGraph3D = {
      nodes: [spider('one', 'x', 'π'), spider('z', 'z', '0'), boundary('out0', 'out', 0), boundary('out1', 'out', 1)],
      edges: [link('e0', 'one', 'z'), link('e1', 'z', 'out0'), link('e2', 'z', 'out1')],
    }
    const result = apply(copied, 'copy', { nodes: ['one', 'z'] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    sound(copied, result.graph)
    expect(result.graph.nodes.filter((node) => node.kind === 'x')).toHaveLength(2)
    const same: ZXGraph3D = {
      nodes: [spider('plus', 'z', '0'), spider('z', 'z', '0'), boundary('out0', 'out', 0)],
      edges: [link('e0', 'plus', 'z'), link('e1', 'z', 'out0')],
    }
    expect(apply(same, 'copy', { nodes: ['plus', 'z'] }).ok).toBe(false)
    const wide: ZXGraph3D = {
      nodes: [spider('wide', 'x', 'π'), spider('z', 'z', '0'), boundary('in', 'in', 0), boundary('out0', 'out', 0)],
      edges: [link('e0', 'in', 'wide'), link('e1', 'wide', 'z'), link('e2', 'z', 'out0')],
    }
    expect(apply(wide, 'copy', { nodes: ['wide', 'z'] }).ok).toBe(false)
    const plus: ZXGraph3D = {
      nodes: [spider('plus', 'z', '0'), spider('x', 'x', '0'), boundary('out0', 'out', 0), boundary('out1', 'out', 1)],
      edges: [link('e0', 'plus', 'x'), link('e1', 'x', 'out0'), link('e2', 'x', 'out1')],
    }
    const split = apply(plus, 'copy', { nodes: ['plus', 'x'] })
    expect(split.ok).toBe(true)
    if (!split.ok) return
    sound(plus, split.graph)
  })

  it('passes phase π through the other colour with the factor e^{iα}', () => {
    const graph = translateCircuit(circuit(1, [gate('x', 'x', [0]), gate('s', 's', [0])]))
    const x = graph.nodes.find((node) => node.kind === 'x')?.id ?? ''
    const z = graph.nodes.find((node) => node.kind === 'z')?.id ?? ''
    const moved = apply(graph, 'pi', { nodes: [x, z] })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    sound(graph, moved.graph)
    const green = moved.graph.nodes.find((node) => node.kind === 'z')
    expect(green?.phase).toBe('3π/2')
    expect(sameScalar(moved.graph.numbers?.[0] ?? ZERO_SCALAR, phaseScalar(PI_HALF))).toBe(true)
    const withoutFactor = { ...moved.graph, numbers: [] as DiagramScalar[] }
    expect(sameMatrix(denote(graph).map, denote(withoutFactor).map)).toBe(false)
    const quarter = translateCircuit(circuit(1, [gate('t', 't', [0]), gate('r', 'rx', [0], 'pi/2')]))
    const quarterIds = quarter.nodes.filter((node) => node.kind === 'z' || node.kind === 'x').map((node) => node.id)
    expect(apply(quarter, 'pi', { nodes: quarterIds }).ok).toBe(false)
  })

  it('cuts pairs of wires between different colours and leaves the remainder', () => {
    const two: ZXGraph3D = {
      nodes: [boundary('in-0', '|0⟩', 0), spider('z', 'z', '0', 0), spider('x', 'x', '0', 1), boundary('out-0', '⟩', 0), boundary('in-1', '|0⟩', 1), boundary('out-1', '⟩', 1)],
      edges: [link('a', 'in-0', 'z'), link('b', 'z', 'out-0'), link('c', 'in-1', 'x'), link('d', 'x', 'out-1'), link('p', 'z', 'x'), link('q', 'z', 'x')],
    }
    const cut = apply(two, 'legs', { nodes: ['z', 'x'] })
    expect(cut.ok).toBe(true)
    if (!cut.ok) return
    sound(two, cut.graph)
    expect(cut.graph.edges.some((edge) => (edge.source === 'z' && edge.target === 'x') || (edge.source === 'x' && edge.target === 'z'))).toBe(false)

    const three: ZXGraph3D = {
      ...two,
      edges: [...two.edges, link('r', 'z', 'x')],
    }
    const left = apply(three, 'legs', { nodes: ['z', 'x'] })
    expect(left.ok).toBe(true)
    if (!left.ok) return
    sound(three, left.graph)
    expect(left.graph.edges.filter((edge) => edge.source === 'z' && edge.target === 'x')).toHaveLength(1)
    expect(apply(two, 'legs', { nodes: ['z', 'x'] }).ok).toBe(true)
    const single = apply({ ...two, edges: two.edges.filter((edge) => edge.id !== 'q') }, 'legs', { nodes: ['z', 'x'] })
    expect(single.ok).toBe(false)
    expect(apply(two, 'fuse', { nodes: ['z', 'x'] }).ok).toBe(false)
    expect(apply(two, 'identity', { nodes: ['z'] }).ok).toBe(false)
    expect(apply(two, 'color', { nodes: ['z'] }).ok).toBe(false)
  })

  it('explodes a square into two spiders that share one wire', () => {
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
    const exploded = apply(cycle, 'square', { nodes: ['z0', 'x0', 'z1', 'x1'] })
    expect(exploded.ok).toBe(true)
    if (!exploded.ok) return
    sound(cycle, exploded.graph)
    const spiders = exploded.graph.nodes.filter((node) => node.kind === 'z' || node.kind === 'x')
    expect(spiders).toHaveLength(2)
    expect(new Set(spiders.map((node) => node.kind)).size).toBe(2)
    expect(exploded.graph.edges.some((edge) => spiders.every((node) => edge.source === node.id || edge.target === node.id))).toBe(true)
  })

  it('turns three alternating CNOTs into the crossed wires, with the swap matrix', () => {
    const spec = circuit(2, [gate('swap', 'swap', [0, 1])])
    let graph = translateCircuit(spec)
    const square = apply(graph, 'square', { nodes: ['swap-c0-q0-z', 'swap-c0-q1-x', 'swap-c1-q1-z', 'swap-c1-q0-x'] })
    expect(square.ok).toBe(true)
    if (!square.ok) return
    sound(graph, square.graph)
    graph = square.graph
    const green = graph.nodes.find((node) => node.kind === 'z' && node.id.startsWith('square'))
    const red = graph.nodes.find((node) => node.kind === 'x' && node.id.startsWith('square'))
    const fuseGreen = apply(graph, 'fuse', { nodes: [green?.id ?? '', 'swap-c2-q0-z'] })
    expect(fuseGreen.ok).toBe(true)
    if (!fuseGreen.ok) return
    sound(graph, fuseGreen.graph)
    graph = fuseGreen.graph
    const fuseRed = apply(graph, 'fuse', { nodes: [red?.id ?? '', 'swap-c2-q1-x'] })
    expect(fuseRed.ok).toBe(true)
    if (!fuseRed.ok) return
    sound(graph, fuseRed.graph)
    graph = fuseRed.graph
    const z = graph.nodes.find((node) => node.kind === 'z')?.id ?? ''
    const x = graph.nodes.find((node) => node.kind === 'x')?.id ?? ''
    const cut = apply(graph, 'legs', { nodes: [z, x] })
    expect(cut.ok).toBe(true)
    if (!cut.ok) return
    sound(graph, cut.graph)
    expect(sameMatrix(denote(cut.graph).map, denote(translateCircuit(spec)).map)).toBe(true)
  })

  it('rewrites a triplet that carries a quarter turn only with the last rule', () => {
    const graph = translateCircuit(circuit(1, [gate('t', 't', [0]), gate('x0', 'rx', [0], '0'), gate('z0', 'rz', [0], '0')]))
    const ids = graph.nodes.filter((node) => node.kind === 'z' || node.kind === 'x').map((node) => node.id)
    expect(apply(graph, 'fuse', { nodes: ids.slice(0, 2) }).ok).toBe(false)
    expect(apply(graph, 'identity', { nodes: [ids[0]] }).ok).toBe(false)
    expect(apply(graph, 'color', { nodes: [ids[0]] }).ok).toBe(false)
    expect(apply(graph, 'legs', { nodes: ids.slice(0, 2) }).ok).toBe(false)
    expect(apply(graph, 'square', { nodes: ids }).ok).toBe(false)
    const rewritten = apply(graph, 'last', { nodes: ids })
    expect(rewritten.ok).toBe(true)
    if (!rewritten.ok) return
    sound(graph, rewritten.graph)
    expect(rewritten.graph.nodes.filter((node) => node.kind === 'x' || node.kind === 'z').map((node) => node.kind).join('')).toBe('xzx')
  })

  it('yanks the naked cup to the wire, and the circuit cup to half the wire', () => {
    const naked: ZXGraph3D = {
      nodes: [boundary('in-0', '|0⟩', 0), spider('cap', 'z', '0'), spider('cup', 'z', '0'), boundary('out-0', '⟩', 0)],
      edges: [link('i', 'in-0', 'cap'), link('m', 'cup', 'cap'), link('o', 'cup', 'out-0')],
    }
    const fused = apply(naked, 'fuse', { nodes: ['cap', 'cup'] })
    expect(fused.ok).toBe(true)
    if (!fused.ok) return
    sound(naked, fused.graph)
    const wire = fused.graph.nodes.find((node) => node.kind === 'z')
    const straight = apply(fused.graph, 'identity', { nodes: [wire?.id ?? ''] })
    expect(straight.ok).toBe(true)
    if (!straight.ok) return
    sound(fused.graph, straight.graph)
    expect(sameMatrix(denote(straight.graph).map, [[ONE, ZERO_SCALAR], [ZERO_SCALAR, ONE]])).toBe(true)

    const scaled: ZXGraph3D = {
      ...naked,
      nodes: naked.nodes.map((node) => (node.kind === 'z' ? { ...node, number: INV_SQRT2 } : node)),
    }
    const fusedScaled = apply(scaled, 'fuse', { nodes: ['cap', 'cup'] })
    expect(fusedScaled.ok).toBe(true)
    if (!fusedScaled.ok) return
    const joined = fusedScaled.graph.nodes.find((node) => node.kind === 'z')
    const halfWire = apply(fusedScaled.graph, 'identity', { nodes: [joined?.id ?? ''] })
    expect(halfWire.ok).toBe(true)
    if (!halfWire.ok) return
    sound(fusedScaled.graph, halfWire.graph)
    expect(sameScalar(halfWire.graph.numbers?.reduce(mul, ONE) ?? ONE, HALF)).toBe(true)
    expect(sameMatrix(denote(halfWire.graph).map, [[HALF, ZERO_SCALAR], [ZERO_SCALAR, HALF]])).toBe(true)
  })

  it('keeps the OpenQASM, and synthesizes one rz from two fused phases', () => {
    const spec = circuit(1, [gate('a', 'rz', [0], 'pi/3'), gate('b', 'rz', [0], 'pi/3')])
    const qasm = toQasm(spec)
    const graph = translateCircuit(spec)
    const zs = graph.nodes.filter((node) => node.kind === 'z').map((node) => node.id)
    const fused = apply(graph, 'fuse', { nodes: zs })
    expect(fused.ok).toBe(true)
    if (!fused.ok) return
    expect(toQasm(spec)).toBe(qasm)
    expect(validateSync(spec, translateCircuit(spec)).ok).toBe(true)
    const written = synthesize(fused.graph)
    expect(written.ok).toBe(true)
    if (!written.ok) return
    expect(written.circuit.gates).toHaveLength(1)
    expect(written.circuit.gates[0].name).toBe('rz')
    expect(written.circuit.gates[0].parameter).toBe('2*pi/3')
    const cup: ZXGraph3D = {
      nodes: [spider('cup', 'z', '0'), boundary('out0', 'out', 0), boundary('out1', 'out', 1)],
      edges: [link('e0', 'cup', 'out0'), link('e1', 'cup', 'out1')],
    }
    expect(synthesize(cup).ok).toBe(false)
  })

  it('reaches the cup from Bell by the cited rules, with the number the matrices ask for', () => {
    const bell = circuit(2, [gate('h', 'h', [0]), gate('cx', 'cx', [0, 1])])
    const prepared = denote(translateCircuit(bell)).state ?? []
    const diagram: ZXGraph3D = {
      nodes: [
        { ...spider('x0', 'x', '0'), number: INV_SQRT2 },
        { id: 'h', kind: 'hadamard', phase: '', wire: 0, position: at },
        spider('z', 'z', '0', 0),
        { ...spider('x1', 'x', '0', 1), number: INV_SQRT2 },
        spider('xt', 'x', '0', 1),
        boundary('out-0', 'out', 0),
        boundary('out-1', 'out', 1),
      ],
      edges: [
        link('e0', 'x0', 'h'), link('e1', 'h', 'z'), link('e2', 'z', 'out-0'),
        link('e3', 'x1', 'xt'), link('e4', 'xt', 'out-1'), link('e5', 'z', 'xt'),
      ],
      numbers: [{ re: Math.SQRT2, im: 0 }],
    }
    expect(sameVector(denote(diagram).state ?? [], prepared)).toBe(true)
    const coloured = apply(diagram, 'color', { nodes: ['x0'] })
    expect(coloured.ok).toBe(true)
    if (!coloured.ok) return
    sound(diagram, coloured.graph)
    const fusedPlus = apply(coloured.graph, 'fuse', { nodes: ['x0', 'z'] })
    expect(fusedPlus.ok).toBe(true)
    if (!fusedPlus.ok) return
    sound(coloured.graph, fusedPlus.graph)
    const fusedZero = apply(fusedPlus.graph, 'fuse', { nodes: ['x1', 'xt'] })
    expect(fusedZero.ok).toBe(true)
    if (!fusedZero.ok) return
    sound(fusedPlus.graph, fusedZero.graph)
    const target = fusedZero.graph.nodes.find((node) => node.kind === 'x')
    const yanked = apply(fusedZero.graph, 'identity', { nodes: [target?.id ?? ''] })
    expect(yanked.ok).toBe(true)
    if (!yanked.ok) return
    sound(fusedZero.graph, yanked.graph)
    const cup = yanked.graph.nodes.find((node) => node.kind === 'z')
    expect(cup).toBeDefined()
    expect(yanked.graph.nodes.filter((node) => node.kind === 'z' || node.kind === 'x')).toHaveLength(1)
    expect(sameVector(denote(yanked.graph).state ?? [], prepared)).toBe(true)
  })

  it('treats teleportation by a cap as only sometimes, and a discard as noise', () => {
    const cap: ZXGraph3D = {
      nodes: [spider('cap', 'z', '0'), boundary('in0', 'in', 0), boundary('in1', 'in', 1)],
      edges: [link('a', 'in0', 'cap'), link('b', 'in1', 'cap')],
    }
    expect(denote(cap).mark).toBe('tal vez')
    const bell = translateCircuit(circuit(2, [gate('h', 'h', [0]), gate('cx', 'cx', [0, 1])]))
    const discarded = {
      ...bell,
      nodes: bell.nodes.map((node) => (node.id === 'out-1' ? { ...node, label: '⏚' } : node)),
    }
    const noise = denote(discarded)
    const sent = denote(bell).state ?? []
    expect(noise.mark).toBe('fugas')
    expect(sameMatrix(noise.density ?? [], [[HALF, ZERO_SCALAR], [ZERO_SCALAR, HALF]])).toBe(true)
    expect(sent).toHaveLength(4)
    expect(sameScalar(sent[0], HALF)).toBe(false)
  })
})

const mul = (left: DiagramScalar, right: DiagramScalar) => ({
  re: left.re * right.re - left.im * right.im,
  im: left.re * right.im + left.im * right.re,
})
