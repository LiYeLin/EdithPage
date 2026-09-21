// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, test, vi, type MockInstance } from 'vitest'
import Matter from 'matter-js'
import { parseTerrainAssets } from '../../src/templates/beijing/assets'
import { createBeijingScene } from '../../src/templates/beijing/scene'
import { installDomStubs, setDocumentVisibility } from './testEnvironment'

const asset = parseTerrainAssets(readFileSync('public/terrain/beijing-landmarks.svg', 'utf8'), readFileSync('public/terrain/beijing-terrain.svg', 'utf8'))
const entry = { module: { id: 'a', title: 'A', description: '', accent: '#9ff7cd', sites: [] }, site: { id: 'alpha', name: 'Alpha', url: 'https://example.com', description: '' } }
let frames: Map<number, FrameRequestCallback>
let scenes: ReturnType<typeof createBeijingScene>[]
let draw: MockInstance<typeof Matter.Render.world>
let createEngine: MockInstance<typeof Matter.Engine.create>
beforeEach(() => {
  installDomStubs()
  setDocumentVisibility('visible')
  frames = new Map()
  scenes = []
  let id = 0
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++id, callback); return id }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)))
  createEngine = vi.spyOn(Matter.Engine, 'create')
  vi.spyOn(Matter.Render, 'create').mockImplementation(options => {
    const canvas = options.canvas!
    return { canvas, engine: options.engine, options: options.options } as unknown as Matter.Render
  })
  draw = vi.spyOn(Matter.Render, 'world').mockImplementation(() => {})
  vi.spyOn(Matter.Render, 'setSize').mockImplementation(() => {})
  vi.spyOn(Matter.Render, 'setPixelRatio').mockImplementation(() => {})
})
afterEach(() => {
  scenes.forEach(scene => scene.dispose())
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function setup(overrides: Partial<Parameters<typeof createBeijingScene>[2]> = {}) {
  const stage = document.createElement('div')
  Object.defineProperty(stage, 'clientWidth', { configurable: true, value: 1440 })
  Object.defineProperty(stage, 'clientHeight', { configurable: true, value: 1000 })
  const icon = document.createElement('div')
  icon.className = 'beijing-icon-link'
  icon.dataset.siteId = 'alpha'
  icon.innerHTML = '<a class="beijing-icon-anchor" href="https://example.com">Alpha</a>'
  stage.append(icon)
  document.body.append(stage)
  const report = vi.fn()
  const layout = vi.fn()
  const scene = createBeijingScene(stage, asset, { iconFor: id => id === 'alpha' ? icon : undefined, report, onLayout: layout, ...overrides })
  scenes.push(scene)
  scene.reconcile([entry])
  return { scene, stage, icon, report, layout, engine: createEngine.mock.results.at(-1)!.value as Matter.Engine }
}
function tick(time: number) {
  const [id, callback] = Array.from(frames)[0]
  frames.delete(id)
  callback(time)
}

test('stable IDs keep bodies and transforms through metadata changes; removal is incremental', () => {
  const { scene, engine, icon } = setup()
  const body = engine.world.bodies.find(body => !body.isStatic)!
  Matter.Body.setPosition(body, { x: 200, y: 400 })
  scene.reconcile([{ ...entry, site: { ...entry.site, name: 'renamed' } }])
  expect(engine.world.bodies.find(body => !body.isStatic)).toBe(body)
  expect(body.position).toEqual({ x: 200, y: 400 })
  expect(icon.style.transform).toContain('translate3d')
  scene.reconcile([])
  expect(engine.world.bodies.filter(body => !body.isStatic)).toHaveLength(0)
  scene.dispose()
})

test('clock pauses on blocked/hidden state and disposal cancels frames, listeners and observer', () => {
  const removeDocument = vi.spyOn(document, 'removeEventListener')
  const removeStage = vi.spyOn(HTMLElement.prototype, 'removeEventListener')
  const { scene, stage, engine } = setup()
  scene.setPaused(false)
  expect(frames.size).toBe(1)
  tick(100)
  expect(engine.timing.timestamp).toBeGreaterThan(0)
  scene.setPaused(true)
  expect(frames.size).toBe(0)
  scene.setPaused(false)
  setDocumentVisibility('hidden')
  document.dispatchEvent(new Event('visibilitychange'))
  expect(frames.size).toBe(0)
  setDocumentVisibility('visible')
  document.dispatchEvent(new Event('visibilitychange'))
  expect(frames.size).toBe(1)
  const observers = (ResizeObserver as unknown as { instances: { disconnect: ReturnType<typeof vi.fn> }[] }).instances
  const last = observers.at(-1)!
  scene.dispose()
  expect(last.disconnect).toHaveBeenCalledOnce()
  expect(frames.size).toBe(0)
  expect(stage.querySelector('canvas')).toBeNull()
  expect(engine.world.bodies).toHaveLength(0)
  expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  expect(removeStage).toHaveBeenCalledWith('pointerdown', expect.any(Function))
  const calls = draw.mock.calls.length
  document.dispatchEvent(new Event('visibilitychange'))
  expect(frames.size).toBe(0)
  expect(draw.mock.calls.length).toBe(calls)
})

test('resize rebuilds wall dimensions and relocates intersecting icons without replacing them', () => {
  const { scene, stage, engine } = setup()
  const body = engine.world.bodies.find(body => !body.isStatic)!
  Matter.Body.setPosition(body, { x: 1300, y: 900 })
  Object.defineProperty(stage, 'clientWidth', { value: 320 })
  Object.defineProperty(stage, 'clientHeight', { value: 640 })
  const observers = (ResizeObserver as unknown as { instances: { callback: () => void }[] }).instances
  observers.at(-1)!.callback()
  expect(engine.world.bodies).toContain(body)
  expect(body.bounds.max.x).toBeLessThan(320)
  expect(body.bounds.max.y).toBeLessThan(624)
  expect(Matter.Query.collides(body, engine.world.bodies.filter(b => b.isStatic))).toHaveLength(0)
  expect(Matter.Render.setSize).toHaveBeenCalledWith(expect.anything(), 320, 640)
  scene.dispose()
})

test('tap is not reported as a drag and its trailing click is suppressed; new intentional clicks are not', () => {
  const { scene, icon, report } = setup()
  scene.setPaused(false)
  const anchor = icon.querySelector('a')!
  const visit = vi.fn((event: Event) => event.preventDefault())
  anchor.addEventListener('click', visit)
  const down = () => icon.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 300 }))
  const up = () => window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  down(); up()
  expect(report.mock.calls.some(([state]) => state.dragging)).toBe(false)
  expect(visit).toHaveBeenCalledTimes(1)
  anchor.click()
  expect(visit).toHaveBeenCalledTimes(1)
  down(); up()
  expect(visit).toHaveBeenCalledTimes(2)
  down()
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 400 }))
  expect(report).toHaveBeenLastCalledWith({ dragging: true, settling: false })
  window.dispatchEvent(new Event('blur'))
  up(); anchor.click()
  expect(visit).toHaveBeenCalledTimes(2)
  expect(report).toHaveBeenLastCalledWith({ dragging: false, settling: false })
  scene.dispose()
})


test('failed Canvas startup leaves no DOM, clock or pointer listeners behind', () => {
  const addStage = vi.spyOn(HTMLElement.prototype, 'addEventListener')
  draw.mockImplementationOnce(() => { throw new Error('Canvas unavailable') })
  expect(() => setup()).toThrow('Canvas unavailable')
  expect(document.querySelector('canvas')).toBeNull()
  expect(frames.size).toBe(0)
  expect(addStage).not.toHaveBeenCalledWith('pointerdown', expect.any(Function))
})

function latestObserver() {
  return (ResizeObserver as unknown as { instances: { callback: () => void; disconnect: ReturnType<typeof vi.fn> }[] }).instances.at(-1)!
}

test('accent changes repaint the existing body; adding a site leaves its position and momentum intact', () => {
  const { scene, engine } = setup()
  const body = engine.world.bodies.find(body => !body.isStatic)!
  Matter.Body.setPosition(body, { x: 250, y: 300 })
  Matter.Body.setVelocity(body, { x: 2, y: 3 })
  const changed = { ...entry, module: { ...entry.module, accent: '#123456' } }
  const added = { ...entry, site: { ...entry.site, id: 'beta' } }
  scene.reconcile([changed, added])
  expect(engine.world.bodies.filter(body => !body.isStatic)).toHaveLength(2)
  expect(engine.world.bodies).toContain(body)
  expect(body.position).toEqual({ x: 250, y: 300 })
  expect(body.velocity).toEqual({ x: 2, y: 3 })
  expect(body.render.fillStyle).toBe('rgba(18, 52, 86, 0.38)')
  expect(body.render.strokeStyle).toBe('#123456')
})

test('removing the actively dragged site cancels it without deleting other bodies or opening a link', () => {
  const { scene, engine, icon, report } = setup()
  const alpha = engine.world.bodies.find(body => !body.isStatic)!
  const added = { ...entry, site: { ...entry.site, id: 'beta' } }
  scene.reconcile([entry, added])
  const beta = engine.world.bodies.find(body => !body.isStatic && body !== alpha)!
  const visit = vi.fn((event: Event) => event.preventDefault())
  icon.querySelector('a')!.addEventListener('click', visit)
  scene.setPaused(false)
  icon.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 300 }))
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 400 }))
  expect(alpha.isStatic).toBe(true)
  expect(report).toHaveBeenLastCalledWith({ dragging: true, settling: false })
  scene.reconcile([added])
  window.dispatchEvent(new PointerEvent('pointerup'))
  expect(engine.world.bodies).not.toContain(alpha)
  expect(engine.world.bodies.filter(body => !body.isStatic)).toEqual([beta])
  expect(alpha.isStatic).toBe(false)
  expect(report).toHaveBeenLastCalledWith({ dragging: false, settling: false })
  expect(visit).not.toHaveBeenCalled()
})

test('unchanged measurements keep terrain bodies, but a safe-area change rebuilds at the new ground level', () => {
  const { scene, engine, stage, layout } = setup()
  const originalBodies = [...engine.world.bodies]
  const icon = originalBodies.find(body => !body.isStatic)!
  const observer = latestObserver()
  observer.callback()
  expect(engine.world.bodies).toEqual(originalBodies)
  expect(layout).toHaveBeenCalledOnce()
  expect(Matter.Render.setSize).not.toHaveBeenCalled()
  stage.style.paddingBottom = '34px'
  observer.callback()
  const ground = engine.world.bodies.find(body => body.label === 'ground')!
  expect(ground.bounds.min.y).toBeCloseTo(949.25)
  expect(layout).toHaveBeenLastCalledWith(expect.objectContaining({ width: 1440, height: 1000, groundY: 949.25 }))
  expect(engine.world.bodies).toContain(icon)
  expect(engine.world.bodies).not.toContain(originalBodies[0])
  scene.dispose()
})

test('visibility cannot resume a panel-blocked scene and repeated resumes own only one frame', () => {
  const { scene, stage, engine } = setup()
  expect(frames.size).toBe(0)
  scene.setPaused(false)
  scene.setPaused(false)
  expect(frames.size).toBe(1)
  tick(100)
  const timestamp = engine.timing.timestamp
  setDocumentVisibility('hidden')
  document.dispatchEvent(new Event('visibilitychange'))
  scene.setPaused(false)
  expect(frames.size).toBe(0)
  scene.setPaused(true)
  setDocumentVisibility('visible')
  document.dispatchEvent(new Event('visibilitychange'))
  expect(frames.size).toBe(0)
  expect(stage.dataset.paused).toBe('true')
  expect(engine.timing.timestamp).toBe(timestamp)
  scene.setPaused(false)
  expect(stage.dataset.paused).toBe('false')
  expect(frames.size).toBe(1)
})

test('a long frame is bounded and pause/resume discards elapsed wall-clock time', () => {
  const { scene, engine } = setup()
  const body = engine.world.bodies.find(body => !body.isStatic)!
  scene.setPaused(false)
  tick(100)
  const first = engine.timing.timestamp
  Matter.Body.setVelocity(body, { x: 100, y: 100 })
  tick(60_100)
  const elapsed = engine.timing.timestamp - first
  expect(elapsed).toBeGreaterThanOrEqual(1000 / 60)
  expect(elapsed).toBeLessThanOrEqual(1000 / 15 + 0.01)
  expect(body.speed).toBeLessThan(13)
  scene.setPaused(true)
  scene.setPaused(false)
  const beforeResume = engine.timing.timestamp
  tick(120_100)
  expect(engine.timing.timestamp - beforeResume).toBeCloseTo(1000 / 60)
  expect(frames.size).toBe(1)
})

test('large imported collections expand the ceiling above every spawn and retain it after resize', () => {
  const { scene, engine, stage } = setup()
  const entries = Array.from({ length: 100 }, (_, index) => ({ ...entry, site: { ...entry.site, id: `imported-${index}` } }))
  scene.reconcile(entries)
  const icons = engine.world.bodies.filter(body => !body.isStatic)
  expect(icons).toHaveLength(100)
  const ceiling = engine.world.bodies.find(body => body.isStatic && body.bounds.max.y < -2000)!
  expect(ceiling).toBeDefined()
  expect(ceiling.bounds.max.y).toBeLessThan(Math.min(...icons.map(body => body.bounds.min.y)))
  expect(icons.every(body => Matter.Query.collides(body, [ceiling]).length === 0)).toBe(true)
  Object.defineProperty(stage, 'clientWidth', { value: 390 })
  latestObserver().callback()
  const resizedCeiling = engine.world.bodies.find(body => body.isStatic && body.bounds.max.y < -2000)!
  expect(resizedCeiling.bounds.max.y).toBe(ceiling.bounds.max.y)
  expect(engine.world.bodies.filter(body => !body.isStatic)).toEqual(icons)
})

test('disposal is idempotent and already-queued frame/resize callbacks cannot revive the scene', () => {
  const { scene, stage, engine, layout, report } = setup()
  scene.setPaused(false)
  const lateFrame = Array.from(frames.values())[0]
  const observer = latestObserver()
  const clearEngine = vi.spyOn(Matter.Engine, 'clear')
  scene.dispose()
  const drawCount = draw.mock.calls.length
  const layoutCount = layout.mock.calls.length
  const reportCount = report.mock.calls.length
  scene.dispose()
  Object.defineProperty(stage, 'clientWidth', { value: 320 })
  observer.callback()
  lateFrame(1000)
  document.dispatchEvent(new Event('visibilitychange'))
  expect(observer.disconnect).toHaveBeenCalledOnce()
  expect(clearEngine).toHaveBeenCalledExactlyOnceWith(engine)
  expect(engine.world.bodies).toHaveLength(0)
  expect(stage.querySelector('canvas')).toBeNull()
  expect(frames.size).toBe(0)
  expect(draw).toHaveBeenCalledTimes(drawCount)
  expect(layout).toHaveBeenCalledTimes(layoutCount)
  expect(report).toHaveBeenCalledTimes(reportCount)
})

test('a layout callback failure after binding observers still cleans up all scene resources', () => {
  const clearEngine = vi.spyOn(Matter.Engine, 'clear')
  const removeStage = vi.spyOn(HTMLElement.prototype, 'removeEventListener')
  expect(() => setup({ onLayout: () => { throw new Error('Layout unavailable') } })).toThrow('Layout unavailable')
  const engine = createEngine.mock.results[0].value as Matter.Engine
  expect(engine.world.bodies).toHaveLength(0)
  expect(clearEngine).toHaveBeenCalledExactlyOnceWith(engine)
  expect(latestObserver().disconnect).toHaveBeenCalledOnce()
  expect(document.querySelector('canvas')).toBeNull()
  expect(removeStage).toHaveBeenCalledWith('pointerdown', expect.any(Function))
  document.dispatchEvent(new Event('visibilitychange'))
  expect(frames.size).toBe(0)
})

test('enabled persistence restores coordinates/angle and saves only on lifecycle events, not frames', () => {
  const save = vi.fn()
  const { scene, engine, stage } = setup({
    getIconPositionPersistence: () => ({ enabled: true, positions: { alpha: { x: 0.2, y: 0.3, angle: 0.4 } } }),
    saveIconPositions: save,
  })
  const body = engine.world.bodies.find(body => !body.isStatic)!
  expect(body.position).toEqual({ x: 288, y: 300 })
  expect(body.angle).toBe(0.4)
  expect(body.velocity).toEqual({ x: 0, y: 0 })
  scene.setPaused(false)
  tick(100); tick(120)
  expect(save).not.toHaveBeenCalled()
  Matter.Body.setPosition(body, { x: 432, y: 400 })
  Matter.Body.setAngle(body, 0.7)
  window.dispatchEvent(new Event('pagehide'))
  expect(save).toHaveBeenLastCalledWith({ alpha: { x: 0.3, y: 0.4, angle: 0.7 } })
  Matter.Body.setPosition(body, { x: 576, y: 300 })
  setDocumentVisibility('hidden')
  document.dispatchEvent(new Event('visibilitychange'))
  expect(save).toHaveBeenLastCalledWith({ alpha: { x: 0.4, y: 0.3, angle: 0.7 } })
  stage.remove()
  scene.dispose()
  expect(save).toHaveBeenLastCalledWith({ alpha: { x: 0.4, y: 0.3, angle: 0.7 } })
})

test('restored and resized positions avoid terrain while retaining relative coordinates in free space', () => {
  const save = vi.fn()
  const { engine, stage } = setup({
    getIconPositionPersistence: () => ({ enabled: true, positions: { alpha: { x: 0.5, y: 0.2, angle: 0.6 } } }),
    saveIconPositions: save,
  })
  const body = engine.world.bodies.find(body => !body.isStatic)!
  Object.defineProperty(stage, 'clientWidth', { value: 390 })
  Object.defineProperty(stage, 'clientHeight', { value: 844 })
  latestObserver().callback()
  expect(body.position.x).toBeCloseTo(195)
  expect(body.position.y).toBeCloseTo(168.8)
  expect(body.angle).toBe(0.6)
  expect(save).toHaveBeenLastCalledWith({ alpha: { x: 0.5, y: 0.2, angle: 0.6 } })
  // An old coordinate may be inside a building after a layout change.
  Matter.Body.setPosition(body, { x: 190, y: 820 })
  Object.defineProperty(stage, 'clientWidth', { value: 320 })
  latestObserver().callback()
  expect(Matter.Query.collides(body, engine.world.bodies.filter(b => b.isStatic))).toHaveLength(0)
})

test('new sites fall, moved/renamed sites keep their body and deleted IDs disappear from the next snapshot', () => {
  const save = vi.fn()
  const { engine, scene } = setup({
    getIconPositionPersistence: () => ({ enabled: true, positions: {
      alpha: { x: 0.2, y: 0.3, angle: 0.4 }, deleted: { x: 0.1, y: 0.1, angle: 0 },
    } }),
    saveIconPositions: save,
  })
  const alpha = engine.world.bodies.find(body => !body.isStatic)!
  const added = { ...entry, site: { ...entry.site, id: 'beta' } }
  scene.reconcile([{ ...entry, module: { ...entry.module, id: 'new' }, site: { ...entry.site, name: 'Changed' } }, added])
  expect(engine.world.bodies).toContain(alpha)
  expect(alpha.position).toEqual({ x: 288, y: 300 })
  const beta = engine.world.bodies.find(body => !body.isStatic && body !== alpha)!
  expect(beta.position.y).toBeLessThan(0)
  scene.reconcile([added])
  window.dispatchEvent(new Event('pagehide'))
  expect(Object.keys(save.mock.lastCall![0])).toEqual(['beta'])
})

test.each([false, true])('disabled or invalid saved coordinates fall safely (enabled=%s)', enabled => {
  const save = vi.fn()
  const { scene, engine } = setup({
    getIconPositionPersistence: () => ({ enabled, positions: { alpha: { x: enabled ? NaN : 0.2, y: 0.3, angle: 0 } } }),
    saveIconPositions: save,
  })
  expect(engine.world.bodies.find(body => !body.isStatic)!.position.y).toBeLessThan(0)
  latestObserver().callback()
  expect(save).not.toHaveBeenCalled()
  window.dispatchEvent(new Event('pagehide'))
  scene.dispose()
  if (!enabled) expect(save).not.toHaveBeenCalled()
})

test('drag release immediately saves the terrain-corrected position and angle', () => {
  const save = vi.fn()
  const { scene, engine, icon } = setup({
    getIconPositionPersistence: () => ({ enabled: true, positions: { alpha: { x: 0.2, y: 0.3, angle: 0.4 } } }),
    saveIconPositions: save,
  })
  scene.setPaused(false)
  icon.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 288, clientY: 300 }))
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: 400, clientY: 400 }))
  expect(save).not.toHaveBeenCalled()
  window.dispatchEvent(new PointerEvent('pointerup'))
  const body = engine.world.bodies.find(body => !body.isStatic)!
  expect(save).toHaveBeenLastCalledWith({ alpha: { x: body.position.x / 1440, y: body.position.y / 1000, angle: body.angle } })
})


test('same-size resize is a no-op and does not write a position snapshot', () => {
  const save = vi.fn()
  setup({
    getIconPositionPersistence: () => ({ enabled: true, positions: {} }),
    saveIconPositions: save,
  })
  const observer = latestObserver()
  const setSizeCalls = (Matter.Render.setSize as MockInstance).mock.calls.length
  observer.callback()
  expect(save).not.toHaveBeenCalled()
  expect(Matter.Render.setSize).toHaveBeenCalledTimes(setSizeCalls)
})

test('disabled persistence keeps vertical coordinates during resize and never writes', () => {
  const save = vi.fn()
  const { engine, stage } = setup({
    getIconPositionPersistence: () => ({ enabled: false, positions: { alpha: { x: 0.2, y: 0.3, angle: 0.4 } } }),
    saveIconPositions: save,
  })
  const body = engine.world.bodies.find(body => !body.isStatic)!
  Matter.Body.setPosition(body, { x: 720, y: 120 })
  Object.defineProperty(stage, 'clientWidth', { value: 720 })
  Object.defineProperty(stage, 'clientHeight', { value: 500 })
  latestObserver().callback()
  expect(body.position.x).toBeCloseTo(360)
  expect(body.position.y).toBeCloseTo(120)
  expect(save).not.toHaveBeenCalled()
})

test.each([
  ['x below zero', { x: -0.1, y: 0.3, angle: 0.4 }],
  ['y above one', { x: 0.2, y: 1.1, angle: 0.4 }],
  ['non-finite angle', { x: 0.2, y: 0.3, angle: Number.POSITIVE_INFINITY }],
  ['non-object position', null],
] as const)('ignores %s during initial restoration', (_name, position) => {
  const { engine } = setup({
    getIconPositionPersistence: () => ({ enabled: true, positions: { alpha: position as never } }),
  })
  const body = engine.world.bodies.find(body => !body.isStatic)!
  expect(body.position.y).toBeLessThan(0)
})

test('snapshots clamp coordinates and normalize a non-finite body angle', () => {
  const save = vi.fn()
  const { scene, engine } = setup({
    getIconPositionPersistence: () => ({ enabled: true, positions: {} }),
    saveIconPositions: save,
  })
  const body = engine.world.bodies.find(body => !body.isStatic)!
  Matter.Body.setPosition(body, { x: -100, y: 1400 })
  Matter.Body.setAngle(body, Number.NaN)
  window.dispatchEvent(new Event('pagehide'))
  expect(save).toHaveBeenLastCalledWith({ alpha: { x: 0, y: 1, angle: 0 } })
  scene.dispose()
})

test('multiple sites are persisted independently and removed IDs are absent from the next snapshot', () => {
  const save = vi.fn()
  const { scene, engine, icon } = setup({
    getIconPositionPersistence: () => ({ enabled: true, positions: {} }),
    saveIconPositions: save,
  })
  const beta = { ...entry, site: { ...entry.site, id: 'beta', name: 'Beta' } }
  scene.reconcile([entry, beta])
  const alpha = engine.world.bodies.find(body => !body.isStatic)!
  const betaBody = engine.world.bodies.find(body => !body.isStatic && body !== alpha)!
  Matter.Body.setPosition(alpha, { x: 144, y: 100 })
  Matter.Body.setAngle(alpha, 0.2)
  Matter.Body.setPosition(betaBody, { x: 720, y: 500 })
  Matter.Body.setAngle(betaBody, -0.3)
  window.dispatchEvent(new Event('pagehide'))
  const firstSnapshot = save.mock.lastCall![0]
  expect(firstSnapshot.alpha).toEqual({ x: 0.1, y: 0.1, angle: 0.2 })
  expect(firstSnapshot.beta.x).toBe(0.5)
  expect(firstSnapshot.beta.y).toBe(0.5)
  expect(firstSnapshot.beta.angle).toBeCloseTo(-0.3)
  scene.reconcile([beta])
  window.dispatchEvent(new Event('pagehide'))
  const secondSnapshot = save.mock.lastCall![0]
  expect(Object.keys(secondSnapshot)).toEqual(['beta'])
  expect(secondSnapshot.beta.x).toBe(0.5)
  expect(secondSnapshot.beta.y).toBe(0.5)
  expect(secondSnapshot.beta.angle).toBeCloseTo(-0.3)
  expect(icon.dataset.siteId).toBe('alpha')
})

test.each([
  ['pointercancel', () => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 7 }))],
  ['blur', () => window.dispatchEvent(new Event('blur'))],
  ['lostpointercapture', (icon: HTMLElement) => icon.dispatchEvent(new Event('lostpointercapture'))],
  ['Escape', (icon: HTMLElement) => icon.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))],
] as const)('%s cancels an active scene drag and saves the current body state', (reason, cancel) => {
  const save = vi.fn()
  const { scene, engine, icon } = setup({
    getIconPositionPersistence: () => ({ enabled: true, positions: {} }),
    saveIconPositions: save,
  })
  scene.setPaused(false)
  const body = engine.world.bodies.find(body => !body.isStatic)!
  icon.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, clientX: 100, clientY: 300 }))
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: 200, clientY: 400 }))
  Matter.Body.setPosition(body, { x: 360, y: 420 })
  Matter.Body.setAngle(body, 0.9)
  if (reason === 'lostpointercapture' || reason === 'Escape') cancel(icon)
  else cancel()
  expect(save).toHaveBeenLastCalledWith({ alpha: { x: 0.25, y: 0.42, angle: 0.9 } })
  expect(icon.querySelector('a')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))).toBe(false)
})

test('hidden state cancels an active drag, preserves its last snapshot, and does not save again after pointerup', () => {
  const save = vi.fn()
  const { scene, engine, icon } = setup({
    getIconPositionPersistence: () => ({ enabled: true, positions: {} }),
    saveIconPositions: save,
  })
  scene.setPaused(false)
  const body = engine.world.bodies.find(body => !body.isStatic)!
  icon.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, clientX: 100, clientY: 300 }))
  Matter.Body.setPosition(body, { x: 288, y: 300 })
  setDocumentVisibility('hidden')
  document.dispatchEvent(new Event('visibilitychange'))
  const calls = save.mock.calls.length
  expect(save).toHaveBeenLastCalledWith({ alpha: { x: 0.2, y: 0.3, angle: body.angle } })
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7 }))
  expect(save).toHaveBeenCalledTimes(calls)
})

test('dispose saves once, is idempotent, and removes lifecycle listeners so later events cannot write', () => {
  const save = vi.fn()
  const { scene, engine } = setup({
    getIconPositionPersistence: () => ({ enabled: true, positions: {} }),
    saveIconPositions: save,
  })
  const body = engine.world.bodies.find(body => !body.isStatic)!
  Matter.Body.setPosition(body, { x: 432, y: 400 })
  scene.dispose()
  const calls = save.mock.calls.length
  expect(save).toHaveBeenLastCalledWith({ alpha: { x: 0.3, y: 0.4, angle: body.angle } })
  scene.dispose()
  window.dispatchEvent(new Event('pagehide'))
  setDocumentVisibility('hidden')
  document.dispatchEvent(new Event('visibilitychange'))
  expect(save).toHaveBeenCalledTimes(calls)
})
