import './matter.css'
import Matter from 'matter-js'
import { isValidIconPosition } from '../config'
import { useEffect, useMemo, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { SiteIcon } from '../../components/SiteIcon'
import { FrequentSiteStrip } from '../../components/FrequentSiteStrip'
import type { IconPosition, IconPositionPersistence, Module, Site } from '../../types'
import type { NavigationTemplateProps } from '../types'

type MatterSite = { site: Site; module: Module }

type BodyMeta = {
  body: Matter.Body
  entry: MatterSite
  size: number
}

type ActiveDrag = {
  body: Matter.Body
  pointerId: number
  captureTarget: HTMLAnchorElement
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

function clampBodyToStage(body: Matter.Body, width: number, height: number) {
  const halfWidth = Math.max(body.position.x - body.bounds.min.x, body.bounds.max.x - body.position.x)
  const halfHeight = Math.max(body.position.y - body.bounds.min.y, body.bounds.max.y - body.position.y)
  const minX = Math.max(0, halfWidth)
  const maxX = Math.max(minX, width - halfWidth)
  const minY = Math.max(0, halfHeight)
  const maxY = Math.max(minY, height - halfHeight)
  Matter.Body.setPosition(body, {
    x: Math.min(maxX, Math.max(minX, body.position.x)),
    y: Math.min(maxY, Math.max(minY, body.position.y)),
  })
}

function createBody(entry: MatterSite, index: number, width: number, height: number, saved?: IconPosition) {
  const random = seeded(entry.site.id)
  const size = 30 + Math.round(random() * 10)
  // Always consume the spawn RNG values: restoration must not change the site's shape.
  const spawnX = 48 + random() * Math.max(1, width - 96)
  const spawnY = -80 - index * 42 - random() * 160
  const spawnAngle = (random() - 0.5) * 0.7
  const restored = isValidIconPosition(saved)
  const x = restored ? saved.x * Math.max(1, width) : spawnX
  const y = restored ? saved.y * Math.max(1, height) : spawnY
  const angle = restored ? saved.angle : spawnAngle
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

  if (restored) {
    Matter.Body.setAngle(body, angle)
    Matter.Body.setVelocity(body, { x: 0, y: 0 })
    Matter.Body.setAngularVelocity(body, 0)
    Matter.Sleeping.set(body, false)
    clampBodyToStage(body, width, height)
  }

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
  iconPositionPersistence,
  onInteractionStateChange,
}: NavigationTemplateProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const iconRefs = useRef(new Map<string, HTMLDivElement>())
  const suppressClickUntil = useRef(0)
  const activeDrag = useRef<ActiveDrag | null>(null)
  const physicsBodies = useRef(new Map<string, Matter.Body>())
  const syncIconsRef = useRef<(() => void) | null>(null)
  const removeGlobalDragListeners = useRef<(() => void) | null>(null)
  const sites = useMemo(() => allSites(modules), [modules])
  const iconPositionPersistenceRef = useRef<IconPositionPersistence | undefined>(iconPositionPersistence)
  const saveIconPositionsRef = useRef(actions.saveIconPositions)
  const saveCurrentPositionsRef = useRef<() => void>(() => {})
  const reconcileRef = useRef<((entries: MatterSite[]) => void) | null>(null)
  const persistenceEnabled = iconPositionPersistence?.enabled === true

  useEffect(() => {
    iconPositionPersistenceRef.current = iconPositionPersistence
    saveIconPositionsRef.current = actions.saveIconPositions
  }, [actions.saveIconPositions, iconPositionPersistence])

  useEffect(() => {
    onInteractionStateChange({ dragging: false, settling: false })
    return () => onInteractionStateChange({ dragging: false, settling: false })
  }, [onInteractionStateChange])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    let disposed = false
    let viewportWidth = Math.max(1, stage.clientWidth)
    let viewportHeight = Math.max(1, stage.clientHeight)
    const engine = Matter.Engine.create({ enableSleeping: true })
    engine.gravity.y = 1.05
    engine.positionIterations = 10
    engine.velocityIterations = 8
    engine.constraintIterations = 4

    const render = Matter.Render.create({
      element: stage,
      engine,
      options: {
        width: viewportWidth,
        height: viewportHeight,
        wireframes: false,
        background: 'transparent',
        pixelRatio: window.devicePixelRatio,
      },
    })
    render.canvas.className = 'matter-canvas'
    render.canvas.setAttribute('aria-hidden', 'true')

    const runner = Matter.Runner.create()
    const bodies = new Map<string, BodyMeta>()
    const bodyLookup = physicsBodies.current
    const savePositions = () => {
      if (!iconPositionPersistenceRef.current?.enabled) return
      const positions = Object.fromEntries(Array.from(bodies, ([id, { body }]) => [id, {
        x: Math.min(1, Math.max(0, body.position.x / viewportWidth)),
        y: Math.min(1, Math.max(0, body.position.y / viewportHeight)),
        angle: Number.isFinite(body.angle) ? body.angle : 0,
      }]))
      // Cached dimensions survive React clearing the stage ref during unmount.
      saveIconPositionsRef.current?.('matter', positions)
    }
    saveCurrentPositionsRef.current = savePositions

    const wallThickness = 80
    const createWalls = () => [
      Matter.Bodies.rectangle(-wallThickness / 2, viewportHeight / 2, wallThickness, viewportHeight * 2, { isStatic: true }),
      Matter.Bodies.rectangle(viewportWidth + wallThickness / 2, viewportHeight / 2, wallThickness, viewportHeight * 2, { isStatic: true }),
      Matter.Bodies.rectangle(viewportWidth / 2, viewportHeight + wallThickness / 2, viewportWidth * 2, wallThickness, { isStatic: true }),
      // Keep the top boundary outside the visible stage so objects can enter from above.
      Matter.Bodies.rectangle(viewportWidth / 2, -1400, viewportWidth * 2, wallThickness, { isStatic: true }),
    ]
    let walls = createWalls()
    Matter.Composite.add(engine.world, walls)

    const syncIcons = () => {
      for (const { body, entry, size } of bodies.values()) {
        const icon = iconRefs.current.get(entry.site.id)
        if (!icon) continue
        icon.style.width = `${size}px`
        icon.style.height = `${size}px`
        icon.style.setProperty('--matter-angle', `${body.angle}rad`)
        icon.style.transform = `translate3d(${body.position.x - size / 2}px, ${body.position.y - size / 2}px, 0) rotate(${body.angle}rad)`
      }
    }

    reconcileRef.current = (entries) => {
      const ids = new Set(entries.map(entry => entry.site.id))
      for (const [id, meta] of bodies) {
        if (ids.has(id)) continue
        if (activeDrag.current?.body === meta.body) {
          const drag = activeDrag.current
          if (drag.captureTarget.hasPointerCapture(drag.pointerId)) drag.captureTarget.releasePointerCapture(drag.pointerId)
          removeGlobalDragListeners.current?.()
          removeGlobalDragListeners.current = null
          activeDrag.current = null
          onInteractionStateChange({ dragging: false, settling: false })
        }
        Matter.Composite.remove(engine.world, meta.body)
        bodies.delete(id)
        bodyLookup.delete(id)
      }
      entries.forEach((entry, index) => {
        const existing = bodies.get(entry.site.id)
        if (existing) {
          if (existing.entry.module.accent !== entry.module.accent) {
            Object.assign(existing.body.render, {
              fillStyle: hexToRgba(entry.module.accent, 0.38), strokeStyle: entry.module.accent,
            })
          }
          existing.entry = entry
        } else {
          const persistence = iconPositionPersistenceRef.current
          const meta = createBody(entry, index, viewportWidth, viewportHeight,
            persistence?.enabled ? persistence.positions[entry.site.id] : undefined)
          bodies.set(entry.site.id, meta)
          bodyLookup.set(entry.site.id, meta.body)
          Matter.Composite.add(engine.world, meta.body)
        }
      })
      syncIcons()
    }

    syncIconsRef.current = syncIcons
    Matter.Events.on(engine, 'afterUpdate', syncIcons)

    const resize = () => {
      if (disposed) return
      const oldWidth = viewportWidth
      const oldHeight = viewportHeight
      const width = Math.max(1, stage.clientWidth)
      const height = Math.max(1, stage.clientHeight)
      if (width === oldWidth && height === oldHeight) return
      viewportWidth = width
      viewportHeight = height
      Matter.Render.setSize(render, width, height)
      walls.forEach(wall => Matter.Composite.remove(engine.world, wall))
      walls = createWalls()
      Matter.Composite.add(engine.world, walls)
      if (iconPositionPersistenceRef.current?.enabled) {
        for (const body of bodyLookup.values()) {
          Matter.Body.setPosition(body, {
            x: body.position.x * width / oldWidth,
            y: body.position.y * height / oldHeight,
          })
          // New sites still enter from above rather than being pulled into view by resize.
          if (body.position.y >= 0) clampBodyToStage(body, width, height)
        }
        savePositions()
      }
      syncIcons()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    const saveWhenHidden = () => {
      if (document.visibilityState !== 'visible') savePositions()
    }
    const saveOnPageHide = () => savePositions()
    document.addEventListener('visibilitychange', saveWhenHidden)
    window.addEventListener('pagehide', saveOnPageHide)

    Matter.Render.run(render)
    Matter.Runner.run(runner, engine)
    syncIcons()

    return () => {
      disposed = true
      savePositions()
      document.removeEventListener('visibilitychange', saveWhenHidden)
      window.removeEventListener('pagehide', saveOnPageHide)
      observer.disconnect()
      Matter.Events.off(engine, 'afterUpdate', syncIcons)
      Matter.Render.stop(render)
      Matter.Runner.stop(runner)
      removeGlobalDragListeners.current?.()
      removeGlobalDragListeners.current = null
      if (activeDrag.current) {
        const drag = activeDrag.current
        if (drag.captureTarget.hasPointerCapture(drag.pointerId)) drag.captureTarget.releasePointerCapture(drag.pointerId)
        activeDrag.current = null
        onInteractionStateChange({ dragging: false, settling: false })
      }
      saveCurrentPositionsRef.current = () => {}
      reconcileRef.current = null
      bodies.clear()
      bodyLookup.clear()
      syncIconsRef.current = null
      Matter.Composite.clear(engine.world, false)
      Matter.Engine.clear(engine)
      render.canvas.remove()
    }
  }, [onInteractionStateChange, persistenceEnabled])

  useEffect(() => {
    reconcileRef.current?.(sites)
  }, [sites, persistenceEnabled, onInteractionStateChange])

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
      // 按下只表示候选手势；真正移动后才上报拖拽，否则 App 的
      // onClickCapture 会把普通链接点击当成拖拽误触拦截。
      onInteractionStateChange({ dragging: true, settling: false })
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

    if (drag.captureTarget.hasPointerCapture(drag.pointerId)) drag.captureTarget.releasePointerCapture(drag.pointerId)

    // Repeated drag updates zero the body's velocity, so Matter may put it to
    // sleep while the pointer is held still. Always wake it on release so
    // gravity resumes even after a long hover in mid-air.
    Matter.Sleeping.set(drag.body, false)

    if (drag.moved || cancelled) {
      // A cancelled pointer sequence must never be reinterpreted as a tap.
      // Suppress any synthetic click that the browser may dispatch after the
      // pointer is interrupted by blur, visibility changes, or pointercancel.
      suppressClickUntil.current = performance.now() + 280
    }
    saveCurrentPositionsRef.current()
    onInteractionStateChange({ dragging: false, settling: false })
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactionBlocked || (event.pointerType === 'mouse' && event.button !== 0)) return
    if ((event.target as HTMLElement).closest('[data-editing-interactive]')) return

    const siteId = event.currentTarget.dataset.siteId ?? ''
    const body = physicsBodies.current.get(siteId)
    const point = getPointerPosition(event)
    const anchor = event.currentTarget.querySelector<HTMLAnchorElement>('a')
    if (!body || !point || !anchor || activeDrag.current) return

    // 新的主动按下不应继承上一次拖拽/取消的 trailing-click 抑制。
    suppressClickUntil.current = 0
    activeDrag.current = {
      body,
      pointerId: event.pointerId,
      captureTarget: anchor,
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

    // 由真实链接捕获指针，让鼠标和触摸的原生 click 都落在链接内。
    // 不再补发 anchor.click()，避免触摸原生 click 再次打开页面并重复计数。
    try {
      anchor.setPointerCapture(event.pointerId)
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
