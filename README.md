# Araqnea

![Araqnea](src/assets/araqnea.png)

Araqnea is a quantum workbench that translates OpenQASM 2.0 into synchronized gate circuits and interactive 3D ZX-calculus diagrams.

## Features

- Three synchronized workbench modes: OpenQASM editor, gate circuit, and 3D ZX graph
- Opens in the 3D spiders view by default, with a first-visit guided UI tour (restart anytime via **Tour** in the navbar) and an **About** panel
- Live parsing with Bell, GHZ, and Hadamard test presets
- Interactive 3D spiders with node selection, phase editing, drag-to-move, animated edges, orbit, pan, and zoom
- Orthographic 2D and perspective 3D graph views with camera reset and zoom controls
- One full-width spider canvas with node inspection and phase editing below it; drag empty space to orbit, shift/right-drag to pan, scroll/pinch to zoom, and double-click a node to focus
- Picturalism palette to the left of the spider canvas, inspired by Coecke & Kissinger's *Picturing Quantum Processes*: drag (or click/tap) Z/X spiders, phase spiders, Hadamard boxes, states, effects, wires, cups, caps, copy, XOR merge and discard symbols onto the canvas; re-phase, move, or remove them from the inspector
- Connect directly on the canvas: toggle **Connect**, then click/tap a source and target (or use Tab and Enter). A preview wire and highlighted targets guide the connection; **Cancel** or Escape clears the pending source. Turn Connect off to move nodes again. Use **Disconnect** in the selected node's inspector to remove a wire you added without deleting its symbols.
- Connections reject self-links, duplicates, full Hadamard boxes, and changes to circuit boundaries. Compose states/effects and fixed-port symbols through their `out`/`in` endpoints; each port accepts one external wire. Free Z/X spiders support multiple wires. At least one endpoint must be a palette symbol, keeping circuit-to-circuit wiring managed by OpenQASM.
- Palette connections are exported in ZX graph JSON, not translated into circuit gates. Editing OpenQASM clears connections to derived circuit nodes so they cannot silently attach to a different gate; palette-only connections remain intact.
- Circuit exports for OpenQASM 2.0, Qiskit Python, Qollab JavaScript, and 3D ZX graph JSON

## OpenQASM support

The editor accepts indexed gates `h`, `x`, `y`, `z`, `s`, `t`, `rx`, `rz`, `cx`, `cz`, and `swap`, plus indexed measurements. A circuit can have one quantum register and an optional single classical register; custom gate definitions and other OpenQASM constructs are not supported.

## Development

```bash
npm install
npm run dev
```

Use `npm run build` for a production build, then `npm run preview` to serve that build locally. Run `npm run lint` for static checks.

## Attribution

This effort is supported by Qollab & IonQ.
