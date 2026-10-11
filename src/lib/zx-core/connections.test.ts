import { describe, expect, it } from 'vitest'
import type { ZXGraph3D, ZXNode } from '../../types/zx'
import { joinSites } from './connections'
import { buildPictureElement } from './pictureElements'

const at = { x: 0, y: 0, z: 0 }
const node = (partial: Pick<ZXNode, 'id' | 'kind'> & Partial<ZXNode>): ZXNode => ({
  phase: '',
  wire: -1,
  position: at,
  ...partial,
})

const open: ZXGraph3D = {
  nodes: [
    node({ id: 'open-in', kind: 'boundary', label: 'in', custom: true }),
    node({ id: 'open-out', kind: 'boundary', label: 'out', custom: true, position: { x: 80, y: 0, z: 0 } }),
    node({ id: 'circuit-in', kind: 'boundary', label: '|0⟩', wire: 0, position: { x: -100, y: 0, z: 0 } }),
    node({ id: 'spider', kind: 'z', phase: '0', wire: 0, position: { x: 0, y: 40, z: 0 } }),
  ],
  edges: [],
}

const ids = (element: Parameters<typeof joinSites>[1]) => joinSites(open, element).map((site) => site.nodeId).sort()

describe('join sites', () => {
  it('sends a state output to an open input or a spider', () => {
    expect(ids('state-zero')).toEqual(['open-in', 'spider'])
    expect(joinSites(open, 'state-zero').find((site) => site.nodeId === 'open-in')?.port).toBe('out0')
  })

  it('sends an effect input to an open output or a spider', () => {
    expect(ids('effect-zero')).toEqual(['open-out', 'spider'])
    expect(joinSites(open, 'effect-zero').find((site) => site.nodeId === 'open-out')?.port).toBe('in0')
  })

  it('lets a wire join either open port', () => {
    expect(ids('wire')).toEqual(['open-in', 'open-out', 'spider'])
  })

  it('keeps a cup off another output', () => {
    expect(ids('cup')).toEqual(['open-in', 'spider'])
  })

  it('joins an effect to the outputs of a cup', () => {
    const cup = buildPictureElement('cup', { x: 200, y: 0, z: 0 }, 'cup')
    const sites = joinSites(cup, 'effect-zero').map((site) => site.nodeId).sort()
    expect(sites).toEqual(['cup-out0', 'cup-out1'])
  })
})
