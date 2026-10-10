import type { ReactElement } from 'react'
import { pictureElementMime, pictureElements, type PictureElementId } from '../../lib/zx-core/pictureElements'

interface SpiderPaletteProps {
  onAdd: (elementId: PictureElementId) => void
  onClear: () => void
  addedCount: number
}

const z = '#30d4ad'
const x = '#f06b7e'
const h = '#f7b84b'
const wire = '#9fb4c8'

const line = (x1: number, y1: number, x2: number, y2: number) => <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={wire} strokeWidth="2" strokeLinecap="round" />
const dot = (cx: number, cy: number, fill: string, r = 7) => <circle cx={cx} cy={cy} r={r} fill={fill} stroke="#08111d" strokeWidth="1.5" />
const phase = (text: string) => <text x="20" y="11" textAnchor="middle" fill="#e7f1fa" fontSize={text.length > 1 ? 9 : 11} fontFamily="monospace">{text}</text>
const triangle = (points: string, fill: string) => <polygon points={points} fill={fill} fillOpacity="0.2" stroke={fill} strokeWidth="1.6" strokeLinejoin="round" />

const icons: Record<PictureElementId, ReactElement> = {
  'z-spider': <>{line(4, 20, 36, 20)}{dot(20, 20, z)}</>,
  'x-spider': <>{line(4, 20, 36, 20)}{dot(20, 20, x)}</>,
  'z-phase': <>{line(4, 26, 36, 26)}{dot(20, 26, z)}{phase('π/2')}</>,
  'x-phase': <>{line(4, 26, 36, 26)}{dot(20, 26, x)}{phase('π')}</>,
  hadamard: <>{line(4, 20, 36, 20)}<rect x="13" y="13" width="14" height="14" rx="1.5" fill={h} stroke="#08111d" /></>,
  'state-zero': <>{triangle('8,10 8,30 22,20', x)}{line(22, 20, 36, 20)}{dot(13, 20, x, 4)}</>,
  'state-plus': <>{triangle('8,10 8,30 22,20', z)}{line(22, 20, 36, 20)}{dot(13, 20, z, 4)}</>,
  'effect-zero': <>{line(4, 20, 18, 20)}{triangle('32,10 32,30 18,20', x)}{dot(27, 20, x, 4)}</>,
  'effect-plus': <>{line(4, 20, 18, 20)}{triangle('32,10 32,30 18,20', z)}{dot(27, 20, z, 4)}</>,
  wire: <>{line(4, 20, 36, 20)}</>,
  cup: <path d="M36 9 H24 A11 11 0 0 0 24 31 H36" fill="none" stroke={wire} strokeWidth="2" strokeLinecap="round" />,
  cap: <path d="M4 9 H16 A11 11 0 0 1 16 31 H4" fill="none" stroke={wire} strokeWidth="2" strokeLinecap="round" />,
  copy: <>{line(4, 20, 20, 20)}{line(20, 20, 36, 10)}{line(20, 20, 36, 30)}{dot(20, 20, z)}</>,
  merge: <>{line(4, 10, 20, 20)}{line(4, 30, 20, 20)}{line(20, 20, 36, 20)}{dot(20, 20, x)}</>,
  discard: <>{line(4, 20, 22, 20)}{line(22, 10, 22, 30)}{line(27, 13, 27, 27)}{line(32, 16, 32, 24)}</>,
}

const groups = [...new Set(pictureElements.map((element) => element.group))]

export function SpiderPalette({ onAdd, onClear, addedCount }: SpiderPaletteProps) {
  return <aside className="spider-palette" data-tour="palette" aria-label="Picturalism element palette">
    <div className="spider-palette-heading"><span className="eyebrow">PICTURALISM</span><b>Diagram elements</b></div>
    {groups.map((group) => <section key={group} className="spider-palette-group" aria-label={group}>
      <h3>{group}</h3>
      <div className="spider-palette-items">
        {pictureElements.filter((element) => element.group === group).map((element) => <button
          key={element.id}
          type="button"
          draggable
          title={`${element.description} — drag onto the canvas or click to add`}
          aria-label={`Add ${element.label}`}
          data-element={element.id}
          onDragStart={(event) => {
            event.dataTransfer.setData(pictureElementMime, element.id)
            event.dataTransfer.setData('text/plain', element.id)
            event.dataTransfer.effectAllowed = 'copy'
          }}
          onClick={() => onAdd(element.id)}
        >
          <svg viewBox="0 0 40 40" aria-hidden="true">{icons[element.id]}</svg>
          <span>{element.label}</span>
        </button>)}
      </div>
    </section>)}
    <p className="spider-palette-hint">Drag a symbol onto the canvas, or click to place it at the view centre.</p>
    {addedCount > 0 && <button type="button" className="spider-palette-clear" onClick={onClear}>Clear {addedCount} added element{addedCount === 1 ? '' : 's'}</button>}
  </aside>
}
