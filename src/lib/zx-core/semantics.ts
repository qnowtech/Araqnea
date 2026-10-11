import type { CircuitGate, GateName } from '../../types/circuit'
import type { DiagramScalar, SpiderKind, ZXGraph3D, ZXNode } from '../../types/zx'

/**
 * The only table of maps. Phases, colours, wires and the linear map of each
 * generator live here. The translator, the palette and the gate glossary read
 * this table; they do not keep a second one.
 *
 * A Z spider of phase α denotes |0…0⟩⟨0…0| + e^{iα}|1…1⟩⟨1…1|.
 * An X spider denotes the same formula in the Hadamard basis, that is Hadamard
 * on every leg of the Z spider. A single-leg X spider carries the scalar 1/√2,
 * so the state of phase 0 is |0⟩ and the state of phase π is |1⟩.
 */

export interface Phase {
  /** α in [0, 2π). */
  radians: number
  /** α/π in lowest terms, when the angle is an exact rational multiple of π. */
  turns?: { num: number; den: number }
}

export type SpiderColor = 'z' | 'x'
export type WireKind = 'quantum' | 'ordinary'

export interface Rational {
  num: number
  den: number
}

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const next = x % y
    x = y
    y = next
  }
  return x || 1
}

const rational = (num: number, den = 1): Rational => {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return { num: 0, den: 1 }
  const sign = num * den < 0 ? -1 : 1
  const divisor = gcd(num, den)
  return { num: sign * Math.abs(num / divisor), den: Math.abs(den / divisor) }
}

const ratAdd = (a: Rational, b: Rational) => rational(a.num * b.den + b.num * a.den, a.den * b.den)
const ratSub = (a: Rational, b: Rational) => rational(a.num * b.den - b.num * a.den, a.den * b.den)
const ratMul = (a: Rational, b: Rational) => rational(a.num * b.num, a.den * b.den)
const ratDiv = (a: Rational, b: Rational) => rational(a.num * b.den, a.den * b.num)

/** Coefficient of π, plus a rational remainder in radians: a·π + b. */
interface LinearAngle {
  a: Rational
  b: Rational
}

const lin = (a: Rational, b: Rational): LinearAngle => ({ a, b })
const ratZero: Rational = { num: 0, den: 1 }
const ratOne: Rational = { num: 1, den: 1 }

const linAdd = (p: LinearAngle, q: LinearAngle) => lin(ratAdd(p.a, q.a), ratAdd(p.b, q.b))
const linSub = (p: LinearAngle, q: LinearAngle) => lin(ratSub(p.a, q.a), ratSub(p.b, q.b))
const linMul = (p: LinearAngle, q: LinearAngle): LinearAngle | undefined => {
  if (p.a.num !== 0 && q.a.num !== 0) return undefined
  return lin(ratAdd(ratMul(p.a, q.b), ratMul(p.b, q.a)), ratMul(p.b, q.b))
}
const linDiv = (p: LinearAngle, q: LinearAngle): LinearAngle | undefined => {
  if (q.a.num !== 0 || q.b.num === 0) return undefined
  return lin(ratDiv(p.a, q.b), ratDiv(p.b, q.b))
}
const linNeg = (p: LinearAngle) => lin(rational(-p.a.num, p.a.den), rational(-p.b.num, p.b.den))

const wrapRadians = (theta: number) => {
  const turn = Math.PI * 2
  let value = theta % turn
  if (value < 0) value += turn
  if (value < 1e-12 || Math.abs(value - turn) < 1e-12) return 0
  return value
}

const phaseFromLinear = (angle: LinearAngle): Phase => {
  if (angle.b.num === 0) {
    let { num, den } = angle.a
    num %= 2 * den
    if (num < 0) num += 2 * den
    const divisor = gcd(num, den)
    num /= divisor
    den /= divisor
    const turns = num === 0 ? { num: 0, den: 1 } : { num, den }
    return { radians: wrapRadians(Math.PI * turns.num / turns.den), turns }
  }
  const radians = wrapRadians(Math.PI * angle.a.num / angle.a.den + angle.b.num / angle.b.den)
  return { radians }
}

const withTurns = (num: number, den: number): Phase => phaseFromLinear(lin(rational(num, den), ratZero))

export const ZERO: Phase = withTurns(0, 1)
export const PI: Phase = withTurns(1, 1)
export const PI_HALF: Phase = withTurns(1, 2)
export const PI_QUARTER: Phase = withTurns(1, 4)
export const THREE_PI_HALF: Phase = withTurns(3, 2)

export const phaseFromTurns = (num: number, den = 1): Phase => withTurns(num, den)

export const phaseFromDegrees = (degrees: number): Phase => withTurns(degrees, 180)

export const phaseFromRadians = (radians: number): Phase => ({ radians: wrapRadians(radians) })

const decimal = (text: string): Rational => {
  const negative = text.startsWith('-')
  const body = negative ? text.slice(1) : text
  const [whole = '0', frac = ''] = body.split('.')
  const den = 10 ** frac.length
  const num = Number((whole || '0') + frac)
  return rational(negative ? -num : num, den)
}

const tokenize = (source: string) => source
  .replaceAll('π', ' pi ')
  .replaceAll('τ', ' tau ')
  .replaceAll('°', ' deg ')
  .replace(/pi/gi, ' pi ')
  .replace(/tau/gi, ' tau ')
  .replace(/deg/gi, ' deg ')
  .match(/pi|tau|deg|\d+(?:\.\d*)?|\.\d+|[+*/()-]/gi) ?? []

/** Parses a phase. An empty mark is 0. Degrees and radians of the same angle agree. */
export function parsePhase(source: string | undefined): Phase | undefined {
  const text = (source ?? '').trim()
  if (!text) return ZERO
  const tokens = tokenize(text)
  if (!tokens.length) return undefined
  let index = 0
  const peek = () => tokens[index]
  const pull = () => tokens[index++]
  function parseExpression(): LinearAngle | undefined {
    let left = parseTerm()
    if (!left) return undefined
    while (peek() === '+' || peek() === '-') {
      const op = pull()
      const right = parseTerm()
      if (!right) return undefined
      left = op === '+' ? linAdd(left, right) : linSub(left, right)
    }
    return left
  }
  function parseTerm(): LinearAngle | undefined {
    const first = parseFactor()
    if (!first) return undefined
    let left: LinearAngle = first
    while (peek() === '*' || peek() === '/' || peek() === 'pi' || peek() === 'tau' || peek() === 'deg' || peek() === '(' || /^\d/.test(peek() ?? '') || peek() === '.') {
      if (peek() === 'deg') {
        pull()
        left = lin(ratDiv(left.b, rational(180)), ratZero)
        continue
      }
      const op = peek() === '*' || peek() === '/' ? pull() : '*'
      const right = parseFactor()
      if (!right) return undefined
      const product = op === '/' ? linDiv(left, right) : linMul(left, right)
      if (!product) return undefined
      left = product
    }
    return left
  }
  function parseFactor(): LinearAngle | undefined {
    if (peek() === '+') {
      pull()
      return parseFactor()
    }
    if (peek() === '-') {
      pull()
      const value = parseFactor()
      return value ? linNeg(value) : undefined
    }
    if (peek() === '(') {
      pull()
      const value = parseExpression()
      if (peek() !== ')') return undefined
      pull()
      return value
    }
    const token = pull()
    if (!token) return undefined
    if (token.toLowerCase() === 'pi') return lin(ratOne, ratZero)
    if (token.toLowerCase() === 'tau') return lin(rational(2), ratZero)
    if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) return lin(ratZero, decimal(token))
    return undefined
  }
  const angle = parseExpression()
  if (!angle || index !== tokens.length) return undefined
  return phaseFromLinear(angle)
}

export const phaseLabel = (phase: Phase): string => {
  const turns = phase.turns
  if (!turns || turns.num === 0) return '0'
  const pi = turns.den === 1 ? 'π' : `π/${turns.den}`
  return turns.num === 1 ? pi : `${turns.num}${pi}`
}

/** OpenQASM angle. The parser accepts `pi`, not the π glyph, and wants an explicit product. */
export const qasmAngle = (phase: Phase): string => {
  const turns = phase.turns
  if (!turns || turns.num === 0) return '0'
  if (turns.den === 1) return turns.num === 1 ? 'pi' : `${turns.num}*pi`
  return turns.num === 1 ? `pi/${turns.den}` : `${turns.num}*pi/${turns.den}`
}

export const phasesEqual = (a: Phase, b: Phase) => {
  if (a.turns && b.turns) return a.turns.num === b.turns.num && a.turns.den === b.turns.den
  return Math.abs(a.radians - b.radians) < 1e-9
}

export const addPhase = (a: Phase, b: Phase): Phase => {
  if (a.turns && b.turns) return withTurns(a.turns.num * b.turns.den + b.turns.num * a.turns.den, a.turns.den * b.turns.den)
  return phaseFromRadians(a.radians + b.radians)
}

/** Vertical flip. The phase α becomes 2π − α, so π/2 becomes 3π/2. */
export const flipPhase = (phase: Phase): Phase => {
  if (phase.turns) return withTurns(2 * phase.turns.den - phase.turns.num, phase.turns.den)
  return phaseFromRadians(Math.PI * 2 - phase.radians)
}

export const addPhases = (phases: Phase[]) => phases.reduce(addPhase, ZERO)

const paintToColor: Record<string, SpiderColor> = {
  green: 'z',
  white: 'z',
  red: 'x',
  gray: 'x',
  grey: 'x',
}

/** Green and white are Z. Red and gray are X. Any other paint is not a spider colour. */
export const spiderColor = (paint: string): SpiderColor | undefined => paintToColor[paint.toLowerCase()]

export const SPIDER_COLORS: readonly SpiderColor[] = ['z', 'x']

export const scalar = (re: number, im = 0): DiagramScalar => ({ re, im })

export const ONE: DiagramScalar = scalar(1)
export const ZERO_SCALAR: DiagramScalar = scalar(0)
export const HALF: DiagramScalar = scalar(1 / 2)
export const NEG_I: DiagramScalar = scalar(0, -1)
export const INV_SQRT2: DiagramScalar = scalar(1 / Math.SQRT2)
/** The spider CNOT and the spider CZ denote the unitary only together with this factor. */
export const SQRT2: DiagramScalar = scalar(Math.SQRT2)

export const addScalar = (a: DiagramScalar, b: DiagramScalar) => scalar(a.re + b.re, a.im + b.im)
export const mulScalar = (a: DiagramScalar, b: DiagramScalar) => scalar(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re)
export const scaleScalar = (a: DiagramScalar, factor: number) => scalar(a.re * factor, a.im * factor)
export const conjScalar = (a: DiagramScalar) => scalar(a.re, -a.im)

export const sameScalar = (a: DiagramScalar, b: DiagramScalar, tolerance = 1e-9) =>
  Math.abs(a.re - b.re) <= tolerance && Math.abs(a.im - b.im) <= tolerance

export const sameVector = (a: DiagramScalar[], b: DiagramScalar[], tolerance = 1e-9) =>
  a.length === b.length && a.every((entry, index) => sameScalar(entry, b[index], tolerance))

export const sameMatrix = (a: DiagramScalar[][], b: DiagramScalar[][], tolerance = 1e-9) =>
  a.length === b.length && a.every((row, index) => sameVector(row, b[index], tolerance))

/** The empty diagram is the number 1. */
export const emptyDiagram: DiagramScalar = ONE

/** e^{iα}, with the quarters of π kept exact. */
export const phaseScalar = (phase: Phase): DiagramScalar => {
  const turns = phase.turns
  if (turns) {
    const { num, den } = turns
    if (num === 0) return ONE
    if (den === 1 && num === 1) return scalar(-1)
    if (den === 2 && num === 1) return scalar(0, 1)
    if (den === 2 && num === 3) return scalar(0, -1)
    const root = 1 / Math.SQRT2
    if (den === 4 && num === 1) return scalar(root, root)
    if (den === 4 && num === 3) return scalar(-root, root)
    if (den === 4 && num === 5) return scalar(-root, -root)
    if (den === 4 && num === 7) return scalar(root, -root)
  }
  return scalar(Math.cos(phase.radians), Math.sin(phase.radians))
}

/** Z spider with no legs. Phase 0 is the number 2. */
export const scalarSpider = (phase: Phase = ZERO): DiagramScalar => addScalar(ONE, phaseScalar(phase))

/**
 * 1/2 is the inverse of the legless Z spider. Meeting that 2 cancels it and
 * leaves the empty diagram.
 */
export const cancelScalar = (left: DiagramScalar, right: DiagramScalar) => mulScalar(left, right)

const hadamardEntry = (row: number, col: number) => {
  const sign = row === 1 && col === 1 ? -1 : 1
  return scalar(sign / Math.SQRT2)
}

/** The Hadamard box and the Hadamard edge are this same generator. */
export function hadamardMatrix(): DiagramScalar[][] {
  return [
    [hadamardEntry(0, 0), hadamardEntry(0, 1)],
    [hadamardEntry(1, 0), hadamardEntry(1, 1)],
  ]
}

export const hadamardBox = hadamardMatrix
export const hadamardEdge = hadamardMatrix

interface Tensor {
  legs: string[]
  data: DiagramScalar[]
}

const bitsToIndex = (bits: number[]) => bits.reduce((index, bit, place) => index | (bit << place), 0)

const spiderData = (color: SpiderColor, phase: Phase, legs: number): DiagramScalar[] => {
  if (legs === 0) return [scalarSpider(phase)]
  const size = 1 << legs
  const z = Array.from({ length: size }, () => ZERO_SCALAR)
  z[0] = ONE
  z[size - 1] = phaseScalar(phase)
  if (color === 'z') return z
  const x = Array.from({ length: size }, () => ZERO_SCALAR)
  const height = 1 / Math.SQRT2
  for (let mask = 0; mask < size; mask += 1) {
    let plus = ONE
    let minus = ONE
    for (let leg = 0; leg < legs; leg += 1) {
      const bit = (mask >> leg) & 1
      plus = scaleScalar(plus, height)
      minus = scaleScalar(minus, bit === 0 ? height : -height)
    }
    x[mask] = addScalar(mulScalar(plus, z[0]), mulScalar(minus, z[size - 1]))
  }
  return x
}

/** Spider tensor before the single-leg X scalar. Leg 0 is the least significant bit. */
export function spiderAmplitudes(color: SpiderColor, phase: Phase, legs: number): DiagramScalar[] {
  return spiderData(color, phase, legs)
}

/**
 * Map of one spider, with its number already multiplied in.
 * A single-leg X spider includes 1/√2, so phase 0 denotes |0⟩ and phase π denotes |1⟩.
 * A single-leg Z spider of phase 0 denotes |0⟩+|1⟩, the generator called |+⟩.
 * Two outputs and phase 0 denote the naked cup |00⟩+|11⟩.
 */
export function spiderMap(color: SpiderColor, phase: Phase, inputs: number, outputs: number): { map: DiagramScalar[]; number: DiagramScalar; legs: string[] } {
  const inputLegs = Array.from({ length: inputs }, (_, index) => `in:${index}`)
  const outputLegs = Array.from({ length: outputs }, (_, index) => `out:${index}`)
  const legs = [...inputLegs, ...outputLegs]
  const singleLeg = color === 'x' && inputs + outputs === 1
  const number = singleLeg ? INV_SQRT2 : ONE
  const map = spiderData(color, phase, legs.length).map((entry) => mulScalar(entry, number))
  return { map, number, legs }
}

const contractShared = (left: Tensor, right: Tensor, shared: string[]): Tensor => {
  const leftFree = left.legs.filter((leg) => !shared.includes(leg))
  const rightFree = right.legs.filter((leg) => !shared.includes(leg))
  const legs = [...leftFree, ...rightFree]
  const data = Array.from({ length: 1 << legs.length }, () => ZERO_SCALAR)
  for (let mask = 0; mask < data.length; mask += 1) {
    const leftBits = Array.from({ length: left.legs.length }, () => 0)
    const rightBits = Array.from({ length: right.legs.length }, () => 0)
    legs.forEach((leg, place) => {
      const bit = (mask >> place) & 1
      const onLeft = left.legs.indexOf(leg)
      const onRight = right.legs.indexOf(leg)
      if (onLeft >= 0) leftBits[onLeft] = bit
      if (onRight >= 0) rightBits[onRight] = bit
    })
    let sum = ZERO_SCALAR
    for (let bits = 0; bits < (1 << shared.length); bits += 1) {
      shared.forEach((leg, place) => {
        const bit = (bits >> place) & 1
        leftBits[left.legs.indexOf(leg)] = bit
        rightBits[right.legs.indexOf(leg)] = bit
      })
      sum = addScalar(sum, mulScalar(left.data[bitsToIndex(leftBits)], right.data[bitsToIndex(rightBits)]))
    }
    data[mask] = sum
  }
  return { legs, data }
}

const tensorProduct = (left: Tensor, right: Tensor): Tensor => {
  const data = Array.from({ length: left.data.length * right.data.length }, () => ZERO_SCALAR)
  left.data.forEach((entry, leftIndex) => {
    right.data.forEach((other, rightIndex) => {
      data[leftIndex + left.data.length * rightIndex] = mulScalar(entry, other)
    })
  })
  return { legs: [...left.legs, ...right.legs], data }
}

export function contractNetwork(tensors: Tensor[]): Tensor {
  let pending = tensors.map((tensor) => ({ legs: [...tensor.legs], data: tensor.data.map((entry) => ({ ...entry })) }))
  while (pending.length > 1) {
    const owner = new Map<string, number>()
    let pair: { left: number; right: number } | undefined
    for (let index = 0; index < pending.length && !pair; index += 1) {
      for (const leg of pending[index].legs) {
        const previous = owner.get(leg)
        if (previous === undefined) owner.set(leg, index)
        else pair = { left: previous, right: index }
      }
    }
    if (!pair) {
      pending = [pending.reduce(tensorProduct)]
      break
    }
    const shared = pending[pair.left].legs.filter((leg) => pending[pair.right].legs.includes(leg))
    const next = contractShared(pending[pair.left], pending[pair.right], shared)
    const drop = new Set([pair.left, pair.right])
    pending = pending.filter((_, index) => !drop.has(index))
    pending.push(next)
  }
  return pending[0] ?? { legs: [], data: [ONE] }
}

const amplitudeAt = (tensor: Tensor, assignment: Record<string, number>) => {
  const index = tensor.legs.reduce((bits, leg, place) => bits | ((assignment[leg] ?? 0) << place), 0)
  return tensor.data[index] ?? ZERO_SCALAR
}

const assigned = (prefix: 'in' | 'out', qubits: number, index: number) => {
  const assignment: Record<string, number> = {}
  for (let qubit = 0; qubit < qubits; qubit += 1) assignment[`${prefix}:${qubit}`] = (index >> (qubits - 1 - qubit)) & 1
  return assignment
}

export function vectorFromTensor(tensor: Tensor, qubits: number): DiagramScalar[] {
  const size = 1 << qubits
  return Array.from({ length: size }, (_, index) => amplitudeAt(tensor, assigned('out', qubits, index)))
}

export function matrixFromTensor(tensor: Tensor, qubits: number): DiagramScalar[][] {
  const size = 1 << qubits
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => {
    return amplitudeAt(tensor, { ...assigned('in', qubits, column), ...assigned('out', qubits, row) })
  }))
}

/** |0⟩, the X spider of one output and phase 0, number included. */
export const ketZero = () => spiderMap('x', ZERO, 0, 1).map

/** |1⟩, the X spider of one output and phase π, number included. */
export const ketOne = () => spiderMap('x', PI, 0, 1).map

/** The Z spider of one output and phase 0: |0⟩+|1⟩. */
export const ketPlus = () => spiderMap('z', ZERO, 0, 1).map

/** Naked quantum cup: Z spider, phase 0, two outputs. The map is |00⟩+|11⟩. */
export const nakedCup = () => vectorFromTensor({ legs: ['out:0', 'out:1'], data: spiderMap('z', ZERO, 0, 2).map }, 2)

/** Two-qubit cap: that same spider with two inputs. It is not the discard. */
export const twoQubitCap = () => spiderMap('z', ZERO, 2, 0)

const vectorTensor = (prefix: 'in' | 'out', vector: DiagramScalar[]): Tensor => {
  const qubits = Math.round(Math.log2(vector.length))
  const legs = Array.from({ length: qubits }, (_, index) => `${prefix}:${index}`)
  const data = Array.from({ length: vector.length }, () => ZERO_SCALAR)
  vector.forEach((amplitude, index) => {
    const tensorIndex = legs.reduce((bits, leg, place) => {
      const qubit = Number(leg.slice(prefix.length + 1))
      const bit = (index >> (qubits - 1 - qubit)) & 1
      return bits | (bit << place)
    }, 0)
    data[tensorIndex] = amplitude
  })
  return { legs, data }
}

export function applySpider(color: SpiderColor, phase: Phase, inputs: number, outputs: number, input: DiagramScalar[]): DiagramScalar[] {
  const spider = spiderMap(color, phase, inputs, outputs)
  const contracted = inputs === 0
    ? { legs: spider.legs, data: spider.map }
    : contractNetwork([{ legs: spider.legs, data: spider.map }, vectorTensor('in', input)])
  return vectorFromTensor(contracted, outputs)
}

/**
 * Copy is the Z spider of one input and two outputs. It copies the computational
 * basis. There is no generator that copies a state of arbitrary phase.
 */
export const copiesArbitraryPhase = false

export const copyImage = (state: DiagramScalar[]) => applySpider('z', ZERO, 1, 2, state)

/** Discard throws the qubit away and stores no bit. On a pure state the number is ⟨ψ|ψ⟩. */
export const discardState = (state: DiagramScalar[]) => state.reduce((sum, amplitude) => addScalar(sum, mulScalar(conjScalar(amplitude), amplitude)), ZERO_SCALAR)

export interface MeasureGenerator {
  type: 'measure'
  input: 'quantum'
  output: 'ordinary'
  storesBit: true
}

export interface EncodeGenerator {
  type: 'encode'
  input: 'ordinary'
  output: 'quantum'
  flipOf: 'measure'
  storesBit: false
}

export interface DiscardGenerator {
  type: 'discard'
  input: 'quantum'
  output: null
  storesBit: false
}

export const measureGenerator: MeasureGenerator = { type: 'measure', input: 'quantum', output: 'ordinary', storesBit: true }
export const encodeGenerator: EncodeGenerator = { type: 'encode', input: 'ordinary', output: 'quantum', flipOf: 'measure', storesBit: false }
export const discardGenerator: DiscardGenerator = { type: 'discard', input: 'quantum', output: null, storesBit: false }

/** Encoding is the vertical flip of measurement: a bit of 1 is sent through X. */
export const encodeBit = (bit: 0 | 1): DiagramScalar[] => (bit === 0 ? ketZero() : ketOne())

/** A quantum wire and an ordinary wire are not the same wire. Neither discard nor measurement retypes one into the other. */
export const producedWire = (generator: MeasureGenerator | EncodeGenerator | DiscardGenerator): WireKind | null => generator.output

export type NodeClass = { type: 'z' | 'x' | 'hadamard' | 'wire' | 'measure' | 'encode' | 'discard' }

/** Every node of a well-formed diagram is one of these generators. */
export function classifyNode(node: ZXNode): NodeClass | undefined {
  if (node.kind === 'z' || node.kind === 'x' || node.kind === 'hadamard') return { type: node.kind }
  if (node.kind !== 'boundary') return undefined
  const label = node.label ?? ''
  if (label.startsWith('M→') || label === 'measure') return { type: 'measure' }
  if (label === '⏚' || label === 'discard') return { type: 'discard' }
  if (label === 'encode') return { type: 'encode' }
  if (label === '|0⟩') return { type: 'x' }
  if (label === '⟩' || label === 'in' || label === 'out') return { type: 'wire' }
  if (!node.custom && node.id.startsWith('in-')) return { type: 'x' }
  if (!node.custom && node.id.startsWith('out-')) return { type: 'wire' }
  return undefined
}

export type PictureElementId =
  | 'z-spider' | 'x-spider' | 'z-phase' | 'x-phase' | 'hadamard'
  | 'state-zero' | 'state-plus' | 'effect-zero' | 'effect-plus'
  | 'wire' | 'cup' | 'cap' | 'copy' | 'merge' | 'discard'

export type GeneratorSpec =
  | { type: 'spider'; color: SpiderColor; phase: Phase; inputs: number; outputs: number; number: DiagramScalar }
  | { type: 'hadamard'; number: DiagramScalar }
  | { type: 'wire'; wire: WireKind }
  | { type: 'discard' }

export interface PaletteEntry {
  id: PictureElementId
  label: string
  group: 'Generators' | 'States & effects' | 'Wires & processes'
  description: string
  spec: GeneratorSpec
}

const spiderSpec = (color: SpiderColor, phase: Phase, inputs: number, outputs: number): GeneratorSpec => ({
  type: 'spider',
  color,
  phase,
  inputs,
  outputs,
  number: color === 'x' && inputs + outputs === 1 ? INV_SQRT2 : ONE,
})

export const palette: PaletteEntry[] = [
  { id: 'z-spider', label: 'Z spider', group: 'Generators', description: 'Z spider, phase 0, one input and one output. Green and white are this colour. On a qubit wire it is rz(0).', spec: spiderSpec('z', ZERO, 1, 1) },
  { id: 'x-spider', label: 'X spider', group: 'Generators', description: 'X spider, phase 0, one input and one output. Red and gray are this colour. On a qubit wire it is rx(0).', spec: spiderSpec('x', ZERO, 1, 1) },
  { id: 'z-phase', label: 'Z phase π/2', group: 'Generators', description: 'Z spider with phase π/2. The same spider as the S gate, and as rz(π/2).', spec: spiderSpec('z', PI_HALF, 1, 1) },
  { id: 'x-phase', label: 'X phase π', group: 'Generators', description: 'X spider with phase π. The same spider as the Pauli X gate.', spec: spiderSpec('x', PI, 1, 1) },
  { id: 'hadamard', label: 'Hadamard', group: 'Generators', description: 'Hadamard box. The same generator as a Hadamard edge.', spec: { type: 'hadamard', number: ONE } },
  { id: 'state-zero', label: 'State |0⟩', group: 'States & effects', description: 'X spider, one output, phase 0, with the scalar 1/√2. The denoted state is |0⟩.', spec: spiderSpec('x', ZERO, 0, 1) },
  { id: 'state-plus', label: 'State |+⟩', group: 'States & effects', description: 'Z spider, one output, phase 0. The map is |0⟩+|1⟩.', spec: spiderSpec('z', ZERO, 0, 1) },
  { id: 'effect-zero', label: 'Effect ⟨0|', group: 'States & effects', description: 'X spider, one input, phase 0, with the scalar 1/√2. The denoted effect is ⟨0|. It is not the discard.', spec: spiderSpec('x', ZERO, 1, 0) },
  { id: 'effect-plus', label: 'Effect ⟨+|', group: 'States & effects', description: 'Z spider, one input, phase 0. The map is ⟨0|+⟨1|.', spec: spiderSpec('z', ZERO, 1, 0) },
  { id: 'wire', label: 'Wire', group: 'Wires & processes', description: 'Quantum wire. It carries a qubit. It is not an ordinary bit wire.', spec: { type: 'wire', wire: 'quantum' } },
  { id: 'cup', label: 'Cup ∪', group: 'Wires & processes', description: 'Naked quantum cup: Z spider, phase 0, two outputs. The map is |00⟩+|11⟩.', spec: spiderSpec('z', ZERO, 0, 2) },
  { id: 'cap', label: 'Cap ∩', group: 'Wires & processes', description: 'Two-qubit cap: the cup\'s spider with two inputs. It is not the discard.', spec: spiderSpec('z', ZERO, 2, 0) },
  { id: 'copy', label: 'Copy', group: 'Wires & processes', description: 'Z spider, one input and two outputs, phase 0. It copies the computational basis. It does not copy a state of arbitrary phase.', spec: spiderSpec('z', ZERO, 1, 2) },
  { id: 'merge', label: 'XOR merge', group: 'Wires & processes', description: 'X spider, two inputs and one output, phase 0.', spec: spiderSpec('x', ZERO, 2, 1) },
  { id: 'discard', label: 'Discard ⏚', group: 'Wires & processes', description: 'Throws the qubit away and stores no bit. The two-qubit cap is not this generator.', spec: { type: 'discard' } },
]

export const paletteEntry = (id: PictureElementId) => palette.find((entry) => entry.id === id)

export type DrawStep =
  | { type: 'z' | 'x'; wire: number; phase: Phase; text?: string }
  | { type: 'h'; wire: number }
  | { type: 'cnot'; control: number; target: number }
  | { type: 'cz'; control: number; target: number }
  | { type: 'measure'; wire: number; bit: number }

export interface GateDrawing {
  steps: DrawStep[]
  numbers: DiagramScalar[]
}

const phaseOf = (parameter: string | undefined) => parsePhase(parameter ?? '0') ?? ZERO

const withScalars = (steps: DrawStep[], extra: DiagramScalar[] = []): GateDrawing => ({
  steps,
  numbers: [
    ...extra,
    ...steps.flatMap((step) => (step.type === 'cnot' || step.type === 'cz' ? [SQRT2] : [])),
  ],
})

/** How a circuit gate is drawn: Z spiders, X spiders, and the Hadamard generator. Swap is three alternating CNOTs. */
export function drawingOf(gate: CircuitGate): GateDrawing {
  const wire = gate.qubits[0]
  const [control, target] = gate.qubits
  switch (gate.name) {
    case 'h':
      return withScalars([{ type: 'h', wire }])
    case 'x':
      return withScalars([{ type: 'x', wire, phase: PI }])
    case 'z':
      return withScalars([{ type: 'z', wire, phase: PI }])
    case 's':
      return withScalars([{ type: 'z', wire, phase: PI_HALF }])
    case 't':
      return withScalars([{ type: 'z', wire, phase: PI_QUARTER }])
    case 'rz':
      return withScalars([{ type: 'z', wire, phase: phaseOf(gate.parameter) }])
    case 'rx':
      return withScalars([{ type: 'x', wire, phase: phaseOf(gate.parameter) }])
    case 'ry':
      return withScalars([
        { type: 'z', wire, phase: phaseOf('-pi/2'), text: '-π/2' },
        { type: 'x', wire, phase: phaseOf(gate.parameter), text: gate.parameter ?? '0' },
        { type: 'z', wire, phase: phaseOf('pi/2'), text: 'π/2' },
      ])
    case 'p':
      return withScalars([{ type: 'z', wire, phase: phaseOf(gate.parameter), text: gate.parameter }])
    case 'y':
      return withScalars([{ type: 'x', wire, phase: PI }, { type: 'z', wire, phase: PI }], [NEG_I])
    case 'cx':
      return withScalars([{ type: 'cnot', control, target }])
    case 'cz':
      return withScalars([{ type: 'cz', control, target }])
    case 'swap':
      return withScalars([
        { type: 'cnot', control, target },
        { type: 'cnot', control: target, target: control },
        { type: 'cnot', control, target },
      ])
    case 'measure':
      return withScalars([{ type: 'measure', wire, bit: gate.classicalBit ?? wire }])
    default:
      return { steps: [], numbers: [] }
  }
}

/** The gate a single spider or Hadamard box inserts into the circuit. */
export function gateFromSpider(kind: SpiderKind, phaseText: string): { name: GateName; parameter?: string } | undefined {
  if (kind === 'hadamard') return { name: 'h' }
  if (kind !== 'z' && kind !== 'x') return undefined
  const phase = parsePhase(phaseText || '0')
  if (!phase) {
    const parameter = (phaseText || '0').replaceAll('π', 'pi').replace(/\s+/g, '')
    if (kind === 'z') return parameter === 'pi' ? { name: 'z' } : { name: 'rz', parameter }
    return parameter === 'pi' ? { name: 'x' } : { name: 'rx', parameter }
  }
  if (kind === 'z') {
    if (phasesEqual(phase, PI)) return { name: 'z' }
    if (phasesEqual(phase, PI_HALF)) return { name: 's' }
    if (phasesEqual(phase, PI_QUARTER)) return { name: 't' }
    return { name: 'rz', parameter: qasmAngle(phase) }
  }
  return phasesEqual(phase, PI) ? { name: 'x' } : { name: 'rx', parameter: qasmAngle(phase) }
}

export function gateZxText(name: GateName): string {
  switch (name) {
    case 'h':
      return 'Hadamard box on the wire. The same generator as a Hadamard edge.'
    case 'x':
      return 'X spider with phase π.'
    case 'y':
      return 'X(π) followed by Z(π), with the scalar −i of ZX = iY. Not a generator of its own.'
    case 'z':
      return 'Z spider with phase π.'
    case 's':
      return 'Z spider with phase π/2. The same spider as rz(π/2).'
    case 't':
      return 'Z spider with phase π/4.'
    case 'rx':
      return 'X spider with phase θ.'
    case 'ry':
      return 'Z(−π/2), then an X spider of phase θ, then Z(π/2). The two Z phases are the basis change; θ lives on the X spider.'
    case 'rz':
      return 'Z spider with phase θ.'
    case 'p':
      return 'Z spider with phase θ. The same spider as rz; the global phase that separates Ph from Rz is not stored.'
    case 'cx':
      return 'Z spider on the control wired to an X spider on the target, both of phase 0, with the scalar √2.'
    case 'cz':
      return 'Two Z spiders of phase 0 joined by a Hadamard edge, with the scalar √2.'
    case 'swap':
      return 'Three CNOTs of alternating colours. Not a generator.'
    case 'measure':
      return 'Measurement boundary. The bit is stored on an ordinary wire. The quantum wire is not retyped.'
    default:
      return ''
  }
}

export function spiderKindText(kind: SpiderKind): string {
  switch (kind) {
    case 'z':
      return 'Z spider. Green and white name this colour. There is no third spider colour.'
    case 'x':
      return 'X spider. Red and gray name this colour. There is no third spider colour.'
    case 'hadamard':
      return 'Hadamard box: the same generator as a Hadamard edge.'
    case 'boundary':
      return 'Boundary: the circuit input |0⟩, an open wire, a measurement, an encoding, or a discard.'
    default:
      return ''
  }
}

const boundaryLeg = (node: ZXNode | undefined, edgeId: string, endpoint: string) => {
  if (!node) return `${edgeId}:${endpoint}`
  if (node.kind === 'boundary' && (node.label === '|0⟩' || node.id.startsWith('in-'))) return `in:${node.wire}`
  if (node.kind === 'boundary' && (node.label === '⟩' || node.id.startsWith('out-'))) return `out:${node.wire}`
  return `${edgeId}@${node.id}`
}

const identityTensor = (left: string, right: string): Tensor => ({
  legs: [left, right],
  data: [ONE, ZERO_SCALAR, ZERO_SCALAR, ONE],
})

const hadamardTensor = (left: string, right: string): Tensor => {
  const [row0, row1] = hadamardMatrix()
  return { legs: [left, right], data: [row0[0], row1[0], row0[1], row1[1]] }
}

/**
 * Linear map of a diagram whose boundaries are the circuit's inputs and outputs.
 * Measurement is not part of that map. Qubit 0 is the left ket index.
 */
export function diagramOperator(graph: ZXGraph3D, qubits: number): DiagramScalar[][] | undefined {
  if (graph.nodes.some((node) => classifyNode(node)?.type === 'measure')) return undefined
  const tensor = networkOf(graph, false)
  if (!tensor) return undefined
  return matrixFromTensor(tensor, qubits)
}

/** State of a circuit whose input boundary is |0⟩. */
export function diagramState(graph: ZXGraph3D, qubits: number): DiagramScalar[] | undefined {
  if (graph.nodes.some((node) => classifyNode(node)?.type === 'measure')) return undefined
  const tensor = networkOf(graph, true)
  if (!tensor) return undefined
  return vectorFromTensor(tensor, qubits)
}

function networkOf(graph: ZXGraph3D, plugZeros: boolean): Tensor | undefined {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
  if (graph.nodes.some((node) => classifyNode(node) === undefined)) return undefined
  const tensors: Tensor[] = []
  for (const edge of graph.edges) {
    const source = nodes.get(edge.source)
    const target = nodes.get(edge.target)
    const left = boundaryLeg(source, edge.id, 'source')
    const right = boundaryLeg(target, edge.id, 'target')
    tensors.push(edge.hadamard ? hadamardTensor(left, right) : identityTensor(left, right))
  }
  for (const node of graph.nodes) {
    if (node.kind !== 'z' && node.kind !== 'x' && node.kind !== 'hadamard') continue
    const legs = graph.edges
      .filter((edge) => edge.source === node.id || edge.target === node.id)
      .map((edge) => `${edge.id}@${node.id}`)
    if (node.kind === 'hadamard') {
      const [row0, row1] = hadamardMatrix()
      tensors.push({ legs, data: legs.length === 2 ? [row0[0], row1[0], row0[1], row1[1]] : [ONE] })
      continue
    }
    const phase = parsePhase(node.phase || '0') ?? ZERO
    const data = spiderData(node.kind, phase, legs.length).map((entry) => mulScalar(entry, node.number ?? ONE))
    tensors.push({ legs, data })
  }
  if (plugZeros) {
    for (let qubit = 0; qubit < graph.nodes.filter((node) => node.id.startsWith('in-')).length; qubit += 1) {
      tensors.push({ legs: [`in:${qubit}`], data: ketZero() })
    }
  }
  let scalarProduct = ONE
  for (const number of graph.numbers ?? []) scalarProduct = mulScalar(scalarProduct, number)
  const contracted = contractNetwork(tensors)
  return { legs: contracted.legs, data: contracted.data.map((entry) => mulScalar(entry, scalarProduct)) }
}
