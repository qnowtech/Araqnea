import type { GateName, QuantumCircuit } from '../../types/circuit'
import type { ZXGraph3D } from '../../types/zx'

const formatGate = (name: string, qubits: number[], parameter?: string, separator = ',') =>
  `${name}${parameter ? `(${parameter})` : ''} ${qubits.map((qubit) => `q[${qubit}]`).join(separator)};`

const classicalBitCount = (circuit: QuantumCircuit) => Math.max(circuit.classicalBits, ...circuit.gates
  .filter((gate) => gate.name === 'measure')
  .map((gate) => (gate.classicalBit ?? gate.qubits[0]) + 1), 0)

export function toQasm(circuit: QuantumCircuit): string {
  const classicalBits = classicalBitCount(circuit)
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

export function toQasm3(circuit: QuantumCircuit): string {
  const classicalBits = classicalBitCount(circuit)
  const lines = ['OPENQASM 3.0;', 'include "stdgates.inc";', '', `qubit[${circuit.qubits}] q;`]
  if (classicalBits) lines.push(`bit[${classicalBits}] c;`)
  lines.push('')
  for (const gate of circuit.gates) {
    if (gate.name === 'measure') {
      lines.push(`c[${gate.classicalBit ?? gate.qubits[0]}] = measure q[${gate.qubits[0]}];`)
    } else {
      lines.push(formatGate(gate.name, gate.qubits, gate.parameter, ', '))
    }
  }
  return lines.join('\n')
}

export function toQiskitPython(circuit: QuantumCircuit): string {
  const classicalBits = classicalBitCount(circuit)
  const usesAngles = circuit.gates.some((gate) => gate.parameter)
  const lines = [
    ...(usesAngles ? ['from math import pi, tau'] : []),
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
      case 'cz':
      case 'swap':
        lines.push(`qc.${gate.name}(${first}, ${second})`)
        break
      default:
        lines.push(`qc.${gate.name}(${first})`)
    }
  }
  return lines.join('\n')
}

const pennyLaneOps: Record<Exclude<GateName, 'measure'>, string> = {
  h: 'Hadamard', x: 'PauliX', y: 'PauliY', z: 'PauliZ', s: 'S', t: 'T', rx: 'RX', rz: 'RZ', cx: 'CNOT', cz: 'CZ', swap: 'SWAP',
}

export function toPennyLane(circuit: QuantumCircuit): string {
  const pyAngle = (parameter: string) => parameter.replace(/\btau\b/gi, '(2 * np.pi)').replace(/\bpi\b/gi, 'np.pi')
  const body: string[] = []
  const finalMeasured: number[] = []
  circuit.gates.forEach((gate, index) => {
    if (gate.name === 'measure') {
      const wire = gate.qubits[0]
      const usedLater = circuit.gates.slice(index + 1).some((later) => later.qubits.includes(wire))
      if (usedLater) body.push(`    qml.measure(wires=${wire})  # mid-circuit measurement → c[${gate.classicalBit ?? wire}]`)
      else if (!finalMeasured.includes(wire)) finalMeasured.push(wire)
      return
    }
    const op = pennyLaneOps[gate.name]
    const wires = gate.qubits.length > 1 ? `[${gate.qubits.join(', ')}]` : `${gate.qubits[0]}`
    body.push(`    qml.${op}(${gate.parameter ? `${pyAngle(gate.parameter)}, ` : ''}wires=${wires})`)
  })
  const returned = finalMeasured.length
    ? `qml.counts(wires=[${finalMeasured.join(', ')}])`
    : `qml.probs(wires=[${Array.from({ length: circuit.qubits }, (_, wire) => wire).join(', ')}])`
  return [
    'import pennylane as qml',
    'from pennylane import numpy as np',
    '',
    `dev = qml.device("default.qubit", wires=${circuit.qubits}${finalMeasured.length ? ', shots=1000' : ''})`,
    '',
    '',
    '@qml.qnode(dev)',
    'def circuit():',
    ...body,
    `    return ${returned}`,
    '',
    '',
    'print(circuit())',
  ].join('\n')
}

export function toZXJson(graph: ZXGraph3D): string {
  return JSON.stringify(graph, null, 2)
}
