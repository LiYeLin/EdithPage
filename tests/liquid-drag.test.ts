import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ATTACH_DISTANCE, containsPoint, edgeContact } from '../src/drag/liquidGeometry.ts'
import { LiquidSession, SETTLE_LIMIT_MS, type Arrival } from '../src/drag/liquidSession.ts'
import { categoryKeyboardCoordinates } from '../src/drag/collision.ts'

const rect = { left: 100, top: 100, width: 200, height: 200 }
const source: Arrival = { moduleId: 'source', siteId: 'one', variant: 'module' }
const target: Arrival = { ...source, moduleId: 'target' }

test('edge anchors sit just inside the radial boundary, not at the bubble center', () => {
  assert.deepEqual(edgeContact(rect, { x: 328, y: 200 })?.point, { x: 296, y: 200 })
  assert.deepEqual(edgeContact(rect, { x: 200, y: 80 })?.normal, { x: 0, y: -1 })
  const center = edgeContact(rect, { x: 200, y: 200 })!
  assert.equal(Number.isFinite(center.point.x), true)
  assert.equal(center.attached, false)
  assert.equal(edgeContact({ ...rect, width: 0 }, { x: 0, y: 0 }), null)
})

test('28px adhesion is bounded on both sides of the edge, including the exact threshold', () => {
  assert.equal(ATTACH_DISTANCE, 28)
  for (const gap of [-28, 0, 28]) assert.equal(edgeContact(rect, { x: 300 + gap, y: 200 })?.attached, true)
  for (const gap of [-28.01, 28.01, 1000]) assert.equal(edgeContact(rect, { x: 300 + gap, y: 200 })?.attached, false)
})

test('ellipse transitions and viewport clipping have finite, bounded geometry', () => {
  assert.equal(edgeContact({ ...rect, height: 100 }, { x: 200, y: 200 })?.gap, 0)
  assert.equal(containsPoint(rect, { x: 100, y: 100 }), true)
  assert.equal(containsPoint(rect, { x: 99, y: 100 }), false)
  assert.equal(containsPoint({ ...rect, width: 0 }, { x: 100, y: 100 }), false)
})

function fixture() {
  const pending: (Arrival | null)[] = []
  const released: string[] = []
  let callback: (() => void) | null = null
  let deadline = 0
  let cancellations = 0
  const session = new LiquidSession(a => pending.push(a), reason => released.push(reason), {
    schedule: (next, ms) => { callback = next; deadline = ms; return () => { cancellations++ } },
  })
  return { session, pending, released, expire: () => callback?.(), deadline: () => deadline, cancellations: () => cancellations }
}

test('lifting, source attachment, detachment and valid target follow do not submit data', () => {
  const f = fixture()
  assert.equal(f.session.phase, 'lifting')
  f.session.follow(true, false); assert.equal(f.session.phase, 'source-attached')
  f.session.follow(false, false); assert.equal(f.session.phase, 'detached')
  f.session.follow(false, true); assert.equal(f.session.phase, 'target-attracted')
  assert.deepEqual(f.pending, [])
})

test('only onMove=true enters success; live drag events cannot change settling', () => {
  const f = fixture()
  f.session.settle(true, target)
  assert.equal(f.session.phase, 'settling-success')
  assert.deepEqual(f.pending, [target])
  assert.equal(f.session.dragging, false)
  f.session.follow(true, false)
  f.session.settle(false, source)
  assert.equal(f.session.phase, 'settling-success')
  assert.equal(f.deadline(), SETTLE_LIMIT_MS)
})

for (const scenario of ['same-category', 'invalid drop', 'Escape cancellation', 'onMove=false duplicate']) {
  test(`${scenario} returns without a successful arrival`, () => {
    const f = fixture()
    f.session.settle(false, source)
    assert.equal(f.session.phase, 'settling-return')
    assert.deepEqual(f.session.pending, source)
    f.session.finish('complete')
    assert.equal(f.session.pending, null)
    assert.equal(f.session.phase, 'idle')
  })
}

for (const reason of ['complete', 'timeout', 'interrupted', 'unmount'] as const) {
  test(`${reason} releases the placeholder and deadline exactly once`, () => {
    const f = fixture()
    f.session.settle(true, target)
    if (reason === 'timeout') f.expire(); else f.session.finish(reason)
    f.expire(); f.session.finish('unmount')
    assert.deepEqual(f.pending, [target, null])
    assert.deepEqual(f.released, [reason])
    assert.equal(f.cancellations(), 1)
    assert.equal(f.session.pending, null)
    assert.equal(f.session.phase, 'idle')
  })
}

test('old deadline after a new drag cannot affect the new session', () => {
  const old = fixture(), next = fixture()
  old.session.settle(true, target)
  old.session.finish('interrupted')
  next.session.settle(true, source)
  old.expire()
  assert.equal(next.session.phase, 'settling-success')
  assert.deepEqual(next.pending, [source])
  next.expire()
  assert.equal(next.deadline(), 360)
  assert.deepEqual(next.pending, [source, null])
})

test('keyboard arrows still choose a category and scroll it into view before measuring', () => {
  let scrolled = false, prevented = false
  const node = {
    getBoundingClientRect: () => ({ left: scrolled ? 160 : 400, top: 100, width: 100, height: 100 }),
    scrollIntoView: () => { scrolled = true },
  }
  // These small test doubles only implement the contract used by the coordinate getter.
  const event = { code: 'ArrowRight', preventDefault: () => { prevented = true } } as KeyboardEvent
  const args = { currentCoordinates: { x: 10, y: 20 }, context: {
    collisionRect: { left: 100, top: 100, width: 40, height: 40 },
    over: { id: 'source' }, droppableContainers: { getEnabled: () => [{ id: 'target', node: { current: node } }] },
  } } as unknown as Parameters<typeof categoryKeyboardCoordinates>[1]
  assert.deepEqual(categoryKeyboardCoordinates(event, args), { x: 100, y: 50 })
  assert.equal(scrolled, true)
  assert.equal(prevented, true)
})
