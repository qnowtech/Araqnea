import type { GateName } from '../types/circuit'
import type { SpiderKind } from '../types/zx'

export interface GateInfo {
  title: string
  description: string
  zx: string
}

export const gateInfo: Record<GateName, GateInfo> = {
  h: { title: 'Hadamard (H)', description: 'Creates an equal superposition: |0⟩ → |+⟩ and |1⟩ → |−⟩. Swaps the Z and X bases.', zx: 'Yellow Hadamard box on the wire.' },
  x: { title: 'Pauli-X (NOT)', description: 'Bit flip: |0⟩ ↔ |1⟩. A rotation of π around the X axis.', zx: 'Red X spider with phase π.' },
  y: { title: 'Pauli-Y', description: 'Bit and phase flip: rotation of π around the Y axis (Y = iXZ).', zx: 'Red X(π) followed by green Z(π) spider.' },
  z: { title: 'Pauli-Z', description: 'Phase flip: leaves |0⟩ unchanged and maps |1⟩ → −|1⟩.', zx: 'Green Z spider with phase π.' },
  s: { title: 'S (phase π/2)', description: 'Quarter turn around Z: |1⟩ → i|1⟩. Two S gates make a Z.', zx: 'Green Z spider with phase π/2.' },
  t: { title: 'T (phase π/4)', description: 'Eighth turn around Z: |1⟩ → e^{iπ/4}|1⟩. Key non-Clifford gate.', zx: 'Green Z spider with phase π/4.' },
  rx: { title: 'Rx(θ) rotation', description: 'Rotates the qubit by angle θ around the X axis of the Bloch sphere.', zx: 'Red X spider with phase θ.' },
  rz: { title: 'Rz(θ) rotation', description: 'Rotates the qubit by angle θ around the Z axis of the Bloch sphere.', zx: 'Green Z spider with phase θ.' },
  cx: { title: 'CNOT (controlled-X)', description: 'Flips the target qubit when the control qubit is |1⟩. Creates entanglement.', zx: 'Green Z spider (control) wired to a red X spider (target).' },
  cz: { title: 'CZ (controlled-Z)', description: 'Applies a phase flip when both qubits are |1⟩. Symmetric in its qubits.', zx: 'Two green Z spiders joined by a Hadamard edge.' },
  swap: { title: 'SWAP', description: 'Exchanges the states of two qubits.', zx: 'Two crossing wires (drawn as linked X spiders).' },
  measure: { title: 'Measure', description: 'Measures the qubit in the computational basis and stores the result in a classical bit.', zx: 'Wire terminated by a measurement boundary.' },
}

export const gateTip = (name: GateName) => `${gateInfo[name].title}\n${gateInfo[name].description}\nZX: ${gateInfo[name].zx}`

export const spiderKindInfo: Record<SpiderKind, string> = {
  z: 'Z spider (green): copies the Z basis; its phase rotates around Z.',
  x: 'X spider (red): copies the X basis; its phase rotates around X.',
  hadamard: 'Hadamard box: changes colour between Z and X spiders.',
  boundary: 'Boundary: an input, output, measurement or open port of the diagram.',
}
