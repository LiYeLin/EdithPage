import Matter from 'matter-js'
import { isValidIconPosition } from '../config'
import type { IconPosition, Module, Site } from '../../types'

export type BeijingSite = { site: Site; module: Module }

function hashSeed(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seeded(value: string) {
  let state = hashSeed(value) || 1
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state)
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state)
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296
  }
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return `rgba(159, 247, 205, ${alpha})`
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function iconRenderStyle(accent: string) {
  return { fillStyle: hexToRgba(accent, 0.38), strokeStyle: accent, lineWidth: 1.5 }
}

export function createIconBody(entry: BeijingSite, index: number, width: number, height = 600, saved?: IconPosition) {
  const random = seeded(entry.site.id)
  const size = 30 + Math.round(random() * 10)
  // Always consume the spawn RNG values: restoration must not change the site's shape.
  const spawnX = 48 + random() * Math.max(1, width - 96)
  const spawnY = -80 - index * 42 - random() * 160
  const spawnAngle = (random() - 0.5) * 0.7
  const restored = isValidIconPosition(saved)
  const x = restored ? saved.x * Math.max(1, width) : spawnX
  const y = restored ? saved.y * Math.max(1, height) : spawnY
  const angle = restored ? saved.angle : spawnAngle
  const common = {
    angle,
    restitution: 0.48 + random() * 0.18,
    friction: 0.18,
    frictionAir: 0.012,
    density: 0.002,
    chamfer: { radius: 5 },
    render: iconRenderStyle(entry.module.accent),
  }

  const body = random() < 0.38
    ? Matter.Bodies.rectangle(x, y, size * 1.65, size * 1.2, common)
    : Matter.Bodies.polygon(x, y, 4 + Math.floor(random() * 5), size, common)

  if (restored) {
    Matter.Body.setAngle(body, angle)
    Matter.Body.setVelocity(body, { x: 0, y: 0 })
    Matter.Body.setAngularVelocity(body, 0)
    Matter.Sleeping.set(body, false)
  }

  return { body, entry, size: size * 2, restored }
}

