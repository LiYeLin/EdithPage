import Matter from 'matter-js'
import type { TemplateInteractionState } from '../types'

type Drag = {
  body: Matter.Body; id: string; element: HTMLElement; pointerId: number
  startX: number; startY: number; dx: number; dy: number; moved: boolean
}

/** Pointer capture is paired with window listeners: leaving an icon/window must never strand a drag. */
export function bindSceneDrag(stage: HTMLElement, options: {
  bodyFor: (id: string) => Matter.Body | undefined
  blocked: () => boolean
  sync: () => void
  release: (body: Matter.Body) => void
  save?: () => void
  report: (state: TemplateInteractionState) => void
}) {
  let active: Drag | null = null
  let removeSessionListeners: (() => void) | null = null
  const suppressed = new Set<string>()
  let explicitClick = false

  const finish = (cancelled: boolean, pointerId?: number) => {
    const drag = active
    if (!drag || (pointerId !== undefined && pointerId !== drag.pointerId)) return
    active = null
    removeSessionListeners?.()
    removeSessionListeners = null
    if (drag.element.hasPointerCapture(drag.pointerId)) drag.element.releasePointerCapture(drag.pointerId)
    Matter.Body.setStatic(drag.body, false)
    options.release(drag.body)
    options.sync()
    options.save?.()
    // Suppression belongs to this gesture/site, not a global timer (which swallows fast subsequent clicks).
    suppressed.add(drag.id)
    options.report({ dragging: false, settling: false })
    if (!cancelled && !drag.moved) {
      explicitClick = true
      try { drag.element.querySelector<HTMLAnchorElement>('a')?.click() } finally { explicitClick = false }
    }
  }
  const down = (event: PointerEvent) => {
    const target = event.target as HTMLElement
    if (options.blocked() || active || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)
      || target.closest('[data-editing-interactive]')) return
    const element = target.closest<HTMLElement>('.beijing-icon-link')
    const id = element?.dataset.siteId
    const body = id ? options.bodyFor(id) : undefined
    if (!body || !id || !element) return
    suppressed.delete(id)
    const rect = stage.getBoundingClientRect()
    active = { body, id, element, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      dx: body.position.x - event.clientX + rect.left, dy: body.position.y - event.clientY + rect.top, moved: false }
    // Hold still during a tap and follow the pointer exactly while dragging, even between physics ticks.
    Matter.Sleeping.set(body, false)
    Matter.Body.setStatic(body, true)
    event.preventDefault()
    try { element.setPointerCapture(event.pointerId) } catch { /* Synthetic pointer tests may not own capture. */ }
    const move = (e: PointerEvent) => {
      if (!active || e.pointerId !== active.pointerId) return
      const bounds = stage.getBoundingClientRect()
      if (!active.moved && Math.hypot(e.clientX - active.startX, e.clientY - active.startY) > 3) {
        active.moved = true
        options.report({ dragging: true, settling: false })
      }
      Matter.Body.setPosition(body, { x: e.clientX - bounds.left + active.dx, y: e.clientY - bounds.top + active.dy })
      options.sync()
      e.preventDefault()
    }
    const up = (e: PointerEvent) => finish(false, e.pointerId)
    const cancel = (e: PointerEvent) => finish(true, e.pointerId)
    const blur = () => finish(true)
    const hidden = () => { if (document.visibilityState !== 'visible') finish(true) }
    const leave = (e: MouseEvent) => { if (e.relatedTarget === null) finish(true) }
    const lost = () => finish(true)
    window.addEventListener('pointermove', move, { capture: true, passive: false })
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', cancel, true)
    window.addEventListener('blur', blur)
    window.addEventListener('mouseout', leave, true)
    document.addEventListener('pointerout', leave, true)
    document.addEventListener('mouseleave', leave, true)
    document.addEventListener('visibilitychange', hidden)
    element.addEventListener('lostpointercapture', lost)
    removeSessionListeners = () => {
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', cancel, true)
      window.removeEventListener('blur', blur)
      window.removeEventListener('mouseout', leave, true)
      document.removeEventListener('pointerout', leave, true)
      document.removeEventListener('mouseleave', leave, true)
      document.removeEventListener('visibilitychange', hidden)
      element.removeEventListener('lostpointercapture', lost)
    }
    // A press is not yet a drag: reporting it as one makes App's post-drop guard cancel normal taps.
  }
  const click = (event: MouseEvent) => {
    const link = (event.target as HTMLElement).closest('.beijing-icon-anchor')
    const id = link?.closest<HTMLElement>('[data-site-id]')?.dataset.siteId
    if (id && !explicitClick && suppressed.has(id)) {
      event.preventDefault()
      event.stopPropagation()
    }
  }
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape') finish(true)
    if (event.key === 'Enter' || event.key === ' ') {
      const id = (event.target as HTMLElement).closest<HTMLElement>('[data-site-id]')?.dataset.siteId
      if (id) suppressed.delete(id)
    }
  }
  stage.addEventListener('pointerdown', down)
  stage.addEventListener('click', click, true)
  stage.addEventListener('keydown', key)
  return {
    cancel: () => finish(true),
    forget: (id: string) => { if (active?.id === id) finish(true); suppressed.delete(id) },
    dispose: () => {
      finish(true)
      stage.removeEventListener('pointerdown', down)
      stage.removeEventListener('click', click, true)
      stage.removeEventListener('keydown', key)
      suppressed.clear()
    },
  }
}
