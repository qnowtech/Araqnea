import type { SpiderKind, Vector3, ZXEdge, ZXGraph3D, ZXNode } from '../../types/zx'
import { palette, phaseLabel, type PaletteEntry, type PictureElementId } from './semantics'

export type { PictureElementId }

export interface PictureElement {
  id: PictureElementId
  label: string
  group: PaletteEntry['group']
  description: string
}

/** Palette symbols. Each one is a generator from the semantics table, a wire, or the discard. */
export const pictureElements: PictureElement[] = palette.map(({ id, label, group, description }) => ({ id, label, group, description }))

export const pictureElementMime = 'application/x-araqnea-picture'

export const isPictureElementId = (value: string): value is PictureElementId =>
  pictureElements.some((element) => element.id === value)

const leg = 70
const isOne = (re: number, im: number) => Math.abs(re - 1) < 1e-12 && Math.abs(im) < 1e-12

export function buildPictureElement(elementId: PictureElementId, at: Vector3, prefix: string): ZXGraph3D {
  const entry = palette.find((item) => item.id === elementId)
  if (!entry) return { nodes: [], edges: [] }
  const nodes: ZXNode[] = []
  const edges: ZXEdge[] = []
  const spec = entry.spec
  const node = (suffix: string, kind: SpiderKind, phase: string, dx: number, dy: number, label?: string, number?: ZXNode['number']) => {
    const id = `${prefix}-${suffix}`
    nodes.push({
      id,
      kind,
      phase,
      wire: -1,
      ...(label !== undefined ? { label } : {}),
      ...(number && !isOne(number.re, number.im) ? { number } : {}),
      position: { x: at.x + dx, y: at.y + dy, z: at.z },
      custom: true,
      symbol: elementId,
    })
    return id
  }
  const connect = (source: string, target: string) =>
    edges.push({ id: `${prefix}-e${edges.length}`, source, target, custom: true })
  const spiderWithLegs = (kind: 'z' | 'x', phase: string, inputs: number, outputs: number, number?: ZXNode['number']) => {
    const centre = node('spider', kind, phase, 0, 0, undefined, number)
    const spread = (count: number, index: number) => (index - (count - 1) / 2) * 60
    for (let index = 0; index < inputs; index += 1) connect(node(`in${index}`, 'boundary', '', -leg, spread(inputs, index), 'in'), centre)
    for (let index = 0; index < outputs; index += 1) connect(centre, node(`out${index}`, 'boundary', '', leg, spread(outputs, index), 'out'))
  }

  if (spec.type === 'wire') {
    connect(node('in0', 'boundary', '', -leg, 0, 'in'), node('out0', 'boundary', '', leg, 0, 'out'))
  } else if (spec.type === 'discard') {
    connect(node('in0', 'boundary', '', -leg, 0, 'in'), node('ground', 'boundary', '', 0, 0, '⏚'))
  } else if (spec.type === 'hadamard') {
    node('box', 'hadamard', '', 0, 0, 'H', spec.number)
  } else if (spec.inputs === 1 && spec.outputs === 1) {
    node('spider', spec.color, phaseLabel(spec.phase), 0, 0, undefined, spec.number)
  } else {
    spiderWithLegs(spec.color, phaseLabel(spec.phase), spec.inputs, spec.outputs, spec.number)
  }
  return { nodes, edges }
}
