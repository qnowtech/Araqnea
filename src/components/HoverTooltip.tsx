import { useEffect, useRef, useState } from 'react'

interface TipState {
  text: string
  x: number
  y: number
  placement: 'above' | 'below'
}

const findTipTarget = (target: EventTarget | null) =>
  target instanceof Element ? target.closest<HTMLElement>('[data-tip]') : null

/**
 * One tooltip for the whole app. Any element with a `data-tip` attribute shows it on hover or keyboard focus.
 * The first line of the tip is rendered as its title. Rendering in a fixed layer avoids clipping inside scroll panes.
 */
export function HoverTooltip() {
  const [tip, setTip] = useState<TipState>()
  const timer = useRef(0)
  const current = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const show = (element: HTMLElement) => {
      const text = element.dataset.tip
      if (!text) return
      const rect = element.getBoundingClientRect()
      const placement = rect.bottom + 120 > window.innerHeight ? 'above' : 'below'
      setTip({ text, x: rect.left + rect.width / 2, y: placement === 'below' ? rect.bottom + 8 : rect.top - 8, placement })
    }
    const enter = (event: Event, delay: number) => {
      const element = findTipTarget(event.target)
      if (element === current.current) return
      window.clearTimeout(timer.current)
      current.current = element
      if (!element) {
        setTip(undefined)
        return
      }
      timer.current = window.setTimeout(() => show(element), delay)
    }
    const leave = (event: Event) => {
      const next = findTipTarget((event as FocusEvent | PointerEvent).relatedTarget)
      if (next === current.current) return
      window.clearTimeout(timer.current)
      current.current = null
      setTip(undefined)
    }
    const hide = () => {
      window.clearTimeout(timer.current)
      current.current = null
      setTip(undefined)
    }
    const over = (event: Event) => enter(event, 220)
    const focus = (event: Event) => enter(event, 0)
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') hide() }
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerout', leave)
    document.addEventListener('focusin', focus)
    document.addEventListener('focusout', leave)
    document.addEventListener('pointerdown', hide, true)
    document.addEventListener('keydown', key)
    window.addEventListener('scroll', hide, true)
    return () => {
      window.clearTimeout(timer.current)
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerout', leave)
      document.removeEventListener('focusin', focus)
      document.removeEventListener('focusout', leave)
      document.removeEventListener('pointerdown', hide, true)
      document.removeEventListener('keydown', key)
      window.removeEventListener('scroll', hide, true)
    }
  }, [])

  if (!tip) return null
  const [title, ...body] = tip.text.split('\n')
  const left = Math.min(Math.max(tip.x, 150), window.innerWidth - 150)
  return <div className={`hover-tip ${tip.placement}`} role="tooltip" style={{ left, top: tip.y }}>
    <b>{title}</b>
    {body.map((line, index) => <span key={index}>{line}</span>)}
  </div>
}
