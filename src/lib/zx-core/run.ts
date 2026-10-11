import type { CircuitGate, QuantumCircuit } from '../../types/circuit'
import type { DiagramScalar, ZXGraph3D } from '../../types/zx'
import { toQasm } from '../exporters/circuitExporters'
import {
  ONE,
  ZERO_SCALAR,
  addScalar,
  classifyNode,
  conjScalar,
  mulScalar,
  parsePhase,
  phaseScalar,
  scalar,
  scaleScalar,
  type Phase,
} from './semantics'
import { denote, sameConnections } from './validate'
import { translateCircuit } from './translator'

/** Who runs does not choose statevector, density, or MPS. `run` does. */
export type RunMode = 'simulator' | 'hardware'

export interface RunOptions {
  mode: RunMode
  graph: ZXGraph3D
  circuit?: QuantumCircuit
  shots?: number
  seed?: number
  /** Bond limit used when the circuit is too wide for the statevector. */
  bond?: number
  /** IBM key. It stays out of the circuit, the OpenQASM, and the result. */
  token?: string
}

export interface StatevectorRun {
  ok: true
  mode: 'simulator'
  method: 'statevector'
  exact: true
  amplitudes: DiagramScalar[]
  probabilities: Record<string, number>
  safe: boolean
  weight: DiagramScalar
  counts?: Record<string, number>
}

export interface DensityRun {
  ok: true
  mode: 'simulator'
  method: 'density'
  exact: true
  density: DiagramScalar[][]
}

export interface MpsRun {
  ok: true
  mode: 'simulator'
  method: 'mps'
  exact: false
  bond: number
  qubits: number
}

export interface HardwareRun {
  ok: true
  mode: 'hardware'
  counts: Record<string, number>
  qasm: string
}

export type RunResult =
  | StatevectorRun
  | DensityRun
  | MpsRun
  | HardwareRun
  | { ok: false; error: string }

const DEFAULT_BOND = 8
const DEFAULT_SHOTS = 1024
const SINGULAR = 1e-8

const subScalar = (left: DiagramScalar, right: DiagramScalar) => scalar(left.re - right.re, left.im - right.im)

const bitString = (index: number, qubits: number) => index.toString(2).padStart(qubits, '0')

const modulusSquared = (value: DiagramScalar) => value.re * value.re + value.im * value.im

function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let next = Math.imul(state ^ (state >>> 15), 1 | state)
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

function probabilitiesOf(amplitudes: DiagramScalar[]): Record<string, number> {
  const qubits = amplitudes.length <= 1 ? 0 : Math.round(Math.log2(amplitudes.length))
  const weights: Record<string, number> = {}
  amplitudes.forEach((amplitude, index) => {
    weights[bitString(index, qubits)] = modulusSquared(amplitude)
  })
  return weights
}

function sampleCounts(weights: Record<string, number>, shots: number, seed: number): Record<string, number> {
  const entries = Object.entries(weights).filter(([, weight]) => weight > SINGULAR)
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  const counts: Record<string, number> = {}
  if (total <= 0 || shots <= 0) return counts
  const random = mulberry32(seed)
  for (let shot = 0; shot < shots; shot += 1) {
    let cursor = random() * total
    let chosen = entries[entries.length - 1][0]
    for (const [bits, weight] of entries) {
      cursor -= weight
      if (cursor <= 0) {
        chosen = bits
        break
      }
    }
    counts[chosen] = (counts[chosen] ?? 0) + 1
  }
  return counts
}

function refuses(graph: ZXGraph3D): string | undefined {
  const ids = new Set(graph.nodes.map((node) => node.id))
  for (const edge of graph.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) return 'An edge names a node that is not in the diagram.'
  }
  for (const node of graph.nodes) {
    if (classifyNode(node) === undefined) return 'This node is not a generator.'
    if ((node.kind === 'z' || node.kind === 'x') && parsePhase(node.phase) === undefined) return 'The phase cannot be read.'
  }
  return undefined
}

function hardware(options: RunOptions): RunResult {
  const circuit = options.circuit
  if (!circuit) return { ok: false, error: 'Hardware runs a circuit.' }
  if (!circuit.gates.some((gate) => gate.name === 'measure')) return { ok: false, error: 'Hardware runs a circuit with measurements.' }
  if (!sameConnections(options.graph, translateCircuit(circuit))) {
    return { ok: false, error: 'The diagram is not the circuit that was sent.' }
  }
  const qasm = toQasm(circuit)
  const simulated = simulate(options)
  if (!simulated.ok || simulated.mode !== 'simulator' || simulated.method !== 'statevector' || !simulated.counts) {
    return { ok: false, error: 'Hardware returns counts for a circuit with measurements.' }
  }
  return { ok: true, mode: 'hardware', counts: simulated.counts, qasm }
}

const matrix1 = (a: DiagramScalar, b: DiagramScalar, c: DiagramScalar, d: DiagramScalar): DiagramScalar[][] => [[a, b], [c, d]]

const gateMatrix = (gate: CircuitGate): DiagramScalar[][] | undefined => {
  const root = 1 / Math.SQRT2
  const phase = parsePhase(gate.parameter ?? '0')
  switch (gate.name) {
    case 'h':
      return matrix1(scalar(root), scalar(root), scalar(root), scalar(-root))
    case 'x':
      return matrix1(ZERO_SCALAR, ONE, ONE, ZERO_SCALAR)
    case 'y':
      return matrix1(ZERO_SCALAR, scalar(0, -1), scalar(0, 1), ZERO_SCALAR)
    case 'z':
      return matrix1(ONE, ZERO_SCALAR, ZERO_SCALAR, scalar(-1))
    case 's':
      return matrix1(ONE, ZERO_SCALAR, ZERO_SCALAR, scalar(0, 1))
    case 't':
      return matrix1(ONE, ZERO_SCALAR, ZERO_SCALAR, phaseScalar({ radians: Math.PI / 4, turns: { num: 1, den: 4 } }))
    case 'rz':
      return phase ? matrix1(ONE, ZERO_SCALAR, ZERO_SCALAR, phaseScalar(phase)) : undefined
    case 'rx':
      return phase ? rotationX(phase) : undefined
    default:
      return undefined
  }
}

function rotationX(phase: Phase): DiagramScalar[][] {
  const cosine = Math.cos(phase.radians / 2)
  const sine = Math.sin(phase.radians / 2)
  return matrix1(scalar(cosine), scalar(0, -sine), scalar(0, -sine), scalar(cosine))
}

function twoQubitMatrix(name: CircuitGate['name'], controlOnLeft: boolean): DiagramScalar[][] {
  const basis = [0, 1, 2, 3]
  const image = basis.slice()
  if (name === 'swap') {
    image[1] = 2
    image[2] = 1
  } else if (name === 'cz') {
    image[3] = 3
  } else if (controlOnLeft) {
    image[2] = 3
    image[3] = 2
  } else {
    image[1] = 3
    image[3] = 1
  }
  return basis.map((row) => basis.map((column) => {
    if (name === 'cz') return row === column ? scalar(row === 3 ? -1 : 1) : ZERO_SCALAR
    return image[column] === row ? ONE : ZERO_SCALAR
  }))
}

interface Site {
  left: number
  right: number
  tensor: DiagramScalar[][][]
}

function emptyMatrix(rows: number, cols: number): DiagramScalar[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ZERO_SCALAR))
}

function siteOf(left: number, right: number): Site {
  return {
    left,
    right,
    tensor: [emptyMatrix(left, right), emptyMatrix(left, right)],
  }
}

function dotH(left: DiagramScalar[], right: DiagramScalar[]): DiagramScalar {
  return left.reduce((sum, entry, index) => addScalar(sum, mulScalar(conjScalar(entry), right[index] ?? ZERO_SCALAR)), ZERO_SCALAR)
}

function multiply(left: DiagramScalar[][], right: DiagramScalar[][]): DiagramScalar[][] {
  const rows = left.length
  const cols = right[0]?.length ?? 0
  const shared = right.length
  const out = emptyMatrix(rows, cols)
  for (let row = 0; row < rows; row += 1) {
    for (let mid = 0; mid < shared; mid += 1) {
      for (let column = 0; column < cols; column += 1) {
        out[row][column] = addScalar(out[row][column], mulScalar(left[row][mid], right[mid][column]))
      }
    }
  }
  return out
}

function conjTranspose(matrix: DiagramScalar[][]): DiagramScalar[][] {
  const rows = matrix.length
  const cols = matrix[0]?.length ?? 0
  const out = emptyMatrix(cols, rows)
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < cols; column += 1) out[column][row] = conjScalar(matrix[row][column])
  }
  return out
}

function qr(matrix: DiagramScalar[][]): { Q: DiagramScalar[][]; R: DiagramScalar[][] } {
  const rows = matrix.length
  const cols = matrix[0]?.length ?? 0
  const columns = Array.from({ length: cols }, (_, column) => matrix.map((row) => ({ ...row[column] })))
  const Q = emptyMatrix(rows, cols)
  const R = emptyMatrix(cols, cols)
  for (let column = 0; column < cols; column += 1) {
    let vector = columns[column]
    for (let previous = 0; previous < column; previous += 1) {
      const basis = Q.map((row) => row[previous])
      const projection = dotH(basis, vector)
      R[previous][column] = projection
      vector = vector.map((entry, index) => subScalar(entry, mulScalar(projection, basis[index])))
    }
    let norm = Math.sqrt(Math.max(0, dotH(vector, vector).re))
    if (norm < 1e-12) {
      for (let axis = 0; axis < rows; axis += 1) {
        vector = Array.from({ length: rows }, (_, index) => (index === axis ? ONE : ZERO_SCALAR))
        for (let previous = 0; previous < column; previous += 1) {
          const basis = Q.map((row) => row[previous])
          const projection = dotH(basis, vector)
          vector = vector.map((entry, index) => subScalar(entry, mulScalar(projection, basis[index])))
        }
        norm = Math.sqrt(Math.max(0, dotH(vector, vector).re))
        if (norm >= 1e-12) break
      }
    }
    R[column][column] = scalar(norm)
    const scaled = norm < 1e-12 ? vector : vector.map((entry) => scaleScalar(entry, 1 / norm))
    for (let row = 0; row < rows; row += 1) Q[row][column] = scaled[row]
  }
  return { Q, R }
}

function eigenvectors(matrix: DiagramScalar[][]): { values: number[]; vectors: DiagramScalar[][] } {
  const size = matrix.length
  let current = matrix.map((row) => row.map((entry) => ({ ...entry })))
  let vectors = emptyMatrix(size, size)
  for (let index = 0; index < size; index += 1) vectors[index][index] = ONE
  for (let iteration = 0; iteration < 48; iteration += 1) {
    let off = 0
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) if (row !== column) off += modulusSquared(current[row][column])
    }
    if (off < 1e-18) break
    const factored = qr(current)
    current = multiply(factored.R, factored.Q)
    vectors = multiply(vectors, factored.Q)
  }
  return { values: current.map((row, index) => row[index].re), vectors }
}

function factor(matrix: DiagramScalar[][], cap: number): { u: DiagramScalar[][]; s: number[]; vh: DiagramScalar[][] } | { error: string } {
  const rows = matrix.length
  const cols = matrix[0]?.length ?? 0
  if (!rows || !cols) return { error: 'The bond exceeds the declared limit.' }
  const tall = rows >= cols
  const source = tall ? matrix : conjTranspose(matrix)
  const gram = multiply(conjTranspose(source), source)
  const eigen = eigenvectors(gram)
  const ranked = eigen.values
    .map((value, index) => ({ sigma: Math.sqrt(Math.max(0, value)), index }))
    .filter((item) => item.sigma > SINGULAR)
    .sort((left, right) => right.sigma - left.sigma)
  if (ranked.length > cap) return { error: 'The bond exceeds the declared limit.' }
  if (!ranked.length) return { error: 'The bond exceeds the declared limit.' }
  const applied = multiply(source, eigen.vectors)
  const u = emptyMatrix(source.length, ranked.length)
  const s = ranked.map((item) => item.sigma)
  const vh = emptyMatrix(ranked.length, source[0].length)
  ranked.forEach((item, column) => {
    for (let row = 0; row < source.length; row += 1) u[row][column] = scaleScalar(applied[row][item.index], 1 / item.sigma)
    for (let row = 0; row < source[0].length; row += 1) vh[column][row] = conjScalar(eigen.vectors[row][item.index])
  })
  if (tall) return { u, s, vh }
  return { u: conjTranspose(vh), s, vh: conjTranspose(u) }
}

function applyOne(site: Site, matrix: DiagramScalar[][]) {
  const next = [emptyMatrix(site.left, site.right), emptyMatrix(site.left, site.right)]
  for (let out = 0; out < 2; out += 1) {
    for (let input = 0; input < 2; input += 1) {
      for (let left = 0; left < site.left; left += 1) {
        for (let right = 0; right < site.right; right += 1) {
          next[out][left][right] = addScalar(next[out][left][right], mulScalar(matrix[out][input], site.tensor[input][left][right]))
        }
      }
    }
  }
  site.tensor = next
}

function applyPair(sites: Site[], index: number, gate: DiagramScalar[][], cap: number): number | string {
  const left = sites[index]
  const right = sites[index + 1]
  const contracted: DiagramScalar[][][][] = Array.from({ length: left.left }, () => (
    Array.from({ length: 2 }, () => Array.from({ length: 2 }, () => Array.from({ length: right.right }, () => ZERO_SCALAR)))
  ))
  for (let l = 0; l < left.left; l += 1) {
    for (let bond = 0; bond < left.right; bond += 1) {
      for (let p0 = 0; p0 < 2; p0 += 1) {
        for (let p1 = 0; p1 < 2; p1 += 1) {
          for (let r = 0; r < right.right; r += 1) {
            contracted[l][p0][p1][r] = addScalar(contracted[l][p0][p1][r], mulScalar(left.tensor[p0][l][bond], right.tensor[p1][bond][r]))
          }
        }
      }
    }
  }
  const gated: DiagramScalar[][][][] = Array.from({ length: left.left }, () => (
    Array.from({ length: 2 }, () => Array.from({ length: 2 }, () => Array.from({ length: right.right }, () => ZERO_SCALAR)))
  ))
  for (let l = 0; l < left.left; l += 1) {
    for (let r = 0; r < right.right; r += 1) {
      for (let out0 = 0; out0 < 2; out0 += 1) {
        for (let out1 = 0; out1 < 2; out1 += 1) {
          for (let in0 = 0; in0 < 2; in0 += 1) {
            for (let in1 = 0; in1 < 2; in1 += 1) {
              const amplitude = gate[out0 * 2 + out1][in0 * 2 + in1]
              gated[l][out0][out1][r] = addScalar(gated[l][out0][out1][r], mulScalar(amplitude, contracted[l][in0][in1][r]))
            }
          }
        }
      }
    }
  }
  const rows = left.left * 2
  const cols = 2 * right.right
  const flat = emptyMatrix(rows, cols)
  for (let l = 0; l < left.left; l += 1) {
    for (let p0 = 0; p0 < 2; p0 += 1) {
      for (let p1 = 0; p1 < 2; p1 += 1) {
        for (let r = 0; r < right.right; r += 1) flat[l * 2 + p0][p1 * right.right + r] = gated[l][p0][p1][r]
      }
    }
  }
  const split = factor(flat, cap)
  if ('error' in split) return split.error
  const nextLeft = siteOf(left.left, split.s.length)
  const nextRight = siteOf(split.s.length, right.right)
  for (let l = 0; l < left.left; l += 1) {
    for (let p0 = 0; p0 < 2; p0 += 1) {
      for (let bond = 0; bond < split.s.length; bond += 1) nextLeft.tensor[p0][l][bond] = split.u[l * 2 + p0][bond]
    }
  }
  for (let bond = 0; bond < split.s.length; bond += 1) {
    for (let p1 = 0; p1 < 2; p1 += 1) {
      for (let r = 0; r < right.right; r += 1) {
        nextRight.tensor[p1][bond][r] = scaleScalar(split.vh[bond][p1 * right.right + r], split.s[bond])
      }
    }
  }
  sites[index] = nextLeft
  sites[index + 1] = nextRight
  return split.s.length
}

function runMps(circuit: QuantumCircuit, cap: number): RunResult {
  const sites = Array.from({ length: circuit.qubits }, () => {
    const site = siteOf(1, 1)
    site.tensor[0][0][0] = ONE
    return site
  })
  const place = Array.from({ length: circuit.qubits }, (_, qubit) => qubit)
  let bond = 1
  const swap = twoQubitMatrix('swap', true)
  const adjacent = (qubit: number, other: number): string | undefined => {
    let left = place.indexOf(qubit)
    let right = place.indexOf(other)
    while (Math.abs(left - right) > 1) {
      const moving = left < right ? right - 1 : left - 1
      const grown = applyPair(sites, moving, swap, cap)
      if (typeof grown === 'string') return grown
      bond = Math.max(bond, grown)
      const held = place[moving]
      place[moving] = place[moving + 1]
      place[moving + 1] = held
      left = place.indexOf(qubit)
      right = place.indexOf(other)
    }
    return undefined
  }
  for (const gate of circuit.gates) {
    if (gate.name === 'measure') continue
    if (gate.qubits.length === 1) {
      const matrix = gateMatrix(gate)
      if (!matrix) return { ok: false, error: 'The phase cannot be read.' }
      applyOne(sites[place.indexOf(gate.qubits[0])], matrix)
      continue
    }
    const [first, second] = gate.qubits
    const blocked = adjacent(first, second)
    if (blocked) return { ok: false, error: blocked }
    const left = place.indexOf(first)
    const right = place.indexOf(second)
    const site = Math.min(left, right)
    const grown = applyPair(sites, site, twoQubitMatrix(gate.name, left < right), cap)
    if (typeof grown === 'string') return { ok: false, error: grown }
    bond = Math.max(bond, grown)
  }
  return { ok: true, mode: 'simulator', method: 'mps', exact: false, bond, qubits: circuit.qubits }
}

function statevectorOf(reportState: DiagramScalar[], safe: boolean, weight: DiagramScalar, shots: number, seed: number, counted: boolean): StatevectorRun {
  const probabilities = probabilitiesOf(reportState)
  return {
    ok: true,
    mode: 'simulator',
    method: 'statevector',
    exact: true,
    amplitudes: reportState,
    probabilities,
    safe,
    weight,
    ...(counted ? { counts: sampleCounts(probabilities, shots, seed) } : {}),
  }
}

function simulate(options: RunOptions): RunResult {
  const circuit = options.circuit
  const cap = options.bond ?? DEFAULT_BOND
  const shots = options.shots ?? DEFAULT_SHOTS
  const seed = options.seed ?? 1
  if (circuit && circuit.qubits > 12) {
    const reason = refuses(options.graph)
    if (reason) return { ok: false, error: reason }
    return runMps(circuit, cap)
  }
  const report = denote(options.graph)
  if (!report.wellFormed) return { ok: false, error: report.reason ?? 'The diagram is not well formed.' }
  if (report.mark === 'tal vez') return { ok: false, error: 'This diagram only sometimes occurs.' }
  if (report.density && !report.pure) {
    if (report.outputs > 8) return { ok: false, error: 'The discarded map is past the density limit.' }
    return { ok: true, mode: 'simulator', method: 'density', exact: true, density: report.density }
  }
  if (report.state) {
    if (report.outputs > 12) {
      if (!circuit) return { ok: false, error: 'Past twelve qubits the simulator runs a circuit as an MPS.' }
      return runMps(circuit, cap)
    }
    const counted = options.graph.nodes.some((node) => classifyNode(node)?.type === 'measure')
    return statevectorOf(report.state, report.safe, report.closed ?? ZERO_SCALAR, shots, seed, counted)
  }
  return { ok: false, error: 'This diagram has no state to run.' }
}

/**
 * Simulator or hardware. The simulator reads the BL-1 map and chooses statevector, density, or MPS.
 * Hardware sends the circuit's OpenQASM and returns counts, not the map.
 */
export function run(options: RunOptions): RunResult {
  if (options.mode === 'hardware') return hardware(options)
  return simulate(options)
}
