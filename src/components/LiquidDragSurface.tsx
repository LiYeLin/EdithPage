import { navigationLiquidMaterial } from '../effects/liquidMaterial'
import { Liquid } from 'liquid-gooey'
import { useEffect, useRef } from 'react'
import { clamp, contact, mix, springStep } from '../demos/liquid-gooey/physics'
import { findBubble } from '../drag/liquidDom'
import type { LiquidVisual } from '../drag/liquidVisual'

/** Reservoir silhouettes and the drop share the demo filter for seamless necks.
 * Cut out interiors after filtering: the local glass skins already paint them,
 * and compositing a second translucent fill would darken the bubbles on pickup. */
export function LiquidDragSurface({ visual }: { visual: LiquidVisual }) {
  const root = useRef<HTMLDivElement>(null)
  const bodies = useRef<(HTMLDivElement | null)[]>([])
  const beads = useRef<(HTMLDivElement | null)[]>([])
  const drop = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let frame = 0, last = 0, landed = false
    const springs = Array.from({ length: 2 }, () => ({ value: 0, velocity: 0 }))
    const directions = [{ x: 1, y: 0 }, { x: -1, y: 0 }]
    const notified = new Set<HTMLElement>()
    let previousTarget: HTMLElement | null = null
    const signal = (shell: HTMLElement, amount: number, direction = { x: 1, y: 0 }, land = false) => {
      shell.dispatchEvent(new CustomEvent('liquid-contact', { detail: { amount, direction, land } }))
      notified.add(shell)
    }
    const position = (node: HTMLElement | null, x: number, y: number, width: number, height = width) => {
      if (!node) return
      Object.assign(node.style, { width: `${width}px`, height: `${height}px`, transform: `translate3d(${x - width / 2}px,${y - height / 2}px,0)` })
    }
    const tick = (now: number) => {
      const dt = Math.min((now - (last || now - 16.67)) / 1000, 1 / 30)
      last = now
      const point = { x: visual.x.get(), y: visual.y.get() }
      const radius = visual.compact ? 26 : 29
      const source = visual.source.variant === 'module' ? findBubble(visual.source.moduleId) : null
      // Preview adhesion before dnd-kit declares a drop target; never change business hit testing.
      const target = visual.targetModuleId === visual.source.moduleId ? null : visual.targetModuleId ? findBubble(visual.targetModuleId) : [...document.querySelectorAll<HTMLElement>('.bubble-shell')].find(shell => {
        if (shell === source) return false
        const r = shell.getBoundingClientRect()
        return contact({ x: r.x + r.width / 2, y: r.y + r.height / 2, radius: r.width / 2 }, point, radius).amount > .025
      }) ?? null
      if (previousTarget && previousTarget !== target) { signal(previousTarget, 0); springs[1].value = 0; springs[1].velocity = 0 }
      previousTarget = target
      const holes: string[] = []
      ;[source, target].forEach((shell, index) => {
        const rect = shell?.getBoundingClientRect()
        if (!shell || !rect || !rect.width) {
          position(bodies.current[index], 0, 0, 0)
          for (let n = 0; n < 4; n++) position(beads.current[index * 4 + n], 0, 0, 0)
          return
        }
        const body = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, radius: rect.width / 2 }
        const touch = contact(body, point, radius)
        const amount = visual.lifetime.dragging ? touch.amount : 0
        const tension = springStep(springs[index], amount, dt, 240, 22)
        const receiving = visual.lifetime.phase === 'settling-success' && target ? 1 : 0
        const land = !visual.lifetime.dragging && !landed && index === receiving
        if (amount > .025) directions[index] = touch.direction
        const direction = directions[index]
        signal(shell, amount, direction, land)
        const skin = shell.querySelector<HTMLElement>('.bubble-liquid-skin')?.getBoundingClientRect() ?? rect
        const cx = skin.x + skin.width / 2, cy = skin.y + skin.height / 2
        position(bodies.current[index], cx, cy, skin.width, skin.height)
        const rx = skin.width / 2 - 1, ry = skin.height / 2 - 1
        holes.push(`M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0 Z`)
        const extension = clamp(touch.gap + radius * .8, 0, touch.reach)
        const strength = clamp(tension)
        for (let n = 0; n < 4; n++) {
          const t = n / 3
          const reach = body.radius - 21 + extension * t * strength
          const size = mix(35, 15, t) * strength * (1 - clamp(touch.gap / touch.reach) * t * .42) * 2
          position(beads.current[index * 4 + n], cx + direction.x * reach, cy + direction.y * reach, size)
        }
      })
      if (!visual.lifetime.dragging) landed = true
      if (root.current) root.current.style.clipPath = `path(evenodd, "M 0 0 H ${innerWidth} V ${innerHeight} H 0 Z ${holes.join(' ')}")`
      position(drop.current, point.x, point.y, radius * 2)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame); notified.forEach(shell => signal(shell, 0)) }
  }, [visual])
  return <div className="liquid-demo-drag-surface" ref={root}>
    <Liquid className="liquid-drag-surface" style={{ position: 'fixed', inset: 0 }} {...navigationLiquidMaterial}>
      {[0, 1].map(i => <Liquid.Item key={`body-${i}`} observe radius={9999}><div className="liquid-demo-shape" ref={node => { bodies.current[i] = node }} /></Liquid.Item>)}
      {Array.from({ length: 8 }, (_, i) => <Liquid.Item key={`neck-${i}`} observe radius={9999}><div className="liquid-demo-shape" ref={node => { beads.current[i] = node }} /></Liquid.Item>)}
      <Liquid.Item observe radius={9999}><div className="liquid-demo-shape" ref={drop} /></Liquid.Item>
    </Liquid>
  </div>
}
