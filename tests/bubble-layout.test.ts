import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getBubbleLayout } from '../src/utils/bubbleLayout.ts'

for (const viewport of [320, 390, 620, 785, 1440]) {
  test(`${viewport}px: bubbles grow until their viewport-safe limit`, () => {
    let previous = 0
    for (let count = 0; count <= 100; count += 1) {
      const layout = getBubbleLayout(count, viewport)
      assert.ok(layout.diameter <= Math.min(400, viewport - 44))
      assert.ok(layout.diameter >= previous)
      if (count <= layout.pageSize) assert.ok(layout.diameter > previous)
      previous = layout.diameter
    }
  })

  test(`${viewport}px: tiles and add shortcut fit without overlap on every page`, () => {
    for (let count = 0; count <= 40; count += 1) {
      const layout = getBubbleLayout(count, viewport)
      for (let start = 0; start <= count; start += layout.pageSize) {
        const size = Math.min(layout.pageSize, count - start)
        const points = layout.positionsForPage(size)
        assert.equal(points.length, size + 1)
        for (let a = 0; a < points.length; a += 1) {
          const point = points[a]
          for (const x of [-layout.tile.width / 2, layout.tile.width / 2]) {
            for (const y of [-layout.tile.height / 2, layout.tile.height / 2]) {
              assert.ok(Math.hypot(point.x + x, point.y + y) < layout.diameter / 2 - 8)
            }
          }
          for (let b = a + 1; b < points.length; b += 1) {
            assert.ok(
              Math.abs(point.x - points[b].x) >= layout.tile.width ||
              Math.abs(point.y - points[b].y) >= layout.tile.height,
              `overlap: viewport=${viewport}, count=${size}, tiles=${a},${b}`,
            )
          }
        }
      }
    }
  })
}

test('empty category keeps an add shortcut; large categories retain bounded page capacity', () => {
  const empty = getBubbleLayout(0, 1440)
  assert.equal(empty.positionsForPage(0).length, 1)
  const many = getBubbleLayout(1000, 390)
  assert.ok(many.pageSize > 0 && many.pageSize < 1000)
  assert.ok(many.diameter <= 336)
})
