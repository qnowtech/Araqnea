import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { TourStep } from '../data/tourSteps'

type Rect = { top: number; left: number; width: number; height: number }

const padding = 8
const cardWidth = 320
const gap = 14

const measure = (target: string): Rect | undefined => {
  const element = document.querySelector(`[data-tour="${target}"]`)
  if (!element) return undefined
  const box = element.getBoundingClientRect()
  return { top: box.top - padding, left: box.left - padding, width: box.width + padding * 2, height: box.height + padding * 2 }
}

export function GuidedTour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect>()
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  const cardRef = useRef<HTMLElement>(null)
  const step = steps[index]
  const last = index === steps.length - 1

  useLayoutEffect(() => {
    const element = document.querySelector(`[data-tour="${step.target}"]`)
    element?.scrollIntoView({ block: 'center', inline: 'nearest' })
    const update = () => {
      setRect(measure(step.target))
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [step.target])

  useEffect(() => {
    cardRef.current?.focus()
  }, [index])

  useEffect(() => {
    const previous = document.activeElement
    return () => {
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowRight') setIndex((current) => Math.min(current + 1, steps.length - 1))
      else if (event.key === 'ArrowLeft') setIndex((current) => Math.max(current - 1, 0))
      else if (event.key === 'Tab' && cardRef.current) {
        const focusable = Array.from(cardRef.current.querySelectorAll<HTMLElement>('button'))
        if (!focusable.length) return
        const first = focusable[0]
        const lastButton = focusable[focusable.length - 1]
        const active = document.activeElement
        if (event.shiftKey && (active === first || !cardRef.current.contains(active))) {
          event.preventDefault()
          lastButton.focus()
        } else if (!event.shiftKey && (active === lastButton || !cardRef.current.contains(active))) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, steps.length])

  const viewportWidth = viewport.width
  const viewportHeight = viewport.height
  const width = Math.min(cardWidth, viewportWidth - 24)
  let cardStyle: CSSProperties = { width, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  if (rect) {
    const left = Math.min(Math.max(12, rect.left), viewportWidth - width - 12)
    const below = rect.top + rect.height + gap
    const spaceBelow = viewportHeight - below
    if (spaceBelow >= 190) cardStyle = { width, left, top: below }
    else if (rect.top - gap >= 190) cardStyle = { width, left, bottom: viewportHeight - rect.top + gap }
    else cardStyle = { width, left: Math.max(12, viewportWidth - width - 24), bottom: 24 }
  }

  return <div className="tour-layer" role="presentation">
    <div className="tour-blocker" onClick={onClose} />
    {rect
      ? <div className="tour-spotlight" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />
      : <div className="tour-dim" />}
    <section ref={cardRef} className="tour-card" style={cardStyle} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body" tabIndex={-1}>
      <span className="eyebrow">GUIDED TOUR · {index + 1} / {steps.length}</span>
      <h2 id="tour-title">{step.title}</h2>
      <p id="tour-body">{step.body}</p>
      <div className="tour-progress" aria-hidden="true">{steps.map((item, i) => <i key={item.target} className={i === index ? 'active' : ''} />)}</div>
      <div className="tour-actions">
        <button type="button" className="tour-skip" onClick={onClose}>Skip tour</button>
        <span>
          {index > 0 && <button type="button" onClick={() => setIndex(index - 1)}>Back</button>}
          <button type="button" className="tour-next" onClick={() => last ? onClose() : setIndex(index + 1)}>{last ? 'Finish' : 'Next'}</button>
        </span>
      </div>
    </section>
  </div>
}
