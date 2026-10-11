export type SpiderKind = 'z' | 'x' | 'boundary' | 'hadamard'

export interface Vector3 {
  x: number
  y: number
  z: number
}

/** A complex number. The empty product — a diagram with no legs and no factors — is 1. */
export interface DiagramScalar {
  re: number
  im: number
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
  /** Scalar carried by this node. Absent means 1. */
  number?: DiagramScalar
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
  /** Scalars with no legs. Absent means the empty diagram, whose number is 1. */
  numbers?: DiagramScalar[]
}
