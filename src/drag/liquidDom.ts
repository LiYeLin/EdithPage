import type { Arrival } from './liquidSession'
import { containsPoint, rectCenter, type Point } from './liquidGeometry'

export function findSiteTile(arrival: Arrival): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>('.site-tile-wrap')].find((tile) =>
    tile.dataset.siteId === arrival.siteId && tile.dataset.moduleId === arrival.moduleId && tile.dataset.variant === arrival.variant) ?? null
}

export function findBubble(moduleId: string): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>('.module-panel')]
    .find((panel) => panel.dataset.moduleId === moduleId)?.querySelector<HTMLElement>('.bubble-shell') ?? null
}

export function isVisiblePoint(node: Element, point: Point) {
  if (!node.isConnected || node.closest('[inert]')) return false
  if (!containsPoint({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }, point)) return false
  // Rects are viewport-relative, including scroll and live Motion transforms.
  let ancestor = node.parentElement
  while (ancestor) {
    if (ancestor.matches('.module-grid, .bubble-shell, .bubble-site-list, .frequent-list')
      && !containsPoint(ancestor.getBoundingClientRect(), point)) return false
    ancestor = ancestor.parentElement
  }
  return true
}

export function visibleIcon(tile: HTMLElement | null) {
  const icon = tile?.querySelector<HTMLElement>('.site-icon')
  if (!icon) return null
  const rect = icon.getBoundingClientRect()
  const point = rectCenter(rect)
  return rect.width > 0 && isVisiblePoint(icon, point) ? { point, size: rect.width } : null
}

export function supportsLiquid() {
  return typeof SVGFEGaussianBlurElement !== 'undefined' && typeof SVGFEColorMatrixElement !== 'undefined'
    && typeof ResizeObserver !== 'undefined' && CSS.supports('filter', 'url("#edith-liquid")')
}
