import { packEnclose, packSiblings } from 'd3-hierarchy'

export type BubbleTileMetrics = {
  width: number
  height: number
  icon: number
  radius: number
}

export const desktopBubbleTile: BubbleTileMetrics = { width: 64, height: 70, icon: 46, radius: 41 }
export const compactBubbleTile: BubbleTileMetrics = { width: 58, height: 62, icon: 40, radius: 36 }

function buildLayouts(tile: BubbleTileMetrics) {
  let previousDiameter = 144

  return Array.from({ length: 13 }, (_, siteCount) => {
    // The add shortcut always occupies a slot, so entering edit mode does not inflate the bubble.
    const circles = packSiblings(Array.from({ length: siteCount + 1 }, () => ({ r: tile.radius })))
    const enclosure = packEnclose(circles)
    // Reserve space for rectangular names, focus rings and the delete badge, not just favicon centers.
    const cornerRadius = Math.hypot(tile.width / 2, tile.height / 2)
    const requiredDiameter = Math.ceil(2 * (enclosure.r - tile.radius + cornerRadius + 16))
    // Packing can give two successive counts the same radius; retain a visible growth step.
    const diameter = Math.max(previousDiameter + 6, requiredDiameter)
    previousDiameter = diameter

    return {
      diameter,
      // Keep reading/tab order top-to-bottom, then left-to-right (the final slot is Add).
      positions: circles
        .map((circle) => ({ x: circle.x - enclosure.x, y: circle.y - enclosure.y }))
        .sort((a, b) => Math.abs(a.y - b.y) > 0.01 ? a.y - b.y : a.x - b.x),
    }
  })
}

const desktopLayouts = buildLayouts(desktopBubbleTile)
const compactLayouts = buildLayouts(compactBubbleTile)

export function getBubbleLayout(siteCount: number, viewportWidth: number) {
  const compact = viewportWidth <= 620
  const tile = compact ? compactBubbleTile : desktopBubbleTile
  const layouts = compact ? compactLayouts : desktopLayouts
  const maxDiameter = Math.min(compact ? 336 : 400, viewportWidth - 44)
  let pageSize = 1

  for (let count = 1; count < layouts.length; count += 1) {
    if (layouts[count].diameter <= maxDiameter) pageSize = count
  }

  return {
    tile,
    pageSize,
    diameter: layouts[Math.min(Math.max(0, siteCount), pageSize)].diameter,
    // Last-page icons remain full size and centered, rather than stretching to fill the bubble.
    positionsForPage: (count: number) => layouts[Math.min(Math.max(0, count), pageSize)].positions,
  }
}
