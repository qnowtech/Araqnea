# Araqnea

![Araqnea](src/assets/araqnea.png)

Araqnea is a quantum workbench that translates OpenQASM 2.0 into synchronized gate circuits and interactive 3D ZX-calculus diagrams.

## Features

- Three synchronized workbench modes: OpenQASM editor, gate circuit, and 3D ZX graph
- Opens in **Spiders** (3D by default, switchable to 2D), with a first-visit guided UI tour (restart anytime via **Tour** in the navbar) and an **About** panel
- Presets available in every view: Bell, GHZ and Hadamard test circuits; Qiskit RealAmplitudes and EfficientSU2 ansatz; PennyLane AngleEmbedding, BasicEntanglerLayers and StronglyEntanglingLayers
- Interactive 3D spiders with node selection, phase editing, drag-to-move, animated edges, orbit, pan, and zoom
- Angle editing in both gates and Spiders: choose **Degrees** or **Radians**, then press **Enter** or **Apply**. The editor identifies the affected gate/wire. Fixed X/Y become Rx/Ry; fixed Z/S/T become Ph. CNOT/CZ/SWAP decomposition phases and Ry basis-change spiders are read-only. Palette edits affect only the diagram until **Add to circuit** is used.
- Orthographic 2D and perspective 3D graph views with camera reset and zoom controls
- One full-width spider canvas with node inspection and phase editing below it; drag empty space to orbit, shift/right-drag to pan, scroll/pinch to zoom, and double-click a node to focus
- Picturalism palette to the left of the spider canvas, inspired by Coecke & Kissinger's *Picturing Quantum Processes*: drag (or click/tap) Z/X spiders, phase spiders, Hadamard boxes, states, effects, wires, cups, caps, copy, XOR merge and discard symbols onto the canvas; re-phase, move, or remove them from the inspector
- Connect directly on the canvas: toggle **Connect**, then click/tap a source and target (or use Tab and Enter). A preview wire and highlighted targets guide the connection; **Cancel** or Escape clears the pending source. Turn Connect off to move nodes again. Use **Disconnect** in the selected node's inspector to remove a wire you added without deleting its symbols.
- Connections reject self-links, duplicates, full Hadamard boxes, and changes to circuit boundaries. Compose states/effects and fixed-port symbols through their `out`/`in` endpoints; each port accepts one external wire. Free Z/X spiders support multiple wires. At least one endpoint must be a palette symbol, keeping circuit-to-circuit wiring managed by OpenQASM.
- Palette connections are exported in ZX graph JSON, not translated into circuit gates. Editing OpenQASM clears connections to derived circuit nodes so they cannot silently attach to a different gate; palette-only connections remain intact.
- Circuit exports for OpenQASM 2.0/3.0, Qiskit Python, PennyLane Python, Qollab JavaScript, and 3D ZX graph JSON

## Presets

Select a **Circuit / ansatz preset**, review its description, and click **Load preset**. Loading replaces and renames the active circuit; duplicate it first to keep the original. The canvas fits the new circuit while keeping the chosen 2D/3D projection. All presets are explicit gate decompositions with fixed example angles, not symbolic optimization programs or Python imports. Edit the angles in OpenQASM, the gate view, or the spider inspector, then export to either Python framework.

- **RealAmplitudes**: 3 qubits, one repetition, linear CNOT entanglement and a final Ry layer.
- **EfficientSU2**: 3 qubits, one repetition, Ry/Rz rotations, linear CNOT entanglement and a final rotation layer.
- **AngleEmbedding**: RX encoding of three features `[pi/4, pi/2, pi/3]`.
- **BasicEntanglerLayers**: 3 qubits, two RX layers with ring CNOT entanglement.
- **StronglyEntanglingLayers**: 3 qubits, two layers of Rot decomposed as Rz/Ry/Rz, with CNOT ranges `[1, 2]`.

See [Qiskit circuit library](https://quantum.cloud.ibm.com/docs/en/api/qiskit/circuit_library) and [PennyLane templates](https://docs.pennylane.ai/en/stable/introduction/templates.html) for the original parametrized templates.

## OpenQASM support

The editor accepts indexed gates `h`, `x`, `y`, `z`, `s`, `t`, `rx`, `ry`, `rz`, `u1` (also accepted as `p`), `cx`, `cz`, and `swap`, plus indexed measurements. Ph is a phase shift, `diag(1, exp(iθ))`, exported as `u1` in OpenQASM 2, `p` in OpenQASM 3/Qiskit, and `PhaseShift` in PennyLane. OpenQASM angles are always radians; the UI converts degree input before updating the source (90° = pi/2). Finite numeric/pi/tau arithmetic is accepted; division by zero is rejected. A circuit can have one quantum register and an optional single classical register; custom gate definitions, Python imports and other OpenQASM constructs are not supported.

Ry is drawn as Z(−pi/2), X(θ), Z(pi/2) in wire order. ZX circuit representations omit global phase; palette-only diagrams and wires are not automatically translated to circuit gates.

## Development

```bash
npm install
npm run dev
```

Use `npm run build` for a production build, then `npm run preview` to serve that build locally. Run `npm run lint` for static checks.
Run `npm test` for angle conversion, gate mapping, Ry decomposition, preset synchronization and export regression tests. Tests use the existing TypeScript compiler and Node test runner, with temporary output cleaned up afterward.

## Attribution

Araqnea is named after Arachne, the weaver of Greek mythology transformed into a spider after challenging Athena. The workbench's formal Z/X spider language comes from ZX-calculus and is inspired by *Quantum in Pictures* by Bob Coecke and Stefano Gogioso, alongside Coecke and Kissinger's *Picturing Quantum Processes*.

This effort is supported by Qollab & IonQ.
