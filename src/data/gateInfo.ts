import type { GateName } from '../types/circuit'
import { gateZxText, spiderKindText } from '../lib/zx-core/semantics'
import type { SpiderKind } from '../types/zx'

export interface GateInfo {
  title: string
  description: string
  zx: string
}

export const gateInfo: Record<GateName, GateInfo> = {
  h: { title: 'Hadamard (H)', description: 'Creates an equal superposition: |0⟩ → (|0⟩+|1⟩)/√2 and |1⟩ → (|0⟩−|1⟩)/√2. Swaps the Z and X bases.', zx: gateZxText('h') },
  x: { title: 'Pauli-X (NOT)', description: 'Bit flip: |0⟩ ↔ |1⟩. A rotation of π around the X axis.', zx: gateZxText('x') },
  y: { title: 'Pauli-Y', description: 'Bit and phase flip: rotation of π around the Y axis. The diagram is X(π) then Z(π), with the scalar of ZX = iY.', zx: gateZxText('y') },
  z: { title: 'Pauli-Z', description: 'Phase flip: leaves |0⟩ unchanged and maps |1⟩ → −|1⟩.', zx: gateZxText('z') },
  s: { title: 'S (phase π/2)', description: 'Quarter turn around Z: |1⟩ → i|1⟩. Two S gates make a Z.', zx: gateZxText('s') },
  t: { title: 'T (phase π/4)', description: 'Eighth turn around Z: |1⟩ → e^{iπ/4}|1⟩. Key non-Clifford gate.', zx: gateZxText('t') },
  rx: { title: 'Rx(θ) rotation', description: 'X spider of phase θ: the phase gate in the Hadamard basis.', zx: gateZxText('rx') },
  ry: { title: 'Ry(θ) rotation', description: 'Rotates the qubit by angle θ around the Y axis. Pauli-Y has a fixed angle of π; use Ry to change it.', zx: gateZxText('ry') },
  rz: { title: 'Rz(θ) rotation', description: 'Z spider of phase θ: |1⟩ picks up e^{iθ}. The same spider as S when θ is π/2.', zx: gateZxText('rz') },
  p: { title: 'Ph(θ) phase shift', description: 'Leaves |0⟩ unchanged and multiplies |1⟩ by exp(iθ). Exported as u1 in OpenQASM 2 and p in Qiskit.', zx: gateZxText('p') },
  cx: { title: 'CNOT (controlled-X)', description: 'Flips the target qubit when the control qubit is |1⟩. Creates entanglement.', zx: gateZxText('cx') },
  cz: { title: 'CZ (controlled-Z)', description: 'Applies a phase flip when both qubits are |1⟩. Symmetric in its qubits.', zx: gateZxText('cz') },
  swap: { title: 'SWAP', description: 'Exchanges the states of two qubits.', zx: gateZxText('swap') },
  measure: { title: 'Measure', description: 'Measures the qubit in the computational basis and stores the result in a classical bit.', zx: gateZxText('measure') },
}

export const gateTip = (name: GateName) => `${gateInfo[name].title}\n${gateInfo[name].description}\nZX: ${gateInfo[name].zx}`

export const spiderKindInfo: Record<SpiderKind, string> = {
  z: spiderKindText('z'),
  x: spiderKindText('x'),
  hadamard: spiderKindText('hadamard'),
  boundary: spiderKindText('boundary'),
}
