import type { CSSProperties } from 'react'
import type { CircuitGate, GateName, QuantumCircuit } from '../../types/circuit'

const palette: { name: GateName; label: string }[] = [
  { name: 'h', label: 'H' }, { name: 'x', label: 'X' }, { name: 'y', label: 'Y' },
  { name: 'z', label: 'Z' }, { name: 's', label: 'S' }, { name: 't', label: 'T' },
  { name: 'rx', label: 'Rx(π/2)' }, { name: 'rz', label: 'Rz(π/2)' },
  { name: 'cx', label: 'CNOT' }, { name: 'cz', label: 'CZ' }, { name: 'swap', label: 'SWAP' },
  { name: 'measure', label: 'Measure' },
]

interface GateCircuitViewProps {
  circuit: QuantumCircuit
  onAdd: (gate: GateName, wire: number) => void
  onRemove: (gateId: string) => void
}

export function GateCircuitView({ circuit, onAdd, onRemove }: GateCircuitViewProps) {
  return (
    <section className="mode-content gate-view">
      <div className="view-title"><div><span className="eyebrow">MODE 02 · GATES</span><h2>Gate circuit</h2></div><span>{circuit.qubits} qubits · {circuit.gates.length} gates</span></div>
      <div className="gate-palette" aria-label="Gate palette">
        {palette.map((gate) => <button
          draggable
          key={gate.name}
          type="button"
          onDragStart={(event) => event.dataTransfer.setData('text/plain', gate.name)}
          onClick={() => onAdd(gate.name, 0)}
        >{gate.label}</button>)}
      </div>
      <div className="circuit-grid" style={{ '--wire-count': circuit.qubits } as CSSProperties}>
        {Array.from({ length: circuit.qubits }, (_, wire) => (
          <div className="circuit-row" key={wire} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
            event.preventDefault()
            const gate = event.dataTransfer.getData('text/plain') as GateName
            if (palette.some((item) => item.name === gate)) onAdd(gate, wire)
          }}>
            <span className="wire-label">q[{wire}]</span>
            <div className="wire-track">
              {circuit.gates.map((gate, column) => gate.qubits.includes(wire) && (
                <GateBlock key={gate.id} gate={gate} column={column} onRemove={onRemove} />
              ))}
            </div>
          </div>
        ))}
        {circuit.classicalBits > 0 && <div className="circuit-row classical-row"><span className="wire-label">c</span><div className="wire-track" /></div>}
      </div>
      <p className="editor-hint">Click a palette gate to add it, or drag it onto a qubit wire. Select a gate’s × to remove it.</p>
    </section>
  )
}

function GateBlock({ gate, column, onRemove }: { gate: CircuitGate; column: number; onRemove: (id: string) => void }) {
  const labels: Record<GateName, string> = {
    h: 'H', x: 'X', y: 'Y', z: 'Z', s: 'S', t: 'T', rx: 'Rx', rz: 'Rz',
    cx: '●', cz: '●', swap: '×', measure: 'M',
  }
  return (
    <div className={`gate-block gate-${gate.name}`} style={{ left: `${column * 72 + 20}px` }} title={`${gate.name.toUpperCase()} ${gate.qubits.map((wire) => `q[${wire}]`).join(', ')}`}>
      {gate.name === 'cx' && gate.qubits.length > 1 && <span className="gate-target">⊕</span>}
      {gate.name === 'cz' && gate.qubits.length > 1 && <span className="gate-target">●</span>}
      {labels[gate.name]}
      {gate.parameter && <small>{gate.parameter}</small>}
      <button type="button" aria-label={`Remove ${gate.name} gate`} onClick={() => onRemove(gate.id)}>×</button>
    </div>
  )
}
