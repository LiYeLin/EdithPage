// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { useContext, useRef, type CSSProperties, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TemplateInteractionState } from '../../src/templates/types'
import type { Module } from '../../src/types'
import { installDomStubs, setDocumentVisibility } from './testEnvironment'

const dnd = vi.hoisted(() => ({
  contexts: [] as Array<Record<string, unknown>>,
  sensors: [] as Array<{ sensor: unknown; options: unknown }>,
  reset() { this.contexts.length = 0; this.sensors.length = 0 },
}))

vi.mock('@dnd-kit/core', async () => {
  const React = await import('react')
  const DndContext = (props: Record<string, unknown> & { children?: ReactNode }) => {
    dnd.contexts.push(props)
    return React.createElement('div', { 'data-testid': 'dnd-context' }, props.children)
  }
  const DragOverlay = ({ children }: { children?: ReactNode }) => React.createElement('div', { 'data-testid': 'drag-overlay' }, children)
  const useSensor = (sensor: unknown, options: unknown) => {
    const result = { sensor, options }
    dnd.sensors.push(result)
    return result
  }
  return {
    DndContext,
    DragOverlay,
    MouseSensor: function MouseSensor() {},
    TouchSensor: function TouchSensor() {},
    KeyboardSensor: function KeyboardSensor() {},
    MeasuringStrategy: { Always: 'always' },
    useSensor,
    useSensors: (...sensors: unknown[]) => sensors,
  }
})

const motionBoundary = vi.hoisted(() => ({
  values: [] as Array<{ get: () => number; set: ReturnType<typeof vi.fn> }>,
  reset() { this.values.length = 0 },
}))

vi.mock('motion/react', async () => {
  const React = await import('react')
  const createValue = (initial: number) => {
    let value = initial
    const result = { get: () => value, set: vi.fn((next: number) => { value = next }) }
    motionBoundary.values.push(result)
    return result
  }
  const Div = React.forwardRef<HTMLDivElement, Record<string, unknown>>((allProps, ref) => {
    const { children, style, ...props } = allProps
    const domStyle = Object.fromEntries(Object.entries((style ?? {}) as CSSProperties)
      .filter(([, value]) => typeof value !== 'object')) as CSSProperties
    return React.createElement('div', { ...props, ref, style: domStyle }, children as ReactNode)
  })
  return {
    motion: { div: Div },
    useMotionValue: (initial: number) => {
      const ref = React.useRef<ReturnType<typeof createValue> | null>(null)
      if (!ref.current) ref.current = createValue(initial)
      return ref.current
    },
    motionValue: createValue,
  }
})

vi.mock('liquid-gooey', async () => {
  const React = await import('react')
  const Item = ({ children }: { children?: ReactNode }) => React.createElement('div', null, children)
  const Liquid = Object.assign(
    ({ children }: { children?: ReactNode }) => React.createElement('div', { 'data-testid': 'liquid' }, children),
    { Item },
  )
  return { Liquid }
})

import { SiteDragProvider } from '../../src/templates/bubble/components/SiteDragProvider'
import { ArrivalFeedbackContext, PendingArrivalContext, SiteDragEnabledContext } from '../../src/templates/bubble/drag/context'
import { BubbleRuntimeContext } from '../../src/templates/bubble/runtime'

const modules: Module[] = [
  {
    id: 'a', title: '分类 A', description: '', accent: '#9ff7cd',
    sites: [{ id: 'alpha', name: 'Alpha', url: 'https://example.com/alpha', description: 'Alpha 说明' }],
  },
  { id: 'b', title: '分类 B', description: '', accent: '#b9b6ff', sites: [] },
]

type DndCallbacks = {
  onDragStart: (event: Record<string, unknown>) => void
  onDragOver: (event: Record<string, unknown>) => void
  onDragEnd: (event: Record<string, unknown>) => void
  onDragCancel: () => void
  accessibility: {
    screenReaderInstructions: { draggable: string }
    announcements: Record<string, (event: Record<string, unknown>) => string>
  }
}

function callbacks() {
  return dnd.contexts.at(-1) as unknown as DndCallbacks
}

function Probe() {
  const enabled = useContext(SiteDragEnabledContext)
  const pending = useContext(PendingArrivalContext)
  const feedback = useContext(ArrivalFeedbackContext)
  return (
    <div>
      <output data-testid="enabled">{String(enabled)}</output>
      <output data-testid="pending">{pending ? `${pending.moduleId}/${pending.siteId}/${pending.variant}` : 'none'}</output>
      <output data-testid="feedback">{feedback ? `${feedback.moduleId}/${feedback.siteId}/${feedback.variant}` : 'none'}</output>
      <div className="module-panel" data-module-id="a"><div className="bubble-shell" /></div>
      <div className="module-panel" data-module-id="b"><div className="bubble-shell" /></div>
      <div className="site-tile-wrap" data-site-id="alpha" data-module-id="a" data-variant="module">
        <a href="#alpha"><span className="site-icon" /></a>
      </div>
    </div>
  )
}

function Harness({
  enabled = true,
  currentModules = modules,
  onMove = vi.fn(() => true),
  onInteractionStateChange = vi.fn(),
}: {
  enabled?: boolean
  currentModules?: readonly Module[]
  onMove?: (move: { siteId: string; fromModuleId: string; toModuleId: string; toIndex?: number }) => boolean
  onInteractionStateChange?: (state: TemplateInteractionState) => void
}) {
  const root = useRef<HTMLDivElement>(null)
  return (
    <BubbleRuntimeContext.Provider value={{ root, blocked: false }}>
      <div ref={root}>
        <SiteDragProvider modules={currentModules} enabled={enabled} onMove={onMove} onInteractionStateChange={onInteractionStateChange}>
          <Probe />
        </SiteDragProvider>
      </div>
    </BubbleRuntimeContext.Provider>
  )
}

function active(overrides: Record<string, unknown> = {}) {
  return {
    id: 'drag-alpha',
    data: { current: { type: 'site', siteId: 'alpha', moduleId: 'a', variant: 'module' } },
    rect: {
      current: {
        initial: { left: 10, top: 20, width: 64, height: 70 },
        translated: { left: 420, top: 20, width: 64, height: 70 },
      },
    },
    ...overrides,
  }
}

function mouseActivator(target?: Element) {
  const event = new MouseEvent('mousedown', { clientX: 30, clientY: 40, bubbles: true })
  if (target) Object.defineProperty(event, 'target', { configurable: true, value: target })
  return event
}

beforeEach(() => {
  installDomStubs()
  setDocumentVisibility('visible')
  dnd.reset()
  motionBoundary.reset()
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1280 })
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: function getBoundingClientRect(this: HTMLElement) {
      if (this.dataset.moduleId === 'b' || this.closest('[data-module-id="b"]')) {
        return { x: 400, y: 0, left: 400, top: 0, right: 700, bottom: 300, width: 300, height: 300, toJSON: () => ({}) }
      }
      if (this.classList.contains('site-icon')) {
        return { x: 20, y: 20, left: 20, top: 20, right: 66, bottom: 66, width: 46, height: 46, toJSON: () => ({}) }
      }
      return { x: 0, y: 0, left: 0, top: 0, right: 300, bottom: 300, width: 300, height: 300, toJSON: () => ({}) }
    },
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('SiteDragProvider', () => {
  it('配置鼠标、触摸和键盘拖拽契约，并通过可访问播报描述结果', () => {
    render(<Harness />)
    expect(dnd.sensors).toEqual(expect.arrayContaining([
      expect.objectContaining({ options: { activationConstraint: { distance: 8 } } }),
      expect.objectContaining({ options: { activationConstraint: { delay: 220, tolerance: 8 } } }),
      expect.objectContaining({ options: expect.objectContaining({ keyboardCodes: { start: ['Space'], cancel: ['Escape', 'Tab'], end: ['Space', 'Enter'] } }) }),
    ]))
    const accessibility = callbacks().accessibility
    expect(accessibility.screenReaderInstructions.draggable).toContain('按空格提起站点')
    expect(accessibility.announcements.onDragStart({ active: active() })).toContain('Alpha')
    expect(accessibility.announcements.onDragOver({ active: active(), over: null })).toBe('当前没有可接收的分类。')
    expect(accessibility.announcements.onDragCancel({})).toBe('已取消移动。')
  })

  it('禁用时不开始拖拽；启用后显示无液态降级预览并在取消时释放', () => {
    const report = vi.fn()
    const view = render(<Harness enabled={false} onInteractionStateChange={report} />)
    act(() => callbacks().onDragStart({ active: active(), activatorEvent: mouseActivator() }))
    expect(report).not.toHaveBeenCalled()
    expect(screen.getByTestId('enabled').textContent).toBe('false')
    expect(screen.queryByText('Alpha', { selector: '.site-drag-preview strong' })).toBeNull()

    view.rerender(<Harness enabled onInteractionStateChange={report} />)
    act(() => callbacks().onDragStart({ active: active(), activatorEvent: mouseActivator() }))
    expect(report).toHaveBeenLastCalledWith({ dragging: true, settling: false })
    expect(screen.getByText('Alpha', { selector: '.site-drag-preview strong' })).not.toBeNull()
    act(() => callbacks().onDragCancel())
    expect(report).toHaveBeenLastCalledWith({ dragging: false, settling: false })
    expect(screen.queryByText('Alpha', { selector: '.site-drag-preview strong' })).toBeNull()
  })

  it('有效跨分类 drop 只调用一次 move，并在无液态降级下短暂上报 settling/arrival feedback', () => {
    vi.useFakeTimers()
    const onMove = vi.fn(() => true)
    const states: TemplateInteractionState[] = []
    render(<Harness onMove={onMove} onInteractionStateChange={(state) => states.push(state)} />)
    const drag = active()
    act(() => callbacks().onDragStart({ active: drag, activatorEvent: mouseActivator() }))
    act(() => callbacks().onDragEnd({ active: drag, over: { id: 'b', data: { current: { type: 'module', moduleId: 'b' } } } }))

    expect(onMove).toHaveBeenCalledWith({ siteId: 'alpha', fromModuleId: 'a', toModuleId: 'b' })
    expect(screen.getByTestId('feedback').textContent).toBe('b/alpha/module')
    expect(states).toContainEqual({ dragging: false, settling: true })
    act(() => vi.advanceTimersByTime(450))
    expect(screen.getByTestId('feedback').textContent).toBe('none')
    expect(states.at(-1)).toEqual({ dragging: false, settling: false })
  })

  it.each([
    ['无目标', null],
    ['非分类目标', { id: 'other', data: { current: { type: 'site' } } }],
  ])('%s drop 不调用业务移动且不产生到达反馈', (_label, over) => {
    const onMove = vi.fn(() => true)
    render(<Harness onMove={onMove} />)
    const drag = active()
    act(() => callbacks().onDragStart({ active: drag, activatorEvent: mouseActivator() }))
    act(() => callbacks().onDragEnd({ active: drag, over }))
    expect(onMove).not.toHaveBeenCalled()
    expect(screen.getByTestId('feedback').textContent).toBe('none')
  })

  it('原分类 drop 交给业务回调判定，返回 false 时不产生到达反馈', () => {
    const onMove = vi.fn(() => false)
    render(<Harness onMove={onMove} />)
    const drag = active()
    act(() => callbacks().onDragStart({ active: drag, activatorEvent: mouseActivator() }))
    act(() => callbacks().onDragEnd({
      active: drag,
      over: { id: 'a', data: { current: { type: 'module', moduleId: 'a' } } },
    }))
    expect(onMove).toHaveBeenCalledWith({ siteId: 'alpha', fromModuleId: 'a', toModuleId: 'a' })
    expect(screen.getByTestId('feedback').textContent).toBe('none')
  })

  it('业务 move 返回 false 时按失败 drop 处理', () => {
    const onMove = vi.fn(() => false)
    render(<Harness onMove={onMove} />)
    const drag = active()
    act(() => callbacks().onDragStart({ active: drag, activatorEvent: mouseActivator() }))
    act(() => callbacks().onDragEnd({ active: drag, over: { id: 'b', data: { current: { type: 'module', moduleId: 'b' } } } }))
    expect(onMove).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('feedback').textContent).toBe('none')
  })

  it('键盘 drop 使用 translated center 识别真实分类，不依赖迟到的 over', () => {
    const onMove = vi.fn(() => true)
    render(<Harness onMove={onMove} />)
    const drag = active()
    act(() => callbacks().onDragStart({ active: drag, activatorEvent: new KeyboardEvent('keydown', { key: ' ' }) }))
    act(() => callbacks().onDragEnd({ active: drag, over: { id: 'a', data: { current: { type: 'module', moduleId: 'a' } } } }))
    expect(onMove).toHaveBeenCalledWith({ siteId: 'alpha', fromModuleId: 'a', toModuleId: 'b' })
    expect(screen.getByTestId('feedback').textContent).toBe('none')
  })

  it('关闭 enabled 会立即释放输入预览和 dragging 锁', () => {
    const report = vi.fn()
    const view = render(<Harness onInteractionStateChange={report} />)
    act(() => callbacks().onDragStart({ active: active(), activatorEvent: mouseActivator() }))
    report.mockClear()
    view.rerender(<Harness enabled={false} onInteractionStateChange={report} />)
    expect(screen.queryByText('Alpha', { selector: '.site-drag-preview strong' })).toBeNull()
    expect(report).toHaveBeenCalledWith({ dragging: false, settling: false })
  })

  it('液态能力可用时创建装饰层；reduced-motion 动态变化会释放旧液态会话并回退预览', () => {
    const media = installDomStubs(false)
    vi.stubGlobal('SVGFEGaussianBlurElement', class SVGFEGaussianBlurElement {})
    vi.stubGlobal('SVGFEColorMatrixElement', class SVGFEColorMatrixElement {})
    vi.mocked(CSS.supports).mockReturnValue(true)
    const view = render(<Harness />)
    const target = view.container.querySelector('.site-tile-wrap')!
    act(() => callbacks().onDragStart({ active: active(), activatorEvent: mouseActivator(target) }))
    expect(document.body.querySelector('.liquid-drag-layer')).not.toBeNull()
    expect(screen.queryByText('Alpha', { selector: '.site-drag-preview strong' })).toBeNull()

    act(() => media.setMatches(true))
    expect(document.body.querySelector('.liquid-drag-layer')).toBeNull()
    expect(screen.getByText('Alpha', { selector: '.site-drag-preview strong' })).not.toBeNull()
  })

  it('拖拽中的指针移动更新液态图层位置，且离开目标分类会清除目标状态', () => {
    vi.useFakeTimers()
    vi.stubGlobal('SVGFEGaussianBlurElement', class SVGFEGaussianBlurElement {})
    vi.stubGlobal('SVGFEColorMatrixElement', class SVGFEColorMatrixElement {})
    vi.mocked(CSS.supports).mockReturnValue(true)
    render(<Harness />)
    const target = document.querySelector('.site-tile-wrap')!
    const drag = active()
    act(() => callbacks().onDragStart({ active: drag, activatorEvent: mouseActivator(target) }))
    act(() => document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 123, clientY: 234 })))
    expect(motionBoundary.values.some(value => value.set.mock.calls.some(([next]) => next === 136))).toBe(true)
    expect(motionBoundary.values.some(value => value.set.mock.calls.some(([next]) => next === 237))).toBe(true)

    act(() => callbacks().onDragOver({
      active: drag,
      over: { id: 'b', data: { current: { type: 'module', moduleId: 'b' } } },
    }))
    act(() => callbacks().onDragOver({
      active: drag,
      over: { id: 'a', data: { current: { type: 'module', moduleId: 'a' } } },
    }))
    act(() => callbacks().onDragCancel())
    act(() => vi.advanceTimersByTime(360))
    expect(screen.getByTestId('pending').textContent).toBe('none')
    expect(document.body.querySelector('.liquid-drag-layer')).toBeNull()
  })

  it('同一输入重复开始拖拽时只保留一个液态会话', () => {
    vi.useFakeTimers()
    vi.stubGlobal('SVGFEGaussianBlurElement', class SVGFEGaussianBlurElement {})
    vi.stubGlobal('SVGFEColorMatrixElement', class SVGFEColorMatrixElement {})
    vi.mocked(CSS.supports).mockReturnValue(true)
    render(<Harness />)
    const target = document.querySelector('.site-tile-wrap')!
    const drag = active()
    act(() => callbacks().onDragStart({ active: drag, activatorEvent: mouseActivator(target) }))
    const first = document.body.querySelector('.liquid-drag-layer')
    act(() => callbacks().onDragStart({ active: drag, activatorEvent: mouseActivator(target) }))
    expect(document.body.querySelectorAll('.liquid-drag-layer')).toHaveLength(1)
    expect(document.body.querySelector('.liquid-drag-layer')).not.toBe(first)
    act(() => callbacks().onDragCancel())
    act(() => vi.advanceTimersByTime(360))
    expect(document.body.querySelector('.liquid-drag-layer')).toBeNull()
  })

  it('页面隐藏和站点被删除都会释放液态会话，卸载清理 portal、监听和活动状态', () => {
    vi.stubGlobal('SVGFEGaussianBlurElement', class SVGFEGaussianBlurElement {})
    vi.stubGlobal('SVGFEColorMatrixElement', class SVGFEColorMatrixElement {})
    vi.mocked(CSS.supports).mockReturnValue(true)
    const report = vi.fn()
    const removeDocument = vi.spyOn(document, 'removeEventListener')
    const view = render(<Harness onInteractionStateChange={report} />)
    const target = view.container.querySelector('.site-tile-wrap')!
    act(() => callbacks().onDragStart({ active: active(), activatorEvent: mouseActivator(target) }))
    expect(document.body.querySelector('.liquid-drag-layer')).not.toBeNull()

    setDocumentVisibility('hidden')
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(document.body.querySelector('.liquid-drag-layer')).toBeNull()

    setDocumentVisibility('visible')
    act(() => callbacks().onDragStart({ active: active(), activatorEvent: mouseActivator(target) }))
    view.rerender(<Harness currentModules={[{ ...modules[0], sites: [] }, modules[1]]} onInteractionStateChange={report} />)
    expect(document.body.querySelector('.liquid-drag-layer')).toBeNull()

    act(() => callbacks().onDragStart({ active: active(), activatorEvent: mouseActivator() }))
    report.mockClear()
    view.unmount()
    expect(document.body.querySelector('.bubble-portals')).toBeNull()
    expect(removeDocument).toHaveBeenCalledWith('mousemove', expect.any(Function), true)
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    expect(report).toHaveBeenCalledWith({ dragging: false, settling: false })
  })
})
