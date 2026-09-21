// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { describe, expect, test, vi } from 'vitest'
import Matter from 'matter-js'
import { parseTerrainAssets, loadTerrainAssets } from '../src/templates/beijing/assets'
import { createBoundaries, createTerrainBodies, layoutTerrain, parsePolygon, releaseAboveTerrain, OUTLINE_STROKE } from '../src/templates/beijing/terrain'

const visual = readFileSync('public/terrain/beijing-landmarks.svg', 'utf8')
const collision = readFileSync('public/terrain/beijing-terrain.svg', 'utf8')
const asset = parseTerrainAssets(visual, collision)

test('only the three paired landmarks are accepted, with no decorative collision paths', () => {
  expect(asset.landmarks.map(b => b.id)).toEqual(['temple-of-heaven', 'forbidden-city', 'china-zun'])
  expect(asset.landmarks.map(b => b.bounds.max.y)).toEqual([560, 560, 560])
  expect(() => parsePolygon('M0 0 Q2 3 4 5 Z')).toThrow()
  expect(() => parsePolygon('M 0 0 L 1 1 L 2 2 Z')).toThrow()
  expect(() => parseTerrainAssets(visual, collision.replace('id="china-zun"', 'id="missing"'))).toThrow()
  expect(() => parseTerrainAssets('<html/>', collision)).toThrow()
})

for (const [width, height] of [[1440, 1000], [390, 844], [320, 640], [844, 390]]) {
  test(`visual/collision transforms agree and fit ${width}x${height}`, () => {
    const layout = layoutTerrain(asset, width, height, 24)
    const bodies = createTerrainBodies(asset, layout)
    expect(layout.groundY).toBe(height - 24 - 16 - OUTLINE_STROKE / 2)
    expect(541.2 * layout.scale + OUTLINE_STROKE).toBeLessThanOrEqual(height / 3 + 0.01)
    let lastRight = 0
    bodies.forEach((body, i) => {
      const bounds = asset.landmarks[i].bounds
      const transform = layout.buildings[i]
      expect(body.isStatic).toBe(true)
      expect(body.render.visible).toBe(false)
      expect(body.parts.length).toBeGreaterThan(1)
      for (const part of body.parts) {
        expect((part as Matter.Body & { positionPrev: { x: number; y: number } }).positionPrev).toEqual(part.position)
      }
      expect(body.bounds.min.x).toBeCloseTo(bounds.min.x * layout.scale + transform.x, 5)
      expect(body.bounds.min.y).toBeCloseTo(bounds.min.y * layout.scale + transform.y, 5)
      expect(body.bounds.max.y).toBeCloseTo(layout.groundY, 5)
      expect(body.bounds.min.x - OUTLINE_STROKE / 2).toBeGreaterThanOrEqual(lastRight + 15.99)
      expect(body.bounds.max.x + OUTLINE_STROKE / 2).toBeLessThanOrEqual(width - 16 + 0.01)
      lastRight = body.bounds.max.x + OUTLINE_STROKE / 2
      // Concavity survived; it was not silently replaced with the enclosing hull.
      const hullArea = Matter.Vertices.area(Matter.Vertices.hull(asset.landmarks[i].vertices), false)
      const partsArea = body.parts.slice(1).reduce((sum, part) => sum + part.area, 0) / layout.scale ** 2
      expect(partsArea).toBeLessThan(hullArea - 1)
    })
    const ground = createBoundaries(layout)[0]
    expect(ground.bounds.min.y).toBeCloseTo(layout.groundY)
    expect(ground.bounds.max.x).toBeGreaterThan(width)
  })
}

function world() {
  const layout = layoutTerrain(asset, 1440, 1000)
  const solids = createTerrainBodies(asset, layout)
  const walls = createBoundaries(layout)
  const engine = Matter.Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 })
  engine.gravity.y = 1.05
  Matter.Composite.add(engine.world, [...solids, ...walls])
  return { engine, layout, solids, walls }
}
function simulate(engine: Matter.Engine, frames = 1200) {
  for (let i = 0; i < frames; i++) {
    for (const body of engine.world.bodies) if (!body.isStatic && body.speed > 12) Matter.Body.setSpeed(body, 12)
    Matter.Engine.update(engine, 1000 / 120)
  }
}

describe('real Matter engine against the shipped polygons', () => {
  for (let index = 0; index < 3; index++) test(`falling body contacts ${asset.landmarks[index].id} without passing through`, () => {
    const { engine, solids, layout } = world()
    const roof = solids[index]
    const x = (roof.bounds.min.x + roof.bounds.max.x) / 2
    const body = Matter.Bodies.rectangle(x, roof.bounds.min.y - 180, 42, 42, { restitution: 0.25 })
    Matter.Composite.add(engine.world, body)
    const contacts = new Set<string>()
    Matter.Events.on(engine, 'collisionStart', event => {
      for (const pair of event.pairs) {
        contacts.add(pair.bodyA.parent.label)
        contacts.add(pair.bodyB.parent.label)
      }
    })
    simulate(engine)
    expect(contacts.has(asset.landmarks[index].id)).toBe(true)
    expect(body.bounds.max.y).toBeLessThanOrEqual(layout.groundY + 1)
    expect(Matter.Query.collides(body, solids).every(c => c.depth < 1)).toBe(true)
    Matter.Engine.clear(engine)
  })

  test('a body in the gap reaches the ground; stacked bodies rest above it', () => {
    const { engine, solids, layout } = world()
    const x = (solids[0].bounds.max.x + solids[1].bounds.min.x) / 2
    const lower = Matter.Bodies.rectangle(x, 500, 42, 42, { restitution: 0 })
    const upper = Matter.Bodies.rectangle(x, 300, 42, 42, { restitution: 0 })
    Matter.Composite.add(engine.world, [lower, upper])
    simulate(engine)
    expect(lower.bounds.max.y).toBeCloseTo(layout.groundY, 0)
    expect(upper.bounds.max.y).toBeLessThan(lower.position.y)
    expect(Matter.Query.collides(lower, solids)).toHaveLength(0)
  })

  test('an off-centre roof landing slides down the temple eaves', () => {
    const { engine, solids } = world()
    const roof = solids[0]
    const x = (roof.bounds.min.x + roof.bounds.max.x) / 2 + 35
    const body = Matter.Bodies.circle(x, roof.bounds.min.y - 100, 14, { friction: 0, restitution: 0.1 })
    Matter.Composite.add(engine.world, body)
    let contactedRoof = false
    Matter.Events.on(engine, 'collisionStart', event => {
      contactedRoof ||= event.pairs.some(pair => pair.bodyA.parent === roof || pair.bodyB.parent === roof)
    })
    let maxX = x
    // Follow the first slide rather than its eventual x after bouncing off other buildings/walls.
    for (let frame = 0; frame < 360; frame++) {
      simulate(engine, 1)
      maxX = Math.max(maxX, body.position.x)
    }
    expect(contactedRoof).toBe(true)
    expect(maxX).toBeGreaterThan(x + 30)
    expect(body.position.y).toBeGreaterThan(roof.bounds.min.y + 80)
    expect(Matter.Query.collides(body, solids).every(c => c.depth < 1)).toBe(true)
  })

  test('two falling icons stack on the palace roof, not inside its silhouette', () => {
    const { engine, solids } = world()
    const roof = solids[1]
    const x = (roof.bounds.min.x + roof.bounds.max.x) / 2
    const lower = Matter.Bodies.rectangle(x, roof.bounds.min.y - 70, 42, 42, { restitution: 0, friction: 0.18 })
    const upper = Matter.Bodies.rectangle(x, roof.bounds.min.y - 160, 42, 42, { restitution: 0, friction: 0.18 })
    Matter.Composite.add(engine.world, [lower, upper])
    simulate(engine)
    // Contact depth, rather than the enclosing AABB, measures overlap with the detailed roof.
    expect(lower.position.y).toBeLessThan(roof.bounds.min.y)
    expect(Math.abs(lower.position.x - x)).toBeLessThan(30)
    const roofContact = Matter.Query.collides(lower, [roof])
    const stackContact = Matter.Query.collides(upper, [lower])
    expect(roofContact.length).toBeGreaterThan(0)
    expect(stackContact.length).toBeGreaterThan(0)
    expect([...roofContact, ...stackContact].every(c => c.depth < 1)).toBe(true)
    expect(upper.position.y).toBeLessThan(lower.position.y - 30)
  })

  test('drag release and a smaller replacement terrain relocate embedded bodies upward', () => {
    const { solids, layout } = world()
    const target = solids[2]
    const body = Matter.Bodies.polygon((target.bounds.min.x + target.bounds.max.x) / 2, 900, 5, 30)
    expect(Matter.Query.collides(body, solids).length).toBeGreaterThan(0)
    const originalX = body.position.x
    releaseAboveTerrain(body, solids, layout)
    expect(body.position.x).toBeCloseTo(originalX)
    expect(Matter.Query.collides(body, solids)).toHaveLength(0)
    const narrow = layoutTerrain(asset, 320, 640)
    const replacement = createTerrainBodies(asset, narrow)
    Matter.Body.setPosition(body, { x: 500, y: 700 })
    releaseAboveTerrain(body, replacement, narrow)
    expect(body.bounds.max.x).toBeLessThanOrEqual(320)
    expect(body.bounds.max.y).toBeLessThan(narrow.groundY)
    expect(Matter.Query.collides(body, replacement)).toHaveLength(0)
  })
})

test('asset fetch forwards cancellation and rejects HTTP errors', async () => {
  const controller = new AbortController()
  const fetchMock = vi.fn().mockResolvedValue({ ok: false })
  vi.stubGlobal('fetch', fetchMock)
  await expect(loadTerrainAssets(controller.signal)).rejects.toThrow()
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal)
  vi.unstubAllGlobals()
})
