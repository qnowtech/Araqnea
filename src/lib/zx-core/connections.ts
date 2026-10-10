import type { ZXGraph3D, ZXNode } from '../../types/zx'

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
