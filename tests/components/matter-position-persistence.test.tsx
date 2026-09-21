// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import Matter from 'matter-js'
import MatterTemplate from '../../src/templates/matter/MatterTemplate'
import type { NavigationTemplateProps } from '../../src/templates/types'
import { installDomStubs, setDocumentVisibility } from './testEnvironment'

const modules = [{ id: 'tools', title: 'Tools', description: '', accent: '#9ff7cd', sites: [
  { id: 'alpha', name: 'Alpha', url: 'https://example.com', description: '' },
] }]
const saved = { x: 0.25, y: 0.3, angle: 0.4 }
function setup(enabled = true, positions = { alpha: saved }) {
  const save = vi.fn()
  const engineSpy = vi.spyOn(Matter.Engine, 'create')
  const props: NavigationTemplateProps = {
    modules, frequentSites: [], editing: false, interactionBlocked: false, revealSite: null,
    iconPositionPersistence: { enabled, positions }, onInteractionStateChange: vi.fn(),
    actions: { enterEditMode: vi.fn(), openSettings: vi.fn(), addSite: vi.fn(), edit: vi.fn(), removeSite: vi.fn(), removeModule: vi.fn(), moveSite: vi.fn(), visitSite: vi.fn(), saveIconPositions: save },
  }
  const view = render(<MatterTemplate {...props} />)
  const engine = engineSpy.mock.results.at(-1)!.value as Matter.Engine
  const body = engine.world.bodies.find(b => !b.isStatic)!
  return { ...view, save, engine, engineSpy, body, props }
}
function observer() {
  return (ResizeObserver as unknown as { instances: { callback: () => void }[] }).instances.at(-1)!
}
beforeEach(() => {
  installDomStubs()
  setDocumentVisibility('visible')
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 })
  vi.spyOn(Matter.Render, 'create').mockImplementation(options => {
    const canvas = document.createElement('canvas')
    options.element!.append(canvas)
    return { canvas, engine: options.engine, options: options.options } as unknown as Matter.Render
  })
  for (const method of ['run', 'stop', 'setSize'] as const) vi.spyOn(Matter.Render, method).mockImplementation(() => {})
  vi.spyOn(Matter.Runner, 'run').mockImplementation(runner => runner)
  vi.spyOn(Matter.Runner, 'stop').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

test('restores normalized center and angle with unchanged seeded geometry and zero velocity', () => {
  const restored = setup()
  expect(restored.body.position).toEqual({ x: 200, y: 180 })
  expect(restored.body.angle).toBe(saved.angle)
  expect(restored.body.velocity).toEqual({ x: 0, y: 0 })
  expect(restored.body.angularVelocity).toBe(0)
  const shape = { label: restored.body.label, area: restored.body.area, mass: restored.body.mass, restitution: restored.body.restitution }
  restored.unmount()
  const fresh = setup(false)
  expect(fresh.body.position.y).toBeLessThan(0)
  expect(fresh.body.label).toBe(shape.label)
  expect(fresh.body.area).toBeCloseTo(shape.area)
  expect(fresh.body.mass).toBeCloseTo(shape.mass)
  expect(fresh.body.restitution).toBe(shape.restitution)
})

test.each([false, true])('no saved data preserves above-stage spawn, including initial ResizeObserver callback (%s)', enabled => {
  const { body, save } = setup(enabled, {} as { alpha: typeof saved })
  const position = { ...body.position }
  observer().callback()
  expect(body.position).toEqual(position)
  expect(body.position.y).toBeLessThan(0)
  expect(save).not.toHaveBeenCalled()
})

test('snapshots read live positions on hidden, pagehide and after DOM refs clear on unmount, never each frame', () => {
  const { body, engine, save, unmount } = setup()
  Matter.Engine.update(engine, 1000 / 60)
  expect(save).not.toHaveBeenCalled()
  Matter.Body.setPosition(body, { x: 400, y: 300 })
  Matter.Body.setAngle(body, 0.8)
  fireEvent(window, new Event('pagehide'))
  expect(save).toHaveBeenLastCalledWith('matter', { alpha: { x: 0.5, y: 0.5, angle: 0.8 } })
  Matter.Body.setPosition(body, { x: 320, y: 240 })
  setDocumentVisibility('hidden')
  fireEvent(document, new Event('visibilitychange'))
  expect(save).toHaveBeenLastCalledWith('matter', { alpha: { x: 0.4, y: 0.4, angle: 0.8 } })
  Matter.Body.setPosition(body, { x: 480, y: 360 })
  unmount()
  expect(save).toHaveBeenLastCalledWith('matter', { alpha: { x: 0.6, y: 0.6, angle: 0.8 } })
  const calls = save.mock.calls.length
  fireEvent(window, new Event('pagehide'))
  expect(save).toHaveBeenCalledTimes(calls)
})

test('resize preserves relative position/angle and clamps the full body to new boundaries', () => {
  const { body, engine, save } = setup()
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 400 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 300 })
  observer().callback()
  expect(body.position).toEqual({ x: 100, y: 90 })
  expect(save).toHaveBeenLastCalledWith('matter', { alpha: saved })
  Matter.Body.setPosition(body, { x: 1000, y: 1000 })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 320 })
  observer().callback()
  expect(body.bounds.min.x).toBeGreaterThanOrEqual(0)
  expect(body.bounds.max.x).toBeLessThanOrEqual(320)
  expect(body.bounds.max.y).toBeLessThanOrEqual(300)
  expect(engine.world.bodies.filter(b => b.isStatic)).toHaveLength(4)
})

test('editing and moving a site keep its live body; additions fall and deletion removes snapshot entries', () => {
  const { body, engine, engineSpy, props, save, rerender } = setup()
  Matter.Body.setPosition(body, { x: 400, y: 300 })
  const beta = { ...modules[0].sites[0], id: 'beta' }
  const moved = [{ ...modules[0], id: 'new-category', sites: [{ ...modules[0].sites[0], name: 'Renamed' }, beta] }]
  rerender(<MatterTemplate {...props} modules={moved} />)
  expect(engineSpy).toHaveBeenCalledOnce()
  expect(engine.world.bodies).toContain(body)
  expect(body.position).toEqual({ x: 400, y: 300 })
  expect(engine.world.bodies.find(b => !b.isStatic && b !== body)!.position.y).toBeLessThan(0)
  rerender(<MatterTemplate {...props} modules={[{ ...moved[0], sites: [beta] }]} />)
  fireEvent(window, new Event('pagehide'))
  expect(Object.keys(save.mock.lastCall![1])).toEqual(['beta'])
})

test('drag release saves immediately; disabled mode ignores previous coordinates and all lifecycle saves', () => {
  const view = setup()
  fireEvent.pointerDown(screen.getByLabelText('Alpha物理图标'), { pointerId: 7, pointerType: 'mouse', button: 0, clientX: 200, clientY: 180 })
  fireEvent.pointerMove(window, { pointerId: 7, clientX: 400, clientY: 300 })
  expect(view.save).not.toHaveBeenCalled()
  fireEvent.pointerUp(window, { pointerId: 7 })
  expect(view.save).toHaveBeenLastCalledWith('matter', { alpha: { x: 0.5, y: 0.5, angle: 0.4 } })
  view.unmount()
  const disabled = setup(false)
  expect(disabled.body.position.y).toBeLessThan(0)
  fireEvent(window, new Event('pagehide'))
  disabled.unmount()
  expect(disabled.save).not.toHaveBeenCalled()
})


test.each([
  ['pointercancel', () => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 7 }))],
  ['blur', () => window.dispatchEvent(new Event('blur'))],
  ['window mouseout', () => window.dispatchEvent(new MouseEvent('mouseout', { relatedTarget: null }))],
  ['document mouseleave', () => document.dispatchEvent(new MouseEvent('mouseleave', { relatedTarget: null }))],
  ['document pointerout', () => document.dispatchEvent(new PointerEvent('pointerout', { pointerId: 7, relatedTarget: null }))],
] as const)('%s cancels a dragged icon and persists the latest position without opening the link', (reason, cancel) => {
  const view = setup()
  const link = screen.getByRole('link', { name: 'Alpha，打开站点' })
  fireEvent.pointerDown(screen.getByLabelText('Alpha物理图标'), { pointerId: 7, pointerType: 'mouse', button: 0, clientX: 200, clientY: 180 })
  fireEvent.pointerMove(window, { pointerId: 7, clientX: 400, clientY: 300 })
  Matter.Body.setPosition(view.body, { x: 520, y: 410 })
  Matter.Body.setAngle(view.body, 1.2)
  cancel()
  expect(view.save).toHaveBeenLastCalledWith('matter', { alpha: { x: 0.65, y: 410 / 600, angle: 1.2 } })
  expect(link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))).toBe(false)
  expect(view.props.actions.visitSite).not.toHaveBeenCalled()
})

test('hidden cancellation persists once as the final snapshot and visible changes do not cancel an active drag', () => {
  const view = setup()
  fireEvent.pointerDown(screen.getByLabelText('Alpha物理图标'), { pointerId: 7, pointerType: 'mouse', button: 0, clientX: 200, clientY: 180 })
  Matter.Body.setPosition(view.body, { x: 240, y: 150 })
  document.dispatchEvent(new Event('visibilitychange'))
  expect(view.save).not.toHaveBeenCalled()

  setDocumentVisibility('hidden')
  Matter.Body.setPosition(view.body, { x: 360, y: 210 })
  document.dispatchEvent(new Event('visibilitychange'))
  expect(view.save).toHaveBeenLastCalledWith('matter', { alpha: { x: 0.45, y: 0.35, angle: 0.4 } })
  expect(view.save.mock.calls.length).toBeGreaterThanOrEqual(1)
})

test('same-size resize is a no-op and disabled persistence does not rescale or save positions', () => {
  const enabled = setup()
  const enabledPosition = { ...enabled.body.position }
  observer().callback()
  expect(enabled.body.position).toEqual(enabledPosition)
  expect(enabled.save).not.toHaveBeenCalled()
  enabled.unmount()

  const disabled = setup(false)
  Matter.Body.setPosition(disabled.body, { x: 700, y: 450 })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 400 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 300 })
  observer().callback()
  expect(disabled.body.position).toEqual({ x: 700, y: 450 })
  expect(disabled.save).not.toHaveBeenCalled()
})

test('lifecycle listeners are detached after unmount and no stale callback can persist positions', () => {
  const view = setup()
  const beforeUnmount = view.save.mock.calls.length
  view.unmount()
  fireEvent(window, new Event('pagehide'))
  setDocumentVisibility('hidden')
  fireEvent(document, new Event('visibilitychange'))
  expect(view.save.mock.calls.length).toBe(beforeUnmount + 1)
})

test('position snapshots clamp out-of-stage coordinates and replace non-finite angles with zero', () => {
  const view = setup()
  Matter.Body.setPosition(view.body, { x: -100, y: 900 })
  Matter.Body.setAngle(view.body, Number.NaN)
  fireEvent(window, new Event('pagehide'))
  expect(view.save).toHaveBeenLastCalledWith('matter', { alpha: { x: 0, y: 1, angle: 0 } })
})

test('a non-left mouse press does not create a drag or persist an unrelated snapshot', () => {
  const view = setup()
  fireEvent.pointerDown(screen.getByLabelText('Alpha物理图标'), { pointerId: 7, pointerType: 'mouse', button: 2, clientX: 200, clientY: 180 })
  fireEvent.pointerMove(window, { pointerId: 7, clientX: 400, clientY: 300 })
  fireEvent.pointerUp(window, { pointerId: 7 })
  expect(view.save).not.toHaveBeenCalled()
  expect(view.props.onInteractionStateChange).not.toHaveBeenCalledWith({ dragging: true, settling: false })
})

test('deleting a dragged site releases pointer capture and removes it from the next persisted snapshot', () => {
  const view = setup()
  const icon = screen.getByLabelText('Alpha物理图标')
  const anchor = icon.querySelector('a')!
  vi.mocked(anchor.hasPointerCapture).mockReturnValue(true)
  fireEvent.pointerDown(icon, { pointerId: 7, pointerType: 'mouse', button: 0, clientX: 200, clientY: 180 })
  const nextModules = [{ ...modules[0], sites: [] }]
  view.rerender(<MatterTemplate {...view.props} modules={nextModules} />)
  expect(anchor.releasePointerCapture).toHaveBeenCalledWith(7)
  fireEvent(window, new Event('pagehide'))
  expect(view.save).toHaveBeenLastCalledWith('matter', {})
})
