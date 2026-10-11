import { useId, useState } from 'react'
import { circuitLibraryPresets } from '../data/circuitLibraryPresets'
import { circuitPresets, type CircuitPreset } from '../data/examples'

const libraryPresets: CircuitPreset[] = circuitLibraryPresets.map((preset) => ({
  name: preset.label,
  group: preset.group,
  description: preset.detail,
  source: preset.qasm,
}))

const presets = [...circuitPresets, ...libraryPresets]
const groups = [...new Set(presets.map((preset) => preset.group))]

export function CircuitPresets({ onLoad }: { onLoad: (preset: CircuitPreset) => void }) {
  const id = useId()
  const [selected, setSelected] = useState('')
  const preset = presets.find((item) => item.name === selected)
  return (
    <div className="preset-toolbar">
      <label htmlFor={id}>Presets
        <select id={id} value={selected} aria-describedby={`${id}-help`} onChange={(event) => setSelected(event.target.value)}>
          <option value="">Select a preset…</option>
          {groups.map((group) => <optgroup label={group} key={group}>
            {presets.filter((item) => item.group === group).map((item) => <option value={item.name} key={item.name}>{item.name}</option>)}
          </optgroup>)}
        </select>
      </label>
      <button type="button" disabled={!preset} onClick={() => { if (preset) onLoad(preset) }}>Load preset</button>
      <p id={`${id}-help`}>{preset?.description ?? 'Circuits, Qiskit ansatz, PennyLane templates and the circuit library. Loading replaces the current circuit.'}</p>
    </div>
  )
}
