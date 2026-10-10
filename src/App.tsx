import { useMemo, useRef, useState } from 'react'
import { examples } from './data/examples'
import { CodeView } from './components/views/CodeView'
import { GateCircuitView } from './components/views/GateCircuitView'
import { Spider3DCanvasView, type SpiderCanvasApi } from './components/views/Spider3DCanvasView'
import { SpiderPalette } from './components/views/SpiderPalette'
import { toQasm, toQiskitPython, toZXJson } from './lib/exporters/circuitExporters'
import { toQollabJs } from './lib/exporters/qollabExporter'
import { parseQasm } from './lib/parsers/qasm2Parser'
import { buildPictureElement, pictureElements, type PictureElementId } from './lib/zx-core/pictureElements'
import { translateCircuit } from './lib/zx-core/translator'
import { connectionError } from './lib/zx-core/connections'
import type { GateName, QuantumCircuit } from './types/circuit'
import type { Vector3, ZXGraph3D } from './types/zx'

type WorkbenchMode = 'code' | 'gates' | 'spiders'
type ExportFormat = 'qollab' | 'qasm' | 'qiskit' | 'zx'

const modeLabels: { id: WorkbenchMode; label: string; icon: string }[] = [
  { id: 'code', label: 'Code', icon: '⌘' },
  { id: 'gates', label: 'Circuit gates', icon: '▦' },
  { id: 'spiders', label: '3D spiders', icon: '◉' },
]

function App() {
  const [source, setSource] = useState<string>(examples['Bell state'])
  const [mode, setMode] = useState<WorkbenchMode>('code')
  const [selectedId, setSelectedId] = useState<string>()
  const [phaseEdit, setPhaseEdit] = useState<{ nodeId?: string; value: string }>({ value: '' })
  const [phaseError, setPhaseError] = useState('')
  const [showExport, setShowExport] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('qollab')
  const [copied, setCopied] = useState(false)
  const [positions, setPositions] = useState<Record<string, Vector3>>({})
  const [added, setAdded] = useState<ZXGraph3D>({ nodes: [], edges: [] })
  const addedCounter = useRef(0)
  const canvasApi = useRef<SpiderCanvasApi>(null)
  const result = useMemo(() => parseQasm(source), [source])
  const baseGraph = useMemo(() => result.circuit ? translateCircuit(result.circuit) : { nodes: [], edges: [] }, [result.circuit])
  const graph = useMemo(() => {
    const nodes = [
      ...baseGraph.nodes.map((node) => positions[node.id] ? { ...node, position: positions[node.id] } : node),
      ...added.nodes,
    ]
    const ids = new Set(nodes.map((node) => node.id))
    return {
      nodes,
      edges: [...baseGraph.edges, ...added.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))],
    }
  }, [baseGraph, positions, added])
  const selectedNode = graph.nodes.find((node) => node.id === selectedId)
  const addedElementCount = new Set(added.nodes.map((node) => node.id.split('-')[0])).size

  const phaseValue = phaseEdit.nodeId === selectedId ? phaseEdit.value : selectedNode?.phase ?? ''
  const updateSource = (value: string) => {
    setSource(value)
    setPositions({})
    setAdded((current) => {
      const ids = new Set(current.nodes.map((node) => node.id))
      return { ...current, edges: current.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)) }
    })
    setSelectedId(undefined)
  }
  const updateCircuit = (circuit: QuantumCircuit) => updateSource(toQasm(circuit))
  const addGate = (name: GateName, wire: number) => {
    if (!result.circuit) return
    const multiQubit = name === 'cx' || name === 'cz' || name === 'swap'
    const qubits = Math.max(result.circuit.qubits, wire + 1, multiQubit ? 2 : 1)
    const targetWire = Math.min(wire, qubits - 1)
    const gateQubits = multiQubit
      ? [targetWire === 0 ? 0 : 0, targetWire === 0 ? 1 : targetWire]
      : [targetWire]
    const gate = {
      id: `new-${Date.now()}-${result.circuit.gates.length}`,
      name,
      qubits: gateQubits,
      ...(['rx', 'rz'].includes(name) ? { parameter: 'pi/2' } : {}),
      ...(name === 'measure' ? { classicalBit: targetWire } : {}),
    }
    updateCircuit({
      ...result.circuit,
      qubits,
      classicalBits: Math.max(result.circuit.classicalBits, name === 'measure' ? targetWire + 1 : 0),
      gates: [...result.circuit.gates, gate],
    })
  }
  const removeGate = (gateId: string) => {
    if (!result.circuit) return
    updateCircuit({ ...result.circuit, gates: result.circuit.gates.filter((gate) => gate.id !== gateId) })
    if (selectedNode?.gateId === gateId) setSelectedId(undefined)
  }
  const addPictureElement = (elementId: PictureElementId, at?: Vector3) => {
    addedCounter.current += 1
    const index = addedCounter.current
    const centre = canvasApi.current?.centerPoint() ?? { x: 0, y: 0, z: 0 }
    const position = at ?? { x: centre.x + ((index % 5) - 2) * 25, y: centre.y + ((index % 3) - 1) * 25, z: centre.z }
    const element = buildPictureElement(elementId, position, `pic${index}-${elementId}`)
    setAdded((current) => ({ nodes: [...current.nodes, ...element.nodes], edges: [...current.edges, ...element.edges] }))
    const focus = element.nodes.find((node) => node.kind !== 'boundary') ?? element.nodes[0]
    setSelectedId(focus.id)
    setPhaseError('')
  }
  const removeAddedNode = (nodeId: string) => {
    setAdded((current) => ({
      nodes: current.nodes.filter((node) => node.id !== nodeId),
      edges: current.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    }))
    setSelectedId(undefined)
  }
  const connectNodes = (source: string, target: string) => {
    const error = connectionError(graph, source, target)
    if (error) return error
    setAdded((current) => ({
      ...current,
      edges: [...current.edges, { id: `pic-edge-${Date.now()}-${current.edges.length}`, source, target, custom: true }],
    }))
  }
  const updatePhase = () => {
    if (selectedNode?.custom) {
      const phase = phaseValue.replaceAll('pi', 'π').trim() || '0'
      setAdded((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === selectedNode.id ? { ...node, phase } : node) }))
      setPhaseEdit({ nodeId: selectedNode.id, value: phase })
      setPhaseError('')
      return
    }
    if (!result.circuit || !selectedNode?.gateId || (selectedNode.kind !== 'z' && selectedNode.kind !== 'x')) return
    const normalizedPhase = phaseValue.replaceAll('π', 'pi').trim()
    const name: GateName = selectedNode.kind === 'z' ? 'rz' : 'rx'
    const gates = result.circuit.gates.map((gate) => gate.id === selectedNode.gateId
      ? { ...gate, name, parameter: normalizedPhase } : gate)
    const nextSource = toQasm({ ...result.circuit, gates })
    const nextResult = parseQasm(nextSource)
    if (!nextResult.circuit) {
      setPhaseError(nextResult.error ?? 'Invalid phase.')
      return
    }
    updateSource(nextSource)
    setSelectedId(`${selectedNode.gateId}-q${selectedNode.wire}-${selectedNode.kind}`)
    setPhaseEdit({ nodeId: `${selectedNode.gateId}-q${selectedNode.wire}-${selectedNode.kind}`, value: normalizedPhase })
    setPhaseError('')
  }
  const moveNode = (id: string, position: Vector3) => {
    if (added.nodes.some((node) => node.id === id)) {
      setAdded((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === id ? { ...node, position } : node) }))
    } else {
      setPositions((current) => ({ ...current, [id]: position }))
    }
  }
  const exportText = !result.circuit ? '' : ({
    qollab: toQollabJs(result.circuit),
    qasm: toQasm(result.circuit),
    qiskit: toQiskitPython(result.circuit),
    zx: toZXJson(graph),
  })[exportFormat]
  const exportName = ({ qollab: 'main.js', qasm: 'circuit.qasm', qiskit: 'circuit.py', zx: 'zx-graph.json' })[exportFormat]

  const download = (name: string, text: string, type: string) => {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    anchor.click()
    URL.revokeObjectURL(url)
  }
  const downloadExport = () => {
    if (exportFormat === 'qollab') {
      download('main.js', exportText, 'text/javascript')
      download('index.html', '<!doctype html>\n<html><head><meta charset="utf-8"><title>Araqnea circuit</title></head><body><pre id="results"></pre><script type="module" src="./main.js"></script></body></html>', 'text/html')
    } else {
      download(exportName, exportText, exportFormat === 'zx' ? 'application/json' : 'text/plain')
    }
  }
  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <main className="app-shell">
      <header>
        <a className="brand" href="/" aria-label="Araqnea home"><span className="brand-mark">⌬</span><span>Araqnea</span><small>QUANTUM WORKBENCH</small></a>
        <nav>
          <span className="header-status"><i /> LIVE SYNC</span>
          <button type="button" onClick={() => setShowExport(true)}>Export <span aria-hidden="true">↗</span></button>
          <button className="run" type="button" onClick={() => setMode('gates')}>▶ Run circuit</button>
        </nav>
      </header>
      <section className="workspace">
        <section className="left-workbench">
          <div className="workbench-top">
            <div><span className="eyebrow">QUANTUM WORKSPACE</span><h1>Untitled circuit</h1></div>
            <span className={`status ${result.error ? 'error' : ''}`}>{result.error ?? '● Synced'}</span>
          </div>
          <div className="mode-tabs" role="tablist" aria-label="Workbench mode">
            {modeLabels.map((item) => <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              className={mode === item.id ? 'active' : ''}
              onClick={() => setMode(item.id)}
            ><span>{item.icon}</span>{item.label}</button>)}
          </div>
          {!result.circuit
            ? <div className="mode-content empty-state">Fix the OpenQASM syntax to edit this circuit.</div>
            : mode === 'code'
              ? <CodeView source={source} error={result.error} qubits={result.circuit.qubits} onChange={updateSource} onPreset={updateSource} />
              : mode === 'gates'
                ? <GateCircuitView circuit={result.circuit} onAdd={addGate} onRemove={removeGate} />
                : <section className="mode-content active-spider-view">
                    <div className="view-title"><div><span className="eyebrow">MODE 03 · ZX GRAPH</span><h2>Spatial spider canvas</h2></div><span>Drag symbols in · connect on canvas · drag nodes</span></div>
                    <div className="spider-stage">
                      <SpiderPalette onAdd={(id) => addPictureElement(id)} onClear={() => { setAdded({ nodes: [], edges: [] }); if (selectedNode?.custom) setSelectedId(undefined) }} addedCount={addedElementCount} />
                      <Spider3DCanvasView graph={graph} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setPhaseError('') }} onMove={moveNode} onConnect={connectNodes} onDropElement={addPictureElement} apiRef={canvasApi} />
                    </div>
                    <div className="graph-legend"><span><i className="z-dot" /> Z spider</span><span><i className="x-dot" /> X spider</span><span><i className="h-dot" /> Hadamard</span><span>{graph.nodes.filter((node) => node.kind !== 'boundary').length} SPIDERS · {graph.edges.length} CONNECTIONS</span></div>
          <div className="inspector">
            <div className="inspector-heading"><b>Selected node</b>{selectedNode && <span className={`node-tag ${selectedNode.kind}`}>{selectedNode.kind.toUpperCase()}</span>}</div>
            {selectedNode ? <>
              <div className="property-row"><span>Node ID</span><code>{selectedNode.id}</code></div>
              {selectedNode.custom
                ? <div className="property-row"><span>Picturalism symbol</span><code>{pictureElements.find((element) => element.id === selectedNode.symbol)?.label ?? selectedNode.symbol}</code></div>
                : <div className="property-row"><span>Qubit wire</span><code>q[{selectedNode.wire}]</code></div>}
              <div className="property-row"><span>3D position</span><code>{selectedNode.position.x.toFixed(1)}, {selectedNode.position.y.toFixed(1)}, {selectedNode.position.z.toFixed(1)}</code></div>
              {selectedNode.kind === 'x' || selectedNode.kind === 'z' ? <div className="phase-editor">
                <label htmlFor="phase-input">Phase</label><input id="phase-input" value={phaseValue} onChange={(event) => setPhaseEdit({ nodeId: selectedId, value: event.target.value })} aria-invalid={Boolean(phaseError)} />
                <button type="button" onClick={updatePhase}>Apply</button>
                {phaseError && <span className="phase-error">{phaseError}</span>}
              </div> : <div className="property-row"><span>Type</span><code>{selectedNode.label ?? selectedNode.kind}</code></div>}
              <div className="property-row"><span>Connected edges</span><code>{graph.edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id).length}</code></div>
              {added.edges.filter((edge) => edge.id.startsWith('pic-edge-') && (edge.source === selectedNode.id || edge.target === selectedNode.id)).map((edge) => <div className="property-row" key={edge.id}>
                <code>{edge.source === selectedNode.id ? edge.target : edge.source}</code>
                <button type="button" aria-label={`Disconnect ${edge.source} from ${edge.target}`} onClick={() => setAdded((current) => ({ ...current, edges: current.edges.filter((item) => item.id !== edge.id) }))}>Disconnect</button>
              </div>)}
              {selectedNode.custom && <button type="button" className="remove-node" onClick={() => removeAddedNode(selectedNode.id)}>Remove element</button>}
            </> : <p className="inspector-placeholder">Select a spider to inspect its phase, connections, and spatial position.</p>}
          </div>
                  </section>}
        </section>
      </section>
      <section className="results">
        <div><span className="eyebrow">CIRCUIT OVERVIEW</span><h2>Quantum circuit</h2></div>
        <div className="result-stats">
          <span><b>{result.circuit?.qubits ?? 0}</b> QUBITS</span>
          <span><b>{result.circuit?.gates.length ?? 0}</b> GATES</span>
          <span><b>{graph.edges.length}</b> WIRES</span>
          <button type="button" onClick={() => setShowExport(true)}>Export circuit ↗</button>
        </div>
      </section>
      <footer>Araqnea <span>·</span> ZX-calculus workbench <span>·</span> Built for quantum engineering</footer>
      {showExport && result.circuit && <div className="modal-backdrop" role="presentation" onClick={() => setShowExport(false)}>
        <section className="modal" role="dialog" aria-modal="true" aria-label="Export circuit" onClick={(event) => event.stopPropagation()}>
          <div className="modal-heading"><div><span className="eyebrow">MULTI-FORMAT EXPORT</span><h2>Take your circuit anywhere</h2></div><button className="close" type="button" onClick={() => setShowExport(false)} aria-label="Close export">×</button></div>
          <label className="export-select">Format
            <select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as ExportFormat)}>
              <option value="qollab">Qollab browser project (main.js + index.html)</option>
              <option value="qasm">OpenQASM 2.0 (.qasm)</option>
              <option value="qiskit">Qiskit Python (.py)</option>
              <option value="zx">3D ZX graph (.json)</option>
            </select>
          </label>
          <pre>{exportText}</pre>
          <div className="export-actions"><button className="copy" type="button" onClick={() => void copyExport()}>{copied ? 'Copied!' : 'Copy'}</button><button className="download" type="button" onClick={downloadExport}>Download {exportFormat === 'qollab' ? 'project files' : exportName}</button></div>
        </section>
      </div>}
    </main>
  )
}

export default App
