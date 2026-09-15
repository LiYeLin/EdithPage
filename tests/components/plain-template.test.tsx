// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PlainTemplate from '../../src/templates/plain/PlainTemplate'
import type { NavigationActions, NavigationTemplateProps } from '../../src/templates/types'
import type { Module, Site } from '../../src/types'
import { installDomStubs } from './testEnvironment'

const alpha: Site = {
  id: 'alpha',
  name: 'Alpha',
  url: 'https://example.com/alpha',
  description: 'Alpha 说明',
}
const beta: Site = {
  id: 'beta',
  name: 'Beta',
  url: 'https://example.com/beta',
  description: 'Beta 说明',
}
const modules: Module[] = [
  { id: 'a', title: '分类 A', description: '说明 A', accent: '#9ff7cd', sites: [alpha] },
  { id: 'b', title: '分类 B', description: '说明 B', accent: '#b9b6ff', sites: [beta] },
  { id: 'empty', title: '空分类', description: '暂无内容', accent: '#ffcf70', sites: [] },
]

function actions(overrides: Partial<NavigationActions> = {}): NavigationActions {
  return {
    enterEditMode: vi.fn(),
    openSettings: vi.fn(),
    addSite: vi.fn(),
    edit: vi.fn(),
    removeSite: vi.fn(),
    removeModule: vi.fn(),
    moveSite: vi.fn(() => true),
    visitSite: vi.fn(),
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

beforeEach(() => installDomStubs())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('PlainTemplate', () => {
  it('浏览态展示分类、真实站点链接和进入编辑入口，并记录站点访问', () => {
    const enterEditMode = vi.fn()
    const visitSite = vi.fn()
    render(<PlainTemplate {...props({ actions: actions({ enterEditMode, visitSite }) })} />)

    const template = screen.getByRole('region', { name: '纯净应用网格模板' })
    expect(template.getAttribute('data-template')).toBe('plain')
    expect(screen.getByRole('heading', { name: '分类 A' }).nextElementSibling?.textContent).toBe('1 个应用')
    expect(screen.getByRole('heading', { name: '空分类' }).nextElementSibling?.textContent).toBe('0 个应用')
    expect(screen.getByText('这个分类还没有应用')).not.toBeNull()

    const link = screen.getByRole('link', { name: 'Alpha，打开站点' })
    expect(link.getAttribute('href')).toBe(alpha.url)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
    fireEvent.click(link)
    expect(visitSite).toHaveBeenCalledWith('alpha')

    fireEvent.click(screen.getByRole('button', { name: '进入编辑模式：分类 A' }))
    fireEvent.click(screen.getByRole('button', { name: '进入编辑模式：空分类' }))
    expect(enterEditMode).toHaveBeenCalledTimes(2)
    expect(screen.queryByText(/编辑模式：/)).toBeNull()
  })

  it('编辑态公开分类和站点操作，并只允许移动到其他分类', () => {
    const edit = vi.fn()
    const removeSite = vi.fn()
    const removeModule = vi.fn()
    const addSite = vi.fn()
    const moveSite = vi.fn(() => true)
    const visitSite = vi.fn()
    render(<PlainTemplate {...props({
      editing: true,
      actions: actions({ edit, removeSite, removeModule, addSite, moveSite, visitSite }),
    })} />)

    fireEvent.click(screen.getByRole('button', { name: '编辑分类 分类 A' }))
    fireEvent.click(screen.getByRole('button', { name: '添加到 分类 A' }))
    fireEvent.click(screen.getByRole('button', { name: '删除分类 分类 A' }))
    expect(edit).toHaveBeenCalledWith({ type: 'module', moduleId: 'a' })
    expect(addSite).toHaveBeenCalledWith('a')
    expect(removeModule).toHaveBeenCalledWith('a')

    fireEvent.click(screen.getByRole('button', { name: '编辑 Alpha' }))
    fireEvent.click(screen.getByRole('button', { name: '删除 Alpha' }))
    expect(edit).toHaveBeenCalledWith({ type: 'site', moduleId: 'a', siteId: 'alpha' })
    expect(removeSite).toHaveBeenCalledWith('a', 'alpha')

    const move = screen.getByRole('combobox', { name: '移动 Alpha' })
    expect(within(move).queryByRole('option', { name: '分类 A' })).toBeNull()
    expect(within(move).getByRole('option', { name: '分类 B' })).not.toBeNull()
    expect(within(move).getByRole('option', { name: '空分类' })).not.toBeNull()
    fireEvent.change(move, { target: { value: 'b' } })
    expect(moveSite).toHaveBeenCalledWith({ siteId: 'alpha', fromModuleId: 'a', toModuleId: 'b' })

    fireEvent.click(screen.getByRole('link', { name: 'Alpha，打开站点' }))
    expect(visitSite).toHaveBeenCalledWith('alpha')
    expect(screen.getByText('编辑模式：修改完成后点击空白处退出')).not.toBeNull()
  })

  it('最常使用区在编辑态通过模板公开动作编辑站点', () => {
    const edit = vi.fn()
    render(<PlainTemplate {...props({
      editing: true,
      frequentSites: [{ moduleId: 'a', site: alpha }],
      actions: actions({ edit }),
    })} />)

    fireEvent.click(screen.getByRole('link', { name: '编辑 Alpha' }))
    expect(edit).toHaveBeenCalledWith({ type: 'site', moduleId: 'a', siteId: 'alpha' })
  })

  it('编辑态空分类提供直接添加入口', () => {
    const addSite = vi.fn()
    render(<PlainTemplate {...props({ editing: true, actions: actions({ addSite }) })} />)
    const emptySection = screen.getByRole('heading', { name: '空分类' }).closest('section')!
    fireEvent.click(within(emptySection).getByRole('button', { name: '添加站点' }))
    expect(addSite).toHaveBeenCalledWith('empty')
  })

  it('没有分类时展示创建入口，并在挂载和卸载时释放交互状态', () => {
    const openSettings = vi.fn()
    const report = vi.fn()
    const view = render(<PlainTemplate {...props({
      modules: [],
      actions: actions({ openSettings }),
      onInteractionStateChange: report,
    })} />)

    expect(screen.getByText('还没有分类')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '创建分类' }))
    expect(openSettings).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledWith({ dragging: false, settling: false })
    expect(report).toHaveBeenCalledTimes(1)

    view.unmount()
    expect(report).toHaveBeenCalledTimes(2)
    expect(report).toHaveBeenLastCalledWith({ dragging: false, settling: false })
  })
})
