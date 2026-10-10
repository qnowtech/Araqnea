import type { QuantumCircuit } from '../../types/circuit'

const jsAngle = (parameter: string) => parameter.replace(/\btau\b/gi, '(2 * Math.PI)').replace(/\bpi\b/gi, 'Math.PI')

export function toQollabJs(circuit: QuantumCircuit, title = 'Araqnea circuit'): string {
  const operations = circuit.gates.map((gate) => {
    if (gate.name === 'measure') return `circuit.measure(${gate.qubits[0]}, ${gate.classicalBit ?? gate.qubits[0]});`
    const args = gate.parameter ? `${jsAngle(gate.parameter)}, ${gate.qubits.join(', ')}` : gate.qubits.join(', ')
    return `circuit.${gate.name}(${args});`
  }).join('\n')
  return `// ${title} — exported from Araqnea\nimport { QuantumCircuit } from 'qiskit';\n\nconst circuit = QuantumCircuit(${circuit.qubits}, ${circuit.classicalBits || circuit.qubits});\n${operations}\n\nconst output = document.getElementById('results');\noutput.textContent = 'Running…';\nconst job = await backend.run(circuit, { shots: 1000 });\nconst counts = (await job.result()).get_counts().toJs();\nconsole.log(counts);\noutput.textContent = JSON.stringify(counts, null, 2);`
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

export function toQollabHtml(title = 'Araqnea circuit'): string {
  const safe = escapeHtml(title)
  return `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>${safe}</title>\n    <link rel="stylesheet" href="./style.css" />\n  </head>\n  <body>\n    <main>\n      <h1>${safe}</h1>\n      <p>Measurement counts (1000 shots):</p>\n      <pre id="results"></pre>\n    </main>\n    <script type="module" src="./main.js"></script>\n  </body>\n</html>`
}

export function toQollabCss(): string {
  return `body {\n  margin: 0;\n  font-family: system-ui, sans-serif;\n  color: #e8edf5;\n  background: #080d17;\n}\n\nmain {\n  max-width: 720px;\n  margin: 0 auto;\n  padding: 2rem;\n}\n\nh1 {\n  color: #65e8ce;\n}\n\n#results {\n  padding: 1rem;\n  border: 1px solid #253246;\n  border-radius: 8px;\n  background: #0b111d;\n  font-family: ui-monospace, monospace;\n}`
}
