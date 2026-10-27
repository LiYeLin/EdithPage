// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SearchDeck } from '../../src/components/SearchDeck'
import { OnboardingGuide } from '../../src/components/OnboardingGuide'
import { useSearchSelection } from '../../src/hooks/useSearchSelection'
import { browserDefaultSearch, submitSearch } from '../../src/platform/search'
import { createBackup, importBackup } from '../../src/platform/backup'
import { searchEngines } from '../../src/data/defaultConfig'
import { installDomStubs } from './testEnvironment'
import { PreferencesProvider } from '../../src/i18n/PreferencesProvider'

const engineKey = 'edith-navigation-search-engine-v1'

beforeEach(() => {
  installDomStubs()
  localStorage.clear()
  vi.stubEnv('VITE_EXTENSION_BUILD', 'true')
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('扩展搜索', () => {
  it('通过默认 API 传递未编码的 trim 查询，不使用 window.open', async () => {
    const query = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', { search: { query } })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    await submitSearch('  中文 & React?  ', browserDefaultSearch)
    expect(query).toHaveBeenCalledExactlyOnceWith({ text: '中文 & React?', disposition: 'NEW_TAB' })
    expect(open).not.toHaveBeenCalled()
  })

  it('所有扩展选项的空查询都不跳转，显式引擎仍编码查询', async () => {
    const query = vi.fn()
    vi.stubGlobal('chrome', { search: { query } })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    for (const selection of [browserDefaultSearch, ...searchEngines]) await submitSearch('   ', selection)
    expect(query).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
    await submitSearch(' 中文 & ', searchEngines[2])
    expect(open).toHaveBeenCalledExactlyOnceWith('https://www.baidu.com/s?wd=%E4%B8%AD%E6%96%87%20%26', '_blank', 'noopener,noreferrer')
  })

  it.each(['missing', 'rejected', 'throwing'])('API %s 时保留输入并显示错误，不改用其他引擎', async (mode) => {
    const query = mode === 'throwing' ? vi.fn(() => { throw new Error('failed') })
      : vi.fn().mockRejectedValue(new Error('failed'))
    vi.stubGlobal('chrome', mode === 'missing' ? {} : { search: { query } })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<SearchDeck engine={browserDefaultSearch} onEngineChange={vi.fn()} />)
    const input = screen.getByRole('textbox', { name: '使用 浏览器默认 搜索' }) as HTMLInputElement
    fireEvent.change(input, { target: { value: '测试' } })
    fireEvent.submit(input.closest('form')!)
    expect((await screen.findByRole('alert')).textContent).toContain('地址栏搜索')
    expect(input.value).toBe('测试')
    expect(open).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '重试' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('默认选项排第一，旧偏好不生效，临时选择和存储变化不影响其他页面', async () => {
    localStorage.setItem(engineKey, 'baidu')
    function SearchHarness() {
      const { engine, changeEngine } = useSearchSelection()
      return <SearchDeck engine={engine} onEngineChange={changeEngine} />
    }
    const { container, unmount } = render(<SearchHarness />)
    const trigger = screen.getByRole('button', { name: /当前引擎：浏览器默认/ })
    expect(trigger.querySelector('img')).toBeNull()
    fireEvent.mouseEnter(container.querySelector('.engine-picker')!)
    expect(screen.getByRole('group').querySelector('button')?.getAttribute('aria-label')).toBe('浏览器默认')
    fireEvent.click(screen.getByRole('button', { name: '百度' }))
    expect(screen.getByRole('textbox', { name: '使用 百度 搜索' })).toBe(document.activeElement)
    expect(localStorage.getItem(engineKey)).toBe('baidu')
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: engineKey, newValue: 'google', storageArea: localStorage })))
    expect(screen.getByRole('button', { name: /当前引擎：百度/ })).not.toBeNull()
    unmount()
    render(<SearchHarness />)
    expect(screen.getByRole('button', { name: /当前引擎：浏览器默认/ })).not.toBeNull()
  })

  it('导入旧备份仍兼容导出，但不能覆盖默认搜索', async () => {
    const { result, unmount } = renderHook(() => useSearchSelection())
    const backup = { format: 'edith-backup', version: 1, exportedAt: new Date().toISOString(), data: { [engineKey]: 'baidu' } }
    await act(() => importBackup(JSON.stringify(backup)))
    expect(result.current.engine.id).toBe('browser-default')
    expect(createBackup().data[engineKey]).toBe('baidu')
    unmount()
    const reopened = renderHook(() => useSearchSelection())
    expect(reopened.result.current.engine.id).toBe('browser-default')
  })

  it('临时选择不写 chrome.storage，也不响应其他扩展页偏好变化', () => {
    const set = vi.fn()
    const addListener = vi.fn()
    vi.stubGlobal('chrome', { runtime: { id: 'test' }, storage: { local: { set }, onChanged: { addListener } } })
    const { result } = renderHook(() => useSearchSelection())
    act(() => result.current.changeEngine(searchEngines[2]))
    expect(result.current.engine.id).toBe('baidu')
    expect(set).not.toHaveBeenCalled()
    expect(addListener).not.toHaveBeenCalled()
  })

  it('引导说明临时选择，并允许直接下一步', () => {
    const onNext = vi.fn()
    render(<OnboardingGuide step={2} onNext={onNext} onSkip={vi.fn()} />)
    expect(screen.getByText(/默认跟随浏览器的搜索设置/)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it.each([1, 2, 3, 4] as const)('英文扩展引导第 %i 步完整翻译并使用正确结束按钮', step => {
    localStorage.setItem('edith-navigation-preferences-v1', '{"language":"en","iconService":"google"}')
    const onNext = vi.fn()
    render(<PreferencesProvider><OnboardingGuide step={step} onNext={onNext} onSkip={vi.fn()} /></PreferencesProvider>)
    expect(screen.getByRole('dialog', { name: 'Welcome tour' }).textContent).not.toMatch(/\p{Script=Han}/u)
    if (step === 2) {
      expect(screen.getByRole('heading', { name: 'Use your default search engine' })).toBeInTheDocument()
      expect(screen.getByText('Search with your browser’s default engine. Use the icon to switch for this tab.')).toBeInTheDocument()
    }
    fireEvent.click(screen.getByRole('button', { name: step === 1 ? 'Get started' : step === 4 ? 'Done' : 'Next' }))
    expect(onNext).toHaveBeenCalledOnce()
  })
})

describe('网页版兼容', () => {
  it('读取并保存引擎偏好，响应跨页变化，重新打开继续使用', async () => {
    vi.stubEnv('VITE_EXTENSION_BUILD', 'false')
    vi.stubGlobal('chrome', undefined)
    localStorage.setItem(engineKey, 'baidu')
    const { result, unmount } = renderHook(() => useSearchSelection())
    expect(result.current.engine.id).toBe('baidu')
    act(() => result.current.changeEngine(searchEngines[1]))
    await waitFor(() => expect(localStorage.getItem(engineKey)).toBe('perplexity'))
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: engineKey, newValue: 'google', storageArea: localStorage })))
    expect(result.current.engine.id).toBe('google')
    unmount()
    const reopened = renderHook(() => useSearchSelection())
    expect(reopened.result.current.engine.id).toBe('perplexity')
  })
})
