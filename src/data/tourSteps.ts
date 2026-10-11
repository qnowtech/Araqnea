export type TourStep = {
  target: string
  title: string
  body: string
}

export const tourSteps: TourStep[] = [
  { target: 'brand', title: 'Welcome to Araqnea', body: 'A quantum workbench where OpenQASM code, gate circuits, and 3D ZX-calculus spider diagrams stay in live sync. This short tour shows you around.' },
  { target: 'navbar', title: 'Navigation bar', body: 'Export your circuit (OpenQASM 2/3, Qiskit, PennyLane, Qollab project, ZX JSON), restart this tour, or open About. Simulator and hardware run from the overview.' },
  { target: 'mode-tabs', title: 'Workbench modes', body: 'Switch between the Code editor, the Circuit gates view, and the Spiders canvas. Every mode edits the same circuit.' },
  { target: 'palette', title: 'Picturalism palette', body: 'Drag diagram elements onto the canvas, or load a Qiskit circuit-library preset. A preset replaces the circuit in the code, the gates and the spiders.' },
  { target: 'canvas', title: 'Spider canvas', body: 'The ZX graph opens flat. Hover a node to learn what it does, drag nodes to rearrange them, and double-click a node to connect it or delete it with its ×.' },
  { target: 'canvas-toolbar', title: 'Canvas toolbar', body: 'Select all nodes, box-select a group, zoom, reset the view, turn time upward, or switch to the 3D view.' },
  { target: 'legend', title: 'Graph legend', body: 'Green and white are Z, red and gray are X, amber is Hadamard. A single stroke is a quantum wire and a double stroke is an ordinary wire. The class mark is the one the diagram already has.' },
  { target: 'inspector', title: 'Node inspector', body: 'Select any spider to read its formula, inspect its position and connections, and edit its phase in degrees or in π.' },
  { target: 'overview', title: 'Circuit overview', body: 'The formula of the whole diagram, the qubit and gate counts, and the simulator and hardware actions. The key stays on screen and out of the circuit.' },
]
