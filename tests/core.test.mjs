import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const output = mkdtempSync(join(tmpdir(), 'araqnea-tests-'))
after(() => rmSync(output, { recursive: true, force: true }))
const program = ts.createProgram([
  'src/data/examples.ts',
  'src/lib/angles.ts',
  'src/lib/sync/circuitSync.ts',
  'src/lib/exporters/circuitExporters.ts',
  'src/lib/exporters/qollabExporter.ts',
], {
  target: ts.ScriptTarget.ES2022,
  // CJS so the extensionless relative requires resolve in Node. The
  // `import { QuantumCircuit } from 'qiskit'` becomes require('qiskit'), which
  // resolves against the stub package written into the output below; the
  // wrapper only executes when runWithQollabBackend actually runs on Qollab.
  module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.Node10,
  ignoreDeprecations: '6.0',
  rootDir: resolve('src'),
  outDir: output,
  strict: true,
  skipLibCheck: true,
  noEmitOnError: true,
})
const diagnostics = ts.getPreEmitDiagnostics(program)
assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCurrentDirectory: () => process.cwd(),
  getCanonicalFileName: (file) => file,
  getNewLine: () => '\n',
}))
assert.equal(program.emit().emitSkipped, false)
// Stub the 'qiskit' package the Qollab runtime provides, so the emitted
// require('qiskit') resolves when the module is loaded. It is never called:
// the tests only exercise the pure exporters, not runWithQollabBackend.
mkdirSync(join(output, 'node_modules/qiskit'), { recursive: true })
writeFileSync(join(output, 'node_modules/qiskit/package.json'), JSON.stringify({ name: 'qiskit', main: 'index.js' }))
writeFileSync(join(output, 'node_modules/qiskit/index.js'), 'module.exports = { QuantumCircuit: class {} };\n')
const require = createRequire(import.meta.url)
const { evaluateAngle, angleParameter, displayAngle, editableGateAngle } = require(join(output, 'lib/angles.js'))
const { parseQasm } = require(join(output, 'lib/parsers/qasm2Parser.js'))
const { translateCircuit } = require(join(output, 'lib/zx-core/translator.js'))
const { validateSync, gateForSpider } = require(join(output, 'lib/sync/circuitSync.js'))
const { toQasm, toQasm3, toQiskitPython, toPennyLane } = require(join(output, 'lib/exporters/circuitExporters.js'))
const { toQollabJs } = require(join(output, 'lib/exporters/qollabExporter.js'))
const { circuitPresets } = require(join(output, 'data/examples.js'))

const circuitWith = (operation) => parseQasm(`OPENQASM 2.0; include "qelib1.inc"; qreg q[2]; ${operation};`).circuit
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`)

test('degrees convert to radians exactly once, with negatives, decimals and zero', () => {
  for (const degrees of [0, 45, 90, 180, 360, -90, 22.5, 0.00000001]) {
    const converted = angleParameter(String(degrees), 'degrees')
    assert.equal(converted.error, undefined)
    close(evaluateAngle(converted.parameter), degrees * Math.PI / 180)
    close(Number(displayAngle(converted.parameter, 'degrees')), degrees)
    assert.ok(circuitWith(`ry(${converted.parameter}) q[0]`))
  }
  close(evaluateAngle('pi/2+pi/4*2'), Math.PI)
  close(evaluateAngle('-tau/4'), -Math.PI / 2)
  close(evaluateAngle('1e-3'), 0.001)
  assert.equal(angleParameter('π/2', 'radians').parameter, 'pi/2')
  assert.equal(circuitWith('rz(PI/2) q[0]').gates[0].parameter, 'pi/2')
  assert.equal(circuitWith('rz(π/2) q[0]').gates[0].parameter, 'pi/2')
  assert.ok(angleParameter('pi/2', 'degrees').error)
})

test('invalid and non-finite angles produce explicit errors without a circuit', () => {
  for (const input of ['', 'abc', '90deg', '1/0', 'pi/0', '1e309', '1++2', 'alert(1)']) {
    assert.ok(angleParameter(input, 'radians').error, input)
    assert.ok(parseQasm(`qreg q[1]; rz(${input}) q[0];`).error, input)
  }
  assert.ok(parseQasm('qreg q[1]; z() q[0];').error)
})

test('fixed X/Y/Z/S/T map to the proper rotation or phase shift; composites stay fixed', () => {
  const expected = { x: ['rx', 'pi'], y: ['ry', 'pi'], z: ['p', 'pi'], s: ['p', 'pi/2'], t: ['p', 'pi/4'] }
  for (const [name, [mapped, parameter]] of Object.entries(expected)) {
    assert.deepEqual(editableGateAngle({ name }), { name: mapped, parameter })
  }
  for (const name of ['cx', 'cz', 'swap', 'h', 'measure']) assert.equal(editableGateAngle({ name }), undefined)
})

test('Ph uses u1 in OpenQASM 2, p in OpenQASM 3/Qiskit, and PhaseShift in PennyLane', () => {
  const circuit = circuitWith('u1(pi/2) q[0]')
  assert.equal(circuit.gates[0].name, 'p')
  assert.match(toQasm(circuit), /u1\(pi\/2\) q\[0\]/)
  assert.match(toQasm3(circuit), /p\(pi\/2\) q\[0\]/)
  assert.match(toQiskitPython(circuit), /qc\.p\(pi\/2, 0\)/)
  assert.match(toPennyLane(circuit), /qml\.PhaseShift\(np\.pi\/2, wires=0\)/)
  const qollabJs = toQollabJs(circuit, translateCircuit(circuit))
  assert.match(qollabJs, /circuit\.p\(Math\.PI\/2, 0\)/)
  assert.match(qollabJs, /drawCircuit\(\);\ndrawZX\(\);/)
  assert.match(qollabJs, /const ZX_DATA = \{"nodes":\[/)
  const node = { custom: true, symbol: 'z-phase', kind: 'z', phase: 'π/3' }
  assert.deepEqual(gateForSpider(node), { name: 'p', parameter: 'pi/3' })
})

test('Ry has a central editable X rotation and distinct fixed Z basis-change nodes', () => {
  const circuit = circuitWith('ry(pi/3) q[0]')
  const graph = translateCircuit(circuit)
  const nodes = graph.nodes.filter((node) => node.gateId === 'g0')
  assert.deepEqual(nodes.map((node) => [node.kind, node.phase]), [['z', '-π/2'], ['x', 'pi/3'], ['z', 'π/2']])
  assert.equal(new Set(graph.nodes.map((node) => node.id)).size, graph.nodes.length)
  assert.equal(validateSync(circuit, graph).ok, true)
  assert.match(toQiskitPython(circuit), /qc\.ry\(pi\/3, 0\)/)
  assert.match(toPennyLane(circuit), /qml\.RY\(np\.pi\/3, wires=0\)/)
  // Rz(pi/2) Rx(theta) Rz(-pi/2) = Ry(theta), in wire order.
  const theta = evaluateAngle(nodes[1].phase)
  const complexMultiply = ([ar, ai], [br, bi]) => [ar * br - ai * bi, ar * bi + ai * br]
  const before = nodes[0].phase
  const last = nodes[2].phase
  const zPhase = (phase, basis) => {
    const angle = (basis ? 1 : -1) * evaluateAngle(phase) / 2
    return [Math.cos(angle), Math.sin(angle)]
  }
  for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
    const rx = row === column ? [Math.cos(theta / 2), 0] : [0, -Math.sin(theta / 2)]
    const value = complexMultiply(zPhase(last, row), complexMultiply(rx, zPhase(before, column)))
    close(value[0], row === column ? Math.cos(theta / 2) : (row === 0 ? -1 : 1) * Math.sin(theta / 2))
    close(value[1], 0)
  }
})

test('every preset parses, round-trips, syncs and exports to both Python frameworks', () => {
  assert.equal(circuitPresets.length, 8)
  for (const preset of circuitPresets) {
    const result = parseQasm(preset.source)
    assert.equal(result.error, undefined, preset.name)
    const circuit = result.circuit
    assert.equal(validateSync(circuit, translateCircuit(circuit)).ok, true, preset.name)
    assert.deepEqual(parseQasm(toQasm(circuit)).circuit, circuit)
    assert.match(toQiskitPython(circuit), /from qiskit import QuantumCircuit/)
    assert.match(toPennyLane(circuit), /@qml.qnode\(dev\)/)
  }
})

test('ansatz and template decompositions have the documented layers and entanglement', () => {
  const gatesFor = (name) => parseQasm(circuitPresets.find((preset) => preset.name === name).source).circuit.gates
  assert.equal(gatesFor('RealAmplitudes').filter((gate) => gate.name === 'ry').length, 6)
  assert.equal(gatesFor('EfficientSU2').filter((gate) => gate.name === 'rz').length, 6)
  assert.equal(gatesFor('AngleEmbedding').length, 3)
  const basic = gatesFor('BasicEntanglerLayers')
  assert.equal(basic.filter((gate) => gate.name === 'rx').length, 6)
  assert.deepEqual(basic.filter((gate) => gate.name === 'cx').map((gate) => gate.qubits), [[0, 1], [1, 2], [2, 0], [0, 1], [1, 2], [2, 0]])
  const strong = gatesFor('StronglyEntanglingLayers')
  assert.equal(strong.length, 24)
  assert.deepEqual(strong.filter((gate) => gate.name === 'cx').map((gate) => gate.qubits), [[0, 1], [1, 2], [2, 0], [0, 2], [1, 0], [2, 1]])
})
