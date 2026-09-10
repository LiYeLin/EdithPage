import { motionValue } from 'motion/react'
import type { Site } from '../types'
import type { Point } from './liquidGeometry'
import type { Arrival, LiquidSession } from './liquidSession'

let nextVisualId = 0

export type LiquidVisual = ReturnType<typeof createLiquidVisual>
export function createLiquidVisual(site: Site, source: Arrival, origin: Point, pointer: Point, iconSize: number, lifetime: LiquidSession) {
  return {
    id: ++nextVisualId, site, source, origin, lifetime, iconSize,
    compact: window.innerWidth <= 1000,
    x: motionValue(origin.x), y: motionValue(origin.y),
    pointerOffset: { x: origin.x - pointer.x, y: origin.y - pointer.y },
    targetModuleId: null as string | null,
  }
}
