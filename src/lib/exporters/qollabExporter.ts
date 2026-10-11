import type { QuantumCircuit } from '../../types/circuit'
import type { ZXGraph3D } from '../../types/zx'

const jsAngle = (parameter: string) => parameter.replace(/\btau\b/gi, '(2 * Math.PI)').replace(/\bpi\b/gi, 'Math.PI')

// Generates Qollab's main.js: plain JS that first draws the gate circuit and the
// ZX spider diagram as styled SVGs (colors live in style.css), then runs the
// circuit with qiskit-js and prints the measurement counts.
export function toQollabJs(circuit: QuantumCircuit, graph?: ZXGraph3D, title = 'Araqnea circuit'): string {
  const operations = circuit.gates.map((gate) => {
    if (gate.name === 'measure') return `circuit.measure(${gate.qubits[0]}, ${gate.classicalBit ?? gate.qubits[0]});`
    const args = gate.parameter ? `${jsAngle(gate.parameter)}, ${gate.qubits.join(', ')}` : gate.qubits.join(', ')
    return `circuit.${gate.name}(${args});`
  }).join('\n')
  const safeTitle = title.replace(/[\r\n]+/g, ' ')
  return `// ${safeTitle} — exported from Araqnea
import { QuantumCircuit } from 'qiskit';

const CIRCUIT_DATA = ${JSON.stringify(circuit)};
const ZX_DATA = ${JSON.stringify(graph ?? { nodes: [], edges: [] })};

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(name, attrs, text) {
  const node = document.createElementNS(SVG_NS, name);
  if (attrs) for (const key in attrs) node.setAttribute(key, String(attrs[key]));
  if (text != null) node.textContent = text;
  return node;
}

function drawCircuit() {
  const host = document.getElementById('circuit');
  if (!host) return;
  const data = CIRCUIT_DATA;
  const subtitle = document.querySelector('.subtitle');
  if (subtitle) subtitle.textContent = data.qubits + ' qubits · ' + data.gates.length + ' gates · exported from Araqnea';
  const rowH = 56;
  const colW = 64;
  const left = 72;
  const top = 32;
  const boxR = 18;
  const wireY = (wire) => top + wire * rowH;
  const cols = Math.max(data.gates.length, 1);
  const rows = data.qubits + (data.classicalBits ? 1 : 0);
  const width = left + cols * colW + 40;
  const height = top * 2 + (rows - 1) * rowH;
  const svg = svgEl('svg', { viewBox: '0 0 ' + width + ' ' + height, class: 'qcircuit', role: 'img' });
  for (let w = 0; w < data.qubits; w += 1) {
    svg.appendChild(svgEl('line', { x1: left - 8, y1: wireY(w), x2: width - 24, y2: wireY(w), class: 'qc-wire' }));
    svg.appendChild(svgEl('text', { x: 8, y: wireY(w) + 4, class: 'qc-wire-label' }, 'q[' + w + ']'));
  }
  if (data.classicalBits) {
    const cy = wireY(data.qubits);
    svg.appendChild(svgEl('line', { x1: left - 8, y1: cy - 2, x2: width - 24, y2: cy - 2, class: 'qc-wire' }));
    svg.appendChild(svgEl('line', { x1: left - 8, y1: cy + 2, x2: width - 24, y2: cy + 2, class: 'qc-wire' }));
    svg.appendChild(svgEl('text', { x: 8, y: cy + 4, class: 'qc-wire-label' }, 'c'));
  }
  const symbols = { h: 'H', x: 'X', y: 'Y', z: 'Z', s: 'S', t: 'T', rx: 'Rx', ry: 'Ry', rz: 'Rz', p: 'Ph', measure: 'M' };
  data.gates.forEach((gate, col) => {
    const x = left + col * colW;
    const wires = gate.qubits;
    if (wires.length > 1) {
      svg.appendChild(svgEl('line', { x1: x, y1: wireY(Math.min.apply(null, wires)), x2: x, y2: wireY(Math.max.apply(null, wires)), class: 'qc-link' }));
    }
    wires.forEach((wire, index) => {
      const y = wireY(wire);
      if (gate.name === 'cx') {
        if (index === 0) {
          svg.appendChild(svgEl('circle', { cx: x, cy: y, r: 5, class: 'qc-ctrl' }));
        } else {
          svg.appendChild(svgEl('circle', { cx: x, cy: y, r: 12, class: 'qc-target' }));
          svg.appendChild(svgEl('line', { x1: x - 12, y1: y, x2: x + 12, y2: y, class: 'qc-target-line' }));
          svg.appendChild(svgEl('line', { x1: x, y1: y - 12, x2: x, y2: y + 12, class: 'qc-target-line' }));
        }
      } else if (gate.name === 'cz') {
        svg.appendChild(svgEl('circle', { cx: x, cy: y, r: 5, class: 'qc-ctrl' }));
      } else if (gate.name === 'swap') {
        svg.appendChild(svgEl('line', { x1: x - 7, y1: y - 7, x2: x + 7, y2: y + 7, class: 'qc-swap' }));
        svg.appendChild(svgEl('line', { x1: x - 7, y1: y + 7, x2: x + 7, y2: y - 7, class: 'qc-swap' }));
      } else {
        svg.appendChild(svgEl('rect', { x: x - boxR, y: y - boxR, width: boxR * 2, height: boxR * 2, rx: 6, class: 'qc-box qc-' + gate.name }));
        svg.appendChild(svgEl('text', { x: x, y: y + 4, class: 'qc-label' }, symbols[gate.name] || gate.name.toUpperCase()));
        if (gate.parameter) svg.appendChild(svgEl('text', { x: x, y: y + boxR + 13, class: 'qc-param' }, gate.parameter));
        if (gate.name === 'measure') {
          const bit = gate.classicalBit != null ? gate.classicalBit : wire;
          if (data.classicalBits) svg.appendChild(svgEl('line', { x1: x, y1: y + boxR, x2: x, y2: wireY(data.qubits), class: 'qc-link' }));
          svg.appendChild(svgEl('text', { x: x, y: y - boxR - 7, class: 'qc-param' }, 'c[' + bit + ']'));
        }
      }
    });
  });
  host.appendChild(svg);
}

function drawZX() {
  const host = document.getElementById('zx');
  if (!host) return;
  const nodes = ZX_DATA.nodes || [];
  const edges = ZX_DATA.edges || [];
  if (!nodes.length) {
    host.textContent = 'Empty diagram.';
    return;
  }
  const pad = 56;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  nodes.forEach((n) => {
    minX = Math.min(minX, n.position.x);
    maxX = Math.max(maxX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxY = Math.max(maxY, n.position.y);
  });
  const width = Math.max(maxX - minX, 1) + pad * 2;
  const height = Math.max(maxY - minY, 1) + pad * 2;
  const px = (n) => n.position.x - minX + pad;
  const py = (n) => maxY - n.position.y + pad;
  const byId = {};
  nodes.forEach((n) => { byId[n.id] = n; });
  const svg = svgEl('svg', { viewBox: '0 0 ' + width + ' ' + height, class: 'zx', role: 'img' });
  edges.forEach((e) => {
    const a = byId[e.source];
    const b = byId[e.target];
    if (!a || !b) return;
    svg.appendChild(svgEl('line', { x1: px(a), y1: py(a), x2: px(b), y2: py(b), class: 'zx-edge' + (e.hadamard ? ' zx-edge-h' : '') }));
  });
  nodes.forEach((n) => {
    const x = px(n);
    const y = py(n);
    if (n.kind === 'hadamard') {
      svg.appendChild(svgEl('rect', { x: x - 10, y: y - 10, width: 20, height: 20, rx: 3, class: 'zx-node zx-h' }));
      svg.appendChild(svgEl('text', { x: x, y: y + 4, class: 'zx-glyph' }, 'H'));
    } else if (n.kind === 'boundary') {
      svg.appendChild(svgEl('circle', { cx: x, cy: y, r: 7, class: 'zx-node zx-b' }));
      if (n.label) svg.appendChild(svgEl('text', { x: x, y: y + 24, class: 'zx-phase' }, n.label));
    } else {
      svg.appendChild(svgEl('circle', { cx: x, cy: y, r: 15, class: 'zx-node zx-' + n.kind }));
      const caption = n.phase && n.phase !== '0' ? n.phase : (n.label || '');
      if (caption) svg.appendChild(svgEl('text', { x: x, y: y + 32, class: 'zx-phase' }, caption));
    }
  });
  host.appendChild(svg);
}

drawCircuit();
drawZX();

const output = document.getElementById('results');
try {
  const circuit = QuantumCircuit(${circuit.qubits}, ${circuit.classicalBits || circuit.qubits});
${operations}
  if (output) output.textContent = 'Running…';
  const job = await backend.run(circuit, { shots: 1000 });
  const counts = (await job.result()).get_counts().toJs();
  console.log(counts);
  if (output) output.textContent = JSON.stringify(counts, null, 2);
} catch (error) {
  if (output) output.textContent = 'Run failed: ' + (error && error.message ? error.message : String(error));
}`
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

// Builds a single self-contained index.html for Qollab: CSS is inlined in a
// <style> tag and the JS in an inline <script type="module">. Qollab serves the
// page from its own origin root, so relative refs like ./style.css or ./main.js
// would resolve to Qollab's own files and never load — everything must inline.
export function toQollabHtml(title = 'Araqnea circuit', css?: string, js?: string): string {
  const safe = escapeHtml(title)
  const styleBlock = css == null ? '    <link rel="stylesheet" href="./style.css" />' : `    <style>\n${css}\n    </style>`
  const scriptBlock = js == null ? '    <script type="module" src="./main.js"></script>' : `    <script type="module">\n${js}\n    </script>`
  return [
    '<!doctype html>',
    '<html lang="en">',
    '  <head>',
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `    <title>${safe}</title>`,
    styleBlock,
    '  </head>',
    '  <body>',
    '    <main>',
    '      <header>',
    `        <h1>${safe}</h1>`,
    '        <p class="subtitle">Exported from Araqnea</p>',
    '      </header>',
    '      <section aria-label="Gate circuit">',
    '        <h2>Gate circuit</h2>',
    '        <div id="circuit" class="canvas"></div>',
    '      </section>',
    '      <section aria-label="ZX spider diagram">',
    '        <h2>ZX spiders</h2>',
    '        <p class="legend"><span><span class="dot z"></span>Z spider</span><span><span class="dot x"></span>X spider</span><span><span class="dot h"></span>Hadamard</span><span><span class="dot b"></span>Boundary</span></p>',
    '        <div id="zx" class="canvas"></div>',
    '      </section>',
    '      <section aria-label="Measurement results">',
    '        <h2>Measurement counts <span class="muted">(1000 shots)</span></h2>',
    '        <pre id="results">Preparing…</pre>',
    '      </section>',
    '    </main>',
    scriptBlock,
    '  </body>',
    '</html>',
  ].join('\n')
}

// The single-file Qollab project: index.html with CSS + JS inlined. This is the
// only file the Export modal offers for the "qollab" format.
export function toQollabBundle(circuit: QuantumCircuit, graph?: ZXGraph3D, title = 'Araqnea circuit'): string {
  return toQollabHtml(title, toQollabCss(), toQollabJs(circuit, graph, title))
}

export function toQollabCss(): string {
  return `:root {
  color-scheme: dark;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: #e8edf5;
  background: #080d17;
  line-height: 1.5;
}

main {
  max-width: 880px;
  margin: 0 auto;
  padding: 2rem 1.25rem 3rem;
}

header h1 {
  margin: 0;
  color: #65e8ce;
  font-size: 1.75rem;
}

.subtitle {
  margin: 0.25rem 0 0;
  color: #9eb5c7;
  font-size: 0.95rem;
}

section {
  margin-top: 1.75rem;
  padding: 1.25rem;
  border: 1px solid #253246;
  border-radius: 12px;
  background: #0b111d;
}

h2 {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
}

.muted {
  color: #9eb5c7;
  font-weight: 400;
  font-size: 0.85rem;
}

.canvas {
  overflow-x: auto;
  padding: 0.5rem 0;
}

/* Gate circuit SVG */
.qcircuit {
  display: block;
  min-width: 480px;
  max-width: 100%;
  height: auto;
}

.qc-wire {
  stroke: #79a1b9;
  stroke-width: 1.5;
}

.qc-wire-label {
  fill: #9eb5c7;
  font-family: ui-monospace, 'SF Mono', monospace;
  font-size: 12px;
}

.qc-box {
  fill: #101a2c;
  stroke: #65e8ce;
  stroke-width: 1.5;
}

.qc-measure {
  stroke: #f8b84e;
}

.qc-label {
  fill: #e8edf5;
  font-family: system-ui, sans-serif;
  font-weight: 600;
  font-size: 14px;
  text-anchor: middle;
}

.qc-param {
  fill: #83f0d7;
  font-family: ui-monospace, monospace;
  font-size: 10px;
  text-anchor: middle;
}

.qc-link {
  stroke: #79a1b9;
  stroke-width: 2;
}

.qc-ctrl {
  fill: #65e8ce;
}

.qc-target {
  fill: none;
  stroke: #65e8ce;
  stroke-width: 2;
}

.qc-target-line {
  stroke: #65e8ce;
  stroke-width: 2;
}

.qc-swap {
  stroke: #65e8ce;
  stroke-width: 2.5;
  stroke-linecap: round;
}

/* ZX spider SVG */
.zx {
  display: block;
  min-width: 480px;
  max-width: 100%;
  height: auto;
}

.zx-edge {
  stroke: #79a1b9;
  stroke-width: 2;
}

.zx-edge-h {
  stroke: #f8b84e;
  stroke-dasharray: 6 4;
}

.zx-node {
  stroke: #080d17;
  stroke-width: 2;
}

.zx-z {
  fill: #10b981;
}

.zx-x {
  fill: #ef4444;
}

.zx-h {
  fill: #f59e0b;
}

.zx-b {
  fill: #9eb5c7;
}

.zx-glyph {
  fill: #080d17;
  font-family: system-ui, sans-serif;
  font-weight: 700;
  font-size: 11px;
  text-anchor: middle;
}

.zx-phase {
  fill: #e8edf5;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  text-anchor: middle;
}

/* Legend + results */
.legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 1.1rem;
  margin: 0 0 0.5rem;
  color: #9eb5c7;
  font-size: 0.85rem;
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 0.35rem;
  border-radius: 50%;
}

.dot.z { background: #10b981; }
.dot.x { background: #ef4444; }
.dot.h { background: #f59e0b; border-radius: 2px; }
.dot.b { background: #9eb5c7; }

#results {
  margin: 0;
  padding: 1rem;
  border: 1px solid #253246;
  border-radius: 8px;
  background: #080d17;
  color: #e8edf5;
  font-family: ui-monospace, 'SF Mono', monospace;
  font-size: 0.85rem;
  white-space: pre-wrap;
  min-height: 3rem;
}`
}
