// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bubbleCollision, isInsideBubble } from '../../src/templates/bubble/drag/collision'

function rect(left: number, top: number, width: number, height: number) {
  return { left, top, right: left + width, bottom: top + height, width, height }
}

function candidate(id: string, bounds: ReturnType<typeof rect>, stripBounds = rect(0, 0, 1000, 800)) {
  const node = document.createElement('div')
  const strip = document.createElement('div')
  strip.className = 'module-grid'
  strip.getBoundingClientRect = vi.fn(() => stripBounds as DOMRect)
  strip.append(node)
  node.getBoundingClientRect = vi.fn(() => bounds as DOMRect)
  return { container: { id, node: { current: node } }, node }
}

function collision({
  point,
  collisionRect = rect(0, 0, 40, 40),
  candidates = [],
}: {
  point?: { x: number; y: number }
  collisionRect?: ReturnType<typeof rect>
  candidates?: ReturnType<typeof candidate>[]
}) {
  const droppableContainers = candidates.map(({ container }) => container)
  const droppableRects = new Map(candidates.map(({ container, node }) => [container.id, node.getBoundingClientRect()]))
  return bubbleCollision({
    collisionRect,
    pointerCoordinates: point,
    droppableContainers,
    droppableRects,
  } as never)
}

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
})

describe('isInsideBubble', () => {
  it('rejects zero-sized rectangles and accepts the center', () => {
    expect(isInsideBubble({ x: 10, y: 10 }, rect(0, 0, 0, 20))).toBe(false)
    expect(isInsideBubble({ x: 50, y: 50 }, rect(0, 0, 100, 100))).toBe(true)
  })

  it('treats the circular edge as inside and corners as outside', () => {
    expect(isInsideBubble({ x: 100, y: 50 }, rect(0, 0, 100, 100))).toBe(true)
    expect(isInsideBubble({ x: 0, y: 0 }, rect(0, 0, 100, 100))).toBe(false)
  })
})

describe('bubbleCollision', () => {
  it('returns no target when there are no candidates or a candidate has no geometry', () => {
    expect(collision({ point: { x: 50, y: 50 } })).toEqual([])
    const item = candidate('a', rect(0, 0, 100, 100))
    item.node.closest = vi.fn(() => null)
    expect(collision({ point: { x: 50, y: 50 }, candidates: [item] })).toEqual([])
  })

  it('selects a bubble only when the pointer is inside the bubble and strip viewport', () => {
    const item = candidate('a', rect(0, 0, 100, 100))
    expect(collision({ point: { x: 50, y: 50 }, candidates: [item] })).toEqual([{ id: 'a' }])
    expect(collision({ point: { x: 0, y: 0 }, candidates: [item] })).toEqual([])
    expect(collision({ point: { x: 150, y: 50 }, candidates: [item] })).toEqual([])
  })

  it('uses collision-rectangle center when pointer coordinates are unavailable', () => {
    const item = candidate('a', rect(0, 0, 100, 100))
    expect(collision({ collisionRect: rect(30, 30, 40, 40), candidates: [item] })).toEqual([{ id: 'a' }])
  })

  it('clips candidates outside the viewport or the module strip', () => {
    const outsideViewport = candidate('viewport', rect(0, 0, 100, 100), rect(-10, -10, 5, 5))
    const outsideStrip = candidate('strip', rect(0, 0, 100, 100), rect(200, 200, 100, 100))
    expect(collision({ point: { x: 50, y: 50 }, candidates: [outsideViewport, outsideStrip] })).toEqual([])
  })

  it('returns every overlapping candidate in stable droppable order', () => {
    const first = candidate('first', rect(0, 0, 100, 100))
    const second = candidate('second', rect(0, 0, 100, 100))
    expect(collision({ point: { x: 50, y: 50 }, candidates: [first, second] })).toEqual([{ id: 'first' }, { id: 'second' }])
  })

  it('handles missing droppable rectangles without throwing', () => {
    const item = candidate('missing', rect(0, 0, 100, 100))
    expect(bubbleCollision({
      collisionRect: rect(0, 0, 40, 40),
      pointerCoordinates: { x: 50, y: 50 },
      droppableContainers: [item.container],
      droppableRects: new Map(),
    } as never)).toEqual([])
  })
})
