import type { MotionValue } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { BubbleFloatContext } from '../hooks/useBubbleFloat'
import { useMotionPreference } from '../hooks/useMotionPreference'
import { useViewportWidth } from '../hooks/useViewportWidth'
import {
  createBubbleFloatBody,
  resetBubbleFloatBody,
  stepBubbleFloatWorld,
  stopBubbleFloatBody,
  type BubbleFloatBody,
  type BubbleFloatMeasurement,
} from '../physics/bubbleFloat'

const IDLE_DELAY_MS = 3000
const DESKTOP_MIN_WIDTH = 1000

type BubbleRegistration = {
  body: BubbleFloatBody
  element: HTMLElement
  x: MotionValue<number>
  y: MotionValue<number>
}

export function BubbleFloatProvider({ blocked, children }: { blocked: boolean; children: ReactNode }) {
  const registrations = useRef(new Map<string, BubbleRegistration>())
  const reducedMotion = useMotionPreference()
  const viewportWidth = useViewportWidth()
  const desktopMotionAllowed = viewportWidth > DESKTOP_MIN_WIDTH && !reducedMotion

  const register = useCallback((id: string, element: HTMLElement, x: MotionValue<number>, y: MotionValue<number>) => {
    const registration = { body: createBubbleFloatBody(id), element, x, y }
    registrations.current.set(id, registration)
    return () => {
      if (registrations.current.get(id) === registration) registrations.current.delete(id)
    }
  }, [])

  useEffect(() => {
    const entries = () => [...registrations.current.values()]
    const stop = () => entries().forEach(({ body }) => stopBubbleFloatBody(body))
    const reset = () => entries().forEach(({ body, x, y }) => {
      resetBubbleFloatBody(body)
      x.set(0)
      y.set(0)
    })

    if (!desktopMotionAllowed) {
      reset()
      return
    }
    if (blocked) {
      stop()
      return
    }

    let animationFrame = 0
    let idleTimer = 0
    let lastTime = 0

    const cancelRun = () => {
      window.clearTimeout(idleTimer)
      idleTimer = 0
      window.cancelAnimationFrame(animationFrame)
      animationFrame = 0
      lastTime = 0
      stop()
    }

    const tick = (now: number) => {
      animationFrame = 0
      const currentEntries = entries().filter(({ element }) => element.isConnected)
      const bodies = currentEntries.map(({ body }) => body)
      const measurements: BubbleFloatMeasurement[] = []
      for (const { body, element } of currentEntries) {
        const shell = element.querySelector<HTMLElement>('.bubble-shell')
        const rect = shell?.getBoundingClientRect()
        if (!rect?.width) continue
        measurements.push({
          id: body.id,
          anchorX: rect.left + rect.width / 2 - body.offsetX,
          anchorY: rect.top + rect.height / 2 - body.offsetY,
          radius: rect.width / 2,
        })
      }
      stepBubbleFloatWorld(bodies, measurements, now, (now - (lastTime || now)) / 1000)
      lastTime = now
      for (const { body, x, y } of currentEntries) {
        x.set(body.offsetX)
        y.set(body.offsetY)
      }
      animationFrame = window.requestAnimationFrame(tick)
    }

    const start = () => {
      idleTimer = 0
      if (document.hidden || document.querySelector('.bubble-float-body:hover, .bubble-float-body:focus-within')) return
      if (!animationFrame) animationFrame = window.requestAnimationFrame(tick)
    }

    const schedule = () => {
      cancelRun()
      idleTimer = window.setTimeout(start, IDLE_DELAY_MS)
    }

    const activity = () => schedule()
    const visibility = () => {
      if (document.hidden) cancelRun()
      else schedule()
    }

    document.addEventListener('pointermove', activity, { capture: true, passive: true })
    document.addEventListener('pointerdown', activity, true)
    document.addEventListener('wheel', activity, { capture: true, passive: true })
    document.addEventListener('keydown', activity, true)
    document.addEventListener('touchstart', activity, { capture: true, passive: true })
    document.addEventListener('focusin', activity, true)
    document.addEventListener('focusout', activity, true)
    window.addEventListener('scroll', activity, { capture: true, passive: true })
    document.addEventListener('visibilitychange', visibility)
    schedule()

    return () => {
      cancelRun()
      document.removeEventListener('pointermove', activity, true)
      document.removeEventListener('pointerdown', activity, true)
      document.removeEventListener('wheel', activity, true)
      document.removeEventListener('keydown', activity, true)
      document.removeEventListener('touchstart', activity, true)
      document.removeEventListener('focusin', activity, true)
      document.removeEventListener('focusout', activity, true)
      window.removeEventListener('scroll', activity, true)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [blocked, desktopMotionAllowed])

  const context = useMemo(() => ({ register }), [register])
  return <BubbleFloatContext.Provider value={context}>{children}</BubbleFloatContext.Provider>
}
