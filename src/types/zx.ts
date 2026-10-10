export type SpiderKind = 'z' | 'x' | 'boundary' | 'hadamard'

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface ZXNode {
  id: string
  kind: SpiderKind
  phase: string
  wire: number
  label?: string
  gateId?: string
  position: Vector3
  custom?: boolean
  symbol?: string
}

export interface ZXEdge {
  id: string
  source: string
  target: string
  hadamard?: boolean
  custom?: boolean
}

export interface ZXGraph3D {
  nodes: ZXNode[]
  edges: ZXEdge[]
}
