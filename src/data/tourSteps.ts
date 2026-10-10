export type TourStep = {
  target: string
  title: string
  body: string
}

export const tourSteps: TourStep[] = [
  { target: 'brand', title: 'Welcome to Araqnea', body: 'A quantum workbench where OpenQASM code, gate circuits, and 3D ZX-calculus spider diagrams stay in live sync. This short tour shows you around.' },
  { target: 'navbar', title: 'Navigation bar', body: 'Export your circuit (OpenQASM 2/3, Qiskit, PennyLane, Qollab project, ZX JSON), run it in the gate view, restart this tour, or open About.' },
  { target: 'mode-tabs', title: 'Workbench modes', body: 'Switch between the Code editor, the Circuit gates view, and the 3D spiders canvas. Every mode edits the same circuit.' },
  { target: 'palette', title: 'Picturalism palette', body: 'Drag diagram elements (spiders, Hadamards, caps, cups…) onto the canvas, or click one to drop it at the view centre. Drop a spider on a qubit wire to add it as a gate.' },
  { target: 'canvas', title: 'Spatial spider canvas', body: 'Your ZX graph in 3D. Hover a node to learn what it does, drag nodes to rearrange them, and double-click a node to connect it or delete it with its ×.' },
  { target: 'canvas-toolbar', title: 'Canvas toolbar', body: 'Select all nodes, box-select a group to move it together, zoom, reset the view, and toggle the 2D/3D projection.' },
  { target: 'legend', title: 'Graph legend', body: 'Colour key for Z spiders, X spiders, and Hadamard boxes, plus live spider and connection counts.' },
  { target: 'inspector', title: 'Node inspector', body: 'Select any spider to inspect its ID, position, and connections, edit its phase, or disconnect custom wires.' },
  { target: 'overview', title: 'Circuit overview', body: 'A summary of qubits, gates, wires and saved circuits. Rename the circuit with its title and switch circuits from the workspace header.' },
]
