import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moveSite } from '../src/utils/moveSite.ts'
import { isInsideBubble } from '../src/drag/collision.ts'

const site = { id: 'one', name: 'One', url: 'https://example.com', description: 'Keep me', shortcut: '⌘1' }
const config = { accent: 'mint', modules: [
  { id: 'a', title: 'A', sites: [{ ...site, id: 'before' }, site, { ...site, id: 'after' }] },
  { id: 'b', title: 'B', sites: [{ ...site, id: 'other' }] },
  { id: 'empty', title: 'Empty', sites: [] },
] }
const move = { siteId: 'one', fromModuleId: 'a', toModuleId: 'b' }

test('cross-category move is atomic, immutable and preserves site ID / metadata', () => {
  const before = JSON.stringify(config)
  const next = moveSite(config, move)
  assert.deepEqual(next.modules[0].sites.map(s => s.id), ['before', 'after'])
  assert.deepEqual(next.modules[1].sites.map(s => s.id), ['other', 'one'])
  assert.equal(next.modules[1].sites[1], site)
  assert.equal(next.modules[2], config.modules[2])
  assert.equal(JSON.stringify(config), before)
  assert.equal(next.modules.flatMap(m => m.sites).length, 4)
  assert.deepEqual(JSON.parse(JSON.stringify(next)), next)
})

test('empty category accepts a site', () => {
  const next = moveSite(config, { ...move, toModuleId: 'empty' })
  assert.equal(next.modules[2].sites[0], site)
})

test('undo restores the original index without overwriting other category changes', () => {
  const moved = moveSite(config, move)
  const extra = { ...site, id: 'extra' }
  moved.modules[1].sites.push(extra)
  const restored = moveSite(moved, { siteId: 'one', fromModuleId: 'b', toModuleId: 'a', toIndex: 1 })
  assert.deepEqual(restored.modules[0].sites, config.modules[0].sites)
  assert.deepEqual(restored.modules[1].sites.map(s => s.id), ['other', 'extra'])
})

for (const [name, values] of Object.entries({
  'same category': { toModuleId: 'a' }, 'missing source': { fromModuleId: 'missing' },
  'missing target': { toModuleId: 'missing' }, 'missing site': { siteId: 'missing' },
})) {
  test(`${name} is a no-op`, () => assert.equal(moveSite(config, { ...move, ...values }), config))
}

test('duplicate / repeated drops never duplicate the site', () => {
  const moved = moveSite(config, move)
  assert.equal(moveSite(moved, move), moved)
  const duplicate = structuredClone(config)
  duplicate.modules[1].sites.push(site)
  assert.equal(moveSite(duplicate, move), duplicate)
})

test('undo clamps the old index after unrelated deletions', () => {
  const next = moveSite(config, { ...move, toIndex: 999 })
  assert.equal(next.modules[1].sites.at(-1), site)
  assert.equal(moveSite(config, { ...move, toIndex: -1 }).modules[1].sites[0], site)
})

test('circular collision accepts center / edge and rejects rectangular corners', () => {
  const rect = { left: 100, top: 200, width: 300, height: 300 }
  assert.equal(isInsideBubble({ x: 250, y: 350 }, rect), true)
  assert.equal(isInsideBubble({ x: 400, y: 350 }, rect), true)
  assert.equal(isInsideBubble({ x: 101, y: 201 }, rect), false)
  assert.equal(isInsideBubble({ x: 401, y: 350 }, rect), false)
  assert.equal(isInsideBubble({ x: 0, y: 0 }, { left: 0, top: 0, width: 0, height: 0 }), false)
})
