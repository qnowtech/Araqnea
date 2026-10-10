export type GateName = 'h' | 'x' | 'y' | 'z' | 's' | 't' | 'rx' | 'rz' | 'cx' | 'cz' | 'swap' | 'measure'

export interface CircuitGate {
  id: string
  name: GateName
  qubits: number[]
  parameter?: string
  classicalBit?: number
}

export interface QuantumCircuit {
  qubits: number
  classicalBits: number
  gates: CircuitGate[]
}
