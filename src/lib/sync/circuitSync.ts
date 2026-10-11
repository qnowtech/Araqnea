import type { CircuitGate, GateName, QuantumCircuit } from '../../types/circuit'
import type { ZXGraph3D, ZXNode } from '../../types/zx'
import { toQasm } from '../exporters/circuitExporters'
import { parseQasm } from '../parsers/qasm2Parser'
import { gateFromSpider } from '../zx-core/semantics'
import { columnSpacing, translateCircuit, wireSpacing, wireY } from '../zx-core/translator'

export interface SyncCheck {
  label: string
  ok: boolean
  detail: string
}

export interface SyncReport {
  ok: boolean
  checks: SyncCheck[]
  diagramOnly: number
}

const sameGate = (a: CircuitGate, b: CircuitGate) => a.name === b.name
  && a.qubits.join(',') === b.qubits.join(',')
  && (a.parameter ?? '') === (b.parameter ?? '')
  && (a.name !== 'measure' || (a.classicalBit ?? a.qubits[0]) === (b.classicalBit ?? b.qubits[0]))

/** Verifies that the OpenQASM specification, the circuit model shown in the gate view and the spider graph agree. */
export function validateSync(circuit: QuantumCircuit, graph: ZXGraph3D): SyncReport {
  const checks: SyncCheck[] = []
  const roundTrip = parseQasm(toQasm(circuit)).circuit
  const codeOk = Boolean(roundTrip) && roundTrip!.qubits === circuit.qubits && roundTrip!.gates.length === circuit.gates.length
    && roundTrip!.gates.every((gate, index) => sameGate(gate, circuit.gates[index]))
  checks.push({ label: 'Code ⇄ gates', ok: codeOk, detail: codeOk ? `${circuit.gates.length} gates on ${circuit.qubits} qubits round-trip through OpenQASM` : 'The gate circuit does not round-trip through OpenQASM' })

  const expected = translateCircuit(circuit)
  const actual = new Map(graph.nodes.map((node) => [node.id, node]))
  const missing = expected.nodes.filter((node) => {
    const found = actual.get(node.id)
    return !found || found.kind !== node.kind || found.phase !== node.phase || found.wire !== node.wire
  })
  const actualEdges = new Set(graph.edges.map((edge) => `${edge.source}→${edge.target}`))
  const missingEdges = expected.edges.filter((edge) => !actualEdges.has(`${edge.source}→${edge.target}`))
  const extraCircuitNodes = graph.nodes.filter((node) => !node.custom && !expected.nodes.some((item) => item.id === node.id))
  const unrepresented = circuit.gates.filter((gate) => !graph.nodes.some((node) => node.gateId === gate.id))
  const spidersOk = !missing.length && !missingEdges.length && !extraCircuitNodes.length && !unrepresented.length
  checks.push({
    label: 'Gates ⇄ spiders',
    ok: spidersOk,
    detail: spidersOk
      ? `Every gate has its ZX spiders (${expected.nodes.length} nodes, ${expected.edges.length} wires)`
      : `${missing.length + extraCircuitNodes.length} spider(s) and ${missingEdges.length} wire(s) out of sync`,
  })

  const ids = new Set(graph.nodes.map((node) => node.id))
  const dangling = graph.edges.filter((edge) => !ids.has(edge.source) || !ids.has(edge.target))
  checks.push({ label: 'Graph integrity', ok: !dangling.length, detail: dangling.length ? `${dangling.length} wire(s) reference missing nodes` : 'All wires connect existing nodes' })

  return { ok: checks.every((check) => check.ok), checks, diagramOnly: graph.nodes.filter((node) => node.custom).length }
}

const insertableSymbols = new Set(['z-spider', 'x-spider', 'z-phase', 'x-phase', 'hadamard'])

export const canInsertIntoCircuit = (node: ZXNode) => Boolean(node.custom && node.symbol && insertableSymbols.has(node.symbol))

/** Maps a single palette generator to the equivalent circuit gate. */
export function gateForSpider(node: ZXNode): { name: GateName; parameter?: string } | undefined {
  if (!canInsertIntoCircuit(node)) return undefined
  return gateFromSpider(node.kind, node.phase)
}

/** Finds the qubit wire under a graph position, if the position lies on a wire's band. */
export function wireAt(circuit: QuantumCircuit, y: number): number | undefined {
  for (let wire = 0; wire < circuit.qubits; wire += 1) {
    if (Math.abs(wireY(wire, circuit.qubits) - y) <= wireSpacing * 0.3) return wire
  }
}

export const nearestWire = (circuit: QuantumCircuit, y: number) =>
  Math.min(circuit.qubits - 1, Math.max(0, Math.round(y / wireSpacing + (circuit.qubits - 1) / 2)))

export const insertIndexAt = (circuit: QuantumCircuit, x: number) =>
  Math.min(circuit.gates.length, Math.max(0, Math.ceil(x / columnSpacing)))

/** Inserts the gate equivalent of a spider into the circuit at the given wire and horizontal position. */
export function insertSpiderGate(circuit: QuantumCircuit, node: ZXNode, wire: number, x: number): { circuit?: QuantumCircuit; error?: string; gate?: CircuitGate } {
  const mapped = gateForSpider(node)
  if (!mapped) return { error: 'Only single spiders and Hadamard boxes can become circuit gates.' }
  const gate: CircuitGate = { id: `new-${Date.now()}`, name: mapped.name, qubits: [wire], ...(mapped.parameter ? { parameter: mapped.parameter } : {}) }
  const gates = [...circuit.gates]
  gates.splice(insertIndexAt(circuit, x), 0, gate)
  const next = { ...circuit, gates }
  const parsed = parseQasm(toQasm(next))
  if (!parsed.circuit) return { error: parsed.error ?? 'Invalid phase for a circuit gate.' }
  return { circuit: next, gate }
}
