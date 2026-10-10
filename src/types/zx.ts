export type SpiderKind = 'z' | 'x' | 'boundary'

export interface ZXNode {
  id: string
  kind: SpiderKind
  phase: string
  wire: number
  label?: string
  x: number
  y: number
}

export interface ZXEdge {
  id: string
  source: string
  target: string
  hadamard?: boolean
}

export interface ZXGraph {
  nodes: ZXNode[]
  edges: ZXEdge[]
}
