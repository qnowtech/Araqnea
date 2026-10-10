import type { QuantumCircuit } from '../../types/circuit'
import type { ZXGraph3D } from '../../types/zx'

const formatGate = (name: string, qubits: number[], parameter?: string) =>
  `${name}${parameter ? `(${parameter})` : ''} ${qubits.map((qubit) => `q[${qubit}]`).join(',')};`

export function toQasm(circuit: QuantumCircuit): string {
  const classicalBits = Math.max(circuit.classicalBits, ...circuit.gates
    .filter((gate) => gate.name === 'measure')
    .map((gate) => (gate.classicalBit ?? gate.qubits[0]) + 1), 0)
  const lines = ['OPENQASM 2.0;', 'include "qelib1.inc";', `qreg q[${circuit.qubits}];`]
  if (classicalBits) lines.push(`creg c[${classicalBits}];`)
  for (const gate of circuit.gates) {
    if (gate.name === 'measure') {
      lines.push(`measure q[${gate.qubits[0]}] -> c[${gate.classicalBit ?? gate.qubits[0]}];`)
    } else {
      lines.push(formatGate(gate.name, gate.qubits, gate.parameter))
    }
  }
  return lines.join('\n')
}

export function toQiskitPython(circuit: QuantumCircuit): string {
  const classicalBits = Math.max(circuit.classicalBits, ...circuit.gates
    .filter((gate) => gate.name === 'measure')
    .map((gate) => (gate.classicalBit ?? gate.qubits[0]) + 1), 0)
  const lines = [
    'from qiskit import QuantumCircuit',
    '',
    `qc = QuantumCircuit(${circuit.qubits}, ${classicalBits})`,
  ]
  for (const gate of circuit.gates) {
    const [first, second] = gate.qubits
    switch (gate.name) {
      case 'measure':
        lines.push(`qc.measure(${first}, ${gate.classicalBit ?? first})`)
        break
      case 'rx':
      case 'rz':
        lines.push(`qc.${gate.name}(${gate.parameter}, ${first})`)
        break
      case 'cx':
        lines.push(`qc.cx(${first}, ${second})`)
        break
      case 'cz':
        lines.push(`qc.cz(${first}, ${second})`)
        break
      case 'swap':
        lines.push(`qc.swap(${first}, ${second})`)
        break
      default:
        lines.push(`qc.${gate.name}(${first})`)
    }
  }
  return lines.join('\n')
}

export function toZXJson(graph: ZXGraph3D): string {
  return JSON.stringify(graph, null, 2)
}
