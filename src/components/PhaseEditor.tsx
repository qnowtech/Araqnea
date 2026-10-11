import { useId, useState } from 'react'
import { angleParameter, displayAngle, type AngleUnit } from '../lib/angles'

interface PhaseEditorProps {
  parameter: string
  target: string
  diagramOnly?: boolean
  onApply: (parameter: string) => string | undefined
}

export function PhaseEditor({ parameter, target, diagramOnly = false, onApply }: PhaseEditorProps) {
  const id = useId()
  const [unit, setUnit] = useState<AngleUnit>('degrees')
  const [draft, setDraft] = useState<{ parameter: string; value: string }>()
  const [error, setError] = useState('')
  const value = draft?.parameter === parameter ? draft.value : displayAngle(parameter, unit)
  return (
    <form className="phase-editor" onSubmit={(event) => {
      event.preventDefault()
      const parsed = angleParameter(value, unit)
      if (!parsed.parameter) {
        setError(parsed.error ?? 'Invalid angle.')
        return
      }
      const applyError = onApply(parsed.parameter)
      setError(applyError ?? '')
      if (!applyError) setDraft(undefined)
    }}>
      <label htmlFor={id}>Phase angle</label>
      <input id={id} value={value} aria-invalid={Boolean(error)} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} onChange={(event) => {
        setDraft({ parameter, value: event.target.value })
        setError('')
      }} />
      <select aria-label="Angle unit" value={unit} onChange={(event) => {
        const nextUnit = event.target.value === 'degrees' ? 'degrees' : 'radians'
        const parsed = angleParameter(value, unit)
        setDraft({ parameter, value: parsed.parameter ? displayAngle(parsed.parameter, nextUnit) : value })
        setUnit(nextUnit)
        setError('')
      }}>
        <option value="degrees">Degrees (°)</option>
        <option value="radians">Radians (rad)</option>
      </select>
      <button type="submit">Apply</button>
      <span className="phase-help" id={`${id}-help`}>{target}. Enter or Apply updates the {diagramOnly ? 'diagram' : 'circuit'}. 180° = pi rad.</span>
      {error && <span className="phase-error" id={`${id}-error`} role="alert">{error}</span>}
    </form>
  )
}
