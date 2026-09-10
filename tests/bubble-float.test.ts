import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  bubbleFloatConfig,
  createBubbleFloatBody,
  resetBubbleFloatBody,
  stepBubbleFloatWorld,
  stopBubbleFloatBody,
  type BubbleFloatMeasurement,
} from '../src/physics/bubbleFloat.ts'

const measurement = (id: string, anchorX = 0, anchorY = 0, radius = 20): BubbleFloatMeasurement => ({
  id,
  anchorX,
  anchorY,
  radius,
})

test('stable ids receive deterministic but distinct drift phases', () => {
  assert.equal(createBubbleFloatBody('ai-tools').phase, createBubbleFloatBody('ai-tools').phase)
  assert.notEqual(createBubbleFloatBody('ai-tools').phase, createBubbleFloatBody('dev-tools').phase)
})

test('offsets and velocity stay finite and bounded after long or delayed frames', () => {
  const body = createBubbleFloatBody('one')
  body.velocityX = 100
  body.velocityY = -100
  for (let index = 0; index < 1200; index += 1) {
    stepBubbleFloatWorld([body], [measurement(body.id)], index * 1000, index === 0 ? 60 : 1 / 60)
    assert.equal(Number.isFinite(body.offsetX), true)
    assert.equal(Number.isFinite(body.offsetY), true)
    assert.ok(Math.abs(body.offsetX) <= bubbleFloatConfig.maxOffsetX)
    assert.ok(Math.abs(body.offsetY) <= bubbleFloatConfig.maxOffsetY)
    assert.ok(Math.hypot(body.velocityX, body.velocityY) <= bubbleFloatConfig.maxSpeed + 1e-9)
  }
})

test('overlapping bubbles separate to their padded circular boundary', () => {
  const first = createBubbleFloatBody('first')
  const second = createBubbleFloatBody('second')
  const measurements = [measurement(first.id, 0), measurement(second.id, 44)]
  stepBubbleFloatWorld([first, second], measurements, 0, 0)
  const firstCenter = measurements[0].anchorX + first.offsetX
  const secondCenter = measurements[1].anchorX + second.offsetX
  assert.ok(secondCenter - firstCenter >= 48 - 1e-9)
})

test('approaching bubbles rebound away from each other', () => {
  const first = createBubbleFloatBody('first')
  const second = createBubbleFloatBody('second')
  first.velocityX = 2
  second.velocityX = -2
  stepBubbleFloatWorld(
    [first, second],
    [measurement(first.id, 0), measurement(second.id, 47)],
    0,
    1 / 60,
  )
  assert.ok(first.velocityX < 0)
  assert.ok(second.velocityX > 0)
})

test('coincident centers resolve without invalid numbers', () => {
  const first = createBubbleFloatBody('first')
  const second = createBubbleFloatBody('second')
  stepBubbleFloatWorld(
    [first, second],
    [measurement(first.id), measurement(second.id)],
    0,
    0,
  )
  for (const value of [first.offsetX, first.offsetY, second.offsetX, second.offsetY]) {
    assert.equal(Number.isFinite(value), true)
  }
})

test('stopping preserves offsets while resetting clears them', () => {
  const body = createBubbleFloatBody('one')
  Object.assign(body, { offsetX: 4, offsetY: -3, velocityX: 2, velocityY: -1 })
  stopBubbleFloatBody(body)
  assert.deepEqual(
    { offsetX: body.offsetX, offsetY: body.offsetY, velocityX: body.velocityX, velocityY: body.velocityY },
    { offsetX: 4, offsetY: -3, velocityX: 0, velocityY: 0 },
  )
  resetBubbleFloatBody(body)
  assert.deepEqual(
    { offsetX: body.offsetX, offsetY: body.offsetY, velocityX: body.velocityX, velocityY: body.velocityY },
    { offsetX: 0, offsetY: 0, velocityX: 0, velocityY: 0 },
  )
})
