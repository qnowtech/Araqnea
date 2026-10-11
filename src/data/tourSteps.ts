export type TourStep = {
  target: string
  title: string
  body: string
}

export const tourSteps: TourStep[] = [
  { target: 'brand', title: 'Welcome to Araqnea', body: 'A quantum workbench where OpenQASM code, gate circuits, and 3D ZX-calculus spider diagrams stay in live sync. This short tour shows you around.' },
  { target: 'navbar', title: 'Navigation bar', body: 'Export your circuit (OpenQASM 2/3, Qiskit, PennyLane, Qollab project, ZX JSON), restart this tour, or open About. Simulator and hardware run from the overview.' },
  { target: 'mode-tabs', title: 'Workbench modes', body: 'Switch between Code, Circuit gates, and Spiders. Every mode edits the same circuit. Presets live in the selector above these tabs.' },
  { target: 'palette', title: 'Picturalism palette', body: 'Click a symbol to place it, or double-click it to mark every node it can join. Drop a spider on a qubit wire to add it as a gate.' },
  { target: 'canvas', title: 'Spider canvas', body: 'The ZX graph opens flat, with time running upward. Hover a node to learn what it does, drag nodes to rearrange them, and double-click a node to connect it or delete it with its ×.' },
  { target: 'canvas-toolbar', title: 'Canvas toolbar', body: 'Select all nodes, box-select a group, zoom, reset the view, turn time left to right, or switch to the 3D view.' },
  { target: 'legend', title: 'Graph legend', body: 'Green and white are Z, red and gray are X, amber is Hadamard. A single stroke is a quantum wire and a double stroke is an ordinary wire. The class mark is the one the diagram already has.' },
  { target: 'inspector', title: 'Node inspector', body: 'Select a spider to read its formula. Editable phases show their target gate and a degrees or radians selector; press Enter or Apply. Composite-gate phases are fixed. Palette phases stay on the diagram until you add them to the circuit.' },
  { target: 'overview', title: 'Circuit overview', body: 'The formula of the whole diagram, then the simulator and hardware actions. Amplitudes, probabilities and counts appear under those actions. The key stays on screen and out of the circuit.' },
]
