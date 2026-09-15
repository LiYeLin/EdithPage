import './matter.css'
import Matter from 'matter-js'
import { useEffect, useMemo, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { SiteIcon } from '../../components/SiteIcon'
import { FrequentSiteStrip } from '../../components/FrequentSiteStrip'
import type { Module, Site } from '../../types'
import type { NavigationTemplateProps } from '../types'

type MatterSite = { site: Site; module: Module }

type BodyMeta = {
  body: Matter.Body
  entry: MatterSite
  size: number
}

type ActiveDrag = {
  body: Matter.Body
  siteId: string
  pointerId: number
  offsetX: number
  offsetY: number
  startX: number
  startY: number
  moved: boolean
}

function hashSeed(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seeded(value: string) {
  let state = hashSeed(value) || 1
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state)
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state)
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296
  }
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return `rgba(159, 247, 205, ${alpha})`
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function createBody(entry: MatterSite, index: number, width: number) {
  const random = seeded(entry.site.id)
  const size = 30 + Math.round(random() * 10)
  const x = 48 + random() * Math.max(1, width - 96)
  const y = -80 - index * 42 - random() * 160
  const angle = (random() - 0.5) * 0.7
  const accent = entry.module.accent
  const common = {
    angle,
    restitution: 0.48 + random() * 0.18,
    friction: 0.18,
    frictionAir: 0.012,
    density: 0.002,
    chamfer: { radius: 5 },
    render: {
      fillStyle: hexToRgba(accent, 0.38),
      strokeStyle: accent,
      lineWidth: 1.5,
    },
  }

  const body = random() < 0.38
    ? Matter.Bodies.rectangle(x, y, size * 1.65, size * 1.2, common)
    : Matter.Bodies.polygon(x, y, 4 + Math.floor(random() * 5), size, common)

  return { body, entry, size: size * 2 }
}

function allSites(modules: readonly Module[]): MatterSite[] {
  return modules.flatMap((module) => module.sites.map((site) => ({ module, site })))
}

export default function MatterTemplate({
  modules,
  frequentSites,
  editing,
  interactionBlocked,
  actions,
  onInteractionStateChange,
}: NavigationTemplateProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const iconRefs = useRef(new Map<string, HTMLDivElement>())
  const suppressClickUntil = useRef(0)
  const skipClickVisitUntil = useRef(0)
  const activeDrag = useRef<ActiveDrag | null>(null)
  const physicsBodies = useRef(new Map<string, Matter.Body>())
  const syncIconsRef = useRef<(() => void) | null>(null)
  const removeGlobalDragListeners = useRef<(() => void) | null>(null)
  const sites = useMemo(() => allSites(modules), [modules])

  useEffect(() => {
    onInteractionStateChange({ dragging: false, settling: false })
    return () => onInteractionStateChange({ dragging: false, settling: false })
  }, [onInteractionStateChange])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const engine = Matter.Engine.create({ enableSleeping: true })
    engine.gravity.y = 1.05
    engine.positionIterations = 10
    engine.velocityIterations = 8
    engine.constraintIterations = 4

    const render = Matter.Render.create({
      element: stage,
      engine,
      options: {
        width: stage.clientWidth,
        height: stage.clientHeight,
        wireframes: false,
        background: 'transparent',
        pixelRatio: window.devicePixelRatio,
      },
    })
    render.canvas.className = 'matter-canvas'
    render.canvas.setAttribute('aria-hidden', 'true')

    const runner = Matter.Runner.create()
    const bodies: BodyMeta[] = sites.map((entry, index) => createBody(entry, index, stage.clientWidth))
    Matter.Composite.add(engine.world, bodies.map(({ body }) => body))
    physicsBodies.current = new Map(bodies.map(({ body, entry }) => [entry.site.id, body]))

    const wallThickness = 80
    const walls = [
      Matter.Bodies.rectangle(-wallThickness / 2, stage.clientHeight / 2, wallThickness, stage.clientHeight * 2, { isStatic: true }),
      Matter.Bodies.rectangle(stage.clientWidth + wallThickness / 2, stage.clientHeight / 2, wallThickness, stage.clientHeight * 2, { isStatic: true }),
      Matter.Bodies.rectangle(stage.clientWidth / 2, stage.clientHeight + wallThickness / 2, stage.clientWidth * 2, wallThickness, { isStatic: true }),
      // Keep the top boundary outside the visible stage so objects can enter from above.
      Matter.Bodies.rectangle(stage.clientWidth / 2, -1400, stage.clientWidth * 2, wallThickness, { isStatic: true }),
    ]
    Matter.Composite.add(engine.world, walls)

    const syncIcons = () => {
      for (const { body, entry, size } of bodies) {
        const icon = iconRefs.current.get(entry.site.id)
        if (!icon) continue
        icon.style.width = `${size}px`
        icon.style.height = `${size}px`
        icon.style.setProperty('--matter-angle', `${body.angle}rad`)
        icon.style.transform = `translate3d(${body.position.x - size / 2}px, ${body.position.y - size / 2}px, 0) rotate(${body.angle}rad)`
      }
    }

    syncIconsRef.current = syncIcons
    Matter.Events.on(engine, 'afterUpdate', syncIcons)

    const resize = () => {
      const width = stage.clientWidth
      const height = stage.clientHeight
      Matter.Render.setSize(render, width, height)
      Matter.Body.setPosition(walls[0], { x: -wallThickness / 2, y: height / 2 })
      Matter.Body.setPosition(walls[1], { x: width + wallThickness / 2, y: height / 2 })
      Matter.Body.setPosition(walls[2], { x: width / 2, y: height + wallThickness / 2 })
      Matter.Body.setPosition(walls[3], { x: width / 2, y: -1400 })
      syncIcons()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(stage)

    Matter.Render.run(render)
    Matter.Runner.run(runner, engine)
    syncIcons()

    return () => {
      observer.disconnect()
      Matter.Events.off(engine, 'afterUpdate', syncIcons)
      Matter.Render.stop(render)
      Matter.Runner.stop(runner)
      removeGlobalDragListeners.current?.()
      removeGlobalDragListeners.current = null
      if (activeDrag.current) {
        activeDrag.current = null
        onInteractionStateChange({ dragging: false, settling: false })
      }
      physicsBodies.current.clear()
      syncIconsRef.current = null
      Matter.Composite.clear(engine.world, false)
      Matter.Engine.clear(engine)
      render.canvas.remove()
    }
  }, [onInteractionStateChange, sites])

  const getPointerPosition = (event: { clientX: number; clientY: number }) => {
    const stage = stageRef.current
    if (!stage) return null
    const bounds = stage.getBoundingClientRect()
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  }

  const moveActiveDrag = (event: { pointerId: number; clientX: number; clientY: number }) => {
    const drag = activeDrag.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const point = getPointerPosition(event)
    if (!point) return

    const nextPosition = {
      x: point.x + drag.offsetX,
      y: point.y + drag.offsetY,
    }
    if (!drag.moved && Math.hypot(point.x - drag.startX, point.y - drag.startY) > 3) {
      drag.moved = true
    }
    Matter.Body.setPosition(drag.body, nextPosition)
    Matter.Body.setVelocity(drag.body, { x: 0, y: 0 })
    Matter.Body.setAngularVelocity(drag.body, 0)
    syncIconsRef.current?.()
  }

  const finishActiveDrag = (pointerId?: number, cancelled = false) => {
    const drag = activeDrag.current
    if (!drag || (pointerId !== undefined && drag.pointerId !== pointerId)) return
    activeDrag.current = null
    removeGlobalDragListeners.current?.()
    removeGlobalDragListeners.current = null

    const icon = iconRefs.current.get(drag.siteId)
    if (icon?.hasPointerCapture(drag.pointerId)) icon.releasePointerCapture(drag.pointerId)

    if (drag.moved || cancelled) {
      // A cancelled pointer sequence must never be reinterpreted as a tap.
      // Suppress any synthetic click that the browser may dispatch after the
      // pointer is interrupted by blur, visibility changes, or pointercancel.
      suppressClickUntil.current = performance.now() + 280
    } else {
      // Pointer capture prevents browsers from consistently synthesizing an
      // anchor click. Preserve normal navigation explicitly for a simple tap.
      skipClickVisitUntil.current = performance.now() + 280
      actions.visitSite(drag.siteId)
      icon?.querySelector<HTMLAnchorElement>('a')?.click()
    }
    onInteractionStateChange({ dragging: false, settling: false })
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactionBlocked || (event.pointerType === 'mouse' && event.button !== 0)) return
    if ((event.target as HTMLElement).closest('[data-editing-interactive]')) return

    const siteId = event.currentTarget.dataset.siteId ?? ''
    const body = physicsBodies.current.get(siteId)
    const point = getPointerPosition(event)
    if (!body || !point || activeDrag.current) return

    activeDrag.current = {
      body,
      siteId,
      pointerId: event.pointerId,
      offsetX: body.position.x - point.x,
      offsetY: body.position.y - point.y,
      startX: point.x,
      startY: point.y,
      moved: false,
    }
    Matter.Sleeping.set(body, false)
    Matter.Body.setVelocity(body, { x: 0, y: 0 })
    Matter.Body.setAngularVelocity(body, 0)
    event.preventDefault()

    // Keep receiving pointermove/up after the pointer leaves the icon. Relying
    // only on React events from the moving element makes the body appear frozen.
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic test events do not own a browser pointer.
    }
    const onMove = (nativeEvent: PointerEvent) => {
      moveActiveDrag(nativeEvent)
      nativeEvent.preventDefault()
    }
    const onPointerUp = (nativeEvent: PointerEvent) => finishActiveDrag(nativeEvent.pointerId)
    const onPointerCancel = (nativeEvent: PointerEvent) => finishActiveDrag(nativeEvent.pointerId, true)
    const onWindowBlur = () => finishActiveDrag(undefined, true)
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') finishActiveDrag(undefined, true)
    }
    const onDocumentPointerOut = (nativeEvent: PointerEvent) => {
      // Browsers do not reliably deliver pointerup after the pointer leaves the
      // viewport. A null relatedTarget is the boundary signal; pointerout
      // events between elements still have a related target and must not cancel
      // an in-progress drag.
      if (nativeEvent.relatedTarget === null) finishActiveDrag(undefined, true)
    }
    const onWindowMouseOut = (nativeEvent: MouseEvent) => {
      if (nativeEvent.relatedTarget === null) finishActiveDrag(undefined, true)
    }
    const onDocumentMouseLeave = (nativeEvent: MouseEvent) => {
      if (nativeEvent.relatedTarget === null) finishActiveDrag(undefined, true)
    }
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onPointerUp, true)
    window.addEventListener('pointercancel', onPointerCancel, true)
    window.addEventListener('blur', onWindowBlur)
    window.addEventListener('mouseout', onWindowMouseOut, true)
    document.addEventListener('pointerout', onDocumentPointerOut, true)
    document.addEventListener('mouseleave', onDocumentMouseLeave, true)
    document.addEventListener('visibilitychange', onVisibilityChange)
    removeGlobalDragListeners.current = () => {
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onPointerUp, true)
      window.removeEventListener('pointercancel', onPointerCancel, true)
      window.removeEventListener('blur', onWindowBlur)
      window.removeEventListener('mouseout', onWindowMouseOut, true)
      document.removeEventListener('pointerout', onDocumentPointerOut, true)
      document.removeEventListener('mouseleave', onDocumentMouseLeave, true)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    onInteractionStateChange({ dragging: true, settling: false })
    syncIconsRef.current?.()
  }

  return (
    <section className="matter-template" data-template="matter" aria-label="物理图标导航模板">
      <FrequentSiteStrip sites={frequentSites} editing={editing} onEnterEditMode={actions.enterEditMode}
        onEdit={(moduleId, siteId) => actions.edit({ type: 'site', moduleId, siteId })}
        onRemove={actions.removeSite} onVisit={actions.visitSite} />
      {!editing && (
        <div className="matter-edit-entry" data-editing-interactive>
          <button
            type="button"
            data-onboarding-edit
            onClick={actions.enterEditMode}
            disabled={interactionBlocked}
            aria-label="进入编辑模式"
          >
            <Pencil size={14} aria-hidden="true" />
            <span>进入编辑模式</span>
          </button>
        </div>
      )}
      <div
        ref={stageRef}
        className={`matter-stage${interactionBlocked ? ' is-blocked' : ''}`}
        aria-label="网站图标物理舞台"
      >
        <div className="matter-icons" aria-label="网站快捷入口">
          {sites.map(({ site, module }) => (
            <div
              key={site.id}
              className="matter-icon-link"
              data-site-id={site.id}
              onPointerDown={handlePointerDown}
              ref={(element) => {
                if (element) iconRefs.current.set(site.id, element)
                else iconRefs.current.delete(site.id)
              }}
              aria-label={`${site.name}物理图标`}
            >
              <a
                className="matter-icon-anchor"
                href={site.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`${site.name}，打开站点`}
                onDragStart={(event) => event.preventDefault()}
                onClick={(event) => {
                  const now = performance.now()
                  if (now < suppressClickUntil.current) {
                    event.preventDefault()
                    event.stopPropagation()
                    return
                  }
                  if (now < skipClickVisitUntil.current) return
                  actions.visitSite(site.id)
                }}
              >
                <span className="matter-icon-shell" style={{ '--matter-accent': module.accent } as CSSProperties}>
                  <SiteIcon url={site.url} name={site.name} size={42} />
                </span>
              </a>
              <span className="matter-icon-name" aria-hidden="true">
                {site.name}
              </span>
              {editing && (
                <span className="matter-icon-actions" data-editing-interactive>
                  <button type="button" aria-label={`编辑 ${site.name}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); actions.edit({ type: 'site', moduleId: module.id, siteId: site.id }) }}>
                    <Pencil size={11} />
                  </button>
                  <button type="button" aria-label={`删除 ${site.name}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); actions.removeSite(module.id, site.id) }}>
                    <Trash2 size={11} />
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
        {sites.length === 0 && <p className="matter-empty">还没有网站，打开编辑模式添加一个吧</p>}
      </div>
    </section>
  )
}
