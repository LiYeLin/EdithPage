// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBackup, importBackup, parseBackup } from '../src/platform/backup'
import { defaultConfig } from '../src/data/defaultConfig'

const CONFIG_KEY = 'edith-navigation-config-v3'
const ENGINE_KEY = 'edith-navigation-search-engine-v1'
const USAGE_KEY = 'edith-navigation-usage-v1'
const ONBOARDING_KEY = 'edith-navigation-onboarding-completed-v1'

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('Edith JSON 备份', () => {
  it('导出当前四组本地数据', () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(defaultConfig))
    localStorage.setItem(ENGINE_KEY, 'baidu')
    localStorage.setItem(USAGE_KEY, JSON.stringify({ github: 3 }))
    localStorage.setItem(ONBOARDING_KEY, '1')

    const backup = createBackup()

    expect(backup.format).toBe('edith-backup')
    expect(backup.version).toBe(1)
    expect(backup.data).toEqual({
      [CONFIG_KEY]: defaultConfig,
      [ENGINE_KEY]: 'baidu',
      [USAGE_KEY]: { github: 3 },
      [ONBOARDING_KEY]: true,
    })
  })

  it('完整导入并清除备份中缺失的数据', async () => {
    localStorage.setItem(ENGINE_KEY, 'google')
    localStorage.setItem(USAGE_KEY, JSON.stringify({ old: 1 }))
    const backup = {
      format: 'edith-backup',
      version: 1,
      exportedAt: '2026-09-28T00:00:00.000Z',
      data: {
        [CONFIG_KEY]: defaultConfig,
        [ENGINE_KEY]: 'perplexity',
        [ONBOARDING_KEY]: false,
      },
    }

    await importBackup(JSON.stringify(backup))

    expect(JSON.parse(localStorage.getItem(CONFIG_KEY) ?? 'null')).toEqual(defaultConfig)
    expect(localStorage.getItem(ENGINE_KEY)).toBe('perplexity')
    expect(localStorage.getItem(USAGE_KEY)).toBeNull()
    expect(localStorage.getItem(ONBOARDING_KEY)).toBeNull()
  })

  it('导入写入失败时恢复全部原始数据', async () => {
    localStorage.setItem(ENGINE_KEY, 'google')
    localStorage.setItem(USAGE_KEY, JSON.stringify({ old: 1 }))
    const originalSetItem = Storage.prototype.setItem
    let failed = false
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === USAGE_KEY && !failed) {
        failed = true
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      }
      originalSetItem.call(this, key, value)
    })

    await expect(importBackup(JSON.stringify({
      format: 'edith-backup',
      version: 1,
      exportedAt: '2026-09-28T00:00:00.000Z',
      data: {
        [CONFIG_KEY]: defaultConfig,
        [ENGINE_KEY]: 'baidu',
        [USAGE_KEY]: { github: 3 },
        [ONBOARDING_KEY]: true,
      },
    }))).rejects.toThrow('Quota exceeded')

    expect(localStorage.getItem(CONFIG_KEY)).toBeNull()
    expect(localStorage.getItem(ENGINE_KEY)).toBe('google')
    expect(JSON.parse(localStorage.getItem(USAGE_KEY) ?? 'null')).toEqual({ old: 1 })
    expect(localStorage.getItem(ONBOARDING_KEY)).toBeNull()
  })

  it.each([
    ['非法 JSON', '{'],
    ['未知版本', JSON.stringify({ format: 'edith-backup', version: 2, data: {} })],
    ['非法配置', JSON.stringify({ format: 'edith-backup', version: 1, data: { [CONFIG_KEY]: [] } })],
    ['非法搜索引擎', JSON.stringify({ format: 'edith-backup', version: 1, data: { [ENGINE_KEY]: 'unknown' } })],
    ['非法访问计数', JSON.stringify({ format: 'edith-backup', version: 1, data: { [USAGE_KEY]: { github: -1 } } })],
  ])('拒绝%s', (_label, text) => {
    expect(() => parseBackup(text)).toThrow()
  })
})
