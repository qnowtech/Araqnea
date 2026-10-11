import type { ZXGraph3D, ZXNode } from '../../types/zx'
import { buildPictureElement } from './pictureElements'
import { paletteEntry, type PictureElementId } from './semantics'

export function connectionError(graph: ZXGraph3D, sourceId: string, targetId: string): string | undefined {
  const source = graph.nodes.find((node) => node.id === sourceId)
  const target = graph.nodes.find((node) => node.id === targetId)
  if (!source || !target) return 'Choose two existing nodes.'
  if (sourceId === targetId) return 'Choose a different node.'
  if (graph.edges.some((edge) => (edge.source === sourceId && edge.target === targetId) || (edge.source === targetId && edge.target === sourceId))) {
    return 'These nodes are already connected.'
  }
  if (!source.custom && !target.custom) return 'Circuit connections are managed by OpenQASM. Add a palette symbol to extend the graph.'
  const portError = (node: ZXNode) => {
    const degree = graph.edges.filter((edge) => edge.source === node.id || edge.target === node.id).length
    if (node.kind === 'boundary') {
      if (!node.custom || !['in', 'out'].includes(node.label ?? '')) return 'This circuit boundary or discard endpoint cannot accept another wire.'
      if (degree >= 2) return 'This port already has an external connection.'
    } else if (node.kind === 'hadamard') {
      if (degree >= 2) return 'A Hadamard box has only two connections.'
    } else if (node.custom && node.symbol && !['z-spider', 'x-spider', 'z-phase', 'x-phase'].includes(node.symbol)) {
      return 'Connect this symbol through its input/output ports.'
    }
  }
  const error = portError(source) ?? portError(target)
  if (error) return error
  if (source.kind === 'boundary' && target.kind === 'boundary' && source.label === target.label) {
    return 'Connect an output port to an input port.'
  }
}

export interface JoinSite {
  nodeId: string
  port: string
}

const joinPrefix = '__join__'

/** Nodes on `graph` that can take one free port of a new palette element. */
export function joinSites(graph: ZXGraph3D, elementId: PictureElementId): JoinSite[] {
  const element = buildPictureElement(elementId, { x: 1_000_000, y: 0, z: 0 }, joinPrefix)
  const ports = element.nodes.filter((node) => node.label === 'in' || node.label === 'out')
  const connectors = ports.length > 0 ? ports : element.nodes.filter((node) => node.kind !== 'boundary')
  const virtual: ZXGraph3D = {
    nodes: [...graph.nodes, ...element.nodes],
    edges: [...graph.edges, ...element.edges],
  }
  const sites: JoinSite[] = []
  for (const node of graph.nodes) {
    const ranked = [...connectors].sort((left, right) => portRank(node, left) - portRank(node, right))
    const via = ranked.find((port) => connectionError(virtual, port.id, node.id) === undefined)
    if (via) sites.push({ nodeId: node.id, port: via.id.slice(joinPrefix.length + 1) })
  }
  return sites
}

const portRank = (node: ZXNode, port: ZXNode) => {
  if (node.label === 'in' && port.label === 'out') return 0
  if (node.label === 'out' && port.label === 'in') return 0
  if (port.label === 'out') return 1
  if (port.label === 'in') return 2
  return 3
}

/** Where a palette symbol can be wired, in the same words the canvas shows. */
export function joinGuide(elementId: PictureElementId): string {
  const entry = paletteEntry(elementId)
  if (!entry) return 'This symbol has no join points.'
  const spec = entry.spec
  if (spec.type === 'wire') return `${entry.label} has an input and an output. Highlighted nodes accept one of those ports. Click one to place and connect.`
  if (spec.type === 'discard') return `${entry.label} has one input. Highlighted nodes accept that port. Click one to place and connect.`
  if (spec.type === 'hadamard') return `${entry.label} joins on either side. Highlighted nodes accept it. Click one to place and connect.`
  const inputs = spec.inputs ? `${spec.inputs} input${spec.inputs === 1 ? '' : 's'}` : ''
  const outputs = spec.outputs ? `${spec.outputs} output${spec.outputs === 1 ? '' : 's'}` : ''
  const ports = [inputs, outputs].filter(Boolean).join(' and ') || 'no open ports'
  return `${entry.label} has ${ports}. Highlighted nodes are where a port can join. Click one to place and connect.`
}

export function joinSiteLabel(node: ZXNode): string {
  if (node.label === 'in' || node.label === 'out') return `${node.label} port`
  if (node.wire >= 0 && node.kind === 'hadamard') return `q[${node.wire}] Hadamard`
  if (node.wire >= 0 && (node.kind === 'z' || node.kind === 'x')) return `q[${node.wire}] ${node.kind.toUpperCase()}`
  return node.label || node.id
}
