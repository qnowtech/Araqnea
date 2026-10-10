import { useMemo, useState } from 'react'
import { examples } from './data/examples'
import { toQollabJs } from './lib/exporters/qollabExporter'
import { parseQasm } from './lib/parsers/qasm2Parser'
import { translateCircuit } from './lib/zx-core/translator'
import type { GateName } from './types/circuit'

const palette: { name: GateName; label: string }[] = [
  { name: 'h', label: 'H' }, { name: 'x', label: 'X' }, { name: 'z', label: 'Z' },
  { name: 's', label: 'S' }, { name: 't', label: 'T' }, { name: 'rx', label: 'Rx' },
  { name: 'rz', label: 'Rz' }, { name: 'cx', label: 'CNOT' }, { name: 'cz', label: 'CZ' },
]

function App() {
  const [source, setSource] = useState<string>(examples['Bell state'])
  const [selected, setSelected] = useState<string>()
  const [showExport, setShowExport] = useState(false)
  const result = useMemo(() => parseQasm(source), [source])
  const graph = useMemo(() => result.circuit ? translateCircuit(result.circuit) : { nodes: [], edges: [] }, [result.circuit])
  const maxX = Math.max(...graph.nodes.map((node) => node.x), 300) + 70
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))

  const addGate = (gate: GateName) => {
    const instruction = gate === 'cx' || gate === 'cz' ? `${gate} q[0],q[1];` : `${gate === 'rx' || gate === 'rz' ? `${gate}(pi/2)` : gate} q[0];`
    setSource((current) => current.replace(/(measure[\s\S]*|$)/, `${instruction}\n$1`))
  }

  return (
    <main className="app-shell">
      <header>
        <div className="brand"><span className="brand-mark">⌬</span><span>Araqnea</span><small>ZX Studio</small></div>
        <nav><button type="button">Documentation</button><button type="button" onClick={() => setShowExport(true)}>Export ↗</button><button className="run" type="button">▶ Run simulation</button></nav>
      </header>
      <section className="workspace">
        <aside className="editor-panel">
          <div className="panel-heading"><div><span className="eyebrow">CIRCUIT INPUT</span><h1>OpenQASM 2.0</h1></div><span className={`status ${result.error ? 'error' : ''}`}>{result.error ?? '● Valid circuit'}</span></div>
          <div className="controls">
            <label>Example
              <select value="" onChange={(event) => setSource(examples[event.target.value as keyof typeof examples])}>
                <option value="" disabled>Load a preset…</option>
                {Object.keys(examples).map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <span className="qubit-count">{result.circuit?.qubits ?? 0} qubits</span>
          </div>
          <div className="palette" aria-label="Gate palette">{palette.map((gate) => <button key={gate.name} type="button" onClick={() => addGate(gate.name)}>{gate.label}</button>)}</div>
          <textarea aria-label="OpenQASM editor" spellCheck="false" value={source} onChange={(event) => setSource(event.target.value)} />
          <p className="editor-hint">Live parsing is enabled. Choose a preset or use the gate palette to build your circuit.</p>
        </aside>
        <section className="diagram-panel">
          <div className="panel-heading"><div><span className="eyebrow">QUANTUM PICTURES</span><h2>ZX-calculus diagram</h2></div><div className="canvas-actions"><button type="button">−</button><button type="button">+</button><button type="button">Fit view</button></div></div>
          <div className="legend"><span><i className="z-dot" /> Z-spider</span><span><i className="x-dot" /> X-spider</span><span><i className="h-line" /> Hadamard edge</span></div>
          <div className="canvas">
            {result.error ? <div className="empty-state">Fix the circuit syntax to view its diagram.</div> :
              <svg viewBox={`0 0 ${maxX} ${Math.max(280, result.circuit!.qubits * 100 + 90)}`} role="img" aria-label="ZX calculus circuit diagram">
                {graph.edges.map((edge) => {
                  const from = nodeById.get(edge.source)!
                  const to = nodeById.get(edge.target)!
                  return <g key={edge.id}><line className={edge.hadamard ? 'hadamard-edge' : 'edge'} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />{edge.hadamard && <rect className="h-box" x={(from.x + to.x) / 2 - 10} y={(from.y + to.y) / 2 - 10} width="20" height="20" rx="3" />}</g>
                })}
                {graph.nodes.map((node) => node.kind === 'boundary'
                  ? <g className="boundary" key={node.id}><text x={node.x} y={node.y + 5} textAnchor="middle">{node.label}</text></g>
                  : <g key={node.id} className={`spider ${node.kind}`} onClick={() => setSelected(node.id)}><circle cx={node.x} cy={node.y} r="25" /><text x={node.x} y={node.y + 5} textAnchor="middle">{node.phase}</text></g>
                )}
              </svg>}
          </div>
          <div className="inspector">{selected ? (() => { const node = nodeById.get(selected)!; return <><b>Spider inspector</b><span>{node.kind.toUpperCase()} spider · wire {node.wire}</span><span>Phase: {node.phase} ({node.phase === 'π/2' ? '90°' : node.phase === 'π' ? '180°' : '0°'})</span></> })() : <><b>Spider inspector</b><span>Select a colored node to inspect its phase and wire.</span></>}</div>
        </section>
      </section>
      <section className="results"><div><span className="eyebrow">BUILT-IN LOCAL SIMULATOR</span><h2>Measurement probabilities</h2></div><div className="bars"><span><i style={{ height: '50%' }} />00 <b>50%</b></span><span><i style={{ height: '0%' }} />01 <b>0%</b></span><span><i style={{ height: '0%' }} />10 <b>0%</b></span><span><i style={{ height: '50%' }} />11 <b>50%</b></span></div></section>
      <footer>This effort is supported by <strong>Qollab &amp; IonQ</strong><span>•</span> Built for Quantum Unlocked</footer>
      {showExport && result.circuit && <div className="modal-backdrop" role="presentation" onClick={() => setShowExport(false)}><section className="modal" role="dialog" aria-modal="true" aria-label="Export Qollab project" onClick={(event) => event.stopPropagation()}><div><span className="eyebrow">QOLLAB EXPORT</span><h2>Ready to run in the browser</h2></div><pre>{toQollabJs(result.circuit)}</pre><button className="copy" type="button" onClick={() => navigator.clipboard.writeText(toQollabJs(result.circuit!))}>Copy main.js</button><button className="close" type="button" onClick={() => setShowExport(false)}>Close</button></section></div>}
    </main>
  )
}

export default App
