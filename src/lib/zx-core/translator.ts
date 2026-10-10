import type { QuantumCircuit } from '../../types/circuit'
import type { ZXEdge, ZXGraph, ZXNode } from '../../types/zx'

const phaseFor = (gate: string, parameter?: string) =>
  ({ x: 'π', z: 'π', s: 'π/2', t: 'π/4', rx: parameter ?? 'θ', rz: parameter ?? 'θ' })[gate] ?? '0'

export function translateCircuit(circuit: QuantumCircuit): ZXGraph {
  const nodes: ZXNode[] = []
  const edges: ZXEdge[] = []
  const last = Array.from({ length: circuit.qubits }, (_, wire) => {
    const id = `in-${wire}`
    nodes.push({ id, kind: 'boundary', phase: '', wire, label: `|0⟩`, x: 56, y: 95 + wire * 100 })
    return id
  })
  const connect = (source: string, target: string, hadamard = false) =>
    edges.push({ id: `e-${edges.length}`, source, target, hadamard })
  const spider = (kind: 'z' | 'x', wire: number, phase: string, column: number) => {
    const id = `n-${nodes.length}`
    nodes.push({ id, kind, phase, wire, x: 150 + column * 92, y: 95 + wire * 100 })
    connect(last[wire], id)
    last[wire] = id
    return id
  }

  circuit.gates.forEach((gate, column) => {
    if (gate.name === 'measure') return
    if (gate.name === 'cx') {
      const control = spider('z', gate.qubits[0], '0', column)
      const target = spider('x', gate.qubits[1], '0', column)
      connect(control, target)
    } else if (gate.name === 'cz') {
      const first = spider('z', gate.qubits[0], '0', column)
      const second = spider('z', gate.qubits[1], '0', column)
      connect(first, second, true)
    } else if (gate.name === 'h') {
      const id = `h-${nodes.length}`
      nodes.push({ id, kind: 'boundary', phase: '', wire: gate.qubits[0], label: 'H', x: 150 + column * 92, y: 95 + gate.qubits[0] * 100 })
      connect(last[gate.qubits[0]], id, true)
      last[gate.qubits[0]] = id
    } else if (gate.name !== 'y' && gate.name !== 'swap') {
      spider(gate.name === 'x' || gate.name === 'rx' ? 'x' : 'z', gate.qubits[0], phaseFor(gate.name, gate.parameter), column)
    }
  })
  last.forEach((source, wire) => {
    const id = `out-${wire}`
    nodes.push({ id, kind: 'boundary', phase: '', wire, label: '⟩', x: 150 + Math.max(circuit.gates.length, 1) * 92, y: 95 + wire * 100 })
    connect(source, id)
  })
  return { nodes, edges }
}
