import { LiquidDragSurface } from './LiquidDragSurface'
import { motion, useMotionValue, type MotionStyle } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { edgeContact, type Point } from '../drag/liquidGeometry'
import { findBubble, findSiteTile, isVisiblePoint, visibleIcon } from '../drag/liquidDom'
import type { LiquidVisual } from '../drag/liquidVisual'
import { SiteIcon } from './SiteIcon'

function useAnchor() {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(0)
  return useMemo(() => ({ x, y, scale }), [x, y, scale])
}

export function LiquidDragLayer({ visual }: { visual: LiquidVisual }) {
  const root = useRef<HTMLDivElement>(null)
  const source = useAnchor()
  const target = useAnchor()
  const scale = useMotionValue(1)
  const opacity = useMotionValue(1)
  const iconScale = useMotionValue(1)
  const { x, y, lifetime } = visual

  useEffect(() => {
    let frame = 0
    let settleStart: number | null = null
    let settleOrigin: Point = visual.origin
    let arrivalStart: number | null = null
    let arrivalTile: HTMLElement | null = null
    let landingAtIcon = false
    let fallback: Point | null = null
    let previousTarget: string | null = null
    let targetBubble: HTMLElement | null = null
    const sourceBubble = visual.source.variant === 'module' ? findBubble(visual.source.moduleId) : null
    const sourceTile = findSiteTile(visual.source)
    const started = performance.now()
    let lastSource: NonNullable<ReturnType<typeof edgeContact>> | null = null
    let sourceRelease = 0
    let sourceAttached = false

    const tick = (now: number) => {
      if (lifetime.phase === 'idle') return
      const point = { x: x.get(), y: y.get() }
      // Geometry reads precede Motion-value writes; no per-frame React state updates.
      if (visual.targetModuleId !== previousTarget) {
        previousTarget = visual.targetModuleId
        targetBubble = previousTarget ? findBubble(previousTarget) : null
      }
      const from = sourceBubble?.isConnected ? edgeContact(sourceBubble.getBoundingClientRect(), point) : null
      const to = targetBubble?.isConnected ? edgeContact(targetBubble.getBoundingClientRect(), point) : null
      const atSource = !!(lifetime.dragging && !targetBubble && from?.attached && sourceBubble && isVisiblePoint(sourceBubble, from.point))
      const atTarget = !!(to?.attached && targetBubble && isVisiblePoint(targetBubble, to.point))

      if (atSource && from) {
        source.x.set(from.point.x); source.y.set(from.point.y); source.scale.set(1)
        lastSource = from
      } else if (lastSource) {
        if (sourceAttached) sourceRelease = now
        const t = Math.min(1, (now - sourceRelease) / 200)
        source.x.set(lastSource.point.x - lastSource.normal.x * 10 * t)
        source.y.set(lastSource.point.y - lastSource.normal.y * 10 * t)
        source.scale.set((1 - t) ** 2)
        if (t === 1) lastSource = null
      }
      sourceAttached = atSource
      if (to) {
        target.x.set(to.point.x); target.y.set(to.point.y)
        fallback = targetBubble && isVisiblePoint(targetBubble, to.point) ? to.point : null
      }
      target.scale.set(atTarget ? 1 : Math.max(0, target.scale.get() - .12))

      if (lifetime.dragging) {
        if (now - started >= 120) lifetime.follow(atSource, !!targetBubble)
        scale.set(1 + .06 * Math.min(1, (now - started) / 120))
      } else {
        if (settleStart === null) {
          settleStart = now
          settleOrigin = point
        }
        const success = lifetime.phase === 'settling-success'
        if (success && (!arrivalTile || !arrivalTile.isConnected) && lifetime.pending) arrivalTile = findSiteTile(lifetime.pending)
        const icon = visibleIcon(success ? arrivalTile : sourceTile)
        if (arrivalStart === null && (icon || !success || now - settleStart >= 60)) {
          arrivalStart = now
          landingAtIcon = !!icon
        }
        // Missing/new-page DOM gets at most 60ms to appear before an edge-only fallback.
        // The independent 360ms deadline releases placeholders even when rAF is suspended.
        // Once fallback travel starts, a late DOM mount must not restart the fade or teleport the drop.
        const destination = landingAtIcon ? icon?.point : success ? fallback : null
        const elapsed = arrivalStart === null ? 0 : now - arrivalStart
        const progress = Math.min(1, elapsed / 220)
        // Critically damped spring-shaped approach, normalized to land exactly at t=1.
        const ease = (1 - (1 + 7 * progress) * Math.exp(-7 * progress)) / (1 - 8 * Math.exp(-7))
        if (destination) {
          x.set(settleOrigin.x + (destination.x - settleOrigin.x) * ease)
          y.set(settleOrigin.y + (destination.y - settleOrigin.y) * ease)
        }
        iconScale.set(1 + ((icon?.size ?? visual.iconSize) / visual.iconSize - 1) * ease)
        scale.set(destination ? 1.06 - .14 * ease : 1.06 - .45 * ease)
        opacity.set(1 - Math.max(0, (elapsed - 140) / 80))
        if (progress === 1) { lifetime.finish('complete'); return }
      }
      if (root.current) root.current.dataset.phase = lifetime.phase
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [visual, lifetime, x, y, source, target, scale, opacity, iconScale])

  return createPortal(
    <motion.div ref={root} className="liquid-drag-layer" style={{ opacity }} aria-hidden="true" data-phase="lifting">
      <LiquidDragSurface visual={visual} />
      {/* Never place content under a filter or the surface's trailing spring. */}
      <motion.div className="liquid-drop-content" style={{ x, y, '--drag-icon-size': `${visual.iconSize}px` } as MotionStyle}>
        <motion.div className="liquid-drop-icon" style={{ scale: iconScale }}>
          <SiteIcon url={visual.site.url} name={visual.site.name} size={visual.iconSize} />
        </motion.div>
        <strong>{visual.site.name}</strong>
      </motion.div>
      {visual.source.variant === 'frequent' && (
        <div className="liquid-source-ripple" style={{ left: visual.origin.x, top: visual.origin.y }} />
      )}
    </motion.div>, document.body,
  )
}
