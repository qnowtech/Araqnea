# 🚀 Spec-Driven Development (SDD): Araqnea v3.0
## Three-Mode Interactive Workbench with 3D ZX Spider Graph Visualization

> **System Prompt / Context Directive for AI Codegen (GitHub Copilot / Cursor):**
> Act as a Senior Frontend Architect, 3D Graphics Engineer (Three.js/WebGL), and Quantum Computing Specialist. Your goal is to build/upgrade the **Araqnea** web application using React 18/19, Vite, TypeScript, Tailwind CSS, Three.js (`react-force-graph-3d` / `@react-three/fiber`), and `@xyflow/react`. Follow this specification strictly, implementing the **Three-Mode Left Panel Workbench** and the **Interactive 3D Spider Graph Visualization Engine** (Neo4j 3D graph style with glowing spheres, spatial rotation, and force-directed 3D topology) for ZX-calculus diagrams, with real-time state synchronization and full export support for Qollab.xyz, OpenQASM 2.0, and Qiskit.

---

## 1. Executive Summary & Architectural Overview

**Araqnea** is an interactive web-based quantum engineering platform that bridges traditional quantum programming (OpenQASM 2.0, Qiskit) with the diagrammatic mathematics of **Quantum Pictures** (*ZX-calculus*).

### What's New in v3.0: Interactive 3D ZX Spider Graph & Three-Mode Workbench
To elevate user experience beyond flat 2D circuit diagrams, Araqnea introduces an immersive **3D Graph Representation Engine** inspired by Neo4j 3D spatial graphs and 3D force-directed networks:

1. **Immersive 3D ZX Spider Graph Engine:**
   * Spider diagrams are rendered in full 3D space ($x, y, z$) using WebGL / Three.js (`react-force-graph-3d` / `@react-three/fiber`).
   * **3D Spherical Spiders:** Green Z-spiders and Red X-spiders render as glowing 3D spheres with volumetric shaders, orbital camera controls (orbit, pan, fly-through), and spatial drag-and-drop.
   * **3D Entanglement Wires:** Quantum connections and Hadamard edges render as 3D spatial tubes/cables with animated photon particle flows.
2. **Three-Mode Workbench in Left Panel:**
   * **Mode 1: Code View** — Full-featured code editor for writing and editing OpenQASM 2.0 and Qiskit JS scripts.
   * **Mode 2: Gate Circuit View** — Visual schematic grid of traditional quantum circuits using standard gate blocks ($H, X, Z, S, T, R_x, R_z, CNOT, CZ, SWAP, \text{Measure}$).
   * **Mode 3: 3D Spider Mode (ZX Symbology)** — Interactive 3D spatial graph canvas where users can manipulate 3D ZX-calculus spiders directly in 3D space.

---

## 2. Technical Stack & Component Architecture

| Subsystem | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18+ / Vite | High-performance reactive UI with HMR |
| **Language** | TypeScript 5+ | Strict types for Circuit AST, Gate Models, and 3D ZX Graphs |
| **Styling & UI** | Tailwind CSS + Lucide Icons | Quantum dark theme, glowing nodes, modern tab controls |
| **3D Graph Engine** | `react-force-graph-3d` / Three.js / WebGL | Immersive 3D spatial spider graph, orbit controls, physics layout |
| **2D Schematic Canvas** | `@xyflow/react` (React Flow) / SVG | 2D gate grid and classic circuit schematics |
| **State Synchronization** | Zustand | Tri-directional state sync between Code, Circuit AST, and 3D ZX Graph |
| **Quantum Engine** | Custom QASM2 Parser & ZX Translator | Bi-directional mapping between gates and 3D ZX spiders |
| **Target Execution** | Qollab.xyz Runtime | Sandboxed browser execution (Pyodide / Qiskit JS) |

```text
araqnea/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── types/
    │   ├── circuit.ts          # Gate Types, Qubits, Circuit AST definition
    │   ├── zx.ts               # 3D Spider Nodes (Z, X), 3D Vectors (x,y,z), Hadamard Edges, Phases
    │   └── qollab.ts           # Execution backends & export bundle schemas
    ├── store/
    │   └── useQuantumStore.ts  # Zustand store managing sync between Code, AST, & 3D ZX Graph
    ├── lib/
    │   ├── parsers/
    │   │   ├── qasm2Parser.ts  # OpenQASM 2.0 -> AST
    │   │   └── qiskitParser.ts # Qiskit JS -> AST
    │   ├── zx-core/
    │   │   ├── translator.ts   # AST <-> 3D ZX Graph Translation Engine
    │   │   ├── layout3d.ts     # 3D Force-Directed DAG Layout generator (x, y, z spatial placement)
    │   │   └── simplifier.ts   # Spider Fusion & Identity Removal algorithms
    │   └── exporters/
    │       ├── qasmExporter.ts # AST/Graph -> OpenQASM 2.0 (.qasm)
    │       ├── qiskitExporter.ts# AST -> Qiskit Python (.py)
    │       └── qollabExporter.ts# Web bundle generator (main.js + index.html)
    ├── components/
    │   ├── layout/
    │   │   ├── HeaderNav.tsx   # Top nav with mode selector, preset loader, & Export button
    │   │   ├── LeftPanel.tsx   # Container switching between Code, Gate, and 3D Spider views
    │   │   └── RightPanel.tsx  # 3D Spider Inspector, 3D Graph Preview, & Backend Run Dock
    │   ├── views/
    │   │   ├── CodeView.tsx            # [Mode 1] Code Editor with syntax feedback
    │   │   ├── GateCircuitView.tsx     # [Mode 2] Standard gate circuit grid visualizer
    │   │   └── Spider3DCanvasView.tsx  # [Mode 3] Interactive 3D Spatial ZX Spider Graph (Neo4j 3D style)
    │   ├── 3d/
    │   │   ├── Spider3DSphere.tsx      # WebGL 3D Emerald Z-spider / Ruby X-spider sphere
    │   │   ├── Hadamard3DBox.tsx       # WebGL 3D Hadamard cube
    │   │   ├── Quantum3DWire.tsx       # WebGL 3D spatial tube with animated flow
    │   │   └── Graph3DControls.tsx     # Camera orbit, reset view, 2D/3D projection toggle
    │   ├── palette/
    │   │   ├── GatePalette.tsx         # Palette for Mode 2 (Common gates)
    │   │   └── SpiderPalette.tsx       # Palette for Mode 3 (3D ZX spiders & symbology)
    │   ├── simulation/
    │   │   ├── BackendSelector.tsx     # IBM Quantum & IonQ simulator selector
    │   │   └── ResultsChart.tsx        # Measurement probability histogram
    │   └── export/
    │       └── ExportModal.tsx         # Export dialog for Qollab, QASM, Qiskit
    └── data/
        └── examples.ts             # Preset circuits (Bell, GHZ, Teleportation, QFT)
```

---

## 3. Left Panel Specifications (3-Mode Workbench)

The Left Panel contains a prominent **Mode Selector Toggle Bar**:
`[ 💻 Code ]` `[ 🔲 Circuit Gates ]` `[ 🕸️ 3D Spider Mode ]`

---

### 🟢 Mode 1: Code View (`CodeView.tsx`)
* **Purpose:** Direct text-based quantum programming.
* **UX/UI Highlights:**
  * Monospace text editor with line numbers, syntax highlighting, and live syntax validation.
  * Supports switching syntax between **OpenQASM 2.0** and **Qiskit JS**.
  * Quick-Load Presets dropdown (Bell State, GHZ State, Quantum Teleportation, Quantum Fourier Transform).
  * Auto-translates code changes into the Gate AST and 3D ZX Spider Graph in real time upon keystroke pause (300ms debounce).

---

### 🔵 Mode 2: Common Gates Circuit View (`GateCircuitView.tsx`)
* **Purpose:** Graphical schematic visualization using traditional quantum logic gates.
* **UX/UI Highlights:**
  * Horizontal multi-qubit grid showing qubit lines ($q_0, q_1, \dots, q_n$) and classical registers ($c$).
  * **Gate Palette Toolbar:** Interactive drag-and-drop / click-to-place gate blocks:
    * Single-qubit gates: $H$ (Hadamard), $X$ (NOT), $Y$, $Z$, $S$, $T$, $R_x(\theta)$, $R_z(\theta)$.
    * Two-qubit entangling gates: $CNOT$ ($CX$), $CZ$, $SWAP$.
    * Measurement gates: $\text{Measure} \rightarrow c[i]$.
  * **Usability & Drag-and-Drop:**
    * Users can drag gates from the palette onto qubit wires or reorder gates along the timeline.

---

### 🟣 Mode 3: 3D Spider Mode — Interactive 3D ZX Graph (`Spider3DCanvasView.tsx`)
* **Purpose:** Immersive 3D graph workbench rendering *ZX-calculus* (*Quantum Pictures*) diagrams as a 3D spatial network (Neo4j 3D graph style).
* **UX/UI Highlights:**
  * **Neo4j 3D Graph Aesthetic:**
    * **Glowing 3D Z-Spiders (Emerald Green `#10b981`):** Rendered as 3D volumetric spheres with halo bloom shaders. Internal phase labels ($\alpha = 0, \pi, \pi/2, \pi/4$) float as 3D billboard text facing the camera.
    * **Glowing 3D X-Spiders (Ruby Red `#ef4444`):** Rendered as 3D red spheres with phase labels $\beta$.
    * **3D Hadamard Boxes (Gold `#f59e0b`):** Rendered as metallic 3D cubes or yellow 3D spatial links.
    * **3D Quantum Wires & Entanglement Cables:** Rendered as 3D curved cylinder tubes connecting spatial nodes in $(x,y,z)$ space. Animated light pulses flow along cables to indicate quantum state propagation.
  * **3D Interaction & Camera Controls:**
    * **Orbit, Pan, Zoom & Fly-Through:** Full 360° mouse/touch rotation, pan, zoom, and focus-on-spider double-click.
    * **3D Spatial Drag-and-Drop:** Click and drag any 3D sphere node in 3D space; physics forces recalculate graph layout in real time.
    * **Node Selection & Highlighting:** Clicking a 3D spider node illuminates its connected 3D wire cluster and updates the Right Panel Inspector.
  * **Interactive Spider Manipulations:**
    * **Phase Editing:** Adjust spider phase via 3D gizmo or Right Panel.
    * **Spider Fusion:** Select two adjacent 3D spiders of the same color and click **"Fuse Spiders"** to collapse them into a single 3D sphere with combined phase ($\alpha_1 + \alpha_2$).

---

## 4. Right Panel: 3D Spider Representation & Inspector

When working in **Code View (Mode 1)** or **Gate Circuit View (Mode 2)**, the **Right Panel** features a dedicated **Interactive 3D Spider Inspector & Mini-Canvas Widget**:

### 🕸️ 3D Spider Graph Preview & Inspector (`RightPanel.tsx`)
* **Real-time 3D Viewport:** Displays the live 3D spider graph of the active quantum circuit in 3D space, regardless of which view mode is active on the left.
* **Full 3D Rotation & Focus:** Users can interactively rotate, zoom, and inspect the 3D topology of spiders, wires, and entanglement loops while typing code or moving gates.
* **Selected Node Properties:**
  * Node ID, Type (3D Green Z-Spider, 3D Red X-Spider, 3D Hadamard Cube).
  * Phase angle (Radians $\pi$, Degrees, Fractional string like `pi/2`).
  * Spatial Coordinates: $(X, Y, Z)$ position in 3D graph space.
  * Connected 3D edges and neighbor list.
  * Quick Actions: *Invert Phase*, *Convert Z <-> X*, *Fuse with Neighbor*, *Center Camera on Node*.

### ⚡ Qollab Execution & Results Dock (`BackendSelector.tsx` & `ResultsChart.tsx`)
* **Backend Selection:** Choose target execution environment:
  * **Qollab Local Browser Simulator** (up to 20 qubits).
  * **IBM Quantum Simulator (Qiskit API)**.
  * **IonQ QPU / Simulator**.
* **Run Button & Probability Histogram:** Sends the circuit for execution and renders state measurement outcomes ($|00\rangle, |01\rangle, |10\rangle, |11\rangle$, etc.).

---

## 5. State Synchronization Matrix

```text
               ┌─────────────────────────────────┐
               │      Global Quantum Store       │
               │  - Code (QASM / Qiskit)         │
               │  - Circuit AST (Gate List)      │
               │  - 3D ZX Graph (Nodes & Edges)  │
               └───────────────┬─────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
   [ Mode 1: Code ]    [ Mode 2: Gates ]    [ Mode 3: 3D Spiders ]
```

* **Code $\rightarrow$ Gates & 3D ZX Spiders:** Editing text parses code, updates the AST, and positions 3D spider nodes in 3D space using force-directed 3D layout (`layout3d.ts`).
* **Gates $\rightarrow$ Code & 3D ZX Spiders:** Dragging a gate adds it to the AST, regenerates QASM code, and spawns the corresponding 3D spiders and 3D spatial wires.
* **3D ZX Spiders $\rightarrow$ Gates & Code:** Moving or fusing 3D spiders updates graph topology, synthesizes back to standard gates, and updates code in real time.

---

## 6. Multi-Format Export Engine

Araqnea provides an **Export Modal** to download or copy files formatted for **Qollab.xyz**, **OpenQASM 2.0**, and **Qiskit**:

1. **Qollab Web Bundle (`main.js` + `index.html`):**
   * Browser-executable JavaScript compliant with Qollab's runtime rules:
   * Uses `import { QuantumCircuit } from 'qiskit';`.
   * Strictly avoids `new` keyword: `const circuit = QuantumCircuit(qubits, bits);`.
   * Invokes: `const job = await backend.run(circuit, { shots: 1000 });`.
   * Unpacks result dictionary: `const counts = (await job.result()).get_counts().toJs();`.
2. **OpenQASM 2.0 File (`.qasm`):** Standard QASM format with `OPENQASM 2.0; include "qelib1.inc";`.
3. **Qiskit Python Script (`.py`):** Standalone Python script for local or IBM Quantum execution.
4. **3D ZX Graph JSON (`.json`):** Export of 3D spider nodes, $(x,y,z)$ positions, phases, and 3D connectivity edges.

---

## 7. Implementation Backlog & Work Items

| ID | Module | Description | Priority |
| :--- | :--- | :--- | :--- |
| **ARQ-201** | `store/useQuantumStore.ts` | Implement Zustand state manager for Code, Gate AST, and 3D ZX Graph. | **P0** |
| **ARQ-202** | `3d/Spider3DSphere.tsx` | Build WebGL 3D glowing sphere component for Z (green) & X (red) spiders with 3D text labels. | **P0** |
| **ARQ-203** | `views/Spider3DCanvasView.tsx` | Implement Neo4j-style 3D force-directed spider graph using `react-force-graph-3d` / Three.js. | **P0** |
| **ARQ-204** | `components/layout/RightPanel.tsx` | Create Right Panel with interactive 3D Spider preview viewport & node property inspector. | **P0** |
| **ARQ-205** | `views/CodeView.tsx` | Build code editor with OpenQASM 2.0 / Qiskit JS parsing and preset loader. | **P0** |
| **ARQ-206** | `views/GateCircuitView.tsx` | Build traditional gate circuit grid with drag-and-drop gate palette. | **P0** |
| **ARQ-207** | `lib/zx-core/translator.ts` | Bi-directional translation logic between Gate AST and 3D ZX Spider Graph. | **P0** |
| **ARQ-208** | `exporters/qollabExporter.ts` | Bundle generator for Qollab `main.js` following Qiskit JS browser specs. | **P1** |
| **ARQ-209** | `simulation/` | Backend execution selector (IBM Quantum & IonQ) and measurement probability chart. | **P1** |

---

## 8. GitHub Copilot / Cursor Starter Prompt

```markdown
Build the "Araqnea v3.0" React + Vite + TypeScript application featuring a 3D ZX Spider Graph Visualizer and Three-Mode Left Panel:

1. Create `src/types/circuit.ts` and `src/types/zx.ts` defining GateAST, ZSpider3D (green sphere), XSpider3D (red sphere), HadamardBox3D, 3D position vectors (x, y, z), and ZXGraph3D.
2. Implement `src/store/useQuantumStore.ts` with Zustand to synchronize Code, Gate AST, and 3D ZX Graph states.
3. Build the 3D Spider Visualizer using `react-force-graph-3d` and Three.js in `src/views/Spider3DCanvasView.tsx` (Neo4j-style 3D graph with glowing green Z-spider spheres, red X-spider spheres, 3D Hadamard boxes, and spatial cables).
4. Implement `src/components/layout/RightPanel.tsx` with an interactive 3D Spider Graph preview viewport and inspector.
5. Create `src/components/layout/LeftPanel.tsx` with tab switching between CodeView, GateCircuitView, and Spider3DCanvasView.
6. Create `src/lib/exporters/qollabExporter.ts` to output Qollab main.js using Qiskit JS conventions (no 'new' keyword, await backend.run(), .toJs()).
```
