// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef, type CSSProperties, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NavigationActions, NavigationTemplateProps, TemplateInteractionState } from '../../src/templates/types'
import type { Module, Site } from '../../src/types'
import { installDomStubs } from './testEnvironment'

const dnd = vi.hoisted(() => ({
  contexts: [] as Array<Record<string, unknown>>,
  draggable: vi.fn(),
  droppable: vi.fn(),
  active: null as null | { data: { current?: Record<string, unknown> } },
  isDragging: false,
  isOver: false,
  reset() {
    this.contexts.length = 0
    this.draggable.mockReset()
    this.droppable.mockReset()
    this.active = null
    this.isDragging = false
    this.isOver = false
  },
}))

vi.mock('@dnd-kit/core', async () => {
  const React = await import('react')
  const DndContext = (props: Record<string, unknown> & { children?: ReactNode }) => {
    dnd.contexts.push(props)
    return React.createElement('div', { 'data-testid': 'dnd-context' }, props.children)
  }
  const DragOverlay = ({ children }: { children?: ReactNode }) => React.createElement('div', { 'data-testid': 'drag-overlay' }, children)
  const useDraggable = (options: Record<string, unknown>) => {
    dnd.draggable(options)
    return {
      attributes: { 'data-dnd-draggable': 'true' },
      listeners: { onKeyDown: vi.fn() },
      setNodeRef: vi.fn(),
      setActivatorNodeRef: vi.fn(),
      isDragging: dnd.isDragging,
    }
  }
  const useDroppable = (options: Record<string, unknown>) => {
    dnd.droppable(options)
    return { setNodeRef: vi.fn(), isOver: dnd.isOver }
  }
  return {
    DndContext,
    DragOverlay,
    MouseSensor: function MouseSensor() {},
    TouchSensor: function TouchSensor() {},
    KeyboardSensor: function KeyboardSensor() {},
    MeasuringStrategy: { Always: 'always' },
    useSensor: (sensor: unknown, options: unknown) => ({ sensor, options }),
    useSensors: (...sensors: unknown[]) => sensors,
    useDraggable,
    useDroppable,
    useDndContext: () => ({ active: dnd.active }),
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
    const result = {
      get: () => value,
      set: vi.fn((next: number) => { value = next }),
    }
    motionBoundary.values.push(result)
    return result
  }
  const make = (tag: 'div' | 'section') => React.forwardRef<HTMLElement, Record<string, unknown>>((allProps, ref) => {
    const { children, layout: _layout, transition: _transition, style, ...props } = allProps
    void _layout
    void _transition
    const domStyle = Object.fromEntries(Object.entries((style ?? {}) as CSSProperties)
      .filter(([, value]) => typeof value !== 'object')) as CSSProperties
    return React.createElement(tag, { ...props, ref, style: domStyle }, children as ReactNode)
  })
  return {
    motion: { div: make('div'), section: make('section') },
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
  const Item = ({ children }: { children?: ReactNode }) => React.createElement('div', { 'data-liquid-item': 'true' }, children)
  const Liquid = Object.assign(
    ({ children, className }: { children?: ReactNode; className?: string }) => React.createElement('div', { className }, children),
    { Item },
  )
  return { Liquid }
})

import BubbleTemplate from '../../src/templates/bubble/BubbleTemplate'
import { BubbleRuntimeContext } from '../../src/templates/bubble/runtime'
import { ArrivalFeedbackContext, PendingArrivalContext, SiteDragEnabledContext } from '../../src/templates/bubble/drag/context'
import { FrequentSites } from '../../src/templates/bubble/components/FrequentSites'
import { ModulePanel } from '../../src/templates/bubble/components/ModulePanel'
import { SiteTile } from '../../src/templates/bubble/components/SiteTile'

const alpha: Site = { id: 'alpha', name: 'Alpha', url: 'https://example.com/alpha', description: 'Alpha 说明' }
const beta: Site = { id: 'beta', name: 'Beta', url: 'https://example.com/beta', description: 'Beta 说明' }
const baseModules: Module[] = [
  { id: 'a', title: '分类 A', description: '说明 A', accent: '#9ff7cd', sites: [alpha, beta] },
  { id: 'b', title: '分类 B', description: '说明 B', accent: '#b9b6ff', sites: [] },
]

function actions(overrides: Partial<NavigationActions> = {}): NavigationActions {
  return {
    enterEditMode: vi.fn(), openSettings: vi.fn(), addSite: vi.fn(), edit: vi.fn(),
    removeSite: vi.fn(), removeModule: vi.fn(), moveSite: vi.fn(() => true), visitSite: vi.fn(),
    ...overrides,
  }
}

function templateProps(overrides: Partial<NavigationTemplateProps> = {}): NavigationTemplateProps {
  return {
    modules: baseModules,
    frequentSites: [{ moduleId: 'a', site: alpha }],
    editing: false,
    interactionBlocked: false,
    revealSite: null,
    actions: actions(),
    onInteractionStateChange: vi.fn(),
    ...overrides,
  }
}

function runtime(children: ReactNode, blocked = false) {
  const root = createRef<HTMLDivElement>()
  return (
    <BubbleRuntimeContext.Provider value={{ root, blocked }}>
      <div ref={root}>{children}</div>
    </BubbleRuntimeContext.Provider>
  )
}

function tile(overrides: Partial<React.ComponentProps<typeof SiteTile>> = {}) {
  return (
    <SiteDragEnabledContext.Provider value={overrides.isEditing ?? false}>
      <PendingArrivalContext.Provider value={null}>
        <ArrivalFeedbackContext.Provider value={null}>
          <SiteTile
            site={alpha}
            moduleId="a"
            variant="module"
            index={0}
            isEditing={false}
            onEnterEditMode={vi.fn()}
            onEdit={vi.fn()}
            onRemove={vi.fn()}
            onVisit={vi.fn()}
            {...overrides}
          />
        </ArrivalFeedbackContext.Provider>
      </PendingArrivalContext.Provider>
    </SiteDragEnabledContext.Provider>
  )
}

beforeEach(() => {
  installDomStubs()
  dnd.reset()
  motionBoundary.reset()
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1280 })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 320 })
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: function getBoundingClientRect(this: HTMLElement) {
      const width = this.classList.contains('site-icon') ? 46 : this.classList.contains('bubble-shell') ? 300 : 100
      return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: width, width, height: width, toJSON: () => ({}) }
    },
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('SiteTile 与 FrequentSites', () => {
  it('浏览态保留真实链接、记录访问，长按进入编辑并消费随后点击', () => {
    vi.useFakeTimers()
    const onVisit = vi.fn()
    const onEnterEditMode = vi.fn()
    render(tile({ onVisit, onEnterEditMode }))
    const link = screen.getByRole('link', { name: 'Alpha：Alpha 说明' })
    expect(link.getAttribute('href')).toBe('https://example.com/alpha')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
    expect((link as HTMLAnchorElement).draggable).toBe(false)
    fireEvent.click(link)
    expect(onVisit).toHaveBeenCalledTimes(1)

    onVisit.mockClear()
    fireEvent.pointerDown(link, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 10, clientY: 10 })
    act(() => vi.advanceTimersByTime(500))
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    expect(link.dispatchEvent(click)).toBe(false)
    expect(onEnterEditMode).toHaveBeenCalledTimes(1)
    expect(onVisit).not.toHaveBeenCalled()
  })

  it('编辑态公开 DnD 语义、点击编辑和独立删除；pending/feedback 只改变该实例', () => {
    dnd.isDragging = true
    const onEdit = vi.fn()
    const onRemove = vi.fn()
    const onVisit = vi.fn()
    render(
      <SiteDragEnabledContext.Provider value>
        <PendingArrivalContext.Provider value={{ siteId: 'alpha', moduleId: 'a', variant: 'module' }}>
          <ArrivalFeedbackContext.Provider value={{ siteId: 'alpha', moduleId: 'a', variant: 'module' }}>
            <SiteTile site={alpha} moduleId="a" variant="module" index={3} isEditing onEnterEditMode={vi.fn()}
              onEdit={onEdit} onRemove={onRemove} onVisit={onVisit} />
          </ArrivalFeedbackContext.Provider>
        </PendingArrivalContext.Provider>
      </SiteDragEnabledContext.Provider>,
    )
    const link = screen.getByRole('link', { name: '编辑 Alpha', hidden: true })
    const wrapper = link.closest('.site-tile-wrap')!
    expect(wrapper.classList.contains('is-drag-source')).toBe(true)
    expect(wrapper.getAttribute('aria-hidden')).toBe('true')
    expect(wrapper.getAttribute('data-pending-arrival')).toBe('true')
    expect(wrapper.getAttribute('data-arrival-feedback')).toBe('true')
    expect(link.getAttribute('tabindex')).toBe('-1')
    expect(dnd.draggable).toHaveBeenCalledWith(expect.objectContaining({ disabled: false, data: { type: 'site', siteId: 'alpha', moduleId: 'a', variant: 'module' } }))

    fireEvent.click(link)
    fireEvent.click(screen.getByRole('button', { name: '删除 Alpha', hidden: true }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onVisit).not.toHaveBeenCalled()
  })

  it('非编辑态禁用拖拽；最常使用列表透传编辑、删除和访问', () => {
    const onEditSite = vi.fn()
    const onRemoveSite = vi.fn()
    const onVisit = vi.fn()
    render(<FrequentSites sites={[{ moduleId: 'a', site: alpha }]} isEditing
      onEnterEditMode={vi.fn()} onEditSite={onEditSite} onRemoveSite={onRemoveSite} onVisit={onVisit} />)
    expect(screen.getByRole('heading', { name: '最常使用' }).nextElementSibling?.textContent).toBe('1')
    fireEvent.click(screen.getByRole('link', { name: '编辑 Alpha' }))
    fireEvent.click(screen.getByRole('button', { name: '删除 Alpha' }))
    expect(onEditSite).toHaveBeenCalledWith('a', 'alpha')
    expect(onRemoveSite).toHaveBeenCalledWith('a', 'alpha')
    expect(onVisit).not.toHaveBeenCalled()
    expect(dnd.draggable).toHaveBeenCalledWith(expect.objectContaining({ disabled: true }))
  })
})

describe('ModulePanel', () => {
  const manySites = Array.from({ length: 15 }, (_, index) => ({
    id: `site-${index}`,
    name: `站点 ${index}`,
    url: `https://example.com/${index}`,
    description: `说明 ${index}`,
  }))
  const module: Module = { id: 'many', title: '多页分类', description: '多页', accent: '#9ff7cd', sites: manySites }

  function panel(overrides: Partial<React.ComponentProps<typeof ModulePanel>> = {}, dragEnabled = false, blocked = false) {
    return runtime(
      <SiteDragEnabledContext.Provider value={dragEnabled}>
        <ModulePanel module={module} revealSite={null} index={0} isEditing={false}
          onEnterEditMode={vi.fn()} onAddSite={vi.fn()} onEditSite={vi.fn()} onEditModule={vi.fn()}
          onRemoveSite={vi.fn()} onRemoveModule={vi.fn()} onVisit={vi.fn()} {...overrides} />
      </SiteDragEnabledContext.Provider>,
      blocked,
    )
  }

  it('长按标题进入编辑；编辑态标题、删除分类和添加站点调用公开回调', () => {
    vi.useFakeTimers()
    const onEnterEditMode = vi.fn()
    const onEditModule = vi.fn()
    const onRemoveModule = vi.fn()
    const onAddSite = vi.fn()
    const { rerender } = render(panel({ onEnterEditMode, onEditModule, onRemoveModule, onAddSite }))
    const title = screen.getByRole('button', { name: '多页分类，长按进入编辑模式' })
    fireEvent.pointerDown(title, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 0, clientY: 0 })
    act(() => vi.advanceTimersByTime(500))
    fireEvent.click(title)
    expect(onEnterEditMode).toHaveBeenCalledTimes(1)
    expect(onEditModule).not.toHaveBeenCalled()

    rerender(panel({ isEditing: true, onEnterEditMode, onEditModule, onRemoveModule, onAddSite }, true))
    fireEvent.click(screen.getByRole('button', { name: '编辑分类 多页分类' }))
    fireEvent.click(screen.getByRole('button', { name: /删除分类 多页分类/ }))
    fireEvent.click(screen.getAllByRole('button', { name: '添加站点到 多页分类' })[0])
    expect(onEditModule).toHaveBeenCalledWith('many')
    expect(onRemoveModule).toHaveBeenCalledWith('many')
    expect(onAddSite).toHaveBeenCalledWith('many')
    expect(dnd.droppable).toHaveBeenLastCalledWith(expect.objectContaining({ disabled: false }))
  })

  it('分页按钮滚动，scroll 事件更新 inert 与页码；revealSite 定位并恢复焦点', () => {
    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => window.setTimeout(() => callback(performance.now()), 16))
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => window.clearTimeout(id))
    const view = render(panel())
    act(() => vi.advanceTimersByTime(20))
    const list = view.container.querySelector('.site-list') as HTMLDivElement
    const pages = view.container.querySelectorAll('.bubble-page')
    expect(pages).toHaveLength(2)
    expect(pages[0].hasAttribute('inert')).toBe(false)
    expect(pages[1].hasAttribute('inert')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: '多页分类 向右滑动' }))
    expect(list.scrollTo).toHaveBeenCalledWith({ left: 320, behavior: 'smooth' })
    list.scrollLeft = 320
    fireEvent.scroll(list)
    expect(screen.getByText('2 / 2')).not.toBeNull()
    expect(pages[0].hasAttribute('inert')).toBe(true)
    expect(pages[1].hasAttribute('inert')).toBe(false)

    view.rerender(panel({ revealSite: { siteId: 'site-14' } }))
    act(() => vi.advanceTimersByTime(40))
    expect(list.scrollTo).toHaveBeenLastCalledWith({ left: 320, behavior: 'instant' })
    expect(screen.getByRole('link', { name: '站点 14：说明 14' })).toBe(document.activeElement)
  })

  it('reduced-motion 使用即时分页；viewport resize 重新计算公开尺寸', () => {
    installDomStubs(true)
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 500 })
    const view = render(panel())
    const section = view.container.querySelector('.module-panel') as HTMLElement
    const compactWidth = section.style.width
    fireEvent.click(screen.getByRole('button', { name: '多页分类 向右滑动' }))
    const list = view.container.querySelector('.site-list') as HTMLDivElement
    expect(list.scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'instant' }))

    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1280 })
    fireEvent(window, new Event('resize'))
    expect(section.style.width).not.toBe(compactWidth)
  })

  it('仅不同分类的活跃拖拽显示为可放置目标', () => {
    dnd.isOver = true
    dnd.active = { data: { current: { moduleId: 'other' } } }
    const view = render(panel({ isEditing: true }, true))
    expect(view.container.querySelector('.module-panel')?.classList.contains('is-drop-target')).toBe(true)
    expect(view.container.querySelector('.bubble-shell')?.getAttribute('data-drop-target')).toBe('true')
  })
})

describe('BubbleTemplate', () => {
  it('组合最常使用与分类行为，编辑/阻塞状态决定拖拽开关', () => {
    const templateActions = actions()
    const report = vi.fn()
    const { container, rerender } = render(<BubbleTemplate {...templateProps({ actions: templateActions, onInteractionStateChange: report })} />)
    const root = container.querySelector('[data-template="bubble"]')!
    expect(root.classList.contains('is-editing')).toBe(false)
    fireEvent.click(screen.getAllByRole('link', { name: 'Alpha：Alpha 说明' })[0])
    expect(templateActions.visitSite).toHaveBeenCalledWith('alpha')
    expect(dnd.draggable).toHaveBeenCalledWith(expect.objectContaining({ disabled: true }))

    dnd.draggable.mockClear()
    rerender(<BubbleTemplate {...templateProps({ editing: true, interactionBlocked: false, actions: templateActions, onInteractionStateChange: report })} />)
    expect(root.classList.contains('is-editing')).toBe(true)
    expect(dnd.draggable).toHaveBeenCalledWith(expect.objectContaining({ disabled: false }))
    fireEvent.click(screen.getAllByRole('link', { name: '编辑 Alpha' })[0])
    expect(templateActions.edit).toHaveBeenCalledWith({ type: 'site', moduleId: 'a', siteId: 'alpha' })

    dnd.draggable.mockClear()
    rerender(<BubbleTemplate {...templateProps({ editing: true, interactionBlocked: true, actions: templateActions, onInteractionStateChange: report })} />)
    expect(dnd.draggable).toHaveBeenCalledWith(expect.objectContaining({ disabled: true }))
  })

  it('DnD 交互上报会同步根节点 dragging class，并在取消后释放', () => {
    const states: TemplateInteractionState[] = []
    const { container } = render(<BubbleTemplate {...templateProps({ editing: true, onInteractionStateChange: (state) => states.push(state) })} />)
    const context = dnd.contexts.at(-1) as {
      onDragStart: (event: Record<string, unknown>) => void
      onDragCancel: () => void
    }
    const anchor = screen.getAllByRole('link', { name: '编辑 Alpha' })[0]
    act(() => context.onDragStart({
      active: {
        data: { current: { type: 'site', siteId: 'alpha', moduleId: 'a', variant: 'frequent' } },
        rect: { current: { initial: { left: 0, top: 0, width: 64, height: 70 } } },
      },
      activatorEvent: new MouseEvent('mousedown', { clientX: 20, clientY: 20 }),
    }))
    expect(container.querySelector('.bubble-template')?.classList.contains('is-site-dragging')).toBe(true)
    expect(states.at(-1)).toEqual({ dragging: true, settling: false })
    act(() => context.onDragCancel())
    expect(container.querySelector('.bubble-template')?.classList.contains('is-site-dragging')).toBe(false)
    expect(states.at(-1)).toEqual({ dragging: false, settling: false })
    expect(anchor).not.toBeNull()
  })
})
