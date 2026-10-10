import type { CircuitGate, GateName, QuantumCircuit } from '../../types/circuit'

const supported = new Set<GateName>(['h', 'x', 'y', 'z', 's', 't', 'rx', 'rz', 'cx', 'cz', 'swap', 'measure'])

export function parseQasm(source: string): { circuit?: QuantumCircuit; error?: string } {
  const statements = source.replace(/\/\/.*$/gm, '').split(';').map((item) => item.trim()).filter(Boolean)
  let qubits = 0
  let classicalBits = 0
  const gates: CircuitGate[] = []

  for (const statement of statements) {
    if (/^(OPENQASM|include)\b/i.test(statement)) continue
    const register = statement.match(/^(qreg|creg)\s+\w+\[(\d+)]$/i)
    if (register) {
      if (register[1].toLowerCase() === 'qreg') qubits = Number(register[2])
      else classicalBits = Number(register[2])
      continue
    }
    const match = statement.match(/^([a-z]+)(?:\(([^)]+)\))?\s+(.+)$/i)
    if (!match) return { error: `Cannot parse “${statement}”` }
    const name = match[1].toLowerCase() as GateName
    if (!supported.has(name)) return { error: `Unsupported gate “${match[1]}”` }
    const indices = [...match[3].matchAll(/\[(\d+)]/g)].map((item) => Number(item[1]))
    if (indices.length === 0 || indices.some((index) => index >= qubits)) {
      return { error: `Invalid qubit reference in “${statement}”` }
    }
    gates.push({ id: `g${gates.length}`, name, qubits: indices, parameter: match[2] })
  }
  return qubits ? { circuit: { qubits, classicalBits, gates } } : { error: 'Add a qreg declaration.' }
}
