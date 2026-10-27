import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compactBubbleTile, desktopBubbleTile, getBubbleContents } from '../src/templates/bubble/utils/bubbleLayout.ts'
import { getWorkspaceLayout, workspaceFits } from '../src/templates/bubble/utils/workspaceLayout.ts'

const groups = (counts: number[]) => counts.map((count, index) => ({ id: `group-${index}`, sites: Array.from({ length: count }) }))

for (const tile of [desktopBubbleTile, compactBubbleTile]) {
  test(`${tile.icon}px icons: rows are centered and the four-site group has 2 + 3 slots`, () => {
    for (let count = 0; count <= 100; count++) {
      const { positions } = getBubbleContents(count, tile)
      const rows = Map.groupBy(positions, point => point.y)
      for (const row of rows.values()) {
        assert.ok(Math.abs(row.reduce((sum, point) => sum + point.x, 0)) < .01)
        assert.deepEqual(row.map(point => point.x), row.map(point => point.x).sort((a, b) => a - b))
      }
      if (count === 4) {
        assert.deepEqual([...rows.values()].map(row => row.length), [2, 3])
        assert.equal(positions[4].x, tile.width + 8)
        assert.equal(positions[4].y, positions[2].y)
      }
    }
  })
  test(`${tile.icon}px icons: all sites and Add stay inside the circle without overlapping`, () => {
    for (let count = 0; count <= 100; count++) {
      const layout = getBubbleContents(count, tile)
      assert.equal(layout.positions.length, count + 1)
      for (let a = 0; a < layout.positions.length; a++) {
        const point = layout.positions[a]
        for (const x of [-tile.width / 2, tile.width / 2]) {
          for (const y of [-tile.height / 2, tile.height / 2]) {
            assert.ok(Math.hypot(point.x + x, point.y + y) < layout.diameter / 2 - 8)
          }
        }
        for (let b = a + 1; b < layout.positions.length; b++) {
          const other = layout.positions[b]
          assert.ok(Math.abs(point.x - other.x) >= tile.width - .01 || Math.abs(point.y - other.y) >= tile.height - .01)
        }
      }
    }
  })
}

test('all-site layout grows beyond the former 400px and 12-site limits', () => {
  assert.equal(getBubbleContents(0).positions.length, 1)
  assert.ok(getBubbleContents(40).diameter > 400)
  assert.equal(getBubbleContents(40).positions.length, 41)
})

for (const size of [{ width: 1326, height: 380 }, { width: 1880, height: 620 }, { width: 2520, height: 940 }, { width: 3800, height: 1660 }]) {
  test(`${size.width}×${size.height}: mixed groups have deterministic, non-overlapping, bounded positions`, () => {
    const content = groups([2, 5, 0, 3])
    const result = getWorkspaceLayout(content, size)
    assert.ok(result.fits)
    assert.ok(workspaceFits(result.items, size))
    assert.deepEqual(result, getWorkspaceLayout(content, size))
    assert.deepEqual(result, getWorkspaceLayout(content, size, result))
    assert.equal(result.items.length, content.length)
  })
}

test('capacity depends on contents and available height, not a group-count ceiling', () => {
  const size = { width: 1400, height: 400 }
  assert.ok(getWorkspaceLayout(groups([0, 0, 0, 0, 0, 0]), size).fits)
  assert.equal(getWorkspaceLayout(groups([30, 30, 30]), size).fits, false)
  assert.equal(getWorkspaceLayout(groups([10, 10, 10, 10]), { width: 1000, height: 300 }).fits, false)
  assert.ok(getWorkspaceLayout(groups([10, 10, 10, 10]), { width: 1000, height: 1000 }).fits)
})

test('2K and 4K workspaces accommodate more of the same content', () => {
  const content = groups(Array(12).fill(10))
  assert.equal(getWorkspaceLayout(content, { width: 1880, height: 620 }).fits, false)
  assert.ok(getWorkspaceLayout(content, { width: 2520, height: 940 }).fits)
  assert.ok(getWorkspaceLayout(groups(Array(25).fill(10)), { width: 3800, height: 1660 }).fits)
})

test('over-capacity data retains every site and falls back to width-bounded vertical rows', () => {
  const size = { width: 600, height: 240 }
  const content = groups([100, 2, 60])
  const layout = getWorkspaceLayout(content, size)
  assert.equal(layout.fits, false)
  assert.ok(layout.height > size.height)
  for (const item of layout.items) {
    assert.equal(item.positions.length, content.find(group => group.id === item.id)!.sites.length + 1)
    assert.ok(item.x >= 0)
    assert.ok(item.x + item.diameter <= size.width)
    assert.ok(item.tile.width >= 44)
    assert.ok(item.tile.icon >= 40)
  }
  assert.ok(layout.items.some(item => item.rectangular))
  assert.ok(getWorkspaceLayout(content, { width: 3800, height: 1660 }, layout).fits)
})

test('rectangular overflow centers the last row including the add slot', () => {
  const item = getWorkspaceLayout(groups([150]), { width: 600, height: 240 }).items[0]
  assert.ok(item.rectangular)
  const rows = Map.groupBy(item.positions, point => point.y)
  for (const row of rows.values()) assert.ok(Math.abs(row.reduce((sum, point) => sum + point.x, 0)) < .01)
})

test('unmeasured workspace cannot approve additions', () => {
  assert.equal(getWorkspaceLayout(groups([0]), { width: 0, height: 0 }).fits, false)
  assert.equal(getWorkspaceLayout([], { width: 0, height: 0 }).fits, false)
})
