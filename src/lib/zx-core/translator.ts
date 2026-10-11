import type { CircuitGate, QuantumCircuit } from '../../types/circuit'
import type { DiagramScalar, ZXEdge, ZXGraph3D, ZXNode } from '../../types/zx'
import { drawingOf, phaseLabel, type DrawStep } from './semantics'

export const columnSpacing = 135
export const wireSpacing = 115
export const wireY = (wire: number, qubits: number) => (wire - (qubits - 1) / 2) * wireSpacing

export function translateCircuit(circuit: QuantumCircuit): ZXGraph3D {
  const nodes: ZXNode[] = []
  const edges: ZXEdge[] = []
  const numbers: DiagramScalar[] = []
  const last = Array.from({ length: circuit.qubits }, (_, wire) => {
    const id = `in-${wire}`
    nodes.push({
      id,
      kind: 'boundary',
      phase: '',
      wire,
      label: '|0⟩',
      position: { x: -150, y: wireY(wire, circuit.qubits), z: 0 },
    })
    return id
  })
  let column = 0
  const connect = (source: string, target: string, hadamard = false) => {
    edges.push({ id: `e-${edges.length}`, source, target, ...(hadamard ? { hadamard: true } : {}) })
  }
  const place = (id: string, kind: ZXNode['kind'], phase: string, wire: number, gateId: string, label?: string) => {
    nodes.push({
      id,
      kind,
      phase,
      wire,
      gateId,
      ...(label ? { label } : {}),
      position: {
        x: column * columnSpacing,
        y: wireY(wire, circuit.qubits),
        z: (column % 2 ? 1 : -1) * (wire % 2 ? 22 : 0),
      },
    })
  }
  const through = (id: string, wire: number) => {
    connect(last[wire], id)
    last[wire] = id
  }
  const expand = (gate: CircuitGate, step: DrawStep) => {
    if (step.type === 'measure') {
      const id = `${gate.id}-measurement`
      place(id, 'boundary', '', step.wire, gate.id, `M→c[${step.bit}]`)
      through(id, step.wire)
      return
    }
    if (step.type === 'h') {
      const id = `${gate.id}-c${column}-hadamard`
      place(id, 'hadamard', '', step.wire, gate.id)
      through(id, step.wire)
      return
    }
    if (step.type === 'z' || step.type === 'x') {
      const id = `${gate.id}-c${column}-q${step.wire}-${step.type}`
      place(id, step.type, phaseLabel(step.phase), step.wire, gate.id)
      through(id, step.wire)
      return
    }
    if (step.type !== 'cnot' && step.type !== 'cz') return
    const controlColor = 'z'
    const targetColor = step.type === 'cnot' ? 'x' : 'z'
    const controlId = `${gate.id}-c${column}-q${step.control}-${controlColor}`
    const targetId = `${gate.id}-c${column}-q${step.target}-${targetColor}`
    place(controlId, controlColor, '0', step.control, gate.id)
    through(controlId, step.control)
    place(targetId, targetColor, '0', step.target, gate.id)
    through(targetId, step.target)
    connect(controlId, targetId, step.type === 'cz')
  }

  for (const gate of circuit.gates) {
    const drawing = drawingOf(gate)
    numbers.push(...drawing.numbers)
    for (const step of drawing.steps) {
      expand(gate, step)
      column += 1
    }
  }

  last.forEach((source, wire) => {
    const id = `out-${wire}`
    nodes.push({
      id,
      kind: 'boundary',
      phase: '',
      wire,
      label: '⟩',
      position: {
        x: Math.max(column, 1) * columnSpacing + 150,
        y: wireY(wire, circuit.qubits),
        z: 0,
      },
    })
    connect(source, id)
  })
  return numbers.length ? { nodes, edges, numbers } : { nodes, edges }
}
