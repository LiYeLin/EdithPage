import assert from 'node:assert/strict'
import test from 'node:test'
import { bubbleLight, DEFAULT_LIGHT, stepLight } from '../src/effects/bubbleHighlights.ts'
import { contact, demoPoint, distance, dockPoint, makeScene, springStep } from '../src/demos/liquid-gooey/physics.ts'

test('contact is strongest at a seam and vanishes inside or far away', () => {
  const body = { x: 200, y: 200, radius: 100 }
  assert.equal(contact(body, body, 37).amount, 0)
  assert.ok(contact(body, { x: 345, y: 200 }, 37).amount > 0.9)
  assert.equal(contact(body, { x: 500, y: 200 }, 37).amount, 0)
})

test('contact is symmetric in all drag directions', () => {
  const body = { x: 200, y: 200, radius: 100 }
  const samples = [{ x: 350, y: 200 }, { x: 50, y: 200 }, { x: 200, y: 350 }, { x: 200, y: 50 }]
  const values = samples.map((point) => contact(body, point, 37).amount)
  assert.ok(values.every((amount) => Math.abs(amount - values[0]) < 1e-10))
})

test('desktop and mobile previews connect both docks in either direction', () => {
  for (const [width, height] of [[1120, 440], [640, 440], [750, 440], [350, 595], [280, 595]]) {
    const scene = makeScene(width, height)
    for (const from of ['a', 'b'] as const) {
      const to = from === 'a' ? 'b' : 'a'
      assert.deepEqual(demoPoint(scene, 0, from), dockPoint(scene[from], scene[to]))
      assert.deepEqual(demoPoint(scene, 1, from), dockPoint(scene[to], scene[from]))
      for (let i = 1; i <= 100; i++) {
        const point = demoPoint(scene, i / 100, from)
        assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y))
        assert.ok(distance(point, demoPoint(scene, (i - 1) / 100, from)) < 28)
        assert.ok(point.x > scene.dropRadius && point.x < width - scene.dropRadius)
        assert.ok(point.y > scene.dropRadius && point.y < height - scene.dropRadius)
      }
    }
  }
})

test('spring recoil settles and survives a background-tab time jump', () => {
  const spring = { value: 1, velocity: 3 }
  springStep(spring, 0, 60)
  assert.ok(Number.isFinite(spring.value) && Math.abs(spring.value) < 2)
  for (let i = 0; i < 240; i++) springStep(spring, 0, 1 / 60)
  assert.ok(Math.abs(spring.value) < 0.001)
})

test('preview clamps overshooting progress to the final dock', () => {
  const scene = makeScene(1120, 440)
  assert.deepEqual(demoPoint(scene, 1.2, 'a'), dockPoint(scene.b, scene.a))
  assert.deepEqual(demoPoint(scene, -1, 'a'), dockPoint(scene.a, scene.b))
})


test('demo click impulse visibly expands the skin then settles without moving its center', () => {
  const pulse = { value: 0, velocity: 12 }
  let maximum = 1
  for (let frame = 0; frame < 240; frame++) {
    const scale = 1 + springStep(pulse, 0, 1 / 60, 190, 13) * .12
    maximum = Math.max(maximum, scale)
    assert.ok(scale > .9 && scale < 1.15)
  }
  assert.ok(maximum > 1.04)
  assert.equal(pulse.value, 0)
  assert.equal(pulse.velocity, 0)
})

test('bubble lighting follows the cursor in local space and clamps diagonals inside the sphere', () => {
  const body = { x: 200, y: 200, radius: 100 }
  assert.deepEqual(bubbleLight(body, body), { x: 0, y: 0 })
  assert.deepEqual(bubbleLight(body, { x: 280, y: 200 }), { x: .5, y: 0 })
  assert.deepEqual(bubbleLight(body, { x: 120, y: 200 }), { x: -.5, y: 0 })
  for (const pointer of [{ x: 10000, y: 10000 }, { x: -10000, y: -10000 }]) {
    const light = bubbleLight(body, pointer)
    assert.ok(Math.abs(Math.hypot(light.x, light.y) - 1) < 1e-10)
    assert.ok(light.x * (pointer.x - body.x) > 0)
    assert.ok(light.y * (pointer.y - body.y) > 0)
  }
  assert.deepEqual(bubbleLight({ x: 20, y: 20, radius: 10 }, { x: 28, y: 20 }), { x: .5, y: 0 })
  assert.deepEqual(bubbleLight({ x: 0, y: 0, radius: 0 }, { x: 5, y: 0 }), { x: 1, y: 0 })
})

test('lighting eases to the cursor without overshoot, then returns exactly to its resting light', () => {
  const body = { x: 200, y: 200, radius: 100 }
  const target = bubbleLight(body, { x: 500, y: 500 })
  let light = { ...DEFAULT_LIGHT }
  const first = stepLight(light, target, 1 / 60)
  assert.ok(first.x > light.x && first.x < target.x)
  assert.ok(first.y > light.y && first.y < target.y)
  for (let frame = 0; frame < 120; frame++) {
    light = stepLight(light, target, 1 / 60)
    assert.ok(Math.hypot(light.x, light.y) <= 1 + 1e-10)
  }
  assert.deepEqual(light, target)
  const resting = bubbleLight(body, null)
  for (let frame = 0; frame < 120; frame++) light = stepLight(light, resting, 1 / 60)
  assert.deepEqual(light, DEFAULT_LIGHT)
})

test('lighting smoothing is frame-rate independent and reduced motion has no trailing animation', () => {
  const target = { x: .8, y: .5 }
  let at60 = { ...DEFAULT_LIGHT }
  let at120 = { ...DEFAULT_LIGHT }
  for (let frame = 0; frame < 12; frame++) at60 = stepLight(at60, target, 1 / 60)
  for (let frame = 0; frame < 24; frame++) at120 = stepLight(at120, target, 1 / 120)
  assert.ok(distance(at60, at120) < 1e-10)
  assert.deepEqual(stepLight(DEFAULT_LIGHT, target, 0), DEFAULT_LIGHT)
  assert.deepEqual(stepLight(DEFAULT_LIGHT, target, 60), target)
  assert.deepEqual(stepLight(DEFAULT_LIGHT, target, 0, true), target)
})
