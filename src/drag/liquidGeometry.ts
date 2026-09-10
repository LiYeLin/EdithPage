export type Point = { x: number; y: number }
export type Rect = { left: number; top: number; width: number; height: number }
export const ATTACH_DISTANCE = 28

export function rectCenter(rect: Rect): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

// Radial intersection also tolerates the slight ellipse during a Motion layout transition.
export function edgeContact(rect: Rect, point: Point) {
  if (rect.width <= 0 || rect.height <= 0) return null
  const center = rectCenter(rect)
  const dx = point.x - center.x
  const dy = point.y - center.y
  const distance = Math.hypot(dx, dy)
  const normal = distance > 0 ? { x: dx / distance, y: dy / distance } : { x: 0, y: -1 }
  const radius = 1 / Math.hypot(normal.x / (rect.width / 2), normal.y / (rect.height / 2))
  const gap = distance - radius
  return {
    point: { x: center.x + normal.x * (radius - 4), y: center.y + normal.y * (radius - 4) },
    normal,
    gap,
    attached: Math.abs(gap) <= ATTACH_DISTANCE,
  }
}

export function containsPoint(rect: Rect, point: Point) {
  return rect.width > 0 && rect.height > 0 && point.x >= rect.left && point.x <= rect.left + rect.width
    && point.y >= rect.top && point.y <= rect.top + rect.height
}
