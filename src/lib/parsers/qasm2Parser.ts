import type { CircuitGate, GateName, QuantumCircuit } from '../../types/circuit'

const supported = new Set<GateName>(['h', 'x', 'y', 'z', 's', 't', 'rx', 'rz', 'cx', 'cz', 'swap', 'measure'])
const singleQubitGates = new Set<GateName>(['h', 'x', 'y', 'z', 's', 't', 'rx', 'rz', 'measure'])
const anglePattern = /^[+-]?(?:pi|tau|\d+(?:\.\d*)?|\.\d+)(?:\s*(?:[*/]\s*(?:pi|tau|\d+(?:\.\d*)?|\.\d+)|[+-]\s*(?:pi|tau|\d+(?:\.\d*)?|\.\d+)))*$/i

export function parseQasm(source: string): { circuit?: QuantumCircuit; error?: string } {
  const statements = source
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
  let qubits = 0
  let classicalBits = 0
  let qregName = 'q'
  let cregName = 'c'
  const gates: CircuitGate[] = []

  for (const statement of statements) {
    if (/^OPENQASM\s+2(?:\.0)?$/i.test(statement) || /^include\s+["']qelib1\.inc["']$/i.test(statement)) continue
    const register = statement.match(/^(qreg|creg)\s+([a-z_]\w*)\[(\d+)]$/i)
    if (register) {
      const size = Number(register[3])
      if (size < 1) return { error: 'Registers must contain at least one bit.' }
      if (register[1].toLowerCase() === 'qreg') {
        if (qubits) return { error: 'Only one quantum register is supported.' }
        qregName = register[2]
        qubits = size
      } else {
        if (classicalBits) return { error: 'Only one classical register is supported.' }
        cregName = register[2]
        classicalBits = size
      }
      continue
    }
    if (!qubits) return { error: 'Declare a qreg before adding gates.' }

    const measurement = statement.match(/^measure\s+([a-z_]\w*)\[(\d+)]\s*->\s*([a-z_]\w*)\[(\d+)]$/i)
    if (measurement) {
      const qubit = Number(measurement[2])
      const classicalBit = Number(measurement[4])
      if (measurement[1] !== qregName || qubit >= qubits) return { error: `Invalid qubit reference in “${statement}”` }
      if (!classicalBits || measurement[3] !== cregName || classicalBit >= classicalBits) {
        return { error: `Invalid classical bit reference in “${statement}”` }
      }
      gates.push({ id: `g${gates.length}`, name: 'measure', qubits: [qubit], classicalBit })
      continue
    }

    const match = statement.match(/^([a-z]+)(?:\(([^()]*)\))?\s+(.+)$/i)
    if (!match) return { error: `Cannot parse “${statement}”` }
    const name = match[1].toLowerCase() as GateName
    if (!supported.has(name) || name === 'measure') return { error: `Unsupported gate “${match[1]}”` }
    const parameter = match[2]?.trim()
    if ((name === 'rx' || name === 'rz') && (!parameter || !anglePattern.test(parameter))) {
      return { error: `Invalid angle in “${statement}”` }
    }
    if (name !== 'rx' && name !== 'rz' && parameter) return { error: `Gate “${name}” does not take a parameter.` }

    const qubitRefs = [...match[3].matchAll(/([a-z_]\w*)\[(\d+)]/gi)]
    const expectedQubits = singleQubitGates.has(name) ? 1 : 2
    if (qubitRefs.length !== expectedQubits || qubitRefs.some((ref) => ref[1] !== qregName || Number(ref[2]) >= qubits)) {
      return { error: `Invalid qubit reference in “${statement}”` }
    }
    if (expectedQubits === 2 && qubitRefs[0][2] === qubitRefs[1][2]) {
      return { error: 'Two-qubit gates require distinct qubits.' }
    }
    gates.push({
      id: `g${gates.length}`,
      name,
      qubits: qubitRefs.map((ref) => Number(ref[2])),
      parameter,
    })
  }
  return qubits ? { circuit: { qubits, classicalBits, gates } } : { error: 'Add a qreg declaration.' }
}
