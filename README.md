# Araqnea

Araqnea is a quantum workbench that translates OpenQASM 2.0 into synchronized gate circuits and interactive 3D ZX-calculus diagrams.

## Features

- Three synchronized workbench modes: OpenQASM editor, gate circuit, and 3D ZX graph
- Live parsing with Bell, GHZ, and Hadamard test presets
- Interactive 3D spiders with node selection, phase editing, drag-to-move, animated edges, orbit, pan, and zoom
- Orthographic 2D and perspective 3D graph views with camera reset and zoom controls
- One full-width spider canvas with node inspection and phase editing below it; drag empty space to orbit, shift/right-drag to pan, scroll/pinch to zoom, and double-click a node to focus
- Picturalism palette to the left of the spider canvas, inspired by Coecke & Kissinger's *Picturing Quantum Processes*: drag (or click/tap) Z/X spiders, phase spiders, Hadamard boxes, states, effects, wires, cups, caps, copy, XOR merge and discard symbols onto the canvas, then connect, re-phase, move, or remove them from the inspector
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
