import { expect, test } from 'vitest'
import { createIconBody, iconRenderStyle, type BeijingSite } from '../src/templates/beijing/icons'

const entry: BeijingSite = {
  module: { id: 'tools', title: '工具', description: '', accent: '#9ff7cd', sites: [] },
  site: { id: 'alpha', name: 'Alpha', url: 'https://example.com', description: '' },
}

function geometry(icon: ReturnType<typeof createIconBody>) {
  return {
    size: icon.size,
    position: icon.body.position,
    angle: icon.body.angle,
    vertices: icon.body.vertices.map(({ x, y }) => ({ x, y })),
    restitution: icon.body.restitution,
  }
}

test('the same site ID produces identical geometry despite metadata and category changes', () => {
  const first = createIconBody(entry, 0, 390)
  const edited = createIconBody({
    site: { ...entry.site, name: 'Renamed', url: 'https://example.org', description: 'Updated' },
    module: { ...entry.module, id: 'work', title: '工作', accent: '#123456' },
  }, 0, 390)
  expect(geometry(edited)).toEqual(geometry(first))
  expect(edited.body).not.toBe(first.body)
  expect(first.entry).toBe(entry)
  expect(edited.body.render.strokeStyle).toBe('#123456')
})

test('different IDs generate varied rectangular and polygonal bodies within safe spawn ranges', () => {
  const icons = Array.from({ length: 64 }, (_, index) => createIconBody({
    ...entry, site: { ...entry.site, id: `site-${index}` },
  }, 0, 390))
  expect(new Set(icons.map(icon => icon.body.label))).toEqual(new Set(['Rectangle Body', 'Polygon Body']))
  expect(new Set(icons.map(icon => JSON.stringify(geometry(icon)))).size).toBeGreaterThan(1)
  for (const { body, size } of icons) {
    expect(size).toBeGreaterThanOrEqual(60)
    expect(size).toBeLessThanOrEqual(80)
    expect(body.position.x).toBeGreaterThanOrEqual(48)
    expect(body.position.x).toBeLessThanOrEqual(342)
    expect(body.bounds.min.x).toBeGreaterThan(0)
    expect(body.bounds.max.x).toBeLessThan(390)
    expect(body.position.y).toBeGreaterThanOrEqual(-240)
    expect(body.position.y).toBeLessThanOrEqual(-80)
    expect(body.bounds.max.y).toBeLessThan(0)
    expect(Math.abs(body.angle)).toBeLessThanOrEqual(0.35)
    expect(body.restitution).toBeGreaterThanOrEqual(0.48)
    expect(body.restitution).toBeLessThanOrEqual(0.66)
    expect(body.isStatic).toBe(false)
    expect(body.mass).toBeGreaterThan(0)
    expect(body.vertices.every(vertex => Number.isFinite(vertex.x) && Number.isFinite(vertex.y))).toBe(true)
  }
})

test('later entries spawn higher without changing the same ID’s shape or horizontal position', () => {
  const first = createIconBody(entry, 0, 1440)
  const later = createIconBody(entry, 10, 1440)
  expect(later.body.position.x).toBe(first.body.position.x)
  expect(first.body.position.y - later.body.position.y).toBeCloseTo(420)
  expect(later.body.angle).toBe(first.body.angle)
  expect(later.size).toBe(first.size)
  expect(later.body.area).toBeCloseTo(first.body.area)
})

test('a temporarily zero-width stage still produces a finite body above the viewport', () => {
  const { body, size } = createIconBody(entry, 0, 0)
  expect(body.position.x).toBeGreaterThanOrEqual(48)
  expect(body.position.x).toBeLessThanOrEqual(49)
  expect(body.bounds.max.y).toBeLessThan(0)
  expect(Number.isFinite(size)).toBe(true)
})

test.each([
  ['#123456', 'rgba(18, 52, 86, 0.38)'],
  ['A0b1C2', 'rgba(160, 177, 194, 0.38)'],
  ['#fff', 'rgba(159, 247, 205, 0.38)'],
  ['', 'rgba(159, 247, 205, 0.38)'],
])('converts %j to a translucent fill while preserving the accent outline', (accent, fillStyle) => {
  expect(iconRenderStyle(accent)).toEqual({ fillStyle, strokeStyle: accent, lineWidth: 1.5 })
})

test('restoring a position preserves deterministic shape, mass and restitution', () => {
  for (let index = 0; index < 40; index += 1) {
    const site = { ...entry, site: { ...entry.site, id: `site-${index}` } }
    const original = createIconBody(site, index, 1440)
    const restored = createIconBody(site, index, 1440, 1000, { x: 0.25, y: 0.3, angle: 1.2 })
    expect(restored.body.label).toBe(original.body.label)
    expect(restored.body.vertices.length).toBe(original.body.vertices.length)
    expect(restored.body.area).toBeCloseTo(original.body.area)
    expect(restored.body.mass).toBeCloseTo(original.body.mass)
    expect(restored.body.restitution).toBe(original.body.restitution)
    expect(restored.body.position).toEqual({ x: 360, y: 300 })
    expect(restored.body.angle).toBe(1.2)
    expect(restored.body.velocity).toEqual({ x: 0, y: 0 })
    expect(restored.body.angularVelocity).toBe(0)
  }
})
