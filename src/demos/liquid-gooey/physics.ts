import { clamp, contact, distance, dockPoint, mix, smoothstep, springStep, unit, type Body, type Point, type Spring } from '../../templates/bubble/physics/liquid.ts'

export { clamp, contact, distance, dockPoint, mix, smoothstep, springStep, unit }
export type { Body, Point, Spring }
export type Scene = { a: Body; b: Body; dropRadius: number; width: number; height: number }

export function makeScene(width: number, height: number): Scene {
  const mobile = width < 640
  const scale = Math.min(1, width / 1000)
  return {
    width, height,
    a: mobile ? { x: width / 2, y: 134, radius: 72 } : { x: width * 0.235, y: height * 0.48, radius: 100 * scale },
    b: mobile ? { x: width / 2, y: 425, radius: 97 } : { x: width * 0.76, y: height * 0.48, radius: 132 * scale },
    dropRadius: mobile ? 29 : Math.max(29, 37 * scale),
  }
}

export function demoPoint(scene: Scene, progress: number, from: 'a' | 'b'): Point {
  const origin = scene[from]
  const destination = scene[from === 'a' ? 'b' : 'a']
  const direction = unit(origin, destination)
  const start = dockPoint(origin, destination)
  const finish = dockPoint(destination, origin)
  const points = [
    { t: 0, point: start },
    { t: 0.12, point: { x: origin.x + direction.x * (origin.radius + 8), y: origin.y + direction.y * (origin.radius + 8) } },
    { t: 0.34, point: { x: origin.x + direction.x * (origin.radius + scene.dropRadius + 58), y: origin.y + direction.y * (origin.radius + scene.dropRadius + 58) } },
    { t: 0.52, point: { x: destination.x - direction.x * (destination.radius + scene.dropRadius + 55), y: destination.y - direction.y * (destination.radius + scene.dropRadius + 55) } },
    { t: 0.8, point: { x: destination.x - direction.x * (destination.radius - 4), y: destination.y - direction.y * (destination.radius - 4) } },
    { t: 1, point: finish },
  ]
  const index = Math.max(1, points.findIndex((keyframe) => clamp(progress) <= keyframe.t))
  const first = points[index - 1]
  const second = points[index]
  const t = smoothstep((clamp(progress) - first.t) / (second.t - first.t))
  return { x: mix(first.point.x, second.point.x, t), y: mix(first.point.y, second.point.y, t) }
}
