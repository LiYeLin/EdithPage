type Point = { x: number; y: number }
type Body = Point & { radius: number }
type Bounds = { left: number; top: number; width: number; height: number }

// A light direction inside the unit disc; the resting light comes from above-left.
export const DEFAULT_LIGHT: Readonly<Point> = { x: -0.53, y: -0.84 }
const LIGHT_REACH = 1.6
const LIGHT_RESPONSE = 12
const LIGHT_EPSILON = 0.001

export function bubbleLight(body: Body, pointer: Point | null): Point {
  if (!pointer) return { ...DEFAULT_LIGHT }
  const x = (pointer.x - body.x) / Math.max(1, body.radius * LIGHT_REACH)
  const y = (pointer.y - body.y) / Math.max(1, body.radius * LIGHT_REACH)
  // Clamp radially, not per axis, so diagonal highlights stay inside the bubble too.
  const length = Math.max(1, Math.hypot(x, y))
  return { x: x / length, y: y / length }
}

export function stepLight(current: Point, target: Point, dt: number, reducedMotion = false): Point {
  if (reducedMotion) return { ...target }
  const blend = 1 - Math.exp(-Math.max(0, dt) * LIGHT_RESPONSE)
  const next = { x: current.x + (target.x - current.x) * blend, y: current.y + (target.y - current.y) * blend }
  // Snap when settled so cursor movement cannot leave a bubble's RAF running forever.
  return Math.hypot(next.x - target.x, next.y - target.y) < LIGHT_EPSILON ? { ...target } : next
}

/** Homepage activation uses the circle/ellipse, not the rectangular DOM hit box.
 * Measure the stable shell, never the bouncing skin, to avoid edge flicker. */
export function hoverLight(bounds: Bounds, pointer: Point): Point | null {
  if (bounds.width <= 0 || bounds.height <= 0) return null
  const x = (pointer.x - bounds.left - bounds.width / 2) / (bounds.width / 2)
  const y = (pointer.y - bounds.top - bounds.height / 2) / (bounds.height / 2)
  if (x * x + y * y > 1) return null
  return bubbleLight({ x: 0, y: 0, radius: 1 }, { x, y })
}

/** Update only reflection layers; never replace the skin's spring-driven transform. */
export function paintBubbleLight(element: HTMLElement, light: Point) {
  element.style.setProperty('--bubble-light-x', light.x.toFixed(4))
  element.style.setProperty('--bubble-light-y', light.y.toFixed(4))
  // The streak is tangent to the sphere; CSS makes it round near the center,
  // where the direction would otherwise be ambiguous.
  element.style.setProperty('--bubble-light-angle', `${Math.atan2(light.y, light.x) * 180 / Math.PI + 90}deg`)
  element.style.setProperty('--bubble-light-distance', Math.hypot(light.x, light.y).toFixed(4))
}
