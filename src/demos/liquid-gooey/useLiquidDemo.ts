import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { clamp, contact, demoPoint, distance, dockPoint, makeScene, mix, springStep, type Body, type Point, type Spring } from './physics'
import { bubbleLight, DEFAULT_LIGHT, paintBubbleLight, stepLight } from '../../effects/bubbleHighlights'

type Phase = 'idle' | 'pull' | 'free' | 'join' | 'settled'
type Mode = 'idle' | 'drag' | 'demo' | 'settle'
type Reservoir = 'a' | 'b'
const newSpring = (): Spring => ({ value: 0, velocity: 0 })
type Controller = { reset: () => void; play: () => void; cancel: () => void; punch: (index: number) => void }

// Recoil tuning: raise these values together for a more elastic, exaggerated splash-back.
const RECOIL_LAND_VELOCITY = 9.2
const RECOIL_DETACH_IMPULSE = 5.8
const RECOIL_STIFFNESS = 145
const RECOIL_DAMPING = 8
const RECOIL_DEFORMATION = 0.115
const CLICK_PULSE_VELOCITY = 12
const CLICK_PULSE_SCALE = 0.12

function position(element: HTMLElement | null, center: Point, width: number, height = width) {
  if (!element) return
  element.style.width = `${width.toFixed(2)}px`
  element.style.height = `${height.toFixed(2)}px`
  element.style.transform = `translate3d(${(center.x - width / 2).toFixed(2)}px, ${(center.y - height / 2).toFixed(2)}px, 0)`
}

export function useLiquidDemo() {
  const stageRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLButtonElement>(null)
  const bodyRefs = useRef<(HTMLDivElement | null)[]>([])
  const neckRefs = useRef<(HTMLDivElement | null)[][]>([[], []])
  const labelRefs = useRef<(HTMLDivElement | null)[]>([])
  const rippleRefs = useRef<(HTMLDivElement | null)[]>([])
  const controller = useRef<Controller>({ reset: () => {}, play: () => {}, cancel: () => {}, punch: () => {} })
  const input = useRef({ pointerId: -1, target: { x: 0, y: 0 }, offset: { x: 0, y: 0 }, released: false })
  const flags = useRef({ slow: false, paused: false, reduced: false })
  const [phase, setPhase] = useState<Phase>('idle')
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!stageRef.current) return
    const stage = stageRef.current
    let scene = makeScene(stage.clientWidth, stage.clientHeight)
    let dock: Reservoir = 'a'
    let mode: Mode = 'idle'
    let point = dockPoint(scene.a, scene.b)
    let settleTarget = point
    let elapsed = 0
    let lastTime = 0
    let frame = 0
    let alive = true
    let shownPhase: Phase = 'idle'
    const pull = [newSpring(), newSpring()]
    const recoil = [newSpring(), newSpring()]
    const pulse = [newSpring(), newSpring()]
    const directions = [{ x: 1, y: 0 }, { x: -1, y: 0 }]
    const lastContact = [0, 0]
    let lightPointer: Point | null = null
    const lights = [{ ...DEFAULT_LIGHT }, { ...DEFAULT_LIGHT }]
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    flags.current.reduced = query.matches

    const announce = (next: Phase) => {
      if (shownPhase === next) return
      shownPhase = next
      stage.dataset.phase = next
      setPhase(next)
    }

    const wake = () => { if (alive && !frame) frame = requestAnimationFrame(render) }
    const setMotion = () => { flags.current.reduced = query.matches; wake() }
    query.addEventListener('change', setMotion)

    const clearLight = () => { lightPointer = null; wake() }
    const trackLight = (event: globalThis.PointerEvent) => {
      if (!event.isPrimary || event.pointerType === 'touch') return
      const rect = stage.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      // Captured icon drags still send moves outside the stage; restore the resting light there.
      lightPointer = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height ? { x, y } : null
      wake()
    }

    const ripple = (index: number) => {
      if (flags.current.reduced) return
      const element = rippleRefs.current[index]
      element?.getAnimations().forEach((animation) => animation.cancel())
      element?.animate([
        { opacity: 0.6, scale: 0.72, borderWidth: '2px' },
        { opacity: 0, scale: 1.3, borderWidth: '0.5px' },
      ], { duration: flags.current.slow ? 1800 : 950, easing: 'cubic-bezier(.16, 1, .3, 1)' })
    }

    const land = (target: Reservoir) => {
      const previous = dock
      dock = target
      mode = 'settle'
      settleTarget = dockPoint(scene[dock], scene[dock === 'a' ? 'b' : 'a'])
      recoil[dock === 'a' ? 0 : 1].velocity = flags.current.reduced ? 0 : RECOIL_LAND_VELOCITY
      if (previous !== target) ripple(target === 'a' ? 0 : 1)
      setPlaying(false)
      setPaused(false)
      flags.current.paused = false
      announce(previous === target ? 'idle' : 'settled')
      wake()
    }

    const reset = () => {
      input.current.pointerId = -1
      input.current.released = false
      dock = 'a'
      mode = 'idle'
      point = dockPoint(scene.a, scene.b)
      settleTarget = point
      pull.forEach((s) => { s.value = 0; s.velocity = 0 })
      recoil.forEach((s) => { s.value = 0; s.velocity = 0 })
      pulse.forEach((s) => { s.value = 0; s.velocity = 0 })
      rippleRefs.current.forEach((element) => element?.getAnimations().forEach((animation) => animation.cancel()))
      elapsed = 0
      lightPointer = null
      flags.current.paused = false
      setPaused(false)
      setPlaying(false)
      announce('idle')
      wake()
    }

    controller.current = {
      reset,
      play: () => {
        if (mode === 'demo') {
          flags.current.paused = !flags.current.paused
          setPaused(flags.current.paused)
          wake()
          return
        }
        if (flags.current.reduced) { land(dock === 'a' ? 'b' : 'a'); return }
        mode = 'demo'
        elapsed = 0
        input.current.pointerId = -1
        flags.current.paused = false
        setPaused(false)
        setPlaying(true)
        announce('pull')
        wake()
      },
      cancel: () => { input.current.pointerId = -1; input.current.released = false; land(dock) },
      punch: (index) => {
        if (flags.current.reduced) return
        pulse[index].velocity = CLICK_PULSE_VELOCITY
        ripple(index)
        wake()
      },
    }

    function paintLight(body: Body, index: number, dt: number) {
      const target = bubbleLight(body, lightPointer)
      const light = stepLight(lights[index], target, dt, flags.current.reduced)
      lights[index] = light
      const element = bodyRefs.current[index]
      if (element) paintBubbleLight(element, light)
      return light.x !== target.x || light.y !== target.y
    }

    function paintBody(body: Body, index: number, dt: number, pulseDt: number) {
      const touch = contact(body, point, scene.dropRadius)
      const active = mode === 'drag' || mode === 'demo'
      const amount = active && !flags.current.reduced ? touch.amount : 0
      if (amount > 0.025) directions[index] = touch.direction
      // Release the large body as well as the neck, otherwise only the icon looks liquid.
      if (lastContact[index] > 0.08 && amount <= 0.08) recoil[index].velocity -= RECOIL_DETACH_IMPULSE
      lastContact[index] = amount
      const tension = springStep(pull[index], amount, dt, 240, 22)
      const bounce = springStep(recoil[index], 0, dt, RECOIL_STIFFNESS, RECOIL_DAMPING)
      const pulseAmount = springStep(pulse[index], 0, pulseDt, 190, 13)
      const direction = directions[index]
      const deformation = tension * 0.065 + bounce * RECOIL_DEFORMATION
      const pulseScale = 1 + pulseAmount * CLICK_PULSE_SCALE
      const center = { x: body.x + direction.x * tension * 8, y: body.y + direction.y * tension * 8 }
      const stretchX = deformation * (Math.abs(direction.x) * 2 - 1)
      position(bodyRefs.current[index], center, body.radius * 2 * (1 + stretchX) * pulseScale, body.radius * 2 * (1 - stretchX) * pulseScale)
      const label = labelRefs.current[index]
      if (label) label.style.transform = `translate(${body.x}px, ${body.y + body.radius + 39}px)`
      position(rippleRefs.current[index], body, body.radius * 2 + 24)

      // Overlapping silhouette beads create a continuous tapered neck in Liquid's shared
      // SVG filter. They retract into their OWN reservoir, never teleport to the other.
      const extension = clamp(touch.gap + scene.dropRadius * 0.8, 0, touch.reach)
      const strength = clamp(tension)
      for (let n = 0; n < 4; n++) {
        const t = n / 3
        const neckCenter = {
          x: center.x + direction.x * (body.radius - 21 + extension * t * strength),
          y: center.y + direction.y * (body.radius - 21 + extension * t * strength),
        }
        const radius = mix(35, 15, t) * strength * (1 - clamp(touch.gap / touch.reach) * t * 0.42)
        // A zero-sized bead is placed safely INSIDE its body; it cannot leave loose specks.
        position(neckRefs.current[index][n], strength < 0.01 ? center : neckCenter, Math.max(0, radius * 2))
      }
      return touch
    }

    function render(time: number) {
      frame = 0
      if (!alive) return
      const realDt = Math.min((time - (lastTime || time - 16.67)) / 1000, 1 / 30)
      lastTime = time
      // 暂停只冻结拖拽演示；用户新点击的回弹仍按慢动作倍率独立运行。
      const pulseDt = realDt * (flags.current.slow ? 0.35 : 1)
      const dt = flags.current.paused && mode === 'demo' ? 0 : pulseDt
      if (input.current.pointerId !== -1 && mode !== 'drag') {
        mode = 'drag'
        setPlaying(false)
        flags.current.paused = false
        setPaused(false)
      }
      if (mode === 'drag') {
        point = { ...input.current.target }
        if (input.current.released) {
          input.current.released = false
          const target = dock === 'a' ? 'b' : 'a'
          land(distance(point, scene[target]) < scene[target].radius + scene.dropRadius * 0.5 ? target : dock)
        }
      } else if (mode === 'demo' && !flags.current.paused) {
        elapsed += dt
        point = demoPoint(scene, Math.min(1, elapsed / 6.6), dock)
        if (elapsed >= 6.6) land(dock === 'a' ? 'b' : 'a')
      } else if (mode === 'settle') {
        const blend = flags.current.reduced ? 1 : 1 - Math.exp(-dt * 10)
        point = { x: mix(point.x, settleTarget.x, blend), y: mix(point.y, settleTarget.y, blend) }
        if (distance(point, settleTarget) < 0.1) { point = settleTarget; mode = 'idle' }
      }
      const a = paintBody(scene.a, 0, dt, pulseDt)
      const b = paintBody(scene.b, 1, dt, pulseDt)
      position(dropRef.current, point, scene.dropRadius * 2)
      // Lighting uses real time: pausing/slowing the demo never delays pointer feedback.
      const lightA = paintLight(scene.a, 0, realDt)
      const lightB = paintLight(scene.b, 1, realDt)
      stage.dataset.dock = dock
      stage.dataset.mode = mode
      if (mode === 'drag' || mode === 'demo') {
        const source = dock === 'a' ? a : b
        const destination = dock === 'a' ? b : a
        const overDestination = distance(point, scene[dock === 'a' ? 'b' : 'a']) < scene[dock === 'a' ? 'b' : 'a'].radius
        announce(destination.amount > 0.08 || overDestination ? 'join' : source.gap < 0 || (source.gap < source.reach && source.amount > 0.04) ? 'pull' : 'free')
      }
      const isUnsettled = (s: Spring) => Math.abs(s.value) > 0.001 || Math.abs(s.velocity) > 0.001
      const unsettled = [...pull, ...recoil].some(isUnsettled)
      if ((mode === 'demo' && !flags.current.paused) || mode === 'drag' || mode === 'settle' || (unsettled && !flags.current.paused) || pulse.some(isUnsettled) || lightA || lightB) wake()
    }

    const resize = new ResizeObserver(() => {
      scene = makeScene(stage.clientWidth, stage.clientHeight)
      lightPointer = null
      // Resizing cancels the current gesture, avoiding stale client-space coordinates.
      input.current.pointerId = -1
      input.current.released = false
      mode = 'idle'
      point = dockPoint(scene[dock], scene[dock === 'a' ? 'b' : 'a'])
      settleTarget = point
      setPlaying(false)
      flags.current.paused = false
      setPaused(false)
      announce('idle')
      wake()
    })
    resize.observe(stage)
    stage.addEventListener('pointerdown', wake)
    stage.addEventListener('pointerdown', trackLight, { passive: true })
    stage.addEventListener('pointermove', trackLight, { passive: true })
    stage.addEventListener('pointerleave', clearLight)
    stage.addEventListener('pointercancel', clearLight)
    window.addEventListener('scroll', clearLight, { passive: true, capture: true })
    const blur = () => { clearLight(); if (mode === 'drag') controller.current.cancel() }
    window.addEventListener('blur', blur)
    wake()
    return () => {
      alive = false
      cancelAnimationFrame(frame)
      resize.disconnect()
      query.removeEventListener('change', setMotion)
      window.removeEventListener('blur', blur)
      stage.removeEventListener('pointerdown', wake)
      stage.removeEventListener('pointerdown', trackLight)
      stage.removeEventListener('pointermove', trackLight)
      stage.removeEventListener('pointerleave', clearLight)
      stage.removeEventListener('pointercancel', clearLight)
      window.removeEventListener('scroll', clearLight, true)
    }
  }, [])

  const onPointerDown = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !event.isPrimary || !stageRef.current) return
    const stage = stageRef.current.getBoundingClientRect()
    const icon = event.currentTarget.getBoundingClientRect()
    const center = { x: icon.left + icon.width / 2 - stage.left, y: icon.top + icon.height / 2 - stage.top }
    input.current = {
      pointerId: event.pointerId, released: false, target: center,
      offset: { x: event.clientX - stage.left - center.x, y: event.clientY - stage.top - center.y },
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.focus({ preventScroll: true })
    event.preventDefault()
  }, [])

  const onPointerMove = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (input.current.pointerId !== event.pointerId || !stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    const inset = event.currentTarget.offsetWidth / 2 + 6
    input.current.target = {
      x: clamp(event.clientX - rect.left - input.current.offset.x, inset, rect.width - inset),
      y: clamp(event.clientY - rect.top - input.current.offset.y, inset, rect.height - inset),
    }
  }, [])

  const onPointerUp = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (input.current.pointerId !== event.pointerId) return
    onPointerMove(event)
    input.current.released = true
    input.current.pointerId = -1
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }, [onPointerMove])

  return {
    stageRef, dropRef, bodyRefs, neckRefs, labelRefs, rippleRefs, phase, playing, paused, slow,
    onPointerDown, onPointerMove, onPointerUp,
    cancel: () => controller.current.cancel(),
    onBubblePointerDown: (event: PointerEvent<HTMLDivElement>, index: number) => {
      if (event.button !== 0 || !event.isPrimary) return
      controller.current.punch(index)
    },
    reset: () => controller.current.reset(),
    play: () => controller.current.play(),
    toggleSlow: () => { flags.current.slow = !flags.current.slow; setSlow(flags.current.slow) },
  }
}
