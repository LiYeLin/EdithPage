// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SearchDeck } from '../../src/components/SearchDeck'
import { SearchEnginePicker } from '../../src/components/SearchEnginePicker'
import { TemplatePicker } from '../../src/components/TemplatePicker'
import { OnboardingGuide, type OnboardingStep } from '../../src/components/OnboardingGuide'
import { searchEngines } from '../../src/data/defaultConfig'
import type { TemplateDefinition } from '../../src/templates/types'
import { installDomStubs } from './testEnvironment'

const templates: readonly TemplateDefinition[] = [
  { id: 'bubble', name: '液态气泡', description: '气泡说明', editingHint: '提示', load: vi.fn() },
  { id: 'plain', name: '纯净网格', description: '网格说明', editingHint: '提示', load: vi.fn() },
]

beforeEach(() => {
  installDomStubs()
})

afterEach(() => {
  cleanup()
  document.body.className = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('SearchEnginePicker', () => {
  it('展示当前引擎与固定目录，鼠标进入后选择新引擎并关闭', () => {
    const onChange = vi.fn()
    const { container } = render(<SearchEnginePicker engine={searchEngines[0]} onChange={onChange} />)
    const picker = container.querySelector('.engine-picker')!
    const trigger = screen.getByRole('button', { name: /当前引擎：Google/ })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('group', { name: '选择搜索引擎' }).hasAttribute('inert')).toBe(true)
    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label')))
      .toEqual([expect.stringContaining('Google'), 'Google', 'Perplexity AI', '百度'])

    fireEvent.mouseEnter(picker)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '百度' }))
    expect(onChange).toHaveBeenCalledWith(searchEngines[2])
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('支持键盘打开、Escape 返回触发器，以及焦点离开后关闭', () => {
    const { container } = render(<SearchEnginePicker engine={searchEngines[0]} onChange={vi.fn()} />)
    const picker = container.querySelector('.engine-picker')!
    const trigger = screen.getByRole('button', { name: /当前引擎：Google/ })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(screen.getByRole('button', { name: 'Google' })).toBe(document.activeElement)
    fireEvent.keyDown(picker, { key: 'Escape' })
    expect(trigger).toBe(document.activeElement)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(trigger)
    const option = screen.getByRole('button', { name: 'Perplexity AI' })
    option.focus()
    fireEvent.mouseLeave(picker)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    fireEvent.blur(option, { relatedTarget: document.body })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('SearchDeck', () => {
  it('首帧聚焦输入框，快捷键可恢复焦点，卸载会清理监听和帧', () => {
    vi.useFakeTimers()
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame')
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<SearchDeck engine={searchEngines[0]} onEngineChange={vi.fn()} />)
    const input = screen.getByRole('textbox', { name: '使用 Google 搜索' })
    act(() => vi.advanceTimersByTime(20))
    expect(input).toBe(document.activeElement)

    ;(screen.getByRole('button', { name: '开始搜索' }) as HTMLButtonElement).focus()
    const shortcut = new KeyboardEvent('keydown', { bubbles: true, key: 'K', metaKey: true, cancelable: true })
    window.dispatchEvent(shortcut)
    expect(shortcut.defaultPrevented).toBe(true)
    expect(input).toBe(document.activeElement)

    unmount()
    expect(cancelFrame).toHaveBeenCalled()
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function))
  })

  it('提交时 trim 并编码查询；空查询打开引擎主页', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<SearchDeck engine={searchEngines[0]} onEngineChange={vi.fn()} />)
    const input = screen.getByRole('textbox', { name: '使用 Google 搜索' })
    fireEvent.change(input, { target: { value: '  React 测试 & hooks  ' } })
    fireEvent.submit(input.closest('form')!)
    expect(open).toHaveBeenLastCalledWith(
      'https://www.google.com/search?q=React%20%E6%B5%8B%E8%AF%95%20%26%20hooks',
      '_blank',
      'noopener,noreferrer',
    )

    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: '开始搜索' }))
    expect(open).toHaveBeenLastCalledWith('https://www.google.com/', '_blank', 'noopener,noreferrer')
  })

  it('切换引擎时透传选择并把焦点还给搜索框', () => {
    const onEngineChange = vi.fn()
    const { container } = render(<SearchDeck engine={searchEngines[0]} onEngineChange={onEngineChange} />)
    fireEvent.mouseEnter(container.querySelector('.engine-picker')!)
    fireEvent.click(screen.getByRole('button', { name: 'Perplexity AI' }))
    expect(onEngineChange).toHaveBeenCalledWith(searchEngines[1])
    expect(screen.getByRole('textbox', { name: '使用 Google 搜索' })).toBe(document.activeElement)
  })
})

describe('TemplatePicker', () => {
  it('初始聚焦关闭按钮，支持 Escape、遮罩和关闭按钮', () => {
    const onClose = vi.fn()
    const { container } = render(<TemplatePicker templates={templates} currentId="bubble" loading={false} busy={false} error={null} onSelect={vi.fn()} onClose={onClose} />)
    const close = screen.getByRole('button', { name: '关闭模板选择' })
    expect(close).toBe(document.activeElement)
    expect(screen.getByRole('dialog', { name: '选择模板' }).getAttribute('aria-modal')).toBe('true')
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(container.querySelector('.drawer-backdrop')!)
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('约束 Tab 与外部焦点，当前项标记且可选择其他模板', () => {
    const onSelect = vi.fn()
    render(<TemplatePicker templates={templates} currentId="bubble" loading={false} busy={false} error={null} onSelect={onSelect} onClose={vi.fn()} />)
    const close = screen.getByRole('button', { name: '关闭模板选择' })
    const options = screen.getAllByRole('button').filter((button) => button.classList.contains('template-option'))
    expect(options[0].getAttribute('aria-pressed')).toBe('true')
    expect(options[1].getAttribute('aria-pressed')).toBe('false')

    close.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(options[1]).toBe(document.activeElement)
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(close).toBe(document.activeElement)
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()
    fireEvent.focusIn(outside)
    expect(close).toBe(document.activeElement)

    fireEvent.click(options[1])
    expect(onSelect).toHaveBeenCalledWith('plain')
    outside.remove()
  })

  it.each([
    ['加载中', true, false, '正在加载模板…可关闭面板取消。'],
    ['交互忙碌', false, true, '请等待拖动与动画结束。'],
  ])('%s时禁用全部模板并显示状态', (_label, loading, busy, status) => {
    render(<TemplatePicker templates={templates} currentId="bubble" loading={loading} busy={busy} error={null} onSelect={vi.fn()} onClose={vi.fn()} />)
    const options = screen.getAllByRole('button').filter((button) => button.classList.contains('template-option')) as HTMLButtonElement[]
    expect(options.every((option) => option.disabled)).toBe(true)
    expect(screen.getByRole('status').textContent).toBe(status)
    expect(screen.getByText('气泡说明')).not.toBeNull()
  })

  it('显示可重试错误文案', () => {
    render(<TemplatePicker templates={templates} currentId="bubble" loading={false} busy={false} error="模板加载失败" onSelect={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('alert').textContent).toContain('模板加载失败 点击所选模板重试。')
  })
})

describe('OnboardingGuide', () => {
  it.each([
    [1, '欢迎使用 Edith', '开始使用'],
    [2, '切换搜索引擎', '下一步'],
    [3, '选择你的模板', '下一步'],
    [4, '进入编辑模式', '下一步'],
  ] as const)('第 %i 步展示正确内容和进度', (step, title, nextLabel) => {
    const onNext = vi.fn()
    const onSkip = vi.fn()
    const { unmount } = render(<OnboardingGuide step={step as OnboardingStep} onNext={onNext} onSkip={onSkip} />)
    expect(screen.getByRole('dialog', { name: '首次访问引导' })).not.toBeNull()
    expect(screen.getByRole('heading', { name: title })).not.toBeNull()
    expect(screen.getByText(`快速了解 · ${step}/4`)).not.toBeNull()
    expect(screen.getByLabelText(`第 ${step} 步，共四步`).querySelectorAll('.is-active')).toHaveLength(1)
    expect(document.body.classList.contains('onboarding-active')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: nextLabel }))
    fireEvent.click(screen.getByRole('button', { name: '跳过引导' }))
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onSkip).toHaveBeenCalledTimes(1)
    unmount()
    expect(document.body.classList.contains('onboarding-active')).toBe(false)
  })
})
