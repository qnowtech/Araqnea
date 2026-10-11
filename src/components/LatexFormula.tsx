import { useMemo } from 'react'
import katex from 'katex'

type LatexFormulaProps = {
  latex: string
  display?: boolean
}

export function LatexFormula({ latex, display = false }: LatexFormulaProps) {
  const html = useMemo(() => {
    if (!latex) return ''
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: display,
      // HTML only: MathML keeps a TeX <annotation> that shows as raw LaTeX if CSS fails to hide it.
      output: 'html',
    })
  }, [latex, display])

  if (!html) return null
  return <span className="latex-formula" dangerouslySetInnerHTML={{ __html: html }} />
}
