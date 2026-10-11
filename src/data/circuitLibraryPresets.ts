/** Pre-built circuits from the Qiskit circuit library, written in the OpenQASM this workbench parses. */

export interface CircuitPreset {
  id: string
  group: string
  label: string
  detail: string
  qasm: string
}

const circuit = (qubits: number, gates: string[], classical = 0) => {
  const lines = ['OPENQASM 2.0;', 'include "qelib1.inc";', `qreg q[${qubits}];`]
  if (classical) lines.push(`creg c[${classical}];`)
  return `${lines.join('\n')}\n${gates.join('\n')}\n`
}

const ry = (qubit: number, angle: string) => [`rz(pi/2) q[${qubit}];`, `rx(${angle}) q[${qubit}];`, `rz(-pi/2) q[${qubit}];`]

/** CCX with controls `a`, `b` and target `t`, in H, T, T† and CX. */
const toffoli = (a: number, b: number, t: number) => [
  `h q[${t}];`,
  `cx q[${b}],q[${t}];`,
  `rz(-pi/4) q[${t}];`,
  `cx q[${a}],q[${t}];`,
  `t q[${t}];`,
  `cx q[${b}],q[${t}];`,
  `rz(-pi/4) q[${t}];`,
  `cx q[${a}],q[${t}];`,
  `t q[${b}];`,
  `t q[${t}];`,
  `h q[${t}];`,
  `cx q[${a}],q[${b}];`,
  `t q[${a}];`,
  `rz(-pi/4) q[${b}];`,
  `cx q[${a}],q[${b}];`,
]

/** Controlled RZ(θ): the phase gate used by QFT and MCPhase. */
const crz = (control: number, target: number, half: string, minusHalf: string) => [
  `rz(${half}) q[${control}];`,
  `cx q[${control}],q[${target}];`,
  `rz(${minusHalf}) q[${target}];`,
  `cx q[${control}],q[${target}];`,
  `rz(${half}) q[${target}];`,
]

const zz = (angle: string) => [`cx q[0],q[1];`, `rz(${angle}) q[1];`, `cx q[0],q[1];`]

const preset = (id: string, group: string, label: string, detail: string, qasm: string): CircuitPreset => ({ id, group, label, detail, qasm })

export const circuitLibraryPresets: CircuitPreset[] = [
  preset('h', 'Standard gates', 'H', 'Hadamard gate.', circuit(1, ['h q[0];'])),
  preset('x', 'Standard gates', 'X', 'Pauli X gate.', circuit(1, ['x q[0];'])),
  preset('y', 'Standard gates', 'Y', 'Pauli Y gate.', circuit(1, ['y q[0];'])),
  preset('z', 'Standard gates', 'Z', 'Pauli Z gate.', circuit(1, ['z q[0];'])),
  preset('s', 'Standard gates', 'S', 'Phase gate S.', circuit(1, ['s q[0];'])),
  preset('t', 'Standard gates', 'T', 'Phase gate T.', circuit(1, ['t q[0];'])),
  preset('rx', 'Standard gates', 'RX(π/2)', 'RX rotation. SX is the same angle.', circuit(1, ['rx(pi/2) q[0];'])),
  preset('rz', 'Standard gates', 'RZ(π/2)', 'RZ rotation. Phase and U1 use this gate.', circuit(1, ['rz(pi/2) q[0];'])),
  preset('cx', 'Standard gates', 'CX', 'Controlled X.', circuit(2, ['cx q[0],q[1];'])),
  preset('cz', 'Standard gates', 'CZ', 'Controlled Z.', circuit(2, ['cz q[0],q[1];'])),
  preset('swap', 'Standard gates', 'SWAP', 'Swap of two qubits.', circuit(2, ['swap q[0],q[1];'])),
  preset('measure', 'Operations', 'Measure', 'Hadamard, then a measurement. Reset and Pauli-product measurement are not in this OpenQASM.', circuit(1, ['h q[0];', 'measure q[0] -> c[0];'], 1)),

  preset('mcx', 'Generalized gates', 'MCX · Toffoli', 'Two-control X, the Toffoli, in H, T and CX.', circuit(3, toffoli(0, 1, 2))),
  preset('mcphase', 'Generalized gates', 'MCPhase(π/2)', 'Controlled phase of π/2.', circuit(2, crz(0, 1, 'pi/4', '-pi/4'))),
  preset('permutation', 'Generalized gates', 'Permutation', 'Cycle of three wires.', circuit(3, ['swap q[0],q[1];', 'swap q[1],q[2];'])),
  preset('diagonal', 'Generalized gates', 'Diagonal', 'Diagonal phase on |11⟩, the CZ gate.', circuit(2, ['cz q[0],q[1];'])),
  preset('pauli-evolution', 'Generalized gates', 'Pauli evolution', 'Evolution under ZZ for time π/4.', circuit(2, zz('pi/2'))),
  preset('hamiltonian', 'Generalized gates', 'Hamiltonian gate', 'The same ZZ evolution, as a Hamiltonian gate.', circuit(2, zz('pi/2'))),

  preset('and', 'Boolean logic', 'AND', 'Bit-flip AND into a third qubit.', circuit(3, toffoli(0, 1, 2))),
  preset('or', 'Boolean logic', 'OR', 'Bit-flip OR, from NOT (NOT a AND NOT b).', circuit(3, ['x q[0];', 'x q[1];', ...toffoli(0, 1, 2), 'x q[0];', 'x q[1];', 'x q[2];'])),
  preset('xor', 'Boolean logic', 'XOR', 'Bitwise XOR, the CX gate.', circuit(2, ['cx q[0],q[1];'])),
  preset('inner-product', 'Boolean logic', 'Inner product', 'Phase of the inner product, the CZ gate.', circuit(2, ['cz q[0],q[1];'])),
  preset('bitwise-xor', 'Boolean logic', 'Bitwise XOR gate', 'A fixed two-bit XOR.', circuit(2, ['cx q[0],q[1];'])),

  preset('qft', 'Basis change', 'QFT', 'Quantum Fourier transform on two qubits.', circuit(2, ['h q[1];', ...crz(0, 1, 'pi/4', '-pi/4'), 'h q[0];', 'swap q[0],q[1];'])),
  preset('iqft', 'Basis change', 'Inverse QFT', 'Inverse of that two-qubit QFT.', circuit(2, ['swap q[0],q[1];', 'h q[0];', 'rz(-pi/4) q[1];', 'cx q[0],q[1];', 'rz(pi/4) q[1];', 'cx q[0],q[1];', 'rz(-pi/4) q[0];', 'h q[1];'])),

  preset('half-adder', 'Arithmetic', 'Half adder', 'One-bit sum on q[1] and carry on q[2].', circuit(3, [...toffoli(0, 1, 2), 'cx q[0],q[1];'])),
  preset('full-adder', 'Arithmetic', 'Full adder', 'One bit, with carry in on q[2], sum on q[3] and carry out on q[4].', circuit(5, ['cx q[0],q[3];', 'cx q[1],q[3];', 'cx q[2],q[3];', ...toffoli(0, 1, 4), ...toffoli(0, 2, 4), ...toffoli(1, 2, 4)])),
  preset('modular-adder', 'Arithmetic', 'Modular adder', 'One-bit sum modulo 2.', circuit(2, ['cx q[0],q[1];'])),
  preset('multiplier', 'Arithmetic', 'Multiplier', 'One-bit product, the AND.', circuit(3, toffoli(0, 1, 2))),
  preset('comparator', 'Arithmetic', 'Integer comparator', 'One-bit compare: the flag flips when q[0] is 1.', circuit(2, ['cx q[0],q[1];'])),
  preset('linear-amplitude', 'Arithmetic', 'Linear amplitude', 'Equal superposition, the one-qubit amplitude function.', circuit(1, ['h q[0];'])),
  preset('functional-pauli', 'Arithmetic', 'Functional Pauli rotation', 'A Pauli rotation whose angle is the function value π/2.', circuit(1, ['rz(pi/2) q[0];'])),

  preset('bell', 'Particular circuits', 'Graph state · Bell', 'One edge: the Bell state, then both measurements.', circuit(2, ['h q[0];', 'cx q[0],q[1];', 'measure q[0] -> c[0];', 'measure q[1] -> c[1];'], 2)),
  preset('ghz', 'Particular circuits', 'GHZ', 'Three-qubit GHZ state, then measurements.', circuit(3, ['h q[0];', 'cx q[0],q[1];', 'cx q[1],q[2];', 'measure q[0] -> c[0];', 'measure q[1] -> c[1];', 'measure q[2] -> c[2];'], 3)),
  preset('fourier-checking', 'Particular circuits', 'Fourier checking', 'Two-qubit Fourier checking layer.', circuit(2, ['h q[0];', 'h q[1];', 'cz q[0],q[1];', 'h q[0];', 'h q[1];'])),
  preset('hidden-linear', 'Particular circuits', 'Hidden linear function', 'Two-qubit hidden linear function.', circuit(2, ['h q[0];', 'h q[1];', 's q[0];', 'cz q[0],q[1];', 'h q[0];', 'h q[1];'])),
  preset('iqp', 'Particular circuits', 'IQP', 'Instantaneous quantum polynomial circuit.', circuit(2, ['h q[0];', 'h q[1];', 'cz q[0],q[1];', 's q[0];', 'h q[0];', 'h q[1];'])),
  preset('quantum-volume', 'Particular circuits', 'Quantum volume', 'One fixed two-qubit volume layer.', circuit(2, ['h q[0];', 'rz(pi/3) q[0];', 'rx(pi/5) q[0];', 'h q[1];', 'rz(pi/7) q[1];', 'cx q[0],q[1];', 'rz(pi/3) q[1];'])),
  preset('phase-estimation', 'Particular circuits', 'Phase estimation', 'One counting qubit for the phase of Z on |1⟩.', circuit(2, ['x q[1];', 'h q[0];', 'cz q[0],q[1];', 'h q[0];', 'measure q[0] -> c[0];'], 1)),
  preset('grover', 'Particular circuits', 'Grover operator', 'One Grover step marking |11⟩.', circuit(2, ['h q[0];', 'h q[1];', 'cz q[0],q[1];', 'h q[0];', 'h q[1];', 'z q[0];', 'z q[1];', 'cz q[0],q[1];', 'h q[0];', 'h q[1];'])),
  preset('unitary-overlap', 'Particular circuits', 'Unitary overlap', 'Overlap of H with H, which is the identity.', circuit(1, ['h q[0];', 'h q[0];'])),

  preset('real-amplitudes', 'N-local circuits', 'Real amplitudes', 'One layer of RY and CX.', circuit(2, [...ry(0, 'pi/2'), ...ry(1, 'pi/2'), 'cx q[0],q[1];'])),
  preset('efficient-su2', 'N-local circuits', 'Efficient SU2', 'RY, RZ and an entangling CX.', circuit(2, [...ry(0, 'pi/2'), ...ry(1, 'pi/2'), 'rz(pi/2) q[0];', 'rz(pi/2) q[1];', 'cx q[0],q[1];'])),
  preset('pauli-two-design', 'N-local circuits', 'Pauli two-design', 'A two-qubit Clifford design.', circuit(2, ['h q[0];', 'h q[1];', 'cz q[0],q[1];', 's q[0];', 's q[1];', 'h q[0];', 'h q[1];'])),
  preset('excitation-preserving', 'N-local circuits', 'Excitation preserving', 'An XX + YY layer of angle π/2.', circuit(2, ['h q[0];', 'h q[1];', ...zz('pi/2'), 'h q[0];', 'h q[1];', 'rx(pi/2) q[0];', 'rx(pi/2) q[1];', ...zz('pi/2'), 'rx(-pi/2) q[0];', 'rx(-pi/2) q[1];'])),
  preset('qaoa', 'N-local circuits', 'QAOA ansatz', 'One ZZ cost and one X mixer.', circuit(2, ['h q[0];', 'h q[1];', ...zz('pi/2'), 'rx(pi/2) q[0];', 'rx(pi/2) q[1];'])),
  preset('evolved-operator', 'N-local circuits', 'Evolved operator', 'One evolved ZZ operator.', circuit(2, zz('pi/2'))),

  preset('z-feature', 'Data encoding', 'Z feature map', 'Hadamard and a Z rotation.', circuit(2, ['h q[0];', 'h q[1];', 'rz(pi/2) q[0];', 'rz(pi/2) q[1];'])),
  preset('zz-feature', 'Data encoding', 'ZZ feature map', 'Z rotations and a ZZ interaction.', circuit(2, ['h q[0];', 'h q[1];', 'rz(pi/2) q[0];', 'rz(pi/2) q[1];', ...zz('pi/2')])),
  preset('pauli-feature', 'Data encoding', 'Pauli feature map', 'A Pauli expansion of Z and ZZ.', circuit(2, ['h q[0];', 'h q[1];', 'rz(pi/2) q[0];', 'rz(pi/2) q[1];', ...zz('pi/2')])),

  preset('initialize-plus', 'Data preparation', 'Initialize |+⟩', 'Preparation of the plus state.', circuit(1, ['h q[0];'])),
  preset('initialize-one', 'Data preparation', 'Initialize |1⟩', 'Preparation of the one state.', circuit(1, ['x q[0];'])),
  preset('state-preparation-bell', 'Data preparation', 'State preparation · Bell', 'Preparation of the Bell state.', circuit(2, ['h q[0];', 'cx q[0],q[1];'])),

  preset('phase-oracle', 'Oracles', 'Phase oracle', 'Phase flip on |11⟩.', circuit(2, ['cz q[0],q[1];'])),
  preset('bitflip-oracle', 'Oracles', 'Bit-flip oracle', 'Bit flip of AND onto the target.', circuit(3, toffoli(0, 1, 2))),

  preset('nct-2a-1', 'Template circuits', 'NCT 2a_1', 'Identity of two X gates.', circuit(1, ['x q[0];', 'x q[0];'])),
  preset('nct-2a-2', 'Template circuits', 'NCT 2a_2', 'Identity of two CX gates.', circuit(2, ['cx q[0],q[1];', 'cx q[0],q[1];'])),
  preset('nct-2a-3', 'Template circuits', 'NCT 2a_3', 'Identity of two Toffoli gates.', circuit(3, [...toffoli(0, 1, 2), ...toffoli(0, 1, 2)])),
  preset('clifford-hh', 'Template circuits', 'Clifford H H', 'Identity of two Hadamards.', circuit(1, ['h q[0];', 'h q[0];'])),
  preset('rzx-pair', 'Template circuits', 'RZX pair', 'An RZX rotation and its inverse.', circuit(2, [...zz('pi/2'), ...zz('-pi/2')])),
]
