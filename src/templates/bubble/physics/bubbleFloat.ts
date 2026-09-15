export type BubbleFloatBody = {
  id: string
  offsetX: number
  offsetY: number
  velocityX: number
  velocityY: number
  phase: number
}

export type BubbleFloatMeasurement = {
  id: string
  anchorX: number
  anchorY: number
  radius: number
}

export const bubbleFloatConfig = {
  maxOffsetX: 10,
  maxOffsetY: 8,
  maxSpeed: 5.2,
  collisionPadding: 4,
  restitution: 0.3,
  maxDeltaSeconds: 1 / 30,
} as const

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function phaseForId(id: string) {
  let hash = 2166136261
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) / 0xffffffff) * Math.PI * 2
}

export function createBubbleFloatBody(id: string): BubbleFloatBody {
  return { id, offsetX: 0, offsetY: 0, velocityX: 0, velocityY: 0, phase: phaseForId(id) }
}

export function stopBubbleFloatBody(body: BubbleFloatBody) {
  body.velocityX = 0
  body.velocityY = 0
}

export function resetBubbleFloatBody(body: BubbleFloatBody) {
  body.offsetX = 0
  body.offsetY = 0
  stopBubbleFloatBody(body)
}

function capVelocity(body: BubbleFloatBody) {
  const speed = Math.hypot(body.velocityX, body.velocityY)
  if (speed <= bubbleFloatConfig.maxSpeed || speed === 0) return
  const scale = bubbleFloatConfig.maxSpeed / speed
  body.velocityX *= scale
  body.velocityY *= scale
}

function containBody(body: BubbleFloatBody) {
  const { maxOffsetX, maxOffsetY, restitution } = bubbleFloatConfig
  if (body.offsetX < -maxOffsetX || body.offsetX > maxOffsetX) {
    body.offsetX = clamp(body.offsetX, -maxOffsetX, maxOffsetX)
    if (Math.sign(body.velocityX) === Math.sign(body.offsetX)) body.velocityX *= -restitution
  }
  if (body.offsetY < -maxOffsetY || body.offsetY > maxOffsetY) {
    body.offsetY = clamp(body.offsetY, -maxOffsetY, maxOffsetY)
    if (Math.sign(body.velocityY) === Math.sign(body.offsetY)) body.velocityY *= -restitution
  }
}

function resolveCollision(
  first: BubbleFloatBody,
  second: BubbleFloatBody,
  firstMeasurement: BubbleFloatMeasurement,
  secondMeasurement: BubbleFloatMeasurement,
) {
  const firstX = firstMeasurement.anchorX + first.offsetX
  const firstY = firstMeasurement.anchorY + first.offsetY
  const secondX = secondMeasurement.anchorX + second.offsetX
  const secondY = secondMeasurement.anchorY + second.offsetY
  let dx = secondX - firstX
  let dy = secondY - firstY
  let distance = Math.hypot(dx, dy)
  const minimumDistance = firstMeasurement.radius + secondMeasurement.radius
    + bubbleFloatConfig.collisionPadding * 2
  if (distance >= minimumDistance) return

  if (distance < 0.001) {
    dx = Math.cos(first.phase - second.phase || first.phase)
    dy = Math.sin(first.phase - second.phase || first.phase)
    distance = 1
  }
  const normalX = dx / distance
  const normalY = dy / distance
  const overlap = minimumDistance - distance
  const firstInverseMass = 1 / Math.max(1, firstMeasurement.radius ** 2)
  const secondInverseMass = 1 / Math.max(1, secondMeasurement.radius ** 2)
  const inverseMassTotal = firstInverseMass + secondInverseMass

  first.offsetX -= normalX * overlap * (firstInverseMass / inverseMassTotal)
  first.offsetY -= normalY * overlap * (firstInverseMass / inverseMassTotal)
  second.offsetX += normalX * overlap * (secondInverseMass / inverseMassTotal)
  second.offsetY += normalY * overlap * (secondInverseMass / inverseMassTotal)

  const relativeVelocityX = second.velocityX - first.velocityX
  const relativeVelocityY = second.velocityY - first.velocityY
  const speedAlongNormal = relativeVelocityX * normalX + relativeVelocityY * normalY
  if (speedAlongNormal < 0) {
    const impulse = -(1 + bubbleFloatConfig.restitution) * speedAlongNormal / inverseMassTotal
    first.velocityX -= impulse * normalX * firstInverseMass
    first.velocityY -= impulse * normalY * firstInverseMass
    second.velocityX += impulse * normalX * secondInverseMass
    second.velocityY += impulse * normalY * secondInverseMass
  }
}

export function stepBubbleFloatWorld(
  bodies: BubbleFloatBody[],
  measurements: BubbleFloatMeasurement[],
  timeMs: number,
  deltaSeconds: number,
) {
  const dt = clamp(deltaSeconds, 0, bubbleFloatConfig.maxDeltaSeconds)
  const measurementById = new Map(measurements.map((measurement) => [measurement.id, measurement]))
  const time = timeMs / 1000

  for (const body of bodies) {
    if (!measurementById.has(body.id)) continue
    const driftX = Math.sin(time * 0.43 + body.phase) * 1.495
    const driftY = Math.cos(time * 0.37 + body.phase * 1.31) * 1.17
    const anchorX = -body.offsetX * 0.12
    const anchorY = -body.offsetY * 0.15
    body.velocityX += (driftX + anchorX) * dt
    body.velocityY += (driftY + anchorY) * dt
    const damping = Math.exp(-0.34 * dt)
    body.velocityX *= damping
    body.velocityY *= damping
    capVelocity(body)
    body.offsetX += body.velocityX * dt
    body.offsetY += body.velocityY * dt
    containBody(body)
  }

  for (let firstIndex = 0; firstIndex < bodies.length; firstIndex += 1) {
    const first = bodies[firstIndex]
    const firstMeasurement = measurementById.get(first.id)
    if (!firstMeasurement) continue
    for (let secondIndex = firstIndex + 1; secondIndex < bodies.length; secondIndex += 1) {
      const second = bodies[secondIndex]
      const secondMeasurement = measurementById.get(second.id)
      if (!secondMeasurement) continue
      resolveCollision(first, second, firstMeasurement, secondMeasurement)
    }
  }

  for (const body of bodies) {
    containBody(body)
    capVelocity(body)
  }
}
