import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_LIGHT, hoverLight, paintBubbleLight, stepLight } from '../src/effects/bubbleHighlights.ts'

const bounds = { left: 100, top: 200, width: 200, height: 200 }

test('homepage light follows only positions inside the bubble, including its circular edge', () => {
  assert.deepEqual(hoverLight(bounds, { x: 200, y: 300 }), { x: 0, y: 0 })
  assert.deepEqual(hoverLight(bounds, { x: 300, y: 300 }), { x: .625, y: 0 })
  assert.deepEqual(hoverLight(bounds, { x: 100, y: 300 }), { x: -.625, y: 0 })
  assert.deepEqual(hoverLight(bounds, { x: 200, y: 200 }), { x: 0, y: -.625 })
  assert.equal(hoverLight(bounds, { x: 300.1, y: 300 }), null)
  assert.equal(hoverLight(bounds, { x: 200, y: 199.9 }), null)
})

test('transparent corners and captured drag positions outside the bubble never become light targets', () => {
  for (const point of [
    { x: 105, y: 205 }, { x: 295, y: 205 },
    { x: 105, y: 395 }, { x: 295, y: 395 },
    { x: -500, y: 300 }, { x: 900, y: 300 },
  ]) assert.equal(hoverLight(bounds, point), null)
})

test('moving in another bubble cannot steer this bubble and outside motion remains at the default', () => {
  const other = { ...bounds, left: 500 }
  let light = hoverLight(bounds, { x: 260, y: 300 })!
  for (const point of [{ x: 600, y: 300 }, { x: 650, y: 300 }, { x: 600, y: 350 }]) {
    assert.ok(hoverLight(other, point))
    const target = hoverLight(bounds, point) ?? DEFAULT_LIGHT
    assert.deepEqual(target, DEFAULT_LIGHT)
    for (let frame = 0; frame < 120; frame++) light = stepLight(light, target, 1 / 60)
    assert.deepEqual(light, DEFAULT_LIGHT)
  }
})

test('hover bounds track viewport offsets and non-circular layout transitions', () => {
  const ellipse = { left: 20, top: -50, width: 320, height: 160 }
  assert.deepEqual(hoverLight(ellipse, { x: 180, y: 30 }), { x: 0, y: 0 })
  assert.deepEqual(hoverLight(ellipse, { x: 180, y: 110 }), { x: 0, y: .625 })
  assert.equal(hoverLight(ellipse, { x: 320, y: 90 }), null)
  assert.equal(hoverLight({ ...bounds, width: 0 }, { x: 100, y: 300 }), null)
  assert.equal(hoverLight({ ...bounds, height: 0 }, { x: 200, y: 200 }), null)
})

test('painting the reflection preserves the spring transform and affects only the requested skin', () => {
  const values = new Map<string, string>([['transform', 'scale(1.1)']])
  const style = { setProperty: (name: string, value: string) => values.set(name, value) }
  paintBubbleLight({ style } as unknown as HTMLElement, { x: .4, y: -.3 })
  assert.equal(values.get('--bubble-light-x'), '0.4000')
  assert.equal(values.get('--bubble-light-y'), '-0.3000')
  assert.equal(values.get('--bubble-light-distance'), '0.5000')
  assert.equal(values.get('transform'), 'scale(1.1)')
  assert.equal(values.size, 5)
})
