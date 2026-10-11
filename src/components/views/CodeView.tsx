interface CodeViewProps {
  source: string
  error?: string
  qubits: number
  onChange: (value: string) => void
}

export function CodeView({ source, error, qubits, onChange }: CodeViewProps) {
  const lineCount = source.split('\n').length
  return (
    <section className="mode-content code-view">
      <div className="view-title">
        <div><span className="eyebrow">MODE 01 · CODE</span><h2>OpenQASM 2.0</h2></div>
        <span className={`status ${error ? 'error' : ''}`}>{error ?? '● Valid circuit'}</span>
      </div>
      <div className="code-toolbar">
        <span>{qubits} qubits</span>
      </div>
      <div className="code-editor">
        <div className="line-numbers" aria-hidden="true">{Array.from({ length: lineCount }, (_, index) => <span key={index}>{index + 1}</span>)}</div>
        <textarea
          aria-label="OpenQASM editor"
          spellCheck={false}
          value={source}
          onChange={(event) => onChange(event.target.value)}
          wrap="off"
        />
      </div>
      <p className="editor-hint">Changes are parsed live and synchronized with gates and Spiders. OpenQASM angles use radians (e.g. pi/2 = 90°). Ph is written as u1 in OpenQASM 2.</p>
    </section>
  )
}
