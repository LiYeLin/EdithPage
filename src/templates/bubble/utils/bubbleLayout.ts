export type BubbleTileMetrics = { width: number; height: number; icon: number; radius: number }
export const desktopBubbleTile: BubbleTileMetrics = { width: 64, height: 70, icon: 46, radius: 41 }
export const compactBubbleTile: BubbleTileMetrics = { width: 58, height: 62, icon: 40, radius: 36 }
export type BubbleContents = {
  tile: BubbleTileMetrics
  diameter: number
  positions: { x: number; y: number }[]
}

const cache = new Map<string, BubbleContents>()

// Every site and the Add shortcut have a real slot, including outside edit mode.
export function getBubbleContents(siteCount: number, tile = desktopBubbleTile): BubbleContents {
  const count = Math.max(0, Math.floor(siteCount))
  const key = `${tile.width}:${tile.height}:${tile.radius}:${count}`
  const cached = cache.get(key)
  if (cached) return cached
  const total = count + 1
  const columns = Math.ceil(Math.sqrt(total))
  const rows = Math.ceil(total / columns)
  const rowCounts = Array.from({ length: rows }, () => Math.floor(total / rows))
  // Fill middle rows first, preferring the lower row when two are equally central.
  const order = Array.from({ length: rows }, (_, index) => index)
    .sort((a, b) => Math.abs(a - (rows - 1) / 2) - Math.abs(b - (rows - 1) / 2) || b - a)
  for (let i = 0; i < total % rows; i++) rowCounts[order[i]]++
  const positions = rowCounts.flatMap((rowCount, row) => Array.from({ length: rowCount }, (_, column) => ({
    x: (column - (rowCount - 1) / 2) * (tile.width + 8),
    y: (row - (rows - 1) / 2) * (tile.height + 4),
  })))
  const radius = Math.max(...positions.map(point => Math.hypot(Math.abs(point.x) + tile.width / 2, Math.abs(point.y) + tile.height / 2)))
  const result = {
    tile,
    diameter: Math.max(150, Math.ceil(2 * (radius + 16))),
    positions,
  }
  if (cache.size >= 128) cache.delete(cache.keys().next().value!)
  cache.set(key, result)
  return result
}
