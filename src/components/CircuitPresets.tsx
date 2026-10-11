import { useId, useState } from 'react'
import { circuitPresets, type CircuitPreset } from '../data/examples'

export function CircuitPresets({ onLoad }: { onLoad: (preset: CircuitPreset) => void }) {
  const id = useId()
  const [selected, setSelected] = useState('')
  const preset = circuitPresets.find((item) => item.name === selected)
  return (
    <div className="preset-toolbar">
      <label htmlFor={id}>Circuit / ansatz preset
        <select id={id} value={selected} aria-describedby={`${id}-help`} onChange={(event) => setSelected(event.target.value)}>
          <option value="">Select a preset…</option>
          {(['Circuits', 'Qiskit ansatz', 'PennyLane templates'] as const).map((group) => <optgroup label={group} key={group}>
            {circuitPresets.filter((item) => item.group === group).map((item) => <option value={item.name} key={item.name}>{item.name}</option>)}
          </optgroup>)}
        </select>
      </label>
      <button type="button" disabled={!preset} onClick={() => { if (preset) onLoad(preset) }}>Load preset</button>
      <p id={`${id}-help`}>{preset?.description ?? 'Choose a circuit, Qiskit ansatz or PennyLane template.'} Loading replaces the current circuit. Export to Qiskit or PennyLane from any view.</p>
    </div>
  )
}
