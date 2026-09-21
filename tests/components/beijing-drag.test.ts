// @vitest-environment jsdom
import Matter from 'matter-js'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { bindSceneDrag } from '../../src/templates/beijing/drag'
import { installDomStubs, setDocumentVisibility } from './testEnvironment'

let dispose: (() => void) | undefined
beforeEach(() => {
  installDomStubs()
  setDocumentVisibility('visible')
})
afterEach(() => {
  dispose?.()
  dispose = undefined
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function pointer(target: EventTarget, type: string, init: PointerEventInit = {}) {
  const event = new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, clientX: 155, clientY: 265, ...init })
  target.dispatchEvent(event)
  return event
}

function setup() {
  const stage = document.createElement('div')
  vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue(new DOMRect(40, 60, 500, 600))
  const bodies = new Map(['alpha', 'beta'].map(id => [id, Matter.Bodies.rectangle(120, 200, 40, 40)]))
  const visits = new Map<string, ReturnType<typeof vi.fn>>()
  const icons = new Map<string, HTMLDivElement>()
  for (const id of bodies.keys()) {
    const icon = document.createElement('div')
    icon.className = 'beijing-icon-link'
    icon.dataset.siteId = id
    icon.innerHTML = `<a class="beijing-icon-anchor" href="https://example.com/${id}"><span>${id}</span></a><button data-editing-interactive>Edit</button>`
    const captures = new Set<number>()
    Object.defineProperties(icon, {
      setPointerCapture: { configurable: true, value: vi.fn((id: number) => { captures.add(id) }) },
      hasPointerCapture: { configurable: true, value: vi.fn((id: number) => captures.has(id)) },
      releasePointerCapture: { configurable: true, value: vi.fn((id: number) => { captures.delete(id) }) },
    })
    const visit = vi.fn((event: Event) => event.preventDefault())
    icon.querySelector('a')!.addEventListener('click', visit)
    visits.set(id, visit)
    icons.set(id, icon)
    stage.append(icon)
  }
  document.body.append(stage)
  const options = { bodyFor: (id: string) => bodies.get(id), blocked: vi.fn(() => false), release: vi.fn(), sync: vi.fn(), report: vi.fn() }
  const drag = bindSceneDrag(stage, options)
  dispose = drag.dispose
  const icon = icons.get('alpha')!
  return { stage, bodies, icons, visits, icon, anchor: icon.querySelector('a')!, body: bodies.get('alpha')!, drag, ...options }
}

test('dragging keeps the initial grab offset and releases the real body without visiting', () => {
  const { icon, body, anchor, visits, report, release, sync } = setup()
  Matter.Sleeping.set(body, true)
  expect(pointer(anchor.querySelector('span')!, 'pointerdown').defaultPrevented).toBe(true)
  expect(body.isStatic).toBe(true)
  expect(body.isSleeping).toBe(false)
  expect(icon.hasPointerCapture(7)).toBe(true)
  expect(report).not.toHaveBeenCalled()
  pointer(window, 'pointermove', { clientX: 315, clientY: 415 })
  expect(body.position).toEqual({ x: 280, y: 350 })
  expect(report).toHaveBeenCalledExactlyOnceWith({ dragging: true, settling: false })
  expect(sync).toHaveBeenCalledOnce()
  pointer(window, 'pointerup')
  expect(body.isStatic).toBe(false)
  expect(body.mass).toBeGreaterThan(0)
  expect(Number.isFinite(body.mass)).toBe(true)
  expect(icon.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(7)
  expect(release).toHaveBeenCalledExactlyOnceWith(body)
  expect(report).toHaveBeenLastCalledWith({ dragging: false, settling: false })
  anchor.click()
  expect(visits.get('alpha')).not.toHaveBeenCalled()
})

test.each([
  ['blocked panel', {}, 'blocked'],
  ['secondary pointer', { isPrimary: false }, 'anchor'],
  ['right mouse button', { button: 2 }, 'anchor'],
  ['edit control', {}, 'button'],
  ['stage background', {}, 'stage'],
  ['removed site body', {}, 'missing'],
] as const)('ignores a press on %s', (_name, init, target) => {
  const { stage, icon, anchor, body, bodies, blocked, release, report } = setup()
  if (target === 'blocked') blocked.mockReturnValue(true)
  if (target === 'missing') bodies.delete('alpha')
  const element = target === 'button' ? icon.querySelector('button')! : target === 'stage' ? stage : anchor
  expect(pointer(element, 'pointerdown', init).defaultPrevented).toBe(false)
  pointer(window, 'pointermove', { clientX: 400 })
  pointer(window, 'pointerup')
  expect(body.position).toEqual({ x: 120, y: 200 })
  expect(body.isStatic).toBe(false)
  expect(icon.setPointerCapture).not.toHaveBeenCalled()
  expect(release).not.toHaveBeenCalled()
  expect(report).not.toHaveBeenCalled()
})

test('another pointer cannot move, finish, cancel or steal an active gesture', () => {
  const { icon, body, icons, bodies, release, report } = setup()
  pointer(icon, 'pointerdown')
  pointer(icons.get('beta')!, 'pointerdown', { pointerId: 8 })
  pointer(window, 'pointermove', { pointerId: 8, clientX: 400 })
  pointer(window, 'pointerup', { pointerId: 8 })
  pointer(window, 'pointercancel', { pointerId: 8 })
  expect(body.position).toEqual({ x: 120, y: 200 })
  expect(body.isStatic).toBe(true)
  expect(bodies.get('beta')!.isStatic).toBe(false)
  expect(release).not.toHaveBeenCalled()
  expect(report).not.toHaveBeenCalled()
  pointer(window, 'pointercancel')
  expect(release).toHaveBeenCalledExactlyOnceWith(body)
})

test.each([
  [3, false, 1],
  [4, true, 0],
])('a %ipx move distinguishes a tap from a drag without duplicate visits', (distance, dragging, visitCount) => {
  const { anchor, visits, report } = setup()
  pointer(anchor, 'pointerdown', { pointerType: 'touch' })
  pointer(window, 'pointermove', { pointerType: 'touch', clientX: 155 + distance })
  expect(report.mock.calls.some(([state]) => state.dragging)).toBe(dragging)
  pointer(window, 'pointerup', { pointerType: 'touch' })
  anchor.click() // Browser's trailing click must not count a second time.
  expect(visits.get('alpha')).toHaveBeenCalledTimes(visitCount)
})

test.each(['pointercancel', 'Escape', 'blur', 'hidden', 'lostpointercapture', 'mouseout', 'pointerout', 'mouseleave', 'cancel'])(
  '%s cancels the gesture, unlocks switching and suppresses accidental navigation', reason => {
    const { stage, icon, anchor, body, visits, drag, release, sync, report } = setup()
    pointer(anchor, 'pointerdown')
    pointer(window, 'pointermove', { clientX: 300 })
    switch (reason) {
      case 'pointercancel': pointer(window, 'pointercancel'); break
      case 'Escape': stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); break
      case 'blur': window.dispatchEvent(new Event('blur')); break
      case 'hidden': setDocumentVisibility('hidden'); document.dispatchEvent(new Event('visibilitychange')); break
      case 'lostpointercapture': icon.dispatchEvent(new Event('lostpointercapture')); break
      case 'mouseout': window.dispatchEvent(new MouseEvent('mouseout', { relatedTarget: null })); break
      case 'pointerout': document.dispatchEvent(new MouseEvent('pointerout', { relatedTarget: null })); break
      case 'mouseleave': document.dispatchEvent(new MouseEvent('mouseleave', { relatedTarget: null })); break
      case 'cancel': drag.cancel(); break
    }
    expect(body.isStatic).toBe(false)
    expect(icon.hasPointerCapture(7)).toBe(false)
    expect(release).toHaveBeenCalledExactlyOnceWith(body)
    expect(report).toHaveBeenLastCalledWith({ dragging: false, settling: false })
    const position = { ...body.position }
    const syncCount = sync.mock.calls.length
    pointer(window, 'pointermove', { clientX: 450 })
    pointer(window, 'pointerup')
    anchor.click()
    expect(body.position).toEqual(position)
    expect(sync).toHaveBeenCalledTimes(syncCount)
    expect(release).toHaveBeenCalledOnce()
    expect(visits.get('alpha')).not.toHaveBeenCalled()
  },
)

test('moving between elements or receiving a visible notification does not cancel', () => {
  const { icon, body, release } = setup()
  pointer(icon, 'pointerdown')
  window.dispatchEvent(new MouseEvent('mouseout', { relatedTarget: document.body }))
  document.dispatchEvent(new Event('visibilitychange'))
  expect(body.isStatic).toBe(true)
  expect(release).not.toHaveBeenCalled()
})

test('click suppression is per site, and a new deliberate press still opens immediately', () => {
  const { anchor, icons, visits } = setup()
  pointer(anchor, 'pointerdown')
  pointer(window, 'pointercancel')
  anchor.click()
  icons.get('beta')!.querySelector('a')!.click()
  expect(visits.get('alpha')).not.toHaveBeenCalled()
  expect(visits.get('beta')).toHaveBeenCalledOnce()
  pointer(anchor, 'pointerdown')
  pointer(window, 'pointerup')
  anchor.click()
  expect(visits.get('alpha')).toHaveBeenCalledOnce()
})

test.each(['Enter', ' '])('%s restores keyboard activation after cancelling a pointer gesture', key => {
  const { anchor, visits } = setup()
  pointer(anchor, 'pointerdown')
  pointer(window, 'pointercancel')
  anchor.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  anchor.click()
  expect(visits.get('alpha')).toHaveBeenCalledOnce()
})

test('forget only cancels the removed site and clears its suppression for a future restored link', () => {
  const { anchor, body, drag, release, visits } = setup()
  pointer(anchor, 'pointerdown')
  drag.forget('beta')
  expect(body.isStatic).toBe(true)
  expect(release).not.toHaveBeenCalled()
  drag.forget('alpha')
  expect(body.isStatic).toBe(false)
  expect(release).toHaveBeenCalledExactlyOnceWith(body)
  anchor.click()
  expect(visits.get('alpha')).toHaveBeenCalledOnce()
})

test('a failed pointer capture still allows window listeners to complete a gesture', () => {
  const { icon, anchor, body, visits } = setup()
  vi.mocked(icon.setPointerCapture).mockImplementation(() => { throw new DOMException('No active pointer', 'NotFoundError') })
  pointer(anchor, 'pointerdown')
  pointer(window, 'pointerup')
  expect(body.isStatic).toBe(false)
  expect(visits.get('alpha')).toHaveBeenCalledOnce()
})

test('disposing mid-drag is idempotent and detaches stage and session handlers', () => {
  const { stage, anchor, body, drag, release, sync, report, visits } = setup()
  pointer(anchor, 'pointerdown')
  pointer(window, 'pointermove', { clientX: 300 })
  drag.dispose()
  drag.dispose()
  expect(body.isStatic).toBe(false)
  expect(release).toHaveBeenCalledOnce()
  const position = { ...body.position }
  sync.mockClear()
  report.mockClear()
  pointer(anchor, 'pointerdown')
  pointer(window, 'pointermove', { clientX: 450 })
  pointer(window, 'pointerup')
  window.dispatchEvent(new Event('blur'))
  stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  expect(body.position).toEqual(position)
  expect(sync).not.toHaveBeenCalled()
  expect(report).not.toHaveBeenCalled()
  expect(visits.get('alpha')).not.toHaveBeenCalled()
  anchor.click()
  expect(visits.get('alpha')).toHaveBeenCalledOnce() // The capture-phase suppressor is also gone.
})
