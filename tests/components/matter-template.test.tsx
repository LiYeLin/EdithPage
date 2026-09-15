// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NavigationActions, NavigationTemplateProps } from '../../src/templates/types'
import type { Module } from '../../src/types'
import { installDomStubs, setDocumentVisibility } from './testEnvironment'

const matter = vi.hoisted(() => {
  let nextBodyId = 0
  let afterUpdate: (() => void) | null = null
  const body = (x: number, y: number, options: Record<string, unknown> = {}) => ({
    id: ++nextBodyId,
    position: { x, y },
    angle: Number(options.angle ?? 0),
  })
  const api = {
    Engine: {
      create: vi.fn(() => ({ world: { bodies: [] }, gravity: { y: 0 } })),
      clear: vi.fn(),
    },
    Render: {
      create: vi.fn(({ element, engine, options }: { element: HTMLElement; engine: unknown; options: unknown }) => {
        const canvas = document.createElement('canvas')
        element.append(canvas)
        return { canvas, engine, options }
      }),
      setSize: vi.fn(),
      run: vi.fn(),
      stop: vi.fn(),
    },
    Runner: {
      create: vi.fn(() => ({ id: 'runner' })),
      run: vi.fn(),
      stop: vi.fn(),
    },
    Bodies: {
      rectangle: vi.fn((x: number, y: number, _width: number, _height: number, options?: Record<string, unknown>) => body(x, y, options)),
      polygon: vi.fn((x: number, y: number, _sides: number, _radius: number, options?: Record<string, unknown>) => body(x, y, options)),
    },
    Composite: {
      add: vi.fn(),
      clear: vi.fn(),
    },
    Events: {
      on: vi.fn((_engine: unknown, event: string, callback: () => void) => {
        if (event === 'afterUpdate') afterUpdate = callback
      }),
      off: vi.fn(),
    },
    Body: {
      setPosition: vi.fn((target: { position: { x: number; y: number } }, position: { x: number; y: number }) => { target.position = position }),
      setVelocity: vi.fn(),
      setAngularVelocity: vi.fn(),
    },
    Sleeping: { set: vi.fn() },
    emitAfterUpdate: () => afterUpdate?.(),
    reset: () => { nextBodyId = 0; afterUpdate = null },
  }
  return api
})

vi.mock('matter-js', () => ({ default: matter }))

import MatterTemplate from '../../src/templates/matter/MatterTemplate'

const modules: Module[] = [
  {
    id: 'tools', title: '工具', description: '常用工具', accent: '#9ff7cd',
    sites: [
      { id: 'alpha', name: 'Alpha', url: 'https://example.com/alpha', description: 'Alpha 说明' },
      { id: 'beta', name: 'Beta', url: 'https://example.com/beta', description: 'Beta 说明' },
    ],
  },
]

function actions(overrides: Partial<NavigationActions> = {}): NavigationActions {
  return {
    enterEditMode: vi.fn(), openSettings: vi.fn(), addSite: vi.fn(), edit: vi.fn(),
    removeSite: vi.fn(), removeModule: vi.fn(), moveSite: vi.fn(() => true), visitSite: vi.fn(),
    ...overrides,
  }
}

function props(overrides: Partial<NavigationTemplateProps> = {}): NavigationTemplateProps {
  return {
    modules,
    frequentSites: [],
    editing: false,
    interactionBlocked: false,
    revealSite: null,
    actions: actions(),
    onInteractionStateChange: vi.fn(),
    ...overrides,
  }
}

function icon(name = 'Alpha') {
  return screen.getByLabelText(`${name}物理图标`)
}

function begin(site = icon(), pointerId = 7) {
  fireEvent.pointerDown(site, {
    pointerId,
    pointerType: 'mouse',
    button: 0,
    clientX: 110,
    clientY: 130,
  })
}

beforeEach(() => {
  installDomStubs()
  setDocumentVisibility('visible')
  matter.reset()
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 })
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ x: 10, y: 20, left: 10, top: 20, right: 810, bottom: 620, width: 800, height: 600, toJSON: () => ({}) }),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('MatterTemplate', () => {
  it('保留可访问编辑入口、真实站点链接和装饰性 hover 名称', () => {
    const templateActions = actions()
    const { container } = render(<MatterTemplate {...props({ actions: templateActions })} />)

    expect(screen.getByRole('region', { name: '物理图标导航模板' })).not.toBeNull()
    const entry = screen.getByRole('button', { name: '进入编辑模式' })
    expect(entry.hasAttribute('data-onboarding-edit')).toBe(true)
    fireEvent.click(entry)
    expect(templateActions.enterEditMode).toHaveBeenCalledTimes(1)

    const link = screen.getByRole('link', { name: 'Alpha，打开站点' })
    expect(link.getAttribute('href')).toBe('https://example.com/alpha')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
    expect(link.querySelector('img')?.draggable).toBe(false)
    const label = icon().querySelector('.matter-icon-name')
    expect(label?.textContent).toBe('Alpha')
    expect(label?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true')

    fireEvent.click(link)
    expect(templateActions.visitSite).toHaveBeenCalledWith('alpha')
  })

  it('阻塞时禁用编辑入口并忽略 pointer 开始；编辑态公开编辑与删除动作', () => {
    const blockedActions = actions()
    const { rerender } = render(<MatterTemplate {...props({ interactionBlocked: true, actions: blockedActions })} />)
    expect((screen.getByRole('button', { name: '进入编辑模式' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByLabelText('网站图标物理舞台').classList.contains('is-blocked')).toBe(true)
    begin()
    expect(blockedActions.visitSite).not.toHaveBeenCalled()
    expect((blockedActions as NavigationActions).enterEditMode).not.toHaveBeenCalled()

    const editingActions = actions()
    rerender(<MatterTemplate {...props({ editing: true, actions: editingActions })} />)
    expect(screen.queryByRole('button', { name: '进入编辑模式' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '编辑 Alpha' }))
    fireEvent.click(screen.getByRole('button', { name: '删除 Alpha' }))
    expect(editingActions.edit).toHaveBeenCalledWith({ type: 'site', moduleId: 'tools', siteId: 'alpha' })
    expect(editingActions.removeSite).toHaveBeenCalledWith('tools', 'alpha')
  })

  it('简单 pointer tap 显式访问并触发锚点点击，但只记录一次访问', () => {
    const templateActions = actions()
    render(<MatterTemplate {...props({ actions: templateActions })} />)
    const link = screen.getByRole('link', { name: 'Alpha，打开站点' }) as HTMLAnchorElement
    const click = vi.spyOn(link, 'click').mockImplementation(() => {})

    begin()
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, bubbles: true }))

    expect(templateActions.visitSite).toHaveBeenCalledTimes(1)
    expect(templateActions.visitSite).toHaveBeenCalledWith('alpha')
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('拖拽通过全局 pointermove 更新位置，结束后释放并抑制 trailing click', () => {
    const templateActions = actions()
    const report = vi.fn()
    vi.spyOn(performance, 'now').mockReturnValue(1_000)
    render(<MatterTemplate {...props({ actions: templateActions, onInteractionStateChange: report })} />)
    report.mockClear()
    const link = screen.getByRole('link', { name: 'Alpha，打开站点' })

    begin()
    expect(report).toHaveBeenLastCalledWith({ dragging: true, settling: false })
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: 160, clientY: 180, bubbles: true, cancelable: true }))
    expect(matter.Body.setPosition).toHaveBeenCalled()
    expect(matter.Body.setVelocity).toHaveBeenLastCalledWith(expect.anything(), { x: 0, y: 0 })
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, bubbles: true }))
    expect(report).toHaveBeenLastCalledWith({ dragging: false, settling: false })

    const trailingClick = new MouseEvent('click', { bubbles: true, cancelable: true })
    expect(link.dispatchEvent(trailingClick)).toBe(false)
    expect(templateActions.visitSite).not.toHaveBeenCalled()
  })

  it.each(['pointercancel', 'blur', 'visibilitychange'] as const)('%s 会取消交互并阻止随后点击', (kind) => {
    const templateActions = actions()
    const report = vi.fn()
    vi.spyOn(performance, 'now').mockReturnValue(2_000)
    render(<MatterTemplate {...props({ actions: templateActions, onInteractionStateChange: report })} />)
    report.mockClear()
    begin()

    if (kind === 'pointercancel') {
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 7, bubbles: true }))
    } else if (kind === 'blur') {
      window.dispatchEvent(new Event('blur'))
    } else {
      setDocumentVisibility('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
    }

    expect(report).toHaveBeenLastCalledWith({ dragging: false, settling: false })
    const link = screen.getByRole('link', { name: 'Alpha，打开站点' })
    expect(link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))).toBe(false)
    expect(templateActions.visitSite).not.toHaveBeenCalled()
  })

  it('普通元素间 pointerout 不取消；离开 viewport 才清理拖拽', () => {
    const report = vi.fn()
    render(<MatterTemplate {...props({ onInteractionStateChange: report })} />)
    report.mockClear()
    begin()
    const related = document.createElement('div')
    document.body.append(related)
    document.dispatchEvent(new PointerEvent('pointerout', { pointerId: 7, bubbles: true, relatedTarget: related }))
    expect(report).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenLastCalledWith({ dragging: true, settling: false })

    document.dispatchEvent(new PointerEvent('pointerout', { pointerId: 7, bubbles: true, relatedTarget: null }))
    expect(report).toHaveBeenLastCalledWith({ dragging: false, settling: false })
    related.remove()
  })

  it('忽略非左键鼠标、编辑操作目标和并发第二指针', () => {
    const report = vi.fn()
    const templateActions = actions()
    render(<MatterTemplate {...props({ editing: true, actions: templateActions, onInteractionStateChange: report })} />)
    report.mockClear()
    fireEvent.pointerDown(icon(), { pointerId: 1, pointerType: 'mouse', button: 2, clientX: 110, clientY: 130 })
    expect(report).not.toHaveBeenCalled()
    fireEvent.pointerDown(screen.getByRole('button', { name: '编辑 Alpha' }), { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 110, clientY: 130 })
    expect(report).not.toHaveBeenCalled()

    begin(icon(), 3)
    fireEvent.pointerDown(icon('Beta'), { pointerId: 4, pointerType: 'mouse', button: 0, clientX: 210, clientY: 230 })
    expect(report).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 4, bubbles: true }))
    expect(report).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 3, bubbles: true }))
  })

  it('尺寸变化同步画布和边界；卸载完整释放 Matter、观察器、画布和交互状态', () => {
    const report = vi.fn()
    const { container, unmount } = render(<MatterTemplate {...props({ onInteractionStateChange: report })} />)
    const Observer = globalThis.ResizeObserver as typeof ResizeObserver & { instances: Array<{ callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }> }
    const observer = Observer.instances[0]
    matter.Render.setSize.mockClear()
    matter.Body.setPosition.mockClear()
    observer.callback([], observer as unknown as ResizeObserver)
    expect(matter.Render.setSize).toHaveBeenCalledWith(expect.anything(), 800, 600)
    expect(matter.Body.setPosition).toHaveBeenCalledTimes(4)

    begin()
    report.mockClear()
    const canvas = container.querySelector('canvas')!
    unmount()
    expect(observer.disconnect).toHaveBeenCalledTimes(1)
    expect(matter.Events.off).toHaveBeenCalledWith(expect.anything(), 'afterUpdate', expect.any(Function))
    expect(matter.Render.stop).toHaveBeenCalledTimes(1)
    expect(matter.Runner.stop).toHaveBeenCalledTimes(1)
    expect(matter.Composite.clear).toHaveBeenCalledWith(expect.anything(), false)
    expect(matter.Engine.clear).toHaveBeenCalledTimes(1)
    expect(canvas.isConnected).toBe(false)
    expect(report).toHaveBeenCalledWith({ dragging: false, settling: false })
  })

  it('没有站点时保留空状态且不创建物理站点 body', () => {
    render(<MatterTemplate {...props({ modules: [] })} />)
    expect(screen.getByText('还没有网站，打开编辑模式添加一个吧')).not.toBeNull()
    expect(screen.queryByLabelText(/物理图标$/)).toBeNull()
    const firstAdd = matter.Composite.add.mock.calls[0]?.[1]
    expect(firstAdd).toEqual([])
  })
})
