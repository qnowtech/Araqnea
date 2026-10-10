import { examples } from '../../data/examples'
import type { Vector3, ZXGraph3D } from '../../types/zx'

export interface SavedCircuit {
  id: string
  title: string
  source: string
  added: ZXGraph3D
  positions: Record<string, Vector3>
  updatedAt: number
}

export interface CircuitLibrary {
  activeId: string
  circuits: SavedCircuit[]
}

export const libraryStorageKey = 'araqnea.circuits.v1'
export const defaultTitle = 'Untitled circuit'

export const createCircuit = (title = defaultTitle, source: string = examples['Bell state']): SavedCircuit => ({
  id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
  title,
  source,
  added: { nodes: [], edges: [] },
  positions: {},
  updatedAt: Date.now(),
})

const isCircuit = (value: unknown): value is SavedCircuit => {
  const item = value as SavedCircuit
  return Boolean(item) && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.source === 'string'
    && Array.isArray(item.added?.nodes) && Array.isArray(item.added?.edges) && typeof item.positions === 'object' && item.positions !== null
}

export function loadLibrary(): CircuitLibrary {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(libraryStorageKey) ?? 'null') as CircuitLibrary | null
    const circuits = Array.isArray(parsed?.circuits) ? parsed.circuits.filter(isCircuit) : []
    if (circuits.length) {
      return { activeId: circuits.some((circuit) => circuit.id === parsed?.activeId) ? parsed!.activeId : circuits[0].id, circuits }
    }
  } catch {
    // Corrupt or unavailable storage: fall back to a fresh library.
  }
  const circuit = createCircuit()
  return { activeId: circuit.id, circuits: [circuit] }
}

export function saveLibrary(library: CircuitLibrary) {
  try {
    window.localStorage.setItem(libraryStorageKey, JSON.stringify(library))
  } catch {
    // Storage may be unavailable (private mode or quota); keep working in memory.
  }
}

export const uniqueTitle = (library: CircuitLibrary, base: string) => {
  const titles = new Set(library.circuits.map((circuit) => circuit.title))
  if (!titles.has(base)) return base
  let index = 2
  while (titles.has(`${base} ${index}`)) index += 1
  return `${base} ${index}`
}
