import type { DiagramScalar } from '../../types/zx'
import type { RunResult } from '../../lib/zx-core/run'

const bits = (index: number, count: number) => {
  const width = count <= 1 ? 1 : Math.round(Math.log2(count))
  return index.toString(2).padStart(width, '0')
}

const pretty = (value: number) => {
  if (Math.abs(value) < 1e-9) return '0'
  const magnitude = Math.abs(value)
  const body = Math.abs(magnitude - Math.SQRT1_2) < 1e-6 ? '1/√2' : Number(magnitude.toPrecision(4)).toString()
  return value < 0 ? `-${body}` : body
}

const amplitudeText = (value: DiagramScalar) => {
  const re = pretty(value.re)
  const im = pretty(value.im)
  if (im === '0') return re
  if (re === '0') return im === '1' ? 'i' : im === '-1' ? '−i' : `${im}i`
  const imag = im === '1' ? '+i' : im === '-1' ? '−i' : im.startsWith('-') ? `${im}i` : `+${im}i`
  return `${re}${imag}`
}

const percent = (value: number) => {
  if (value < 1e-9) return '0%'
  return `${Number((value * 100).toPrecision(4))}%`
}

function Counts({ entries }: { entries: Record<string, number> }) {
  const shots = Object.values(entries).reduce((sum, count) => sum + count, 0)
  return <Bars label="Histogram of counts" color="#f7b84b" entries={Object.entries(entries).sort(([left], [right]) => left.localeCompare(right)).map(([bit, count]) => ({ bit, value: shots ? count / shots : 0, caption: String(count) }))} />
}

function Bars({ label, entries, color }: { label: string; entries: { bit: string; value: number; caption: string }[]; color: string }) {
  const width = Math.max(entries.length, 1) * 56
  return <svg className="run-bars" role="img" aria-label={label} viewBox={`0 0 ${width} 118`} width={width} height={118}>
    <line x1="8" y1="78" x2={width - 8} y2="78" stroke="#2c3c52" />
    {entries.map((entry, index) => {
      const height = Math.max(0, Math.min(1, entry.value)) * 64
      return <g key={entry.bit}>
        <rect x={index * 56 + 16} y={78 - height} width={24} height={height} fill={color} rx="2" />
        <text x={index * 56 + 28} y={74 - height} textAnchor="middle" fill="#d5e7f6" fontSize="9" fontFamily="monospace">{entry.caption}</text>
        <text x={index * 56 + 28} y={96} textAnchor="middle" fill="#9aa9bb" fontSize="11" fontFamily="monospace">{entry.bit}</text>
      </g>
    })}
  </svg>
}

export function RunReport({ result }: { result: RunResult }) {
  if (!result.ok) return <p className="run-error">{result.error}</p>
  if (result.mode === 'hardware') {
    const shots = Object.values(result.counts).reduce((sum, count) => sum + count, 0)
    const entries = Object.entries(result.counts).sort(([left], [right]) => left.localeCompare(right))
    return <div className="run-output">
      <article className="run-chart">
        <h3>Counts</h3>
        <p>Hardware returns counts only. {shots} shots. Bar height is the share of shots.</p>
        <Counts entries={result.counts} />
      </article>
      <article className="run-chart">
        <h3>Outcomes</h3>
        <table className="prob-table">
          <thead><tr><th>State</th><th>Count</th><th>Share</th></tr></thead>
          <tbody>
            {entries.map(([bit, count]) => <tr key={bit}><td>{bit}</td><td>{count}</td><td>{percent(shots ? count / shots : 0)}</td></tr>)}
          </tbody>
        </table>
      </article>
    </div>
  }
  if (result.method === 'density') return <p className="run-note">The simulator returned a density matrix. This diagram has no amplitudes or counts to draw.</p>
  if (result.method === 'mps') return <p className="run-note">Approximate MPS on {result.qubits} qubits, bond {result.bond}. No exact amplitudes.</p>
  const labels = result.amplitudes.map((_, index) => bits(index, result.amplitudes.length))
  return <div className="run-output">
    <article className="run-chart">
      <h3>Probabilities</h3>
      <p>{result.safe ? 'Safe state.' : 'The state is not safe.'} Bar height is the probability, from 0 to 1.</p>
      <Bars label="City plot of probabilities" color="#30d4ad" entries={labels.map((bit) => ({ bit, value: result.probabilities[bit] ?? 0, caption: percent(result.probabilities[bit] ?? 0) }))} />
    </article>
    <article className="run-chart">
      <h3>Amplitudes</h3>
      <table className="prob-table">
        <thead><tr><th>State</th><th>Amplitude</th><th>Probability</th></tr></thead>
        <tbody>
          {labels.map((bit, index) => <tr key={bit}>
            <td>{bit}</td>
            <td>{amplitudeText(result.amplitudes[index])}</td>
            <td>{percent(result.probabilities[bit] ?? 0)}</td>
          </tr>)}
        </tbody>
      </table>
    </article>
    {result.counts && <article className="run-chart">
      <h3>Counts</h3>
      <Counts entries={result.counts} />
    </article>}
  </div>
}
