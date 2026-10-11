export type TourStep = {
  target: string
  title: string
  body: string
}

export const tourSteps: TourStep[] = [
  { target: 'brand', title: 'Welcome to Araqnea', body: 'A quantum workbench where OpenQASM code, gate circuits, and ZX-calculus spider diagrams stay in live sync. This short tour shows you around.' },
  { target: 'navbar', title: 'Navigation bar', body: 'Export your circuit from here (OpenQASM 2.0/3.0, Qiskit, PennyLane, a runnable Qollab project, or ZX graph JSON), restart this tour, or open About. The LIVE SYNC badge shows every view tracks the same circuit.' },
  { target: 'mode-tabs', title: 'Workbench modes', body: 'Switch between Code, Circuit gates, and Spiders. Every mode edits the same circuit. The preset library sits above these tabs: 48 circuits across standard gates, oracles, ansatzes, arithmetic, and more — select one, read its description, and press Load preset.' },
  { target: 'palette', title: 'Picturalism palette', body: 'Fifteen symbols in three groups — generators (Z/X spiders, phases, Hadamard), states and effects (|0⟩, |+⟩, ⟨0|, ⟨+|), and wires and processes (wire, cup, cap, copy, XOR merge, discard). Click a symbol to place it, or double-click it to mark every node it can join. Drop a spider on a qubit wire to add it as a gate.' },
  { target: 'canvas', title: 'Spider canvas', body: 'The ZX graph opens flat, with time running upward. Hover a node to learn what it does, drag nodes to rearrange them, and double-click a node to connect it or delete it with its ×.' },
  { target: 'canvas-toolbar', title: 'Canvas toolbar', body: 'All selects every node, ▭ Box box-selects a group, +/− zoom, ⌂ resets the camera, ↑/→ turns time upward or rightward, and 2D/3D switches between the orthographic and orbital views.' },
  { target: 'legend', title: 'Graph legend', body: 'Green is Z, red is X, amber is Hadamard. A single stroke is a quantum wire and a double stroke is an ordinary wire. The class mark names the diagram, and the tally counts spiders and connections.' },
  { target: 'inspector', title: 'Node inspector', body: 'Select a spider to read its formula. Editable phases show their target gate with a degrees-or-radians selector; press Enter or Apply. Composite-gate phases are fixed. Palette phases stay on the diagram until you press Add to circuit. Connect from here starts a wire, and per-wire Disconnect removes one you added.' },
  { target: 'overview', title: 'Circuit overview', body: 'The circuit title and formula, the qubit, gate and wire tallies, then the Simulator and Hardware actions. Probabilities, amplitudes and counts appear under those actions once a run finishes. The hardware Key stays on screen and out of the circuit.' },
]
