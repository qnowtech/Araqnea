export type TourStep = {
  target: string
  title: string
  body: string
}

export const tourSteps: TourStep[] = [
  { target: 'brand', title: 'Welcome to Araqnea', body: 'A quantum workbench where OpenQASM code, gate circuits, and 3D ZX-calculus spider diagrams stay in live sync. This short tour shows you around.' },
  { target: 'navbar', title: 'Navigation bar', body: 'Export your circuit, run it in the gate view, restart this tour at any time, or open About for project information.' },
  { target: 'mode-tabs', title: 'Workbench modes', body: 'Switch between the Code editor, the Circuit gates view, and the 3D spiders canvas. Every mode edits the same circuit.' },
  { target: 'palette', title: 'Picturalism palette', body: 'Drag diagram elements (spiders, Hadamards, caps, cups…) onto the canvas, or click one to drop it at the view centre.' },
  { target: 'canvas', title: 'Spatial spider canvas', body: 'Your ZX graph in 3D. Drag to orbit, shift/right-drag to pan, scroll or pinch to zoom, and drag nodes to rearrange them.' },
  { target: 'canvas-toolbar', title: 'Canvas toolbar', body: 'Toggle 2D/3D projection, zoom, reset the view, and enter connect mode to wire nodes together.' },
  { target: 'legend', title: 'Graph legend', body: 'Colour key for Z spiders, X spiders, and Hadamard boxes, plus live spider and connection counts.' },
  { target: 'inspector', title: 'Node inspector', body: 'Select any spider to inspect its ID, position, and connections, edit its phase, or disconnect custom wires.' },
  { target: 'overview', title: 'Circuit overview', body: 'A summary of qubits, gates, and wires, with a shortcut to multi-format export (Qollab, OpenQASM, Qiskit, ZX JSON).' },
]
