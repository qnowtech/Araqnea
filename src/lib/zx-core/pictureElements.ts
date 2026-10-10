import type { SpiderKind, Vector3, ZXEdge, ZXGraph3D, ZXNode } from '../../types/zx'

export type PictureElementId =
  | 'z-spider' | 'x-spider' | 'z-phase' | 'x-phase' | 'hadamard'
  | 'state-zero' | 'state-plus' | 'effect-zero' | 'effect-plus'
  | 'wire' | 'cup' | 'cap' | 'copy' | 'merge' | 'discard'

export interface PictureElement {
  id: PictureElementId
  label: string
  group: 'Generators' | 'States & effects' | 'Wires & processes'
  description: string
}

/**
 * Diagrammatic building blocks following the picturalism of
 * Coecke & Kissinger, "Picturing Quantum Processes": spiders, boxes,
 * states and effects (triangles whose flat side faces their wire),
 * cups, caps and discarding. Diagrams flow left to right in Araqnea.
 */
export const pictureElements: PictureElement[] = [
  { id: 'z-spider', label: 'Z spider', group: 'Generators', description: 'Green Z spider, phase 0. Merges with neighbouring Z spiders; copies Z-basis states. Drop it on a qubit wire to insert rz(0).' },
  { id: 'x-spider', label: 'X spider', group: 'Generators', description: 'Red X spider, phase 0. Merges with neighbouring X spiders; copies X-basis states. Drop it on a qubit wire to insert rx(0).' },
  { id: 'z-phase', label: 'Z phase π/2', group: 'Generators', description: 'Z spider with phase π/2 — the S gate. Drop it on a qubit wire to insert s.' },
  { id: 'x-phase', label: 'X phase π', group: 'Generators', description: 'X spider with phase π — the NOT (Pauli-X) gate. Drop it on a qubit wire to insert x.' },
  { id: 'hadamard', label: 'Hadamard', group: 'Generators', description: 'Hadamard box: swaps the Z and X bases (colour change). Drop it on a qubit wire to insert h.' },
  { id: 'state-zero', label: 'State |0⟩', group: 'States & effects', description: 'Prepares the computational basis state |0⟩ (an X spider with a single output).' },
  { id: 'state-plus', label: 'State |+⟩', group: 'States & effects', description: 'Prepares the superposition |+⟩ = (|0⟩+|1⟩)/√2 (a Z spider with a single output).' },
  { id: 'effect-zero', label: 'Effect ⟨0|', group: 'States & effects', description: 'Post-selects / tests for |0⟩ (an X spider with a single input).' },
  { id: 'effect-plus', label: 'Effect ⟨+|', group: 'States & effects', description: 'Post-selects / tests for |+⟩ (a Z spider with a single input).' },
  { id: 'wire', label: 'Wire', group: 'Wires & processes', description: 'Identity: carries a system unchanged from its input port to its output port.' },
  { id: 'cup', label: 'Cup ∪', group: 'Wires & processes', description: 'Cup: prepares the Bell state (|00⟩+|11⟩) — two outputs, no inputs.' },
  { id: 'cap', label: 'Cap ∩', group: 'Wires & processes', description: 'Cap: Bell effect that joins two inputs — used for teleportation and transposes.' },
  { id: 'copy', label: 'Copy', group: 'Wires & processes', description: 'Copy: Z spider that copies a Z-basis value from one input into two outputs.' },
  { id: 'merge', label: 'XOR merge', group: 'Wires & processes', description: 'XOR merge: X spider that adds two inputs modulo 2 into one output.' },
  { id: 'discard', label: 'Discard ⏚', group: 'Wires & processes', description: 'Discard (ground): throws a system away, tracing it out of the process.' },
]

export const pictureElementMime = 'application/x-araqnea-picture'

export const isPictureElementId = (value: string): value is PictureElementId =>
  pictureElements.some((element) => element.id === value)

const leg = 70

export function buildPictureElement(elementId: PictureElementId, at: Vector3, prefix: string): ZXGraph3D {
  const nodes: ZXNode[] = []
  const edges: ZXEdge[] = []
  const node = (suffix: string, kind: SpiderKind, phase: string, dx: number, dy: number, label?: string) => {
    const id = `${prefix}-${suffix}`
    nodes.push({
      id,
      kind,
      phase,
      wire: -1,
      ...(label !== undefined ? { label } : {}),
      position: { x: at.x + dx, y: at.y + dy, z: at.z },
      custom: true,
      symbol: elementId,
    })
    return id
  }
  const connect = (source: string, target: string) =>
    edges.push({ id: `${prefix}-e${edges.length}`, source, target, custom: true })
  const spiderWithLegs = (kind: 'z' | 'x', phase: string, inputs: number, outputs: number) => {
    const centre = node('spider', kind, phase, 0, 0)
    const spread = (count: number, index: number) => (index - (count - 1) / 2) * 60
    for (let index = 0; index < inputs; index += 1) connect(node(`in${index}`, 'boundary', '', -leg, spread(inputs, index), 'in'), centre)
    for (let index = 0; index < outputs; index += 1) connect(centre, node(`out${index}`, 'boundary', '', leg, spread(outputs, index), 'out'))
  }

  switch (elementId) {
    case 'z-spider': node('spider', 'z', '0', 0, 0); break
    case 'x-spider': node('spider', 'x', '0', 0, 0); break
    case 'z-phase': node('spider', 'z', 'π/2', 0, 0); break
    case 'x-phase': node('spider', 'x', 'π', 0, 0); break
    case 'hadamard': node('box', 'hadamard', '', 0, 0, 'H'); break
    case 'state-zero': spiderWithLegs('x', '0', 0, 1); break
    case 'state-plus': spiderWithLegs('z', '0', 0, 1); break
    case 'effect-zero': spiderWithLegs('x', '0', 1, 0); break
    case 'effect-plus': spiderWithLegs('z', '0', 1, 0); break
    case 'wire': connect(node('in0', 'boundary', '', -leg, 0, 'in'), node('out0', 'boundary', '', leg, 0, 'out')); break
    case 'cup': spiderWithLegs('z', '0', 0, 2); break
    case 'cap': spiderWithLegs('z', '0', 2, 0); break
    case 'copy': spiderWithLegs('z', '0', 1, 2); break
    case 'merge': spiderWithLegs('x', '0', 2, 1); break
    case 'discard': connect(node('in0', 'boundary', '', -leg, 0, 'in'), node('ground', 'boundary', '', 0, 0, '⏚')); break
  }
  return { nodes, edges }
}
