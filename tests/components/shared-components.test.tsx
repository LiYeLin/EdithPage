// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteIcon } from '../../src/components/SiteIcon'
import { FrequentSiteStrip } from '../../src/components/FrequentSiteStrip'
import { SettingsDrawer } from '../../src/components/SettingsDrawer'
import { TemplateHost } from '../../src/templates/TemplateHost'
import type { LoadedTemplate } from '../../src/templates/useTemplateSelection'
import type { NavigationActions, NavigationTemplateProps, TemplateDefinition } from '../../src/templates/types'
import type { NavigationConfig } from '../../src/types'
import { installDomStubs } from './testEnvironment'

const config: NavigationConfig = {
  templateId: 'bubble',
  accent: 'mint',
  modules: [
    {
      id: 'a', title: '分类 A', description: '说明 A', accent: '#9ff7cd',
      sites: [{ id: 'alpha', name: 'Alpha', url: 'https://example.com/alpha', description: 'Alpha 说明' }],
    },
    {
      id: 'b', title: '分类 B', description: '说明 B', accent: '#b9b6ff',
      sites: [{ id: 'beta', name: 'Beta', url: 'https://github.com/', description: 'Beta 说明' }],
    },
  ],
}

function actions(overrides: Partial<NavigationActions> = {}): NavigationActions {
  return {
    enterEditMode: vi.fn(), openSettings: vi.fn(), addSite: vi.fn(), edit: vi.fn(),
    removeSite: vi.fn(), removeModule: vi.fn(), moveSite: vi.fn(() => true), visitSite: vi.fn(),
    ...overrides,
  }
}

function templateProps(overrides: Partial<NavigationTemplateProps> = {}): NavigationTemplateProps {
  return {
    modules: config.modules,
    frequentSites: [{ moduleId: 'a', site: config.modules[0].sites[0] }],
    editing: false,
    interactionBlocked: false,
    revealSite: null,
    actions: actions(),
    onInteractionStateChange: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => installDomStubs())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('SiteIcon', () => {
  it('已知站点优先使用本地图标，并保留尺寸、装饰语义和禁止原生拖拽', () => {
    const { container } = render(<SiteIcon url="https://github.com/openai" name="GitHub" size={32} />)
    const wrapper = container.querySelector('.site-icon') as HTMLElement
    const image = container.querySelector('img') as HTMLImageElement
    expect(wrapper.getAttribute('aria-hidden')).toBe('true')
    expect(wrapper.style.width).toBe('32px')
    expect(wrapper.style.height).toBe('32px')
    expect(image.src).toContain('/site-icons/github.svg')
    expect(image.width).toBe(32)
    expect(image.height).toBe(32)
    expect(image.draggable).toBe(false)
    expect(image.alt).toBe('')
  })

  it('图片失败时按来源顺序降级，最终显示首字母占位', () => {
    const { container } = render(<SiteIcon url="https://github.com/" name="github" />)
    let image = container.querySelector('img')!
    fireEvent.error(image)
    image = container.querySelector('img')!
    expect(image.getAttribute('src')).toContain('google.com/s2/favicons')
    fireEvent.error(image)
    expect(container.querySelector('.site-icon-fallback')?.textContent).toBe('G')
  })

  it('未知域名只有远程 favicon 降级，fast.ai 直接使用文字标志', () => {
    const { container, rerender } = render(<SiteIcon url="https://unknown.test/path" name="unknown" />)
    const image = container.querySelector('img')!
    expect(image.getAttribute('src')).toContain('domain=unknown.test')
    fireEvent.error(image)
    expect(container.querySelector('.site-icon-fallback')?.textContent).toBe('U')

    rerender(<SiteIcon url="https://www.fast.ai/" name="Fast AI" />)
    const fallback = container.querySelector('.site-icon-fallback')!
    expect(fallback.textContent).toBe('fast.ai')
    expect(fallback.classList.contains('site-icon-wordmark')).toBe(true)
  })

  it('编辑 URL 到新域名会重置已经失败的来源状态', () => {
    const { container, rerender } = render(<SiteIcon url="https://unknown.test" name="Unknown" />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('.site-icon-fallback')).not.toBeNull()
    rerender(<SiteIcon url="https://github.com" name="GitHub" />)
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/site-icons/github.svg')
  })
})

describe('FrequentSiteStrip', () => {
  it('浏览态提供真实链接、记录访问，并提供可访问编辑入口', () => {
    const onVisit = vi.fn()
    const onEnterEditMode = vi.fn()
    render(<FrequentSiteStrip sites={[
      { moduleId: 'a', site: config.modules[0].sites[0] },
      { moduleId: 'b', site: config.modules[1].sites[0] },
    ]} editing={false} onEnterEditMode={onEnterEditMode} onEdit={vi.fn()} onRemove={vi.fn()} onVisit={onVisit} />)
    expect(screen.getByRole('heading', { name: '最常使用' }).nextElementSibling?.textContent).toBe('2')
    const link = screen.getByRole('link', { name: 'Alpha：Alpha 说明' })
    expect(link.getAttribute('href')).toBe('https://example.com/alpha')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
    fireEvent.click(link)
    expect(onVisit).toHaveBeenCalledWith('alpha')
    fireEvent.click(screen.getByRole('button', { name: '编辑最常使用的 Alpha' }))
    expect(onEnterEditMode).toHaveBeenCalledTimes(1)
  })

  it('编辑态点击链接改为编辑，不记录访问，并显示独立编辑/删除动作', () => {
    const onEdit = vi.fn()
    const onRemove = vi.fn()
    const onVisit = vi.fn()
    render(<FrequentSiteStrip sites={[{ moduleId: 'a', site: config.modules[0].sites[0] }]} editing
      onEnterEditMode={vi.fn()} onEdit={onEdit} onRemove={onRemove} onVisit={onVisit} />)
    const link = screen.getByRole('link', { name: '编辑 Alpha' })
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    expect(link.dispatchEvent(click)).toBe(false)
    expect(onEdit).toHaveBeenCalledWith('a', 'alpha')
    expect(onVisit).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '编辑 Alpha' }))
    fireEvent.click(screen.getByRole('button', { name: '删除 Alpha' }))
    expect(onEdit).toHaveBeenCalledTimes(2)
    expect(onRemove).toHaveBeenCalledWith('a', 'alpha')
    expect(screen.queryByRole('button', { name: '编辑最常使用的 Alpha' })).toBeNull()
  })
})

describe('SettingsDrawer', () => {
  it('关闭态不可交互；遮罩始终可关闭，打开后内部关闭按钮可用', () => {
    const onClose = vi.fn()
    const props = { activeModuleId: null, editingTarget: null, config, onClose, onChange: vi.fn(), onReset: vi.fn() }
    const { container, rerender } = render(<SettingsDrawer open={false} {...props} />)
    const drawer = container.querySelector('aside')!
    expect(drawer.getAttribute('aria-hidden')).toBe('true')
    expect(drawer.hasAttribute('inert')).toBe(true)
    expect(screen.queryByRole('button', { name: '关闭' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '关闭设置' }))
    rerender(<SettingsDrawer open {...props} />)
    expect(drawer.getAttribute('aria-hidden')).toBe('false')
    expect(drawer.hasAttribute('inert')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('普通设置可切换主题、添加并规范化站点、创建分类与恢复默认', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_726_400_000_000)
    const onChange = vi.fn()
    const onReset = vi.fn()
    const { rerender } = render(<SettingsDrawer open activeModuleId="b" editingTarget={null} config={config} onClose={vi.fn()} onChange={onChange} onReset={onReset} />)
    expect(screen.getByRole('heading', { name: '定制工作台' })).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /星云紫/ }))
    expect(onChange).toHaveBeenLastCalledWith({ ...config, accent: 'violet' })

    fireEvent.change(screen.getByPlaceholderText('站点名称'), { target: { value: '  新站点  ' } })
    fireEvent.change(screen.getByPlaceholderText('https://example.com'), { target: { value: ' docs.example.com/path ' } })
    fireEvent.click(screen.getByRole('button', { name: '添加到「分类 B」' }))
    const added = onChange.mock.calls.at(-1)?.[0] as NavigationConfig
    expect(added.modules[1].sites.at(-1)).toEqual({
      id: '1726400000000', name: '新站点', url: 'https://docs.example.com/path', description: '自定义站点',
    })
    expect((screen.getByPlaceholderText('站点名称') as HTMLInputElement).value).toBe('')

    fireEvent.change(screen.getByPlaceholderText('例如：设计灵感'), { target: { value: '  新分类  ' } })
    fireEvent.click(screen.getByRole('button', { name: '新建分类' }))
    const withModule = onChange.mock.calls.at(-1)?.[0] as NavigationConfig
    expect(withModule.modules.at(-1)).toEqual({
      id: 'module-1726400000000', title: '新分类', description: '你的自定义资源分组', accent: '#9ff7cd', sites: [],
    })
    rerender(<SettingsDrawer open activeModuleId={null} editingTarget={null} config={withModule} onClose={vi.fn()} onChange={onChange} onReset={onReset} />)
    expect((screen.getByLabelText('所属分类') as HTMLSelectElement).value).toBe('module-1726400000000')
    fireEvent.click(screen.getByRole('button', { name: /恢复默认内容与配色/ }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('空分类列表时禁止提交站点和分类选择', () => {
    render(<SettingsDrawer open activeModuleId={null} editingTarget={null} config={{ ...config, modules: [] }} onClose={vi.fn()} onChange={vi.fn()} onReset={vi.fn()} />)
    expect((screen.getByLabelText('所属分类') as HTMLSelectElement).disabled).toBe(true)
    fireEvent.change(screen.getByPlaceholderText('站点名称'), { target: { value: 'Name' } })
    fireEvent.change(screen.getByPlaceholderText('https://example.com'), { target: { value: 'example.com' } })
    expect((screen.getByRole('button', { name: '添加到「模块」' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('编辑站点时更新原分类，或原子地移动到另一分类，然后关闭', () => {
    const onChange = vi.fn()
    const onClose = vi.fn()
    const { unmount } = render(<SettingsDrawer open activeModuleId={null} editingTarget={{ type: 'site', moduleId: 'a', siteId: 'alpha' }} config={config} onClose={onClose} onChange={onChange} onReset={vi.fn()} />)
    expect(screen.getByRole('heading', { name: '编辑站点' })).not.toBeNull()
    fireEvent.change(screen.getByPlaceholderText('站点名称'), { target: { value: '  Alpha 新名  ' } })
    fireEvent.change(screen.getByPlaceholderText('一句话描述（可选）'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: '保存站点' }))
    const sameModule = onChange.mock.calls[0][0] as NavigationConfig
    expect(sameModule.modules[0].sites[0]).toMatchObject({ name: 'Alpha 新名', description: '自定义站点' })
    expect(onClose).toHaveBeenCalledTimes(1)
    unmount()

    onChange.mockClear(); onClose.mockClear()
    render(<SettingsDrawer open activeModuleId={null} editingTarget={{ type: 'site', moduleId: 'a', siteId: 'alpha' }} config={config} onClose={onClose} onChange={onChange} onReset={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('所属分类'), { target: { value: 'b' } })
    fireEvent.click(screen.getByRole('button', { name: '保存站点' }))
    const moved = onChange.mock.calls[0][0] as NavigationConfig
    expect(moved.modules[0].sites).toHaveLength(0)
    expect(moved.modules[1].sites.map((site) => site.id)).toEqual(['beta', 'alpha'])
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('编辑分类可修改名称、默认说明和强调色，但保留站点', () => {
    const onChange = vi.fn()
    const onClose = vi.fn()
    render(<SettingsDrawer open activeModuleId={null} editingTarget={{ type: 'module', moduleId: 'a' }} config={config} onClose={onClose} onChange={onChange} onReset={vi.fn()} />)
    expect(screen.getByRole('heading', { name: '编辑分类' })).not.toBeNull()
    fireEvent.change(screen.getByPlaceholderText('分类名称'), { target: { value: '  新分类名  ' } })
    fireEvent.change(screen.getByPlaceholderText('一句话描述'), { target: { value: ' ' } })
    fireEvent.click(screen.getByRole('button', { name: '使用颜色 #ff9fb7' }))
    fireEvent.click(screen.getByRole('button', { name: '保存分类' }))
    const updated = onChange.mock.calls[0][0] as NavigationConfig
    expect(updated.modules[0]).toEqual({
      ...config.modules[0], title: '新分类名', description: '你的自定义资源分组', accent: '#ff9fb7',
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('TemplateHost', () => {
  it('无活动模板时区分加载中和失败，并允许重试', () => {
    const retry = vi.fn()
    const props = templateProps()
    const { rerender } = render(<TemplateHost {...props} active={null} error={null} retry={retry} />)
    expect(screen.getByRole('region', { name: '导航模板' }).getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('status').textContent).toContain('正在加载导航模板')
    rerender(<TemplateHost {...props} active={null} error="加载失败" retry={retry} />)
    expect(screen.getByRole('alert').textContent).toBe('加载失败')
    expect(screen.getByRole('region', { name: '导航模板' }).getAttribute('aria-busy')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: '重试加载' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('向模板透传公开 props，阻塞时 inert，并忽略旧模板卸载后的迟到上报', () => {
    let firstReport: NavigationTemplateProps['onInteractionStateChange'] | null = null
    const First = (props: NavigationTemplateProps) => {
      firstReport = props.onInteractionStateChange
      return <p>第一个模板</p>
    }
    const Second = () => <p>第二个模板</p>
    const definition = (id: string, Component: LoadedTemplate['Component']): LoadedTemplate => ({
      definition: { id, name: id, description: id, editingHint: id, load: vi.fn() } satisfies TemplateDefinition,
      Component,
    })
    const notify = vi.fn()
    const props = templateProps({ interactionBlocked: true, onInteractionStateChange: notify })
    const { container, rerender, unmount } = render(<TemplateHost {...props} active={definition('first', First)} error={null} retry={vi.fn()} />)
    expect(screen.getByText('第一个模板')).not.toBeNull()
    expect(container.querySelector('.template-host')?.hasAttribute('inert')).toBe(true)
    firstReport?.({ dragging: true, settling: false })
    expect(notify).toHaveBeenCalledWith({ dragging: true, settling: false })

    rerender(<TemplateHost {...props} active={definition('second', Second)} error={null} retry={vi.fn()} />)
    expect(screen.getByText('第二个模板')).not.toBeNull()
    expect(notify).toHaveBeenCalledWith({ dragging: false, settling: false })
    notify.mockClear()
    firstReport?.({ dragging: true, settling: true })
    expect(notify).not.toHaveBeenCalled()
    unmount()
    expect(notify).toHaveBeenCalledWith({ dragging: false, settling: false })
  })
})
