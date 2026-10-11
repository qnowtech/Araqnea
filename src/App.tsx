import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gateInfo, spiderKindInfo } from './data/gateInfo'
import { GuidedTour } from './components/GuidedTour'
import { HoverTooltip } from './components/HoverTooltip'
import { tourSteps } from './data/tourSteps'
import { CodeView } from './components/views/CodeView'
import { GateCircuitView } from './components/views/GateCircuitView'
import { Spider3DCanvasView, type SpiderCanvasApi } from './components/views/Spider3DCanvasView'
import { SpiderPalette } from './components/views/SpiderPalette'
import { toPennyLane, toQasm, toQasm3, toQiskitPython, toZXJson } from './lib/exporters/circuitExporters'
import { toQollabCss, toQollabHtml, toQollabJs } from './lib/exporters/qollabExporter'
import { parseQasm } from './lib/parsers/qasm2Parser'
import { createCircuit, defaultTitle, loadLibrary, saveLibrary, uniqueTitle, type SavedCircuit } from './lib/storage/circuitLibrary'
import { canInsertIntoCircuit, insertSpiderGate, nearestWire, validateSync, wireAt } from './lib/sync/circuitSync'
import { buildPictureElement, pictureElements, type PictureElementId } from './lib/zx-core/pictureElements'
import { columnSpacing, translateCircuit } from './lib/zx-core/translator'
import { connectionError } from './lib/zx-core/connections'
import type { GateName, QuantumCircuit } from './types/circuit'
import type { Vector3, ZXGraph3D, ZXNode } from './types/zx'

type WorkbenchMode = 'code' | 'gates' | 'spiders'
type ExportFormat = 'qasm2' | 'qasm3' | 'qiskit' | 'pennylane' | 'qollab' | 'zx'
interface ExportFile { name: string; text: string; type: string }

const modeLabels: { id: WorkbenchMode; label: string; icon: string; tip: string }[] = [
  { id: 'code', label: 'Code', icon: '⌘', tip: 'Code\nWrite or paste OpenQASM 2.0. Every edit updates the gates and spiders.' },
  { id: 'gates', label: 'Circuit gates', icon: '▦', tip: 'Circuit gates\nBuild the circuit by clicking or dragging gates onto qubit wires.' },
  { id: 'spiders', label: '3D spiders', icon: '◉', tip: '3D spiders\nExplore and edit the ZX-calculus diagram of the same circuit.' },
]

const exportFormats: { id: ExportFormat; label: string; detail: string }[] = [
  { id: 'qasm2', label: 'OpenQASM 2.0', detail: '.qasm · qelib1.inc' },
  { id: 'qasm3', label: 'OpenQASM 3.0', detail: '.qasm · stdgates.inc' },
  { id: 'qiskit', label: 'Qiskit', detail: 'Python .py' },
  { id: 'pennylane', label: 'PennyLane', detail: 'Python .py' },
  { id: 'qollab', label: 'Qollab project', detail: 'index.html · style.css · main.js' },
  { id: 'zx', label: 'ZX graph', detail: '3D graph .json' },
]

const blankCircuit = 'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[2];\ncreg c[2];'
const insertableElements = new Set<PictureElementId>(['z-spider', 'x-spider', 'z-phase', 'x-phase', 'hadamard'])
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'circuit'

const tourStorageKey = 'araqnea.tour.completed'
const tourCompleted = () => {
  try {
    return window.localStorage.getItem(tourStorageKey) === 'true'
  } catch {
    return false
  }
}

function App() {
  const [library, setLibrary] = useState(loadLibrary)
  const [mode, setMode] = useState<WorkbenchMode>('spiders')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [phaseEdit, setPhaseEdit] = useState<{ nodeId?: string; value: string }>({ value: '' })
  const [phaseError, setPhaseError] = useState('')
  const [showExport, setShowExport] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('qasm2')
  const [exportFileIndex, setExportFileIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showTour, setShowTour] = useState(() => !tourCompleted())
  const [notice, setNotice] = useState('')
  const noticeTimer = useRef(0)
  const addedCounter = useRef(0)
  const canvasApi = useRef<SpiderCanvasApi>(null)

  useEffect(() => saveLibrary(library), [library])
  useEffect(() => () => window.clearTimeout(noticeTimer.current), [])

  const active = library.circuits.find((circuit) => circuit.id === library.activeId) ?? library.circuits[0]
  const { source, added, positions, title } = active
  const updateActive = useCallback((patch: (circuit: SavedCircuit) => Partial<SavedCircuit>) => {
    setLibrary((current) => ({
      ...current,
      circuits: current.circuits.map((circuit) => circuit.id === current.activeId ? { ...circuit, ...patch(circuit), updatedAt: Date.now() } : circuit),
    }))
  }, [])
  const announce = useCallback((message: string) => {
    window.clearTimeout(noticeTimer.current)
    setNotice(message)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 3200)
  }, [])

  const result = useMemo(() => parseQasm(source), [source])
  const baseGraph = useMemo(() => result.circuit ? translateCircuit(result.circuit) : { nodes: [], edges: [] }, [result.circuit])
  const graph = useMemo<ZXGraph3D>(() => {
    const nodes = [
      ...baseGraph.nodes.map((node) => positions[node.id] ? { ...node, position: positions[node.id] } : node),
      ...added.nodes,
    ]
    const ids = new Set(nodes.map((node) => node.id))
    return {
      nodes,
      edges: [...baseGraph.edges, ...added.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))],
      ...(baseGraph.numbers?.length ? { numbers: baseGraph.numbers } : {}),
    }
  }, [baseGraph, positions, added])
  const sync = useMemo(() => result.circuit ? validateSync(result.circuit, graph) : undefined, [result.circuit, graph])
  const selectedId = selectedIds.at(-1)
  const selectedNode = selectedIds.length === 1 ? graph.nodes.find((node) => node.id === selectedId) : undefined
  const addedElementCount = new Set(added.nodes.map((node) => node.id.split('-')[0])).size

  const phaseValue = phaseEdit.nodeId === selectedId ? phaseEdit.value : selectedNode?.phase ?? ''
  const updateSource = (value: string) => {
    updateActive((circuit) => {
      const ids = new Set(circuit.added.nodes.map((node) => node.id))
      return { source: value, positions: {}, added: { ...circuit.added, edges: circuit.added.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)) } }
    })
    setSelectedIds([])
  }
  const updateCircuit = (circuit: QuantumCircuit) => updateSource(toQasm(circuit))
  const addGate = (name: GateName, wire: number) => {
    if (!result.circuit) return
    const multiQubit = name === 'cx' || name === 'cz' || name === 'swap'
    const qubits = Math.max(result.circuit.qubits, wire + 1, multiQubit ? 2 : 1)
    const targetWire = Math.min(wire, qubits - 1)
    const gateQubits = multiQubit
      ? [0, targetWire === 0 ? 1 : targetWire]
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
  }
  const insertIntoCircuit = (node: ZXNode, wire: number, x: number, removeIds: string[] = []) => {
    if (!result.circuit) return false
    const inserted = insertSpiderGate(result.circuit, node, wire, x)
    if (!inserted.circuit || !inserted.gate) {
      announce(inserted.error ?? 'Could not insert this spider into the circuit.')
      return false
    }
    const removed = new Set(removeIds)
    updateActive((circuit) => {
      const nodes = circuit.added.nodes.filter((item) => !removed.has(item.id))
      const ids = new Set(nodes.map((item) => item.id))
      return { source: toQasm(inserted.circuit!), positions: {}, added: { nodes, edges: circuit.added.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)) } }
    })
    setSelectedIds([])
    announce(`Inserted ${inserted.gate.name}${inserted.gate.parameter ? `(${inserted.gate.parameter})` : ''} on q[${wire}] — code and gates updated.`)
    return true
  }
  const addPictureElement = (elementId: PictureElementId, at?: Vector3) => {
    addedCounter.current += 1
    const index = addedCounter.current
    const centre = canvasApi.current?.centerPoint() ?? { x: 0, y: 0, z: 0 }
    const position = at ?? { x: centre.x + ((index % 5) - 2) * 100, y: centre.y + ((index % 3) - 1) * 100, z: centre.z }
    const element = buildPictureElement(elementId, position, `pic${Date.now().toString(36)}${index}-${elementId}`)
    const circuit = result.circuit
    if (at && circuit && insertableElements.has(elementId)) {
      const wire = wireAt(circuit, at.y)
      const outX = Math.max(circuit.gates.length, 1) * columnSpacing + 150
      if (wire !== undefined && at.x > -150 && at.x < outX && insertIntoCircuit(element.nodes[0], wire, at.x)) return
    }
    updateActive((current) => ({ added: { nodes: [...current.added.nodes, ...element.nodes], edges: [...current.added.edges, ...element.edges] } }))
    const focus = element.nodes.find((node) => node.kind !== 'boundary') ?? element.nodes[0]
    setSelectedIds([focus.id])
    setPhaseError('')
  }
  const canDelete = useCallback((id: string) => {
    const node = graph.nodes.find((item) => item.id === id)
    return Boolean(node && (node.custom || node.gateId))
  }, [graph])
  const deleteNodes = (ids: string[]) => {
    const removed = new Set(ids.filter((id) => added.nodes.some((node) => node.id === id)))
    const gateIds = new Set(graph.nodes.filter((node) => ids.includes(node.id) && !node.custom && node.gateId).map((node) => node.gateId!))
    updateActive((circuit) => {
      const nodes = circuit.added.nodes.filter((node) => !removed.has(node.id))
      if (gateIds.size && result.circuit) {
        const ids = new Set(nodes.map((node) => node.id))
        return {
          source: toQasm({ ...result.circuit, gates: result.circuit.gates.filter((gate) => !gateIds.has(gate.id)) }),
          positions: {},
          added: { nodes, edges: circuit.added.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)) },
        }
      }
      return { added: { nodes, edges: circuit.added.edges.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target)) } }
    })
    setSelectedIds([])
    if (gateIds.size) announce(`Removed ${gateIds.size} gate${gateIds.size === 1 ? '' : 's'} — code and gates updated.`)
  }
  const connectNodes = (sourceId: string, target: string) => {
    const error = connectionError(graph, sourceId, target)
    if (error) return error
    updateActive((circuit) => ({
      added: { ...circuit.added, edges: [...circuit.added.edges, { id: `pic-edge-${Date.now()}-${circuit.added.edges.length}`, source: sourceId, target, custom: true }] },
    }))
  }
  const updatePhase = () => {
    if (!selectedNode) return
    if (selectedNode.custom) {
      const phase = phaseValue.replaceAll('pi', 'π').trim() || '0'
      updateActive((circuit) => ({ added: { ...circuit.added, nodes: circuit.added.nodes.map((node) => node.id === selectedNode.id ? { ...node, phase } : node) } }))
      setPhaseEdit({ nodeId: selectedNode.id, value: phase })
      setPhaseError('')
      return
    }
    if (!result.circuit || !selectedNode.gateId || (selectedNode.kind !== 'z' && selectedNode.kind !== 'x')) return
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
    const nextId = `${selectedNode.gateId}-q${selectedNode.wire}-${selectedNode.kind}`
    setSelectedIds([nextId])
    setPhaseEdit({ nodeId: nextId, value: normalizedPhase })
    setPhaseError('')
    announce(`Phase applied as ${name}(${normalizedPhase}) — code and gates updated.`)
  }
  const moveNodes = useCallback((moves: Record<string, Vector3>) => {
    updateActive((circuit) => {
      const customIds = new Set(circuit.added.nodes.map((node) => node.id))
      const nextPositions = { ...circuit.positions }
      for (const [id, position] of Object.entries(moves)) if (!customIds.has(id)) nextPositions[id] = position
      return {
        positions: nextPositions,
        added: { ...circuit.added, nodes: circuit.added.nodes.map((node) => moves[node.id] ? { ...node, position: moves[node.id] } : node) },
      }
    })
  }, [updateActive])
  const describeNode = useCallback((node: ZXNode) => {
    const kindName = { z: 'Z spider', x: 'X spider', hadamard: 'Hadamard box', boundary: 'Boundary' }[node.kind]
    const heading = node.kind === 'z' || node.kind === 'x' ? `${kindName} · phase ${node.phase || '0'}` : node.kind === 'boundary' ? `${kindName} ${node.label ?? ''}`.trim() : kindName
    const lines = [heading, spiderKindInfo[node.kind]]
    if (node.custom) {
      const element = pictureElements.find((item) => item.id === node.symbol)
      if (element) lines.push(`Palette: ${element.label} — ${element.description}`)
      lines.push('Diagram-only: exported in ZX JSON, not in OpenQASM.')
    } else {
      const gate = result.circuit?.gates.find((item) => item.id === node.gateId)
      if (gate) lines.push(`From ${gateInfo[gate.name].title} on ${gate.qubits.map((wire) => `q[${wire}]`).join(', ')}.`)
      else if (node.id.startsWith('in-')) lines.push(`Input state of qubit q[${node.wire}].`)
      else if (node.id.startsWith('out-')) lines.push(`Output of qubit q[${node.wire}].`)
    }
    lines.push(node.custom || node.gateId ? 'Double-click to connect or delete.' : 'Double-click to connect.')
    return lines.join('\n')
  }, [result.circuit])

  const exportFiles: ExportFile[] = !result.circuit ? [] : ({
    qasm2: [{ name: `${slug(title)}.qasm`, text: toQasm(result.circuit), type: 'text/plain' }],
    qasm3: [{ name: `${slug(title)}.qasm3.qasm`, text: toQasm3(result.circuit), type: 'text/plain' }],
    qiskit: [{ name: `${slug(title)}_qiskit.py`, text: toQiskitPython(result.circuit), type: 'text/x-python' }],
    pennylane: [{ name: `${slug(title)}_pennylane.py`, text: toPennyLane(result.circuit), type: 'text/x-python' }],
    qollab: [
      { name: 'main.js', text: toQollabJs(result.circuit, title), type: 'text/javascript' },
      { name: 'index.html', text: toQollabHtml(title), type: 'text/html' },
      { name: 'style.css', text: toQollabCss(), type: 'text/css' },
    ],
    zx: [{ name: `${slug(title)}.zx.json`, text: toZXJson(graph), type: 'application/json' }],
  })[exportFormat]
  const exportFile = exportFiles[Math.min(exportFileIndex, exportFiles.length - 1)]

  const startTour = () => {
    setShowExport(false)
    setShowAbout(false)
    setMode('spiders')
    setShowTour(true)
  }
  const closeTour = useCallback(() => {
    setShowTour(false)
    try {
      window.localStorage.setItem(tourStorageKey, 'true')
    } catch {
      // Storage may be unavailable (private mode); the tour will simply show again next visit.
    }
  }, [])

  const download = (file: ExportFile) => {
    const url = URL.createObjectURL(new Blob([file.text], { type: file.type }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.name
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  const copyExport = async () => {
    if (!exportFile) return
    try {
      await navigator.clipboard.writeText(exportFile.text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const switchCircuit = (id: string) => {
    setLibrary((current) => ({ ...current, activeId: id }))
    setSelectedIds([])
    setPhaseError('')
  }
  const newCircuit = () => {
    setLibrary((current) => {
      const circuit = createCircuit(uniqueTitle(current, defaultTitle), blankCircuit)
      return { activeId: circuit.id, circuits: [...current.circuits, circuit] }
    })
    setSelectedIds([])
    setMode('gates')
    announce('New circuit created and saved in this browser.')
  }
  const duplicateCircuit = () => {
    setLibrary((current) => {
      const original = current.circuits.find((circuit) => circuit.id === current.activeId) ?? current.circuits[0]
      const copy = { ...createCircuit(uniqueTitle(current, `${original.title} copy`), original.source), added: original.added, positions: original.positions }
      return { activeId: copy.id, circuits: [...current.circuits, copy] }
    })
    setSelectedIds([])
  }
  const deleteCircuit = () => {
    if (library.circuits.length < 2 || !window.confirm(`Delete “${title}”? This cannot be undone.`)) return
    setLibrary((current) => {
      const circuits = current.circuits.filter((circuit) => circuit.id !== current.activeId)
      return { activeId: circuits[0].id, circuits }
    })
    setSelectedIds([])
    announce(`Deleted “${title}”.`)
  }

  const syncTip = result.error
    ? `Out of sync\nThe OpenQASM code has an error. Fix it to resync the gates and spiders.\n${result.error}`
    : sync ? `${sync.ok ? 'Code, gates and spiders are in sync' : 'Sync problem detected'}\n${sync.checks.map((check) => `${check.ok ? '✓' : '✗'} ${check.label}: ${check.detail}`).join('\n')}${sync.diagramOnly ? `\n• ${sync.diagramOnly} diagram-only node(s) live in the ZX graph only.` : ''}` : ''

  return (
    <main className="app-shell">
      <HoverTooltip />
      <header>
        <a className="brand" data-tour="brand" href="/" aria-label="Araqnea home"><span className="brand-mark">⌬</span><span>Araqnea</span><small>QUANTUM WORKBENCH</small></a>
        <nav data-tour="navbar">
          <span className="header-status"><i /> LIVE SYNC</span>
          <button type="button" onClick={startTour} data-tip={'Guided tour\nA short walkthrough of the workbench.'}>Tour <span aria-hidden="true">✦</span></button>
          <button type="button" onClick={() => setShowAbout(true)}>About</button>
          <button type="button" onClick={() => { setExportFileIndex(0); setShowExport(true) }} data-tip={'Export\nOpenQASM 2/3, Qiskit, PennyLane, a Qollab project (HTML, CSS, JS) or ZX JSON.'}>Export <span aria-hidden="true">↗</span></button>
          <button className="run" type="button" onClick={() => setMode('gates')}>▶ Run circuit</button>
        </nav>
      </header>
      <section className="workspace">
        <section className="left-workbench">
          <div className="workbench-top">
            <div className="circuit-title">
              <span className="eyebrow">QUANTUM WORKSPACE · SAVED IN THIS BROWSER</span>
              <input
                className="title-input"
                aria-label="Circuit title"
                value={title}
                maxLength={80}
                data-tip={'Rename circuit\nClick to edit the title. Changes are saved automatically.'}
                onChange={(event) => updateActive(() => ({ title: event.target.value }))}
                onBlur={(event) => { if (!event.target.value.trim()) updateActive(() => ({ title: defaultTitle })) }}
                onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
              />
            </div>
            <div className="circuit-library" aria-label="Saved circuits">
              <select aria-label="Open saved circuit" value={active.id} onChange={(event) => switchCircuit(event.target.value)} data-tip={'Saved circuits\nSwitch between circuits stored in this browser.'}>
                {library.circuits.map((circuit) => <option key={circuit.id} value={circuit.id}>{circuit.title || defaultTitle}</option>)}
              </select>
              <button type="button" onClick={newCircuit} data-tip={'New circuit\nStart a blank 2-qubit circuit.'}>＋ New</button>
              <button type="button" onClick={duplicateCircuit} data-tip={'Duplicate\nCopy this circuit, including spider layout.'}>⧉</button>
              <button type="button" aria-label="Delete circuit" onClick={deleteCircuit} disabled={library.circuits.length < 2} data-tip={library.circuits.length < 2 ? 'Delete circuit\nKeep at least one circuit.' : 'Delete circuit\nRemove this circuit from the browser.'}>🗑</button>
              <span className={`status sync-status ${result.error || (sync && !sync.ok) ? 'error' : ''}`} role="status" tabIndex={0} data-tip={syncTip}>
                {result.error ? `⚠ ${result.error}` : sync?.ok ? '● Synced · code ⇄ gates ⇄ spiders' : '⚠ Out of sync'}
              </span>
            </div>
          </div>
          <div className="mode-tabs" data-tour="mode-tabs" role="tablist" aria-label="Workbench mode">
            {modeLabels.map((item) => <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              className={mode === item.id ? 'active' : ''}
              data-tip={item.tip}
              onClick={() => setMode(item.id)}
            ><span>{item.icon}</span>{item.label}</button>)}
          </div>
          {!result.circuit && mode !== 'code'
            ? <div className="mode-content empty-state">Fix the OpenQASM syntax to edit this circuit. <button type="button" onClick={() => setMode('code')}>Open code</button></div>
            : mode === 'code'
              ? <CodeView source={source} error={result.error} qubits={result.circuit?.qubits ?? 0} onChange={updateSource} onPreset={updateSource} />
              : mode === 'gates'
                ? <GateCircuitView circuit={result.circuit!} onAdd={addGate} onRemove={removeGate} />
                : <section className="mode-content active-spider-view">
                    <div className="view-title"><div><span className="eyebrow">MODE 03 · ZX GRAPH</span><h2>Spatial spider canvas</h2></div><span>Drop on a wire to add a gate · double-click a node to connect or delete · box-select to move groups</span></div>
                    <div className="spider-stage">
                      <SpiderPalette onAdd={(id) => addPictureElement(id)} onClear={() => { updateActive(() => ({ added: { nodes: [], edges: [] } })); setSelectedIds((ids) => ids.filter((id) => !added.nodes.some((node) => node.id === id))) }} addedCount={addedElementCount} />
                      <Spider3DCanvasView graph={graph} selectedIds={selectedIds} onSelectionChange={(ids) => { setSelectedIds(ids); setPhaseError('') }} onMove={moveNodes} onConnect={connectNodes} onDelete={deleteNodes} canDelete={canDelete} describeNode={describeNode} onDropElement={addPictureElement} apiRef={canvasApi} />
                    </div>
                    <div className="graph-legend" data-tour="legend"><span data-tip={spiderKindInfo.z} tabIndex={0}><i className="z-dot" /> Z spider</span><span data-tip={spiderKindInfo.x} tabIndex={0}><i className="x-dot" /> X spider</span><span data-tip={spiderKindInfo.hadamard} tabIndex={0}><i className="h-dot" /> Hadamard</span><span>{graph.nodes.filter((node) => node.kind !== 'boundary').length} SPIDERS · {graph.edges.length} CONNECTIONS</span></div>
          <div className="inspector" data-tour="inspector">
            <div className="inspector-heading"><b>{selectedIds.length > 1 ? `${selectedIds.length} nodes selected` : 'Selected node'}</b>{selectedNode && <span className={`node-tag ${selectedNode.kind}`}>{selectedNode.kind.toUpperCase()}</span>}</div>
            {selectedIds.length > 1 ? <>
              <p className="inspector-placeholder">Drag any selected node on the canvas to move the whole group. Press Delete to remove the deletable nodes.</p>
              <div className="inspector-actions">
                <button type="button" className="remove-node" onClick={() => deleteNodes(selectedIds.filter(canDelete))} disabled={!selectedIds.some(canDelete)}>Delete {selectedIds.filter(canDelete).length} deletable</button>
                <button type="button" onClick={() => setSelectedIds([])}>Clear selection</button>
              </div>
            </> : selectedNode ? <>
              <div className="property-row"><span>Node ID</span><code>{selectedNode.id}</code></div>
              {selectedNode.custom
                ? <div className="property-row"><span>Picturalism symbol</span><code>{pictureElements.find((element) => element.id === selectedNode.symbol)?.label ?? selectedNode.symbol}</code></div>
                : <div className="property-row"><span>Qubit wire</span><code>q[{selectedNode.wire}]</code></div>}
              <div className="property-row"><span>3D position</span><code>{selectedNode.position.x.toFixed(1)}, {selectedNode.position.y.toFixed(1)}, {selectedNode.position.z.toFixed(1)}</code></div>
              {selectedNode.kind === 'x' || selectedNode.kind === 'z' ? <div className="phase-editor">
                <label htmlFor="phase-input">Phase</label><input id="phase-input" value={phaseValue} onChange={(event) => setPhaseEdit({ nodeId: selectedId, value: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') updatePhase() }} aria-invalid={Boolean(phaseError)} />
                <button type="button" onClick={updatePhase}>Apply</button>
                {phaseError && <span className="phase-error">{phaseError}</span>}
              </div> : <div className="property-row"><span>Type</span><code>{selectedNode.label ?? selectedNode.kind}</code></div>}
              <div className="property-row"><span>Connected edges</span><code>{graph.edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id).length}</code></div>
              {added.edges.filter((edge) => edge.id.startsWith('pic-edge-') && (edge.source === selectedNode.id || edge.target === selectedNode.id)).map((edge) => <div className="property-row" key={edge.id}>
                <code>{edge.source === selectedNode.id ? edge.target : edge.source}</code>
                <button type="button" aria-label={`Disconnect ${edge.source} from ${edge.target}`} onClick={() => updateActive((circuit) => ({ added: { ...circuit.added, edges: circuit.added.edges.filter((item) => item.id !== edge.id) } }))}>Disconnect</button>
              </div>)}
              <div className="inspector-actions">
                <button type="button" onClick={() => canvasApi.current?.startConnection(selectedNode.id)} data-tip={'Connect\nStart a wire from this node, then click a target node.'}>Connect from here</button>
                {result.circuit && canInsertIntoCircuit(selectedNode) && <button type="button" onClick={() => insertIntoCircuit(selectedNode, nearestWire(result.circuit!, selectedNode.position.y), selectedNode.position.x, [selectedNode.id])} data-tip={'Add to circuit\nConverts this spider into the equivalent gate on the nearest qubit wire, updating the code and gate view.'}>Add to circuit on q[{nearestWire(result.circuit, selectedNode.position.y)}]</button>}
                {canDelete(selectedNode.id) && <button type="button" className="remove-node" onClick={() => deleteNodes([selectedNode.id])}>{selectedNode.custom ? 'Delete node' : 'Delete gate'}</button>}
              </div>
            </> : <p className="inspector-placeholder">Select a spider to inspect its phase, connections, and spatial position. Double-click a node to connect or delete it.</p>}
          </div>
                  </section>}
        </section>
      </section>
      <section className="results" data-tour="overview">
        <div><span className="eyebrow">CIRCUIT OVERVIEW</span><h2>{title || defaultTitle}</h2></div>
        <div className="result-stats">
          <span><b>{result.circuit?.qubits ?? 0}</b> QUBITS</span>
          <span><b>{result.circuit?.gates.length ?? 0}</b> GATES</span>
          <span><b>{graph.edges.length}</b> WIRES</span>
          <span><b>{library.circuits.length}</b> SAVED CIRCUITS</span>
        </div>
      </section>
      <footer>Araqnea <span>·</span> ZX-calculus workbench <span>·</span> Built for quantum engineering</footer>
      {notice && <div className="toast" role="status">{notice}</div>}
      {showExport && result.circuit && exportFile && <div className="modal-backdrop" role="presentation" onClick={() => setShowExport(false)}>
        <section className="modal export-modal" role="dialog" aria-modal="true" aria-label="Export circuit" onClick={(event) => event.stopPropagation()}>
          <div className="modal-heading"><div><span className="eyebrow">MULTI-FORMAT EXPORT</span><h2>Take “{title || defaultTitle}” anywhere</h2></div><button className="close" type="button" onClick={() => setShowExport(false)} aria-label="Close export">×</button></div>
          <div className="export-formats" role="radiogroup" aria-label="Export format">
            {exportFormats.map((format) => <button
              key={format.id}
              type="button"
              role="radio"
              aria-checked={exportFormat === format.id}
              className={exportFormat === format.id ? 'active' : ''}
              onClick={() => { setExportFormat(format.id); setExportFileIndex(0) }}
            ><b>{format.label}</b><span>{format.detail}</span></button>)}
          </div>
          {exportFiles.length > 1 && <div className="export-files" role="tablist" aria-label="Project files">
            {exportFiles.map((file, index) => <button key={file.name} type="button" role="tab" aria-selected={file === exportFile} className={file === exportFile ? 'active' : ''} onClick={() => setExportFileIndex(index)}>{file.name}</button>)}
          </div>}
          <pre aria-label={`${exportFile.name} preview`}>{exportFile.text}</pre>
          <div className="export-actions">
            <button className="copy" type="button" onClick={() => void copyExport()}>{copied ? 'Copied!' : `Copy ${exportFile.name}`}</button>
            <button className="download" type="button" onClick={() => download(exportFile)}>Download {exportFile.name}</button>
            {exportFiles.length > 1 && <button className="download" type="button" onClick={() => exportFiles.forEach((file, index) => window.setTimeout(() => download(file), index * 250))}>Download all {exportFiles.length} files</button>}
          </div>
        </section>
      </div>}
      {showAbout && <div className="modal-backdrop" role="presentation" onClick={() => setShowAbout(false)}>
        <section className="modal about" role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={(event) => event.stopPropagation()}>
          <div className="modal-heading"><div><span className="eyebrow">ABOUT ARAQNEA</span><h2 id="about-title">A ZX-calculus quantum workbench</h2></div><button className="close" type="button" onClick={() => setShowAbout(false)} aria-label="Close about">×</button></div>
          <p>Araqnea lets you design quantum circuits three ways — OpenQASM 2.0 code, a gate circuit editor, and an interactive 3D ZX-calculus spider canvas — all kept in live sync.</p>
          <ul>
            <li><b>Code</b> — write or load OpenQASM 2.0 presets with instant parsing.</li>
            <li><b>Circuit gates</b> — add and remove gates on qubit wires.</li>
            <li><b>3D spiders</b> — explore the ZX graph spatially, drag picturalism elements in, box-select and move groups, double-click to connect or delete, and edit phases.</li>
            <li><b>Circuits</b> — rename, create and switch between circuits saved in your browser.</li>
            <li><b>Export</b> — OpenQASM 2.0/3.0, Qiskit, PennyLane, a Qollab project (index.html, style.css, main.js), or 3D ZX JSON.</li>
          </ul>
          <p className="about-meta">Built by Qnow Technologies · Released under the MIT License.</p>
          <div className="export-actions"><button type="button" onClick={startTour}>Take the guided tour</button><button className="copy" type="button" onClick={() => setShowAbout(false)}>Close</button></div>
        </section>
      </div>}
      {showTour && <GuidedTour steps={tourSteps} onClose={closeTour} />}
    </main>
  )
}

export default App
