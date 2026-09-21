import Matter from 'matter-js'
import decomp from 'poly-decomp'

// Non-scaling outline strokes also count toward the visible viewport margins and building gaps.
export const OUTLINE_STROKE = 1.5

export const LANDMARK_IDS = ['temple-of-heaven', 'forbidden-city', 'china-zun'] as const
export type LandmarkId = typeof LANDMARK_IDS[number]
export type Point = { x: number; y: number }
export type Landmark = {
  id: LandmarkId
  vertices: Point[]
  bounds: { min: Point; max: Point }
  paths: { d: string; kind: string }[]
}
export type TerrainAsset = { landmarks: Landmark[] }
export type TerrainLayout = {
  width: number
  height: number
  scale: number
  groundY: number
  buildings: { id: LandmarkId; x: number; y: number }[]
}

/** This is deliberately not a general SVG parser: only our closed absolute polygons are accepted. */
export function parsePolygon(path: string): Point[] {
  const number = '(-?\\d+(?:\\.\\d+)?)'
  const pair = `${number}\\s+${number}`
  if (!new RegExp(`^\\s*M\\s+${pair}(?:\\s+L\\s+${pair}){2,}\\s+Z\\s*$`).test(path)) {
    throw new Error('地形必须使用闭合的 M/L/Z 多边形')
  }
  const values = path.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
  const points = Array.from({ length: values.length / 2 }, (_, i) => ({ x: values[i * 2], y: values[i * 2 + 1] }))
  if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)) || Matter.Vertices.area(points, false) <= 0) {
    throw new Error('地形坐标无效')
  }
  return points
}

export function polygonBounds(vertices: Point[]) {
  return {
    min: { x: Math.min(...vertices.map(v => v.x)), y: Math.min(...vertices.map(v => v.y)) },
    max: { x: Math.max(...vertices.map(v => v.x)), y: Math.max(...vertices.map(v => v.y)) },
  }
}

export function layoutTerrain(asset: TerrainAsset, width: number, height: number, safeBottom = 0): TerrainLayout {
  const groundY = height - 16 - safeBottom - OUTLINE_STROKE / 2
  // The curved visual crown reaches 18.8, slightly above the sampled collision polygon.
  const maxHeight = 560 - Math.min(18.8, ...asset.landmarks.map(b => b.bounds.min.y))
  const compact = width < 768
  const totalWidth = asset.landmarks.reduce((sum, b) => sum + b.bounds.max.x - b.bounds.min.x, 0)
  const gap = 16 + OUTLINE_STROKE
  const margin = 16 + OUTLINE_STROKE / 2
  const scale = Math.max(0.01, Math.min((height / 3 - OUTLINE_STROKE) / maxHeight, compact ? (width - margin * 2 - gap * 2) / totalWidth : (width - 48) / 1800))
  let left = (width - totalWidth * scale - gap * 2) / 2
  const buildings = asset.landmarks.map(b => {
    const x = compact ? left - b.bounds.min.x * scale : (width - 1800 * scale) / 2
    left += (b.bounds.max.x - b.bounds.min.x) * scale + gap
    return { id: b.id, x, y: groundY - 560 * scale }
  })
  return { width, height, groundY, scale, buildings }
}

export function createTerrainBodies(asset: TerrainAsset, layout: TerrainLayout): Matter.Body[] {
  Matter.Common.setDecomp(decomp)
  return asset.landmarks.map(landmark => {
    // Decompose before screen scaling; do not discard the small eaves/crown fragments.
    const vertices = landmark.vertices.map(v => ({ ...v }))
    const centre = Matter.Vertices.centre(vertices)
    const body = Matter.Bodies.fromVertices(centre.x, centre.y, [vertices], {
      isStatic: true, label: landmark.id, friction: 0.6, render: { visible: false },
    }, true, 0, 0, 0.01)
    if (!body) throw new Error('建筑轮廓分解失败')
    // Compound/static centres need not equal the polygon centroid. Restore source-space bounds.
    const dx = landmark.bounds.min.x - body.bounds.min.x
    const dy = landmark.bounds.min.y - body.bounds.min.y
    Matter.Body.translate(body, { x: dx, y: dy })
    Matter.Body.scale(body, layout.scale, layout.scale, { x: 0, y: 0 })
    const offset = layout.buildings.find(b => b.id === landmark.id)!
    Matter.Body.translate(body, { x: offset.x, y: offset.y })
    // Body.scale moves position but not positionPrev. Reset every static part's history so the
    // contact solver cannot mistake layout scaling for a moving roof and launch resting icons.
    Matter.Body.setStatic(body, true)
    return body
  })
}

export function createBoundaries(layout: TerrainLayout, ceiling = -2000): Matter.Body[] {
  const { width, height, groundY } = layout
  const thickness = 80
  const options = { isStatic: true, friction: 0.6, render: { visible: false } }
  const wallHeight = height - ceiling + thickness
  return [
    Matter.Bodies.rectangle(width / 2, groundY + thickness / 2, width + thickness * 2, thickness, { ...options, label: 'ground' }),
    Matter.Bodies.rectangle(-thickness / 2, (height + ceiling) / 2, thickness, wallHeight, options),
    Matter.Bodies.rectangle(width + thickness / 2, (height + ceiling) / 2, thickness, wallHeight, options),
    Matter.Bodies.rectangle(width / 2, ceiling - thickness / 2, width + thickness * 2, thickness, options),
  ]
}

/** Used after direct manipulation, not each frame: never release a body inside a solid landmark. */
export function releaseAboveTerrain(body: Matter.Body, solids: Matter.Body[], layout: TerrainLayout) {
  const left = body.position.x - body.bounds.min.x
  const right = body.bounds.max.x - body.position.x
  const x = Math.max(left + 1, Math.min(layout.width - right - 1, body.position.x))
  const top = body.bounds.max.y - body.position.y
  Matter.Body.setPosition(body, { x, y: Math.min(body.position.y, layout.groundY - top - 1) })
  // Bounded upward search at fixed x keeps corrections predictable even under several overlapping eaves.
  for (let step = 0; step < Math.ceil(layout.height / 2) + 100 && Matter.Query.collides(body, solids).length; step++) {
    Matter.Body.translate(body, { x: 0, y: -2 })
  }
  Matter.Body.setVelocity(body, { x: 0, y: 0 })
  Matter.Body.setAngularVelocity(body, 0)
  Matter.Sleeping.set(body, false)
}
