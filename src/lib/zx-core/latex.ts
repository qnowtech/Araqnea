import type { DiagramScalar, ZXGraph3D, ZXNode } from '../../types/zx'
import {
  ONE,
  ZERO,
  ZERO_SCALAR,
  conjScalar,
  hadamardMatrix,
  mulScalar,
  parsePhase,
  phaseFromTurns,
  phaseScalar,
  phasesEqual,
  sameScalar,
  scalar,
  scalarSpider,
  spiderMap,
  type Phase,
  type SpiderColor,
} from './semantics'
import { denote, type Denotation } from './validate'

/** The map of BL-0 and the number of BL-1, written with the book's word. The professional name is that same equality. */
export interface Formula {
  latex: string
  map: DiagramScalar[][]
  number: DiagramScalar
  inputs: number
  outputs: number
  prose: string
  profession: string
}

export interface ClosedNumber {
  value: DiagramScalar
  latex: string
  probability: DiagramScalar
  probabilityLatex: string
}

const bookName: Record<string, string> = {
  'caja de cambio de color': 'compuerta de Hadamard',
  'taza cuántica': 'estado de Bell',
  seguro: 'causal',
  'tal vez': 'postseleccionado',
  'con fugas': 'mixto, abierto',
  'sin fugas': 'puro, cerrado',
  ruido: 'ruido',
  'araña Z': 'araña Z',
  'araña X': 'araña X',
  araña: 'araña',
  tapa: 'postseleccionado',
}

const named = (prose: string) => ({ prose, profession: bookName[prose] ?? prose })

const near = (left: number, right: number) => Math.abs(left - right) <= 1e-8

const bitsOf = (index: number, width: number) => (width === 0 ? '' : index.toString(2).padStart(width, '0'))

const divScalar = (left: DiagramScalar, right: DiagramScalar): DiagramScalar => {
  const norm = right.re * right.re + right.im * right.im
  if (norm === 0) return ZERO_SCALAR
  return scalar((left.re * right.re + left.im * right.im) / norm, (left.im * right.re - left.re * right.im) / norm)
}

const phaseLatex = (phase: Phase): string => {
  const turns = phase.turns
  if (!turns || turns.num === 0) return '0'
  const pi = turns.den === 1 ? '\\pi' : `\\pi/${turns.den}`
  return turns.num === 1 ? pi : `${turns.num}${pi}`
}

const gaussianLatex = (re: number, im: number): string => {
  if (re === 0 && im === 0) return '0'
  if (re === 0 && im === 1) return 'i'
  if (re === 0 && im === -1) return '-i'
  if (im === 0) return String(re)
  if (re === 0) return `${im}i`
  const imag = im === 1 ? '+i' : im === -1 ? '-i' : im > 0 ? `+${im}i` : `${im}i`
  return `${re}${imag}`
}

const asPhase = (value: DiagramScalar): string | undefined => {
  const magnitude = Math.hypot(value.re, value.im)
  if (!near(magnitude, 1)) return undefined
  for (let den = 1; den <= 12; den += 1) {
    for (let num = 0; num < den * 2; num += 1) {
      const phase = phaseFromTurns(num, den)
      if (!sameScalar(phaseScalar(phase), value, 1e-8)) continue
      if (num === 0) return '1'
      return `e^{i${phaseLatex(phase)}}`
    }
  }
  return undefined
}

const asScaled = (value: DiagramScalar): string | undefined => {
  const scales = [
    { mult: 1, den: '' },
    { mult: 2, den: '2' },
    { mult: 4, den: '4' },
    { mult: Math.SQRT2, den: '\\sqrt{2}' },
    { mult: 2 * Math.SQRT2, den: '2\\sqrt{2}' },
  ]
  for (const scale of scales) {
    const re = Math.round(value.re * scale.mult)
    const im = Math.round(value.im * scale.mult)
    if (Math.abs(re) > 6 || Math.abs(im) > 6) continue
    if (!near(value.re * scale.mult, re) || !near(value.im * scale.mult, im)) continue
    const num = gaussianLatex(re, im)
    if (!scale.den) return num
    if (num === '1') return `1/${scale.den}`
    if (num === '-1') return `-1/${scale.den}`
    if (num === '2' && scale.den === '\\sqrt{2}') return '\\sqrt{2}'
    if (num === '-2' && scale.den === '\\sqrt{2}') return `-\\sqrt{2}`
    const wrapped = im === 0 ? num : `(${num})`
    return `${wrapped}/${scale.den}`
  }
  return undefined
}

/** Angles stay in π. A decimal is left for a state that BL-2 calculates. */
const exactLatex = (value: DiagramScalar, style: 'short' | 'phase'): string => {
  if (sameScalar(value, ZERO_SCALAR, 1e-8)) return '0'
  if (style === 'phase') {
    const phased = asPhase(value)
    if (phased) return phased
  }
  return asScaled(value) ?? asPhase(value) ?? '0'
}

const unit = (value: DiagramScalar): DiagramScalar | undefined =>
  [ONE, scalar(-1), scalar(0, 1), scalar(0, -1)].find((option) => sameScalar(option, value, 1e-8))

const signed = (coeff: DiagramScalar, body: string, first: boolean): string => {
  const lead = exactLatex(unit(coeff) ?? coeff, 'short')
  if (lead === '0') return ''
  if (lead === '1') return `${first ? '' : '+'}${body}`
  if (lead === '-1') return `-${body}`
  if (lead.startsWith('-') || lead.startsWith('e^{')) return `${first || lead.startsWith('-') ? '' : '+'}${lead}${body}`
  return `${first ? '' : '+'}${lead}${body}`
}

const applyFactor = (factor: DiagramScalar, expr: string, many: boolean): string => {
  if (sameScalar(factor, ONE, 1e-8)) return expr
  const lead = exactLatex(factor, 'short')
  const group = many ? `(${expr})` : expr
  if (lead === '1/\\sqrt{2}') return `${group}/\\sqrt{2}`
  if (lead === '-1/\\sqrt{2}') return `-${group}/\\sqrt{2}`
  if (lead === '1/2') return `${group}/2`
  if (lead === '-1/2') return `-${group}/2`
  if (lead === '-1') return `-${group}`
  return `${lead}${group}`
}

const diracKet = (amplitudes: DiagramScalar[]): string => {
  const qubits = amplitudes.length <= 1 ? 0 : Math.round(Math.log2(amplitudes.length))
  const terms = amplitudes.flatMap((amp, index) => (sameScalar(amp, ZERO_SCALAR, 1e-8) ? [] : [{ amp, bits: bitsOf(index, qubits) }]))
  if (!terms.length) return '0'
  if (qubits === 0) return exactLatex(terms[0].amp, 'short')
  const factor = terms[0].amp
  const coeffs = terms.map((term) => divScalar(term.amp, factor))
  if (coeffs.every((coeff) => unit(coeff))) {
    const expr = coeffs.map((coeff, index) => signed(coeff, `|${terms[index].bits}\\rangle`, index === 0)).join('')
    return applyFactor(factor, expr, terms.length > 1)
  }
  return terms.map((term, index) => signed(term.amp, `|${term.bits}\\rangle`, index === 0)).join('')
}

const diracBra = (amplitudes: DiagramScalar[]): string => {
  const qubits = amplitudes.length <= 1 ? 0 : Math.round(Math.log2(amplitudes.length))
  const terms = amplitudes.flatMap((amp, index) => (sameScalar(amp, ZERO_SCALAR, 1e-8) ? [] : [{ amp, bits: bitsOf(index, qubits) }]))
  if (!terms.length) return '0'
  return terms.map((term, index) => signed(term.amp, `\\langle ${term.bits}|`, index === 0)).join('')
}

const diracOperator = (map: DiagramScalar[][]): string => {
  const rows = map.length
  const cols = map[0]?.length ?? 0
  if (rows === 0 || cols === 0) return ''
  if (rows === 1 && cols === 1) return exactLatex(map[0][0], 'short')
  const outputs = rows === 1 ? 0 : Math.round(Math.log2(rows))
  const inputs = cols === 1 ? 0 : Math.round(Math.log2(cols))
  if (inputs === 0) return diracKet(map.map((row) => row[0] ?? ZERO_SCALAR))
  if (outputs === 0) return diracBra(map[0] ?? [])
  const terms = map.flatMap((row, out) => row.flatMap((amp, inn) => (
    sameScalar(amp, ZERO_SCALAR, 1e-8) ? [] : [{ amp, body: `|${bitsOf(out, outputs)}\\rangle\\langle ${bitsOf(inn, inputs)}|` }]
  )))
  return terms.map((term, index) => signed(term.amp, term.body, index === 0)).join('')
}

const spiderWords = (color: SpiderColor, phase: Phase, inputs: number, outputs: number) => {
  if (color === 'z' && inputs === 0 && outputs === 2 && phasesEqual(phase, ZERO)) return named('taza cuántica')
  if (color === 'z' && inputs === 2 && outputs === 0 && phasesEqual(phase, ZERO)) return named('tapa')
  return named(color === 'z' ? 'araña Z' : 'araña X')
}

const generatorLatex = (color: SpiderColor, phase: Phase, inputs: number, outputs: number): string => {
  if (inputs + outputs === 0) return exactLatex(scalarSpider(phase), 'short')
  if (inputs > 0 && outputs > 0) {
    const factor = phasesEqual(phase, ZERO) ? '' : `e^{i${phaseLatex(phase)}}`
    if (color === 'z') return `|0\\dots 0\\rangle\\langle 0\\dots 0| + ${factor}|1\\dots 1\\rangle\\langle 1\\dots 1|`
    return `|+\\dots +\\rangle\\langle +\\dots +| + ${factor}|-\\dots -\\rangle\\langle -\\dots -|`
  }
  const spec = spiderMap(color, phase, inputs, outputs)
  const rows = outputs === 0 ? 1 : 1 << outputs
  const cols = inputs === 0 ? 1 : 1 << inputs
  const map = Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, column) => {
    let index = 0
    for (let qubit = 0; qubit < inputs; qubit += 1) index |= ((column >> (inputs - 1 - qubit)) & 1) << qubit
    for (let qubit = 0; qubit < outputs; qubit += 1) index |= ((row >> (outputs - 1 - qubit)) & 1) << (inputs + qubit)
    return spec.map[index] ?? ZERO_SCALAR
  }))
  return inputs === 0 ? diracKet(map.map((row) => row[0])) : diracOperator(map)
}

const HADAMARD = '\\frac{1}{\\sqrt{2}}\\left(|0\\rangle\\langle 0| + |0\\rangle\\langle 1| + |1\\rangle\\langle 0| - |1\\rangle\\langle 1|\\right)'

const arityOf = (graph: ZXGraph3D, id: string) => {
  let inputs = 0
  let outputs = 0
  for (const edge of graph.edges) {
    if (edge.target === id) inputs += 1
    if (edge.source === id) outputs += 1
  }
  return { inputs, outputs }
}

const isNakedCup = (graph: ZXGraph3D) => {
  const spiders = graph.nodes.filter((node) => node.kind === 'z' || node.kind === 'x' || node.kind === 'hadamard')
  if (spiders.length !== 1 || spiders[0].kind !== 'z') return false
  const phase = parsePhase(spiders[0].phase || '0')
  if (!phase || !phasesEqual(phase, ZERO)) return false
  if ((graph.numbers ?? []).some((value) => !sameScalar(value, ONE))) return false
  const outputs = graph.edges.filter((edge) => edge.source === spiders[0].id).length
  const inputs = graph.edges.filter((edge) => edge.target === spiders[0].id).length
  return inputs === 0 && outputs === 2
}

const diagramWords = (graph: ZXGraph3D, report: Denotation) => {
  if (isNakedCup(graph)) return named('taza cuántica')
  if (report.mark === 'seguro') return named('seguro')
  if (report.mark === 'tal vez') return named('tal vez')
  if (report.mark === 'fugas') return named('con fugas')
  if (report.mark === 'ruido') return named('ruido')
  if (report.pure) return named('sin fugas')
  return named('araña')
}

const hidesPhase = (report: Denotation) => {
  if (!report.state || report.inputs === 0) return false
  const nonzero = report.state.filter((entry) => !sameScalar(entry, ZERO_SCALAR, 1e-8))
  return nonzero.length === 1 && nonzero[0].re > 0 && near(nonzero[0].im, 0)
}

const compositionNotes = (graph: ZXGraph3D): string[] => {
  const factors = (graph.numbers ?? [])
    .filter((value) => !sameScalar(value, ONE, 1e-8) && !near(value.im, 0))
    .map((value) => exactLatex(value, 'phase'))
  const phases = graph.nodes.flatMap((node) => {
    if (node.kind !== 'z' && node.kind !== 'x') return []
    const phase = parsePhase(node.phase || '0')
    if (!phase || phasesEqual(phase, ZERO)) return []
    return [phaseLatex(phase)]
  })
  return [...factors, ...phases]
}

const diagramLatex = (graph: ZXGraph3D, report: Denotation): string => {
  if (report.inputs === 0 && report.outputs === 0) return exactLatex(report.map[0]?.[0] ?? ONE, 'short')
  const body = report.state && !hidesPhase(report) ? diracKet(report.state) : diracOperator(report.map)
  const notes = compositionNotes(graph)
  return notes.length ? `${notes.join(' \\cdot ')} \\cdot ${body}` : body
}

const blank = (prose: string): Formula => ({
  latex: '',
  map: [],
  number: ONE,
  inputs: 0,
  outputs: 0,
  prose,
  profession: prose,
})

const fromNode = (graph: ZXGraph3D, node: ZXNode): Formula => {
  if (node.kind === 'hadamard') {
    const words = named('caja de cambio de color')
    return { latex: HADAMARD, map: hadamardMatrix(), number: node.number ?? ONE, inputs: 1, outputs: 1, ...words }
  }
  if (node.kind !== 'z' && node.kind !== 'x') return blank('araña')
  const phase = parsePhase(node.phase || '0') ?? ZERO
  const { inputs, outputs } = arityOf(graph, node.id)
  const spec = spiderMap(node.kind, phase, inputs, outputs)
  const rows = outputs === 0 ? 1 : 1 << Math.max(outputs, 0)
  const cols = inputs === 0 ? 1 : 1 << Math.max(inputs, 0)
  const map = Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, column) => {
    let index = 0
    for (let qubit = 0; qubit < inputs; qubit += 1) index |= ((column >> (inputs - 1 - qubit)) & 1) << qubit
    for (let qubit = 0; qubit < outputs; qubit += 1) index |= ((row >> (outputs - 1 - qubit)) & 1) << (inputs + qubit)
    return mulScalar(spec.map[index] ?? ZERO_SCALAR, node.number && inputs + outputs === 1 ? divScalar(node.number, spec.number) : ONE)
  }))
  const words = spiderWords(node.kind, phase, inputs, outputs)
  const number = inputs + outputs === 0 ? (map[0]?.[0] ?? ONE) : (node.number ?? spec.number)
  return { latex: generatorLatex(node.kind, phase, inputs, outputs), map, number, inputs, outputs, ...words }
}

/**
 * Formula of one generator, or of the whole diagram when no node is chosen.
 * Measurement stays out of the formula: the map is the one from before the stored bit.
 */
export function explain(graph: ZXGraph3D, nodeId?: string): Formula {
  if (nodeId) {
    const node = graph.nodes.find((item) => item.id === nodeId)
    if (!node) return blank('This node is not in the diagram.')
    return fromNode(graph, node)
  }
  const report = denote(graph)
  if (!report.wellFormed) return blank(report.reason ?? 'The diagram is not well formed.')
  const words = diagramWords(graph, report)
  return {
    latex: diagramLatex(graph, report),
    map: report.map,
    number: report.number,
    inputs: report.inputs,
    outputs: report.outputs,
    ...words,
  }
}

export function sameFormula(left: Formula, right: Formula): boolean {
  return sameScalar(left.number, right.number) && left.map.length === right.map.length && left.map.every((row, index) => {
    const other = right.map[index] ?? []
    return row.length === other.length && row.every((entry, column) => sameScalar(entry, other[column] ?? ZERO_SCALAR))
  })
}

/** Modulus squared of an amplitude. */
export function probability(value: DiagramScalar): DiagramScalar {
  return mulScalar(conjScalar(value), value)
}

/**
 * An amplitude is the number of a state closed with a test.
 * The probability is the modulus squared of that amplitude.
 */
export function amplitude(state: ZXGraph3D, test: ZXGraph3D): ClosedNumber | undefined {
  const prepared = denote(state)
  const effect = denote(test)
  if (!prepared.wellFormed || !effect.wellFormed || !prepared.state) return undefined
  if (effect.outputs !== 0 || effect.inputs !== prepared.outputs) return undefined
  const row = effect.map[0] ?? []
  const value = prepared.state.reduce(
    (sum, entry, index) => ({ re: sum.re + (row[index]?.re ?? 0) * entry.re - (row[index]?.im ?? 0) * entry.im, im: sum.im + (row[index]?.re ?? 0) * entry.im + (row[index]?.im ?? 0) * entry.re }),
    ZERO_SCALAR,
  )
  const weight = probability(value)
  return { value, latex: exactLatex(value, 'short'), probability: weight, probabilityLatex: exactLatex(weight, 'short') }
}

/** What remains after discarding the state's output. A safe state weighs 1. */
export function stateProbability(graph: ZXGraph3D): { value: DiagramScalar; latex: string } | undefined {
  const report = denote(graph)
  if (report.closed === undefined) return undefined
  return { value: report.closed, latex: exactLatex(report.closed, 'short') }
}
