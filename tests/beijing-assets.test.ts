// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { loadTerrainAssets, parseTerrainAssets } from '../src/templates/beijing/assets'

// Small, controlled fixtures make each validation failure independent of the artwork's detail paths.
const visual = `<svg viewBox="0 0 1800 640">
  <g id="temple-of-heaven"><path class="outline" d="M 10 560 L 20 400 L 30 560 Z"/></g>
  <g id="forbidden-city"><path class="roof" d="M 50 560 L 60 450 L 70 560 Z"/></g>
  <g id="china-zun"><path class="fine" d="M 90 560 L 100 20 L 110 560 Z"/></g>
</svg>`
const collision = `<svg viewBox="0 0 1800 640">
  <path id="temple-of-heaven" d="M 10 560 L 20 400 L 30 560 Z"/>
  <path id="forbidden-city" d="M 50 560 L 60 450 L 70 560 Z"/>
  <path id="china-zun" d="M 90 560 L 100 20 L 110 560 Z"/>
  <path id="ground" d="M 0 560 L 1800 560 L 1800 640 L 0 640 Z"/>
</svg>`

afterEach(() => vi.unstubAllGlobals())

test.each([
  ['malformed XML', '<svg>', collision, 'SVG 格式错误'],
  ['visual coordinate system', visual.replace('1800 640', '900 320'), collision, 'SVG 格式错误'],
  ['collision coordinate system', visual, collision.replace('1800 640', '900 320'), 'SVG 格式错误'],
  ['visual parent transform', visual.replace('<g ', '<g transform="scale(2)" '), collision, '统一原始坐标'],
  ['collision path transform', visual, collision.replace('<path ', '<path transform="translate(1 0)" '), '统一原始坐标'],
  ['extra collision path', visual, collision.replace('</svg>', '<path d="M 0 0 L 1 0 L 1 1 Z"/></svg>'), '缺少建筑或地面'],
  ['missing ground', visual, collision.replace('id="ground"', 'id="decoration"'), '缺少建筑或地面'],
  ['missing collision landmark', visual, collision.replace('id="china-zun"', 'id="other"'), '建筑素材不完整'],
  ['missing visual landmark', visual.replace('id="china-zun"', 'id="other"'), collision, '建筑素材不完整'],
  ['ground baseline', visual, collision.replace('M 0 560 L 1800 560', 'M 0 559 L 1800 559'), '地面基准不匹配'],
  ['building baseline', visual, collision.replace('M 10 560', 'M 10 561'), '建筑基准不匹配'],
  ['empty visual group', visual.replace(/<path class="outline"[^>]*\/>/, ''), collision, '建筑线稿无效'],
  ['missing visual path data', visual.replace('d="M 10 560 L 20 400 L 30 560 Z"', ''), collision, '建筑线稿无效'],
  ['unsupported visual class', visual.replace('class="outline"', 'class="unknown"'), collision, '建筑线稿无效'],
  ['missing collision path data', visual, collision.replace('d="M 10 560 L 20 400 L 30 560 Z"', ''), '闭合的 M/L/Z'],
])('rejects %s instead of returning a partially usable terrain', (_name, display, terrain, message) => {
  expect(() => parseTerrainAssets(display, terrain)).toThrow(message)
})

test('copies only path data and allowed classes, defaulting unclassified lines to detail', () => {
  const decorated = visual
    .replace('class="outline"', 'onclick="alert(1)" style="fill:red"')
    .replace('<g id="temple-of-heaven">', '<g id="temple-of-heaven"><script>untrusted()</script><style>body{display:none}</style>')
  const result = parseTerrainAssets(decorated, collision)
  expect(result.landmarks[0]).toEqual({
    id: 'temple-of-heaven',
    vertices: [{ x: 10, y: 560 }, { x: 20, y: 400 }, { x: 30, y: 560 }],
    bounds: { min: { x: 10, y: 400 }, max: { x: 30, y: 560 } },
    paths: [{ d: 'M 10 560 L 20 400 L 30 560 Z', kind: 'detail' }],
  })
  expect(result.landmarks.map(item => item.paths[0].kind)).toEqual(['detail', 'roof', 'fine'])
})

test('waits for both response bodies before parsing, using the same abort signal', async () => {
  let completeCollision!: (text: string) => void
  const collisionText = new Promise<string>(resolve => { completeCollision = resolve })
  const fetchMock = vi.fn(async (url: string) => ({ ok: true, text: () => url.includes('landmarks') ? Promise.resolve(visual) : collisionText }))
  vi.stubGlobal('fetch', fetchMock)
  const controller = new AbortController()
  const loaded = vi.fn()
  const pending = loadTerrainAssets(controller.signal).then(loaded)
  await Promise.resolve()
  await Promise.resolve()
  expect(loaded).not.toHaveBeenCalled()
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/terrain\/beijing-landmarks\.svg$/), { signal: controller.signal })
  expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/terrain\/beijing-terrain\.svg$/), { signal: controller.signal })
  completeCollision(collision)
  await pending
  expect(loaded).toHaveBeenCalledExactlyOnceWith(parseTerrainAssets(visual, collision))
})

test.each(['network', 'response body', 'aborted'] as const)('propagates %s failures rather than returning partial assets', async failure => {
  const error = failure === 'aborted' ? new DOMException('Cancelled', 'AbortError') : new Error(failure)
  const controller = new AbortController()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('landmarks')) return { ok: true, text: async () => visual }
    if (failure === 'response body') return { ok: true, text: async () => { throw error } }
    if (failure === 'aborted') controller.abort()
    throw error
  }))
  await expect(loadTerrainAssets(controller.signal)).rejects.toBe(error)
})
