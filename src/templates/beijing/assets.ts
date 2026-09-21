import { LANDMARK_IDS, parsePolygon, polygonBounds, type TerrainAsset } from './terrain'

function parseSvg(text: string) {
  const svg = new DOMParser().parseFromString(text, 'image/svg+xml')
  if (svg.querySelector('parsererror') || svg.documentElement.getAttribute('viewBox') !== '0 0 1800 640') {
    throw new Error('北京地形 SVG 格式错误')
  }
  return svg
}

export function parseTerrainAssets(visualText: string, collisionText: string): TerrainAsset {
  const visual = parseSvg(visualText)
  const collision = parseSvg(collisionText)
  if (visual.querySelector('[transform]') || collision.querySelector('[transform]')) throw new Error('素材需使用统一原始坐标')
  if (collision.querySelectorAll('path').length !== 4 || !collision.querySelector('path[id="ground"]')) {
    throw new Error('北京地形缺少建筑或地面')
  }
  const ground = parsePolygon(collision.querySelector('path[id="ground"]')!.getAttribute('d') ?? '')
  if (polygonBounds(ground).min.y !== 560) throw new Error('地面基准不匹配')
  return { landmarks: LANDMARK_IDS.map(id => {
    const outline = collision.querySelector(`path[id="${id}"]`)
    const group = visual.querySelector(`g[id="${id}"]`)
    if (!outline || !group || group.querySelector('[transform]') || group.hasAttribute('transform')) throw new Error('建筑素材不完整')
    const vertices = parsePolygon(outline.getAttribute('d') ?? '')
    const bounds = polygonBounds(vertices)
    if (bounds.max.y !== 560) throw new Error('建筑基准不匹配')
    // Only local path data/classes are copied into React. No SVG styles/scripts or raw HTML are injected.
    const paths = Array.from(group.querySelectorAll('path')).map(path => ({
      d: path.getAttribute('d') ?? '', kind: path.getAttribute('class') ?? 'detail',
    }))
    if (!paths.length || paths.some(p => !p.d || !['outline', 'roof', 'detail', 'fine'].includes(p.kind))) throw new Error('建筑线稿无效')
    return { id, vertices, bounds, paths }
  }) }
}

export async function loadTerrainAssets(signal: AbortSignal): Promise<TerrainAsset> {
  const read = async (name: string) => {
    const response = await fetch(`${import.meta.env.BASE_URL}terrain/${name}.svg`, { signal })
    if (!response.ok) throw new Error('北京地形素材加载失败')
    return response.text()
  }
  const [visual, collision] = await Promise.all([read('beijing-landmarks'), read('beijing-terrain')])
  return parseTerrainAssets(visual, collision)
}
