import type { QuantumCircuit } from '../../types/circuit'

export function toQollabJs(circuit: QuantumCircuit): string {
  const operations = circuit.gates.map((gate) => {
    if (gate.name === 'measure') return `qc.measure(${gate.qubits[0]}, ${gate.classicalBit ?? gate.qubits[0]});`
    const args = gate.parameter ? `${gate.parameter}, ${gate.qubits.join(', ')}` : gate.qubits.join(', ')
    return `qc.${gate.name}(${args});`
  }).join('\n')
  return `import { QuantumCircuit } from 'qiskit';\n\nconst circuit = QuantumCircuit(${circuit.qubits}, ${circuit.classicalBits || circuit.qubits});\n${operations.replaceAll('qc.', 'circuit.')}\n\nconst job = await backend.run(circuit, { shots: 1000 });\nconst counts = (await job.result()).get_counts().toJs();\nconsole.log(counts);`
}
