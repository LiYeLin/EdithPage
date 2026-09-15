export type Point = { x: number; y: number }
export type Body = Point & { radius: number }
export type Spring = { value: number; velocity: number }

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
export const mix = (a: number, b: number, t: number) => a + (b - a) * t
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
export const smoothstep = (t: number) => { const p = clamp(t); return p * p * (3 - 2 * p) }

export function unit(from: Point, to: Point): Point {
  const length = distance(from, to)
  return length < 0.001 ? { x: 1, y: 0 } : { x: (to.x - from.x) / length, y: (to.y - from.y) / length }
}

export function dockPoint(body: Body, other: Body): Point {
  const direction = unit(body, other)
  return { x: body.x + direction.x * body.radius * 0.42, y: body.y + direction.y * body.radius * 0.42 }
}

/** Contact exists only around the boundary: no invisible tether across the stage. */
export function contact(body: Body, drop: Point, dropRadius: number) {
  const length = distance(body, drop)
  const reach = dropRadius * 2.3
  const gap = length - body.radius - dropRadius
  const emergence = smoothstep((length - body.radius * 0.52) / (body.radius * 0.64))
  const release = 1 - smoothstep((gap - 10) / (reach - 10))
  return { amount: emergence * release, gap, direction: unit(body, drop), reach }
}

export function springStep(spring: Spring, target: number, dt: number, stiffness = 180, damping = 15) {
  const step = Math.min(dt, 1 / 30)
  spring.velocity += ((target - spring.value) * stiffness - spring.velocity * damping) * step
  spring.value += spring.velocity * step
  if (Math.abs(spring.value - target) < 0.0001 && Math.abs(spring.velocity) < 0.0001) {
    spring.value = target
    spring.velocity = 0
  }
  return spring.value
}
