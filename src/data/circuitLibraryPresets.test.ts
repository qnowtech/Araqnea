import { describe, expect, it } from 'vitest'
import { parseQasm } from '../lib/parsers/qasm2Parser'
import { circuitLibraryPresets } from './circuitLibraryPresets'

describe('circuit library presets', () => {
  it('parses every preset into a circuit', () => {
    for (const preset of circuitLibraryPresets) {
      const parsed = parseQasm(preset.qasm)
      expect(parsed.error, preset.id).toBeUndefined()
      expect(parsed.circuit?.gates.length, preset.id).toBeGreaterThan(0)
    }
  })
})
