import Matter from 'matter-js'
import { createIconBody, iconRenderStyle, type BeijingSite } from './icons'
import { bindSceneDrag } from './drag'
import { createBoundaries, createTerrainBodies, layoutTerrain, releaseAboveTerrain, type TerrainAsset, type TerrainLayout } from './terrain'
import type { TemplateInteractionState } from '../types'
import type { IconPosition, IconPositionPersistence } from '../../types'

type IconBody = ReturnType<typeof createIconBody>

/** A single scene owns its engine, static geometry, pointer session and animation clock. */
export function createBeijingScene(stage: HTMLDivElement, asset: TerrainAsset, options: {
  iconFor: (id: string) => HTMLElement | undefined
  onLayout: (layout: TerrainLayout) => void
  report: (state: TemplateInteractionState) => void
  getIconPositionPersistence?: () => IconPositionPersistence | undefined
  saveIconPositions?: (positions: Record<string, IconPosition>) => void
}) {
  const measure = () => layoutTerrain(asset, Math.max(1, stage.clientWidth), Math.max(1, stage.clientHeight),
    Number.parseFloat(getComputedStyle(stage).paddingBottom) || 0)
  let layout = measure()
  let solids = createTerrainBodies(asset, layout)
  let ceiling = -2000
  let walls = createBoundaries(layout, ceiling)
  const engine = Matter.Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8, constraintIterations: 4 })
  engine.gravity.y = 1.05
  Matter.Composite.add(engine.world, [...solids, ...walls])
  // Build the renderer off-DOM: a failed Canvas initialisation must not leave a half-mounted scene.
  const canvas = document.createElement('canvas')
  const render = Matter.Render.create({ canvas, engine, options: {
    width: layout.width, height: layout.height, wireframes: false, background: 'transparent', pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  } })
  render.canvas.className = 'beijing-canvas'
  render.canvas.setAttribute('aria-hidden', 'true')
  const bodies = new Map<string, IconBody>()
  let blocked = true
  let disposed = false
  let frame = 0
  let previousTime = 0
  let accumulator = 0
  const savePositions = () => {
    const persistence = options.getIconPositionPersistence?.()
    if (!persistence?.enabled || !options.saveIconPositions) return
    const positions = Object.fromEntries(Array.from(bodies, ([id, { body }]) => [id, {
      x: Math.min(1, Math.max(0, body.position.x / Math.max(1, layout.width))),
      y: Math.min(1, Math.max(0, body.position.y / Math.max(1, layout.height))),
      angle: Number.isFinite(body.angle) ? body.angle : 0,
    }]))
    options.saveIconPositions(positions)
  }
  const sync = () => {
    for (const [id, { body, size }] of bodies) {
      const icon = options.iconFor(id)
      if (!icon) continue
      icon.style.width = `${size}px`
      icon.style.height = `${size}px`
      icon.style.setProperty('--beijing-angle', `${body.angle}rad`)
      icon.style.transform = `translate3d(${body.position.x - size / 2}px, ${body.position.y - size / 2}px, 0) rotate(${body.angle}rad)`
      icon.style.visibility = 'visible'
    }
    Matter.Render.world(render)
  }
  try {
    sync()
  } catch (error) {
    Matter.Composite.clear(engine.world, false)
    Matter.Engine.clear(engine)
    throw error
  }
  stage.append(render.canvas)
  const drag = bindSceneDrag(stage, {
    bodyFor: id => bodies.get(id)?.body,
    blocked: () => blocked || document.visibilityState !== 'visible',
    sync,
    release: body => releaseAboveTerrain(body, solids, layout),
    save: savePositions,
    report: options.report,
  })
  const tick = (time: number) => {
    if (disposed || blocked || document.visibilityState !== 'visible') return
    accumulator += previousTime ? Math.min(time - previousTime, 1000 / 15) : 1000 / 60
    previousTime = time
    // Small fixed steps reduce tunnelling through roof edges; drawing/HTML sync still happens once per frame.
    const step = 1000 / 120
    while (accumulator >= step) {
      for (const { body } of bodies.values()) {
        if (!body.isStatic && body.speed > 12) Matter.Body.setSpeed(body, 12)
      }
      Matter.Engine.update(engine, step)
      accumulator -= step
    }
    sync()
    frame = requestAnimationFrame(tick)
  }
  const refreshClock = () => {
    cancelAnimationFrame(frame)
    previousTime = 0
    accumulator = 0
    if (blocked || document.visibilityState !== 'visible') {
      drag.cancel()
      if (document.visibilityState !== 'visible') savePositions()
    }
    else if (!disposed) frame = requestAnimationFrame(tick)
    stage.dataset.paused = String(blocked || document.visibilityState !== 'visible')
  }
  const resize = () => {
    if (disposed) return
    const next = measure()
    if (next.width === layout.width && next.height === layout.height && next.groundY === layout.groundY) return
    drag.cancel()
    const oldWidth = layout.width
    const oldHeight = layout.height
    const persistenceEnabled = options.getIconPositionPersistence?.()?.enabled === true
    layout = next
    for (const body of [...solids, ...walls]) Matter.Composite.remove(engine.world, body)
    solids = createTerrainBodies(asset, layout)
    walls = createBoundaries(layout, ceiling)
    Matter.Composite.add(engine.world, [...solids, ...walls])
    Matter.Render.setSize(render, layout.width, layout.height)
    Matter.Render.setPixelRatio(render, Math.min(window.devicePixelRatio || 1, 2))
    for (const { body } of bodies.values()) {
      Matter.Body.setPosition(body, {
        x: body.position.x * layout.width / oldWidth,
        y: persistenceEnabled ? body.position.y * layout.height / oldHeight : body.position.y,
      })
      releaseAboveTerrain(body, solids, layout)
    }
    options.onLayout(layout)
    sync()
    if (persistenceEnabled) savePositions()
  }
  const observer = new ResizeObserver(resize)
  const saveOnPageHide = () => savePositions()
  const dispose = () => {
    if (disposed) return
    disposed = true
    blocked = true
    cancelAnimationFrame(frame)
    observer.disconnect()
    drag.dispose()
    savePositions()
    document.removeEventListener('visibilitychange', refreshClock)
    window.removeEventListener('pagehide', saveOnPageHide)
    bodies.clear()
    Matter.Composite.clear(engine.world, false)
    Matter.Engine.clear(engine)
    render.canvas.remove()
    options.report({ dragging: false, settling: false })
  }
  try {
    observer.observe(stage)
    document.addEventListener('visibilitychange', refreshClock)
    window.addEventListener('pagehide', saveOnPageHide)
    options.onLayout(layout)
    options.report({ dragging: false, settling: false })
  } catch (error) {
    dispose()
    throw error
  }

  return {
    reconcile(entries: BeijingSite[]) {
      const nextIds = new Set(entries.map(entry => entry.site.id))
      for (const [id, meta] of bodies) {
        if (nextIds.has(id)) continue
        drag.forget(id)
        Matter.Composite.remove(engine.world, meta.body)
        bodies.delete(id)
      }
      entries.forEach((entry, index) => {
        const existing = bodies.get(entry.site.id)
        if (existing) {
          if (existing.entry.module.accent !== entry.module.accent) {
            Object.assign(existing.body.render, iconRenderStyle(entry.module.accent))
          }
          existing.entry = entry
        } else {
          const persistence = options.getIconPositionPersistence?.()
          const saved = persistence?.enabled ? persistence.positions[entry.site.id] : undefined
          const meta = createIconBody(entry, index, layout.width, layout.height, saved)
          if (meta.restored) releaseAboveTerrain(meta.body, solids, layout)
          bodies.set(entry.site.id, meta)
          Matter.Composite.add(engine.world, meta.body)
        }
      })
      // Keep the ceiling above every initial spawn, including large imported collections.
      const nextCeiling = Math.min(-2000, ...Array.from(bodies.values(), b => b.body.bounds.min.y - 160))
      if (nextCeiling < ceiling) {
        ceiling = nextCeiling
        walls.forEach(body => Matter.Composite.remove(engine.world, body))
        walls = createBoundaries(layout, ceiling)
        Matter.Composite.add(engine.world, walls)
      }
      sync()
    },
    setPaused(value: boolean) { blocked = value; refreshClock() },
    dispose,
  }
}
