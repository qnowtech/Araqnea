import type { CSSProperties } from 'react'
import { gateInfo, gateTip } from '../../data/gateInfo'
import type { CircuitGate, GateName, QuantumCircuit } from '../../types/circuit'

const palette: { name: GateName; label: string }[] = [
  { name: 'h', label: 'H' }, { name: 'x', label: 'X' }, { name: 'y', label: 'Y' },
  { name: 'z', label: 'Z' }, { name: 's', label: 'S' }, { name: 't', label: 'T' },
  { name: 'rx', label: 'Rx(π/2)' }, { name: 'rz', label: 'Rz(π/2)' },
  { name: 'cx', label: 'CNOT' }, { name: 'cz', label: 'CZ' }, { name: 'swap', label: 'SWAP' },
  { name: 'measure', label: 'Measure' },
]

const columnWidth = 72
const columnOffset = 28
const rowHeight = 64

interface GateCircuitViewProps {
  circuit: QuantumCircuit
  onAdd: (gate: GateName, wire: number) => void
  onRemove: (gateId: string) => void
}

export function GateCircuitView({ circuit, onAdd, onRemove }: GateCircuitViewProps) {
  const trackWidth = Math.max(600, circuit.gates.length * columnWidth + columnOffset * 2)
  return (
    <section className="mode-content gate-view">
      <div className="view-title"><div><span className="eyebrow">MODE 02 · GATES</span><h2>Gate circuit</h2></div><span>{circuit.qubits} qubits · {circuit.gates.length} gates</span></div>
      <div className="gate-palette" aria-label="Gate palette">
        {palette.map((gate) => <button
          draggable
          key={gate.name}
          type="button"
          data-tip={`${gateTip(gate.name)}\nClick to add on q[0] or drag onto a qubit wire.`}
          aria-label={`Add ${gateInfo[gate.name].title}`}
          onDragStart={(event) => event.dataTransfer.setData('text/plain', gate.name)}
          onClick={() => onAdd(gate.name, 0)}
        >{gate.label}</button>)}
      </div>
      <div className="circuit-grid" style={{ '--wire-count': circuit.qubits, '--track-width': `${trackWidth}px` } as CSSProperties}>
        {Array.from({ length: circuit.qubits }, (_, wire) => (
          <div className="circuit-row" key={wire} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
            event.preventDefault()
            const gate = event.dataTransfer.getData('text/plain') as GateName
            if (palette.some((item) => item.name === gate)) onAdd(gate, wire)
          }}>
            <span className="wire-label">q[{wire}]</span>
            <div className="wire-track">
              {circuit.gates.map((gate, column) => gate.qubits.includes(wire) && (
                <GateBlock key={gate.id} gate={gate} wire={wire} column={column} onRemove={onRemove} />
              ))}
            </div>
          </div>
        ))}
        {circuit.classicalBits > 0 && <div className="circuit-row classical-row"><span className="wire-label">c</span><div className="wire-track" /></div>}
      </div>
      <p className="editor-hint">Click a palette gate to add it, or drag it onto a qubit wire. Hover a gate to learn what it does, then use its × to remove it.</p>
    </section>
  )
}

function GateBlock({ gate, wire, column, onRemove }: { gate: CircuitGate; wire: number; column: number; onRemove: (id: string) => void }) {
  const multi = gate.qubits.length > 1
  const isControl = multi && gate.qubits[0] === wire
  const symbol = gate.name === 'cx' ? (isControl ? '●' : '⊕')
    : gate.name === 'cz' ? '●'
      : gate.name === 'swap' ? '×'
        : ({ h: 'H', x: 'X', y: 'Y', z: 'Z', s: 'S', t: 'T', rx: 'Rx', rz: 'Rz', measure: 'M' } as Record<string, string>)[gate.name]
  const top = Math.min(...gate.qubits)
  const span = Math.max(...gate.qubits) - top
  const role = multi ? (gate.name === 'cx' ? (isControl ? ' · control' : ' · target') : '') : ''
  return (
    <div
      className={`gate-block gate-${gate.name}${multi ? ' multi' : ''}${gate.name === 'cx' && !isControl ? ' target' : ''}`}
      style={{ left: `${column * columnWidth + columnOffset}px` }}
      data-tip={`${gateTip(gate.name)}\nOn ${gate.qubits.map((item) => `q[${item}]`).join(', ')}${role}${gate.parameter ? ` · θ = ${gate.parameter}` : ''}${gate.name === 'measure' ? ` → c[${gate.classicalBit ?? wire}]` : ''}`}
      tabIndex={0}
    >
      {multi && wire === top && span > 0 && <span className="gate-connector" style={{ height: `${span * rowHeight - 28}px` }} aria-hidden="true" />}
      {symbol}
      {gate.parameter && <small>{gate.parameter}</small>}
      <button type="button" aria-label={`Remove ${gate.name} gate`} onClick={() => onRemove(gate.id)}>×</button>
    </div>
  )
}
