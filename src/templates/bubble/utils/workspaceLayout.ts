import { packSiblings } from 'd3-hierarchy'
import { compactBubbleTile, desktopBubbleTile, getBubbleContents, type BubbleContents } from './bubbleLayout.ts'

export type WorkspaceSize = { width: number; height: number }
type Group = { id: string; sites: readonly unknown[] }
export type BubblePlacement = BubbleContents & {
  id: string; x: number; y: number; shellHeight: number; rectangular: boolean
}
export type WorkspaceLayout = { fits: boolean; height: number; items: BubblePlacement[] }
export const bubbleHeaderHeight = 32
// Includes the existing float's 10px/8px travel, focus rings and edit controls.
const edge = 12

function rowLayout(items: BubblePlacement[], size: WorkspaceSize, gap: number): WorkspaceLayout {
  const rows: BubblePlacement[][] = []
  let row: BubblePlacement[] = []
  let rowWidth = 0
  for (const item of items) {
    const width = item.diameter + edge * 2
    if (row.length && rowWidth + gap + width > size.width) {
      rows.push(row); row = []; rowWidth = 0
    }
    row.push(item)
    rowWidth += (row.length > 1 ? gap : 0) + width
  }
  if (row.length) rows.push(row)
  let y = edge
  const placed: BubblePlacement[] = []
  for (const entries of rows) {
    const width = entries.reduce((sum, item) => sum + item.diameter + edge * 2, 0) + gap * (entries.length - 1)
    let x = (size.width - width) / 2 + edge
    for (const item of entries) {
      placed.push({ ...item, x, y })
      x += item.diameter + edge * 2 + gap
    }
    y += Math.max(...entries.map(item => item.shellHeight)) + bubbleHeaderHeight + edge * 2 + gap
  }
  const height = rows.length ? y - gap - edge : 0
  const offset = Math.max(0, (size.height - height) / 2)
  return { fits: height <= size.height, height: Math.max(height, size.height), items: placed.map(item => ({ ...item, y: item.y + offset })) }
}

function overlapsRect(a: BubblePlacement, b: BubblePlacement, padding: number) {
  return a.x - padding < b.x + b.diameter + padding && b.x - padding < a.x + a.diameter + padding
    && a.y - padding < b.y + bubbleHeaderHeight + padding && b.y - padding < a.y + bubbleHeaderHeight + padding
}

function headerHitsCircle(header: BubblePlacement, circle: BubblePlacement, padding: number) {
  const cx = circle.x + circle.diameter / 2
  const cy = circle.y + bubbleHeaderHeight + circle.diameter / 2
  const nearestX = Math.max(header.x - padding, Math.min(cx, header.x + header.diameter + padding))
  const nearestY = Math.max(header.y - padding, Math.min(cy, header.y + bubbleHeaderHeight + padding))
  return Math.hypot(cx - nearestX, cy - nearestY) < circle.diameter / 2 + padding
}

// Validate actual circles AND title/control rectangles; area ratios alone cannot prove a fit.
export function workspaceFits(items: BubblePlacement[], size: WorkspaceSize, gap = 0): boolean {
  const padding = edge + gap / 2
  for (let index = 0; index < items.length; index++) {
    const a = items[index]
    if (a.x < edge - .01 || a.y < edge - .01 || a.x + a.diameter + edge > size.width + .01
      || a.y + bubbleHeaderHeight + a.shellHeight + edge > size.height + .01) return false
    for (let j = index + 1; j < items.length; j++) {
      const b = items[j]
      if (a.rectangular || b.rectangular) return false
      if (Math.hypot(a.x + a.diameter / 2 - b.x - b.diameter / 2,
        a.y + a.diameter / 2 - b.y - b.diameter / 2) < (a.diameter + b.diameter) / 2 + padding * 2
        || overlapsRect(a, b, padding) || headerHitsCircle(a, b, padding) || headerHitsCircle(b, a, padding)) return false
    }
  }
  return true
}

function circleLayout(items: BubblePlacement[], size: WorkspaceSize, rotated: boolean, gap: number): BubblePlacement[] {
  const circles = packSiblings(items.map(item => ({ r: item.diameter / 2 + bubbleHeaderHeight + edge + gap / 2, item })))
  const points = circles.map(circle => ({ ...circle.item,
    x: (rotated ? circle.y : circle.x) - circle.item.diameter / 2,
    y: (rotated ? circle.x : circle.y) - circle.item.diameter / 2 - bubbleHeaderHeight,
  }))
  const minX = Math.min(...points.map(item => item.x)) - edge
  const minY = Math.min(...points.map(item => item.y)) - edge
  const width = Math.max(...points.map(item => item.x + item.diameter)) + edge - minX
  const height = Math.max(...points.map(item => item.y + bubbleHeaderHeight + item.diameter)) + edge - minY
  return points.map(item => ({ ...item, x: item.x - minX + (size.width - width) / 2, y: item.y - minY + (size.height - height) / 2 }))
}

function movement(items: BubblePlacement[], previous?: WorkspaceLayout) {
  return items.reduce((sum, item) => {
    const old = previous?.items.find(entry => entry.id === item.id)
    return sum + (old ? Math.hypot(old.x - item.x, old.y - item.y) : 0)
  }, 0)
}

export function getWorkspaceLayout(groups: readonly Group[], size: WorkspaceSize, previous?: WorkspaceLayout): WorkspaceLayout {
  if (!groups.length) return { fits: size.width > 0 && size.height > 0, height: Math.max(0, size.height), items: [] }
  for (const [tile, gap] of [[desktopBubbleTile, 24], [desktopBubbleTile, 12], [compactBubbleTile, 12]] as const) {
    const items = groups.map(group => ({ ...getBubbleContents(group.sites.length, tile), id: group.id,
      x: 0, y: 0, shellHeight: 0, rectangular: false })).map(item => ({ ...item, shellHeight: item.diameter }))
    // No arrangement can fit a group that alone exceeds the usable rectangle.
    if (items.some(item => item.diameter + edge * 2 > size.width || item.diameter + bubbleHeaderHeight + edge * 2 > size.height)) continue
    const candidates: BubblePlacement[][] = []
    if (previous?.fits && items.every(item => previous.items.some(old => old.id === item.id))) {
      candidates.push(items.map(item => ({ ...item, x: previous.items.find(old => old.id === item.id)!.x, y: previous.items.find(old => old.id === item.id)!.y })))
    }
    for (const ordered of [items, [...items].sort((a, b) => b.diameter - a.diameter)]) {
      candidates.push(rowLayout(ordered, size, gap).items, circleLayout(ordered, size, false, gap), circleLayout(ordered, size, true, gap))
    }
    const valid = candidates.filter(candidate => workspaceFits(candidate, size, gap))
      .sort((a, b) => movement(a, previous) - movement(b, previous))
    if (valid.length) return { fits: true, height: size.height, items: valid[0] }
  }
  // Existing over-capacity data stays fully accessible, including groups wider than the window.
  const items = groups.map(group => {
    const contents = getBubbleContents(group.sites.length, compactBubbleTile)
    const diameter = Math.max(compactBubbleTile.width + 32, size.width - edge * 2)
    if (contents.diameter <= diameter) return { ...contents, id: group.id, x: 0, y: 0, shellHeight: contents.diameter, rectangular: false }
    const columns = Math.max(1, Math.floor((diameter - 32) / contents.tile.width))
    const rows = Math.ceil((group.sites.length + 1) / columns)
    const shellHeight = rows * contents.tile.height + 32
    return { ...contents, id: group.id, diameter, shellHeight, rectangular: true, x: 0, y: 0,
      positions: Array.from({ length: group.sites.length + 1 }, (_, i) => ({
        x: (i % columns - (Math.min(columns, group.sites.length + 1 - Math.floor(i / columns) * columns) - 1) / 2) * contents.tile.width,
        y: 16 + Math.floor(i / columns) * contents.tile.height + contents.tile.height / 2 - shellHeight / 2,
      })) }
  })
  return { ...rowLayout(items, size, 12), fits: false }
}
