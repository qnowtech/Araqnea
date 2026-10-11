export const examples = {
  'Bell state': `OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[2];\ncreg c[2];\nh q[0];\ncx q[0],q[1];\nmeasure q[0] -> c[0];\nmeasure q[1] -> c[1];`,
  'GHZ state': `OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[3];\ncreg c[3];\nh q[0];\ncx q[0],q[1];\ncx q[1],q[2];\nmeasure q[0] -> c[0];\nmeasure q[1] -> c[1];\nmeasure q[2] -> c[2];`,
  'Hadamard test': `OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[2];\ncreg c[2];\nh q[0];\ncz q[0],q[1];\nh q[0];\nmeasure q[0] -> c[0];`
} as const

export interface CircuitPreset {
  name: string
  group: string
  description: string
  source: string
}

const template = (qubits: number, gates: string[]) =>
  ['OPENQASM 2.0;', 'include "qelib1.inc";', `qreg q[${qubits}];`, ...gates].join('\n')

export const circuitPresets: CircuitPreset[] = [
  ...Object.entries(examples).map(([name, source]) => ({
    name, source, group: 'Circuits' as const,
    description: name === 'Bell state' ? 'Two-qubit entanglement with measurements.'
      : name === 'GHZ state' ? 'Three-qubit entanglement with measurements.'
        : 'Ancilla interference with a controlled-Z and measurement.',
  })),
  {
    name: 'RealAmplitudes',
    group: 'Qiskit ansatz',
    description: '3 qubits · 1 repetition · linear CNOT entanglement · two Ry layers. Fixed example angles, editable in code or gates.',
    source: template(3, [
      'ry(pi/4) q[0];', 'ry(pi/2) q[1];', 'ry(pi/3) q[2];',
      'cx q[0],q[1];', 'cx q[1],q[2];',
      'ry(pi/6) q[0];', 'ry(pi/4) q[1];', 'ry(pi/2) q[2];',
    ]),
  },
  {
    name: 'EfficientSU2',
    group: 'Qiskit ansatz',
    description: '3 qubits · 1 repetition · linear CNOT entanglement · Ry/Rz layers. Fixed example angles, not a symbolic optimizer.',
    source: template(3, [
      'ry(pi/4) q[0];', 'ry(pi/2) q[1];', 'ry(pi/3) q[2];',
      'rz(pi/6) q[0];', 'rz(pi/4) q[1];', 'rz(pi/2) q[2];',
      'cx q[0],q[1];', 'cx q[1],q[2];',
      'ry(pi/6) q[0];', 'ry(pi/4) q[1];', 'ry(pi/2) q[2];',
      'rz(pi/3) q[0];', 'rz(pi/6) q[1];', 'rz(pi/4) q[2];',
    ]),
  },
  {
    name: 'AngleEmbedding',
    group: 'PennyLane templates',
    description: '3 features on 3 qubits · RX encoding with features [pi/4, pi/2, pi/3]. Decomposed into editable gates.',
    source: template(3, ['rx(pi/4) q[0];', 'rx(pi/2) q[1];', 'rx(pi/3) q[2];']),
  },
  {
    name: 'BasicEntanglerLayers',
    group: 'PennyLane templates',
    description: '3 qubits · 2 layers · default RX rotations and a CNOT ring. Decomposed with fixed example weights.',
    source: template(3, [
      'rx(pi/4) q[0];', 'rx(pi/2) q[1];', 'rx(pi/3) q[2];',
      'cx q[0],q[1];', 'cx q[1],q[2];', 'cx q[2],q[0];',
      'rx(pi/6) q[0];', 'rx(pi/4) q[1];', 'rx(pi/2) q[2];',
      'cx q[0],q[1];', 'cx q[1],q[2];', 'cx q[2],q[0];',
    ]),
  },
  {
    name: 'StronglyEntanglingLayers',
    group: 'PennyLane templates',
    description: '3 qubits · 2 layers · Rot decomposed as Rz/Ry/Rz · CNOT ranges [1, 2]. Fixed example weights.',
    source: template(3, [
      'rz(pi/4) q[0];', 'ry(pi/2) q[0];', 'rz(pi/3) q[0];',
      'rz(pi/6) q[1];', 'ry(pi/4) q[1];', 'rz(pi/2) q[1];',
      'rz(pi/3) q[2];', 'ry(pi/6) q[2];', 'rz(pi/4) q[2];',
      'cx q[0],q[1];', 'cx q[1],q[2];', 'cx q[2],q[0];',
      'rz(pi/6) q[0];', 'ry(pi/4) q[0];', 'rz(pi/2) q[0];',
      'rz(pi/3) q[1];', 'ry(pi/6) q[1];', 'rz(pi/4) q[1];',
      'rz(pi/4) q[2];', 'ry(pi/2) q[2];', 'rz(pi/3) q[2];',
      'cx q[0],q[2];', 'cx q[1],q[0];', 'cx q[2],q[1];',
    ]),
  },
]
