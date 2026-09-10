import { useEffect, useRef } from 'react'
import { DEFAULT_LIGHT, hoverLight, paintBubbleLight, stepLight } from '../effects/bubbleHighlights'
import { springStep } from '../demos/liquid-gooey/physics'

/** Animate only the skin: hit boxes, pagination and readable icons stay stable. */
export function useBubbleLiquid(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const skin = ref.current
    const shell = skin?.closest<HTMLElement>('.bubble-shell')
    if (!skin || !shell || !enabled) return
    const ripple = shell.querySelector<HTMLElement>('.bubble-liquid-ripple')
    const splash = () => {
      ripple?.getAnimations().forEach(animation => animation.cancel())
      ripple?.animate([
        { opacity: .6, scale: .72, borderWidth: '2px' },
        { opacity: 0, scale: 1.3, borderWidth: '.5px' },
      ], { duration: 950, easing: 'cubic-bezier(.16, 1, .3, 1)' })
    }
    const pulse = { value: 0, velocity: 0 }
    const pull = { value: 0, velocity: 0 }
    const recoil = { value: 0, velocity: 0 }
    let light = { ...DEFAULT_LIGHT }
    let lightTarget = { ...DEFAULT_LIGHT }
    let amount = 0, previous = 0, direction = { x: 1, y: 0 }, frame = 0, last = 0
    const paint = (now: number) => {
      frame = 0
      const dt = Math.min((now - (last || now - 16.67)) / 1000, 1 / 30)
      last = now
      const nextLight = stepLight(light, lightTarget, dt)
      if (nextLight.x !== light.x || nextLight.y !== light.y) paintBubbleLight(skin, nextLight)
      light = nextLight
      const lightMoving = light.x !== lightTarget.x || light.y !== lightTarget.y
      const tension = springStep(pull, amount, dt, 240, 22)
      const bounce = springStep(recoil, 0, dt, 145, 8)
      const scale = 1 + springStep(pulse, 0, dt, 190, 13) * .12
      const stretch = (tension * .065 + bounce * .115) * (Math.abs(direction.x) * 2 - 1)
      skin.style.transform = `translate(${direction.x * tension * 8}px, ${direction.y * tension * 8}px) scale(${(1 + stretch) * scale}, ${(1 - stretch) * scale})`
      if (lightMoving || amount || [pulse, pull, recoil].some(s => Math.abs(s.value) > .001 || Math.abs(s.velocity) > .001)) frame = requestAnimationFrame(paint)
      else { skin.style.transform = ''; last = 0 }
    }
    const wake = () => { if (!frame) frame = requestAnimationFrame(paint) }
    const aimLight = (target: typeof light) => {
      if (target.x === lightTarget.x && target.y === lightTarget.y) return
      lightTarget = target
      wake()
    }
    const clearLight = () => aimLight({ ...DEFAULT_LIGHT })
    const trackLight = (event: PointerEvent) => {
      if (!event.isPrimary || event.pointerType === 'touch') return
      const target = hoverLight(shell.getBoundingClientRect(), { x: event.clientX, y: event.clientY })
      aimLight(target ?? { ...DEFAULT_LIGHT })
    }
    // Listen locally: moving outside this bubble never drives its highlight. The
    // ellipse check also rejects transparent corners and captured drags outside.
    shell.addEventListener('pointerenter', trackLight, { passive: true })
    shell.addEventListener('pointermove', trackLight, { passive: true })
    shell.addEventListener('pointerleave', clearLight)
    shell.addEventListener('pointercancel', clearLight)
    window.addEventListener('blur', clearLight)
    window.addEventListener('scroll', clearLight, { passive: true, capture: true })
    const resize = new ResizeObserver(clearLight)
    resize.observe(shell)

    const punch = (event: PointerEvent) => {
      if (event.button !== 0 || !event.isPrimary) return
      pulse.velocity = 12
      splash()
      wake()
    }
    const contact = (event: Event) => {
      const detail = (event as CustomEvent<{ amount: number; direction: { x: number; y: number }; land?: boolean }>).detail
      amount = detail.amount
      if (amount > .025) direction = detail.direction
      if (previous > .08 && amount <= .08) recoil.velocity -= 5.8
      if (detail.land) { recoil.velocity = 9.2; splash() }
      previous = amount
      wake()
    }
    shell.addEventListener('pointerdown', punch)
    shell.addEventListener('liquid-contact', contact)
    return () => {
      cancelAnimationFrame(frame)
      ripple?.getAnimations().forEach(animation => animation.cancel())
      skin.style.transform = ''
      paintBubbleLight(skin, DEFAULT_LIGHT)
      resize.disconnect()
      shell.removeEventListener('pointerenter', trackLight)
      shell.removeEventListener('pointermove', trackLight)
      shell.removeEventListener('pointerleave', clearLight)
      shell.removeEventListener('pointercancel', clearLight)
      window.removeEventListener('blur', clearLight)
      window.removeEventListener('scroll', clearLight, true)
      shell.removeEventListener('pointerdown', punch)
      shell.removeEventListener('liquid-contact', contact)
    }
  }, [enabled])
  return ref
}
