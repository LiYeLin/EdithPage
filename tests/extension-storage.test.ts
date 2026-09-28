// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('扩展存储适配器', () => {
  it('启动时预加载 chrome.storage.local，并保持同步缓存', async () => {
    const set = vi.fn(async () => undefined)
    const remove = vi.fn(async () => undefined)
    const get = vi.fn(async () => ({ 'edith-navigation-search-engine-v1': 'baidu' }))
    vi.stubGlobal('chrome', { runtime: { id: 'extension-id' }, storage: { local: { get, set, remove } } })
    const storage = await import('../src/platform/storage')

    await storage.initializeStorage()
    expect(storage.getStoredValue('edith-navigation-search-engine-v1')).toBe('baidu')

    await storage.setStoredValue('edith-navigation-search-engine-v1', 'google')
    expect(storage.getStoredValue('edith-navigation-search-engine-v1')).toBe('google')
    expect(set).toHaveBeenCalledWith({ 'edith-navigation-search-engine-v1': 'google' })

    await storage.removeStoredValue('edith-navigation-search-engine-v1')
    expect(storage.getStoredValue('edith-navigation-search-engine-v1')).toBeNull()
    expect(remove).toHaveBeenCalledWith(['edith-navigation-search-engine-v1'])
  })

  it('接收其他扩展页面的 storage.onChanged 并更新缓存和订阅者', async () => {
    type ChangeListener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => void
    let changeListener: ChangeListener | null = null
    const addListener = vi.fn((listener: ChangeListener) => { changeListener = listener })
    const removeListener = vi.fn()
    const get = vi.fn(async () => ({ 'edith-navigation-search-engine-v1': 'baidu' }))
    vi.stubGlobal('chrome', {
      runtime: { id: 'extension-id' },
      storage: {
        local: { get, set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) },
        onChanged: { addListener, removeListener },
      },
    })
    const storage = await import('../src/platform/storage')
    await storage.initializeStorage()
    const received: Array<string | null> = []
    const unsubscribe = storage.subscribeStoredValue('edith-navigation-search-engine-v1', (value) => received.push(value))

    changeListener?.({ 'edith-navigation-search-engine-v1': { newValue: 'perplexity' } }, 'local')

    expect(storage.getStoredValue('edith-navigation-search-engine-v1')).toBe('perplexity')
    expect(received).toEqual(['perplexity'])
    unsubscribe()
    expect(removeListener).toHaveBeenCalledOnce()
  })

  it('批量替换失败时恢复扩展存储快照', async () => {
    const set = vi.fn(async () => undefined)
    const remove = vi.fn()
      .mockRejectedValueOnce(new Error('remove failed'))
      .mockResolvedValue(undefined)
    const get = vi.fn(async () => ({ 'edith-navigation-search-engine-v1': 'baidu' }))
    vi.stubGlobal('chrome', { runtime: { id: 'extension-id' }, storage: { local: { get, set, remove } } })
    const storage = await import('../src/platform/storage')
    await storage.initializeStorage()

    await expect(storage.replaceStoredValues({ 'edith-navigation-config-v3': '{"new":true}' })).rejects.toThrow('remove failed')

    expect(storage.getStoredValue('edith-navigation-search-engine-v1')).toBe('baidu')
    expect(storage.getStoredValue('edith-navigation-config-v3')).toBeNull()
    expect(set).toHaveBeenLastCalledWith({ 'edith-navigation-search-engine-v1': 'baidu' })
    expect(remove).toHaveBeenLastCalledWith([
      'edith-navigation-config-v3',
      'edith-navigation-usage-v1',
      'edith-navigation-onboarding-completed-v1',
    ])
  })
})
