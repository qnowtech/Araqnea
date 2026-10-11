import type { CircuitGate, GateName } from '../types/circuit'

export type AngleUnit = 'degrees' | 'radians'

const numberPattern = String.raw`(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?`
const atomPattern = `(?:pi|tau|${numberPattern})`
const anglePattern = new RegExp(`^[+-]?${atomPattern}(?:\\s*[*/+-]\\s*${atomPattern})*$`, 'i')
const tokenPattern = new RegExp(`pi|tau|${numberPattern}|[+*/-]`, 'g')

export function evaluateAngle(expression: string): number | undefined {
  const source = expression.replaceAll('π', 'pi').trim().toLowerCase()
  if (!anglePattern.test(source)) return undefined
  const tokens = source.match(tokenPattern)!
  const value = (token: string) => token === 'pi' ? Math.PI : token === 'tau' ? 2 * Math.PI : Number(token)
  let index = 0
  let sign = 1
  if (tokens[0] === '+' || tokens[0] === '-') sign = tokens[index++] === '-' ? -1 : 1
  let term = sign * value(tokens[index++])
  let total = 0
  while (index < tokens.length) {
    const operator = tokens[index++]
    const next = value(tokens[index++])
    if (operator === '*') term *= next
    else if (operator === '/') term /= next
    else {
      total += term
      term = operator === '-' ? -next : next
    }
  }
  const result = total + term
  return Number.isFinite(result) ? result : undefined
}

export function angleParameter(input: string, unit: AngleUnit): { parameter?: string; error?: string } {
  const expression = input.replaceAll('π', 'pi').trim().toLowerCase()
  const angle = evaluateAngle(expression)
  if (angle === undefined) return { error: 'Enter a finite angle, e.g. 90 degrees or pi/2 radians. Division by zero is not allowed.' }
  if (unit === 'degrees') {
    if (/\b(pi|tau)\b/.test(expression)) return { error: 'For pi or tau expressions, select radians. In degrees, enter a number such as 90.' }
    return { parameter: angle === 0 ? '0' : `${Number(angle.toPrecision(12))}/180*pi` }
  }
  return { parameter: expression }
}

export function displayAngle(parameter: string, unit: AngleUnit): string {
  if (unit === 'radians') return parameter.replaceAll('π', 'pi')
  const angle = evaluateAngle(parameter)
  return angle === undefined ? parameter : String(Number((angle * 180 / Math.PI).toPrecision(12)))
}

export const parameterizedGates = new Set<GateName>(['rx', 'ry', 'rz', 'p'])

export function editableGateAngle(gate: CircuitGate): { name: GateName; parameter: string } | undefined {
  if (parameterizedGates.has(gate.name)) return { name: gate.name, parameter: gate.parameter ?? '0' }
  switch (gate.name) {
    case 'x': return { name: 'rx', parameter: 'pi' }
    case 'y': return { name: 'ry', parameter: 'pi' }
    case 'z': return { name: 'p', parameter: 'pi' }
    case 's': return { name: 'p', parameter: 'pi/2' }
    case 't': return { name: 'p', parameter: 'pi/4' }
    default: return undefined
  }
}
