export type Point = { x: number; y: number }
export type Body = Point & { radius: number }
export type Scene = { a: Body; b: Body; dropRadius: number; width: number; height: number }
export type Spring = { value: number; velocity: number }

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
export const mix = (a: number, b: number, t: number) => a + (b - a) * t
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
export const smoothstep = (t: number) => { const p = clamp(t); return p * p * (3 - 2 * p) }

export function makeScene(width: number, height: number): Scene {
  const mobile = width < 640
  const scale = Math.min(1, width / 1000)
  return {
    width, height,
    a: mobile ? { x: width / 2, y: 134, radius: 72 } : { x: width * 0.235, y: height * 0.48, radius: 100 * scale },
    b: mobile ? { x: width / 2, y: 425, radius: 97 } : { x: width * 0.76, y: height * 0.48, radius: 132 * scale },
    dropRadius: mobile ? 29 : Math.max(29, 37 * scale),
  }
}

export function unit(from: Point, to: Point): Point {
  const length = distance(from, to)
  return length < 0.001 ? { x: 1, y: 0 } : { x: (to.x - from.x) / length, y: (to.y - from.y) / length }
}

export function dockPoint(body: Body, other: Body): Point {
  const direction = unit(body, other)
  return { x: body.x + direction.x * body.radius * 0.42, y: body.y + direction.y * body.radius * 0.42 }
}

/** Contact exists only around the boundary: no invisible tether across the stage.
 * The same profile drives both reservoirs, so approach and separation are symmetric. */
export function contact(body: Body, drop: Point, dropRadius: number) {
  const length = distance(body, drop)
  const reach = dropRadius * 2.3
  const gap = length - body.radius - dropRadius
  const emergence = smoothstep((length - body.radius * 0.52) / (body.radius * 0.64))
  const release = 1 - smoothstep((gap - 10) / (reach - 10))
  return { amount: emergence * release, gap, direction: unit(body, drop), reach }
}

export function springStep(spring: Spring, target: number, dt: number, stiffness = 180, damping = 15) {
  // Clamp the integration step after a background-tab pause to prevent explosive recoil.
  const step = Math.min(dt, 1 / 30)
  spring.velocity += ((target - spring.value) * stiffness - spring.velocity * damping) * step
  spring.value += spring.velocity * step
  if (Math.abs(spring.value - target) < 0.0001 && Math.abs(spring.velocity) < 0.0001) {
    spring.value = target
    spring.velocity = 0
  }
  return spring.value
}

/** The preview deliberately slows at BOTH seams so the neck and intake are visible. */
export function demoPoint(scene: Scene, progress: number, from: 'a' | 'b'): Point {
  const origin = scene[from]
  const destination = scene[from === 'a' ? 'b' : 'a']
  const direction = unit(origin, destination)
  const start = dockPoint(origin, destination)
  const finish = dockPoint(destination, origin)
  const points = [
    { t: 0, point: start },
    { t: 0.12, point: { x: origin.x + direction.x * (origin.radius + 8), y: origin.y + direction.y * (origin.radius + 8) } },
    { t: 0.34, point: { x: origin.x + direction.x * (origin.radius + scene.dropRadius + 58), y: origin.y + direction.y * (origin.radius + scene.dropRadius + 58) } },
    { t: 0.52, point: { x: destination.x - direction.x * (destination.radius + scene.dropRadius + 55), y: destination.y - direction.y * (destination.radius + scene.dropRadius + 55) } },
    { t: 0.8, point: { x: destination.x - direction.x * (destination.radius - 4), y: destination.y - direction.y * (destination.radius - 4) } },
    { t: 1, point: finish },
  ]
  const index = Math.max(1, points.findIndex((keyframe) => clamp(progress) <= keyframe.t))
  const first = points[index - 1]
  const second = points[index]
  const t = smoothstep((clamp(progress) - first.t) / (second.t - first.t))
  return { x: mix(first.point.x, second.point.x, t), y: mix(first.point.y, second.point.y, t) }
}
