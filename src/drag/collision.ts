import type { CollisionDetection, KeyboardCoordinateGetter } from '@dnd-kit/core'

type Point = { x: number; y: number }
type Rect = { left: number; top: number; width: number; height: number }

export function isInsideBubble(point: Point, rect: Rect) {
  if (rect.width <= 0 || rect.height <= 0) return false
  const x = (point.x - rect.left - rect.width / 2) / (rect.width / 2)
  const y = (point.y - rect.top - rect.height / 2) / (rect.height / 2)
  return x * x + y * y <= 1
}

// Circle corners and clipped/off-screen parts of the horizontal strip are not valid drop targets.
export const bubbleCollision: CollisionDetection = ({ collisionRect, pointerCoordinates, droppableContainers, droppableRects }) => {
  const point = pointerCoordinates ?? {
    x: collisionRect.left + collisionRect.width / 2,
    y: collisionRect.top + collisionRect.height / 2,
  }
  return droppableContainers.flatMap((container) => {
    const rect = droppableRects.get(container.id)
    const strip = container.node.current?.closest('.module-grid')?.getBoundingClientRect()
    if (!rect || !strip || point.x < Math.max(0, strip.left) || point.x > Math.min(window.innerWidth, strip.right)
      || point.y < Math.max(0, strip.top) || point.y > Math.min(window.innerHeight, strip.bottom)) return []
    return isInsideBubble(point, rect) ? [{ id: container.id }] : []
  })
}

// The UI packs icons automatically: keyboard arrows select categories, not arbitrary icon positions.
export const categoryKeyboardCoordinates: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
  const directions: Record<string, Point> = {
    ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
  }
  const direction = directions[event.code]
  const current = context.collisionRect
  if (!direction || !current) return
  event.preventDefault()
  const center = { x: current.left + current.width / 2, y: current.top + current.height / 2 }
  const candidates = context.droppableContainers.getEnabled().flatMap((container) => {
    const node = container.node.current
    if (!node || container.id === context.over?.id) return []
    const rect = node.getBoundingClientRect()
    const dx = rect.left + rect.width / 2 - center.x
    const dy = rect.top + rect.height / 2 - center.y
    if (dx * direction.x + dy * direction.y <= 1) return []
    return [{ node, distance: Math.hypot(dx, dy) }]
  }).sort((a, b) => a.distance - b.distance)
  const target = candidates[0]?.node
  if (!target) return
  target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
  const rect = target.getBoundingClientRect()
  return {
    x: currentCoordinates.x + rect.left + rect.width / 2 - center.x,
    y: currentCoordinates.y + rect.top + rect.height / 2 - center.y,
  }
}
