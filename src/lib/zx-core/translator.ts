import type { CircuitGate, QuantumCircuit } from '../../types/circuit'
import type { ZXEdge, ZXGraph3D, ZXNode } from '../../types/zx'

const phaseFor = (gate: CircuitGate) =>
  ({ x: 'π', y: 'π', z: 'π', s: 'π/2', t: 'π/4', rx: gate.parameter ?? 'θ', rz: gate.parameter ?? 'θ' } as Partial<Record<CircuitGate['name'], string>>)[gate.name] ?? '0'

export const columnSpacing = 135
export const wireSpacing = 115
export const wireY = (wire: number, qubits: number) => (wire - (qubits - 1) / 2) * wireSpacing

export function translateCircuit(circuit: QuantumCircuit): ZXGraph3D {
  const nodes: ZXNode[] = []
  const edges: ZXEdge[] = []
  const last = Array.from({ length: circuit.qubits }, (_, wire) => {
    const id = `in-${wire}`
    nodes.push({
      id,
      kind: 'boundary',
      phase: '',
      wire,
      label: `|0⟩`,
      position: { x: -150, y: wireY(wire, circuit.qubits), z: 0 },
    })
    return id
  })
  const connect = (source: string, target: string, hadamard = false) =>
    edges.push({ id: `e-${edges.length}`, source, target, hadamard })
  const addNode = (node: ZXNode) => {
    nodes.push(node)
    return node.id
  }
  const spider = (gate: CircuitGate, kind: 'z' | 'x', wire: number, phase: string, column: number) => {
    const id = `${gate.id}-q${wire}-${kind}`
    const current = addNode({
      id,
      kind,
      phase,
      wire,
      gateId: gate.id,
      position: {
        x: column * columnSpacing,
        y: wireY(wire, circuit.qubits),
        z: (column % 2 ? 1 : -1) * (wire % 2 ? 22 : 0),
      },
    })
    connect(last[wire], current)
    last[wire] = current
    return current
  }

  circuit.gates.forEach((gate, column) => {
    if (gate.name === 'measure') {
      const wire = gate.qubits[0]
      const id = `${gate.id}-measurement`
      const node = addNode({
        id,
        kind: 'boundary',
        phase: '',
        wire,
        label: `M→c[${gate.classicalBit ?? wire}]`,
        gateId: gate.id,
        position: { x: column * columnSpacing, y: wireY(wire, circuit.qubits), z: 0 },
      })
      connect(last[wire], node)
      last[wire] = node
    } else if (gate.name === 'h') {
      const wire = gate.qubits[0]
      const id = addNode({
        id: `${gate.id}-hadamard`,
        kind: 'hadamard',
        phase: '',
        wire,
        gateId: gate.id,
        position: { x: column * columnSpacing, y: wireY(wire, circuit.qubits), z: 0 },
      })
      connect(last[wire], id)
      last[wire] = id
    } else if (gate.name === 'cx' || gate.name === 'cz') {
      const first = spider(gate, 'z', gate.qubits[0], '0', column)
      const second = spider(gate, gate.name === 'cx' ? 'x' : 'z', gate.qubits[1], '0', column)
      connect(first, second, gate.name === 'cz')
    } else if (gate.name === 'swap') {
      const first = spider(gate, 'x', gate.qubits[0], 'π', column)
      const second = spider(gate, 'x', gate.qubits[1], 'π', column)
      connect(first, second)
    } else if (gate.name === 'y') {
      const wire = gate.qubits[0]
      spider(gate, 'x', wire, 'π', column)
      spider(gate, 'z', wire, 'π', column)
    } else {
      spider(gate, gate.name === 'x' || gate.name === 'rx' ? 'x' : 'z', gate.qubits[0], phaseFor(gate), column)
    }
  })

  last.forEach((source, wire) => {
    const id = `out-${wire}`
    nodes.push({
      id,
      kind: 'boundary',
      phase: '',
      wire,
      label: '⟩',
      position: {
        x: Math.max(circuit.gates.length, 1) * columnSpacing + 150,
        y: wireY(wire, circuit.qubits),
        z: 0,
      },
    })
    connect(source, id)
  })
  return { nodes, edges }
}
