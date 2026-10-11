import type { DiagramScalar } from '../../types/zx'

const bits = (index: number, count: number) => {
  const width = Math.max(1, Math.round(Math.log2(count)))
  return index.toString(2).padStart(width, '0')
}

export function CityPlot({ amplitudes }: { amplitudes: DiagramScalar[] }) {
  const max = Math.max(...amplitudes.map((value) => Math.hypot(value.re, value.im)), 1e-9)
  const width = amplitudes.length * 36
  return <svg className="city-plot" role="img" aria-label="City plot of amplitudes" viewBox={`0 0 ${width} 96`} width={width} height={96}>
    {amplitudes.map((value, index) => {
      const height = Math.hypot(value.re, value.im) / max * 62
      return <g key={index}>
        <rect x={index * 36 + 8} y={70 - height} width={20} height={Math.max(height, 0)} fill="#30d4ad" />
        <text x={index * 36 + 18} y={86} textAnchor="middle" fill="#9aa9bb" fontSize="10" fontFamily="monospace">{bits(index, amplitudes.length)}</text>
      </g>
    })}
  </svg>
}

export function Histogram({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts)
  const max = Math.max(...entries.map(([, count]) => count), 1)
  const width = Math.max(entries.length, 1) * 36
  return <svg className="histogram" role="img" aria-label="Histogram of counts" viewBox={`0 0 ${width} 96`} width={width} height={96}>
    {entries.map(([bit, count], index) => {
      const height = count / max * 62
      return <g key={bit}>
        <rect x={index * 36 + 8} y={70 - height} width={20} height={Math.max(height, 0)} fill="#f7b84b" />
        <text x={index * 36 + 18} y={86} textAnchor="middle" fill="#9aa9bb" fontSize="10" fontFamily="monospace">{bit}</text>
      </g>
    })}
  </svg>
}
