// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getIconPositionPersistence } from '../src/templates/config'
import { usePersistentConfig } from '../src/hooks/usePersistentConfig'
import type { TemplateDefinition } from '../src/templates/types'
import type { NavigationConfig } from '../src/types'

const STORAGE_KEY = 'edith-navigation-config-v3'
const STORAGE_ERROR = '无法保存到浏览器，本次修改仅在当前页面有效。'

/**
 * 固定产品默认值快照。这里不引用 defaultConfig，避免生产默认值被意外改动时
 * 测试和实现一起变化而失去回归保护。
 */
const EXPECTED_DEFAULT_CONFIG: NavigationConfig = {
  templateId: 'bubble',
  accent: 'mint',
  modules: [
    {
      id: 'ai-tools',
      title: 'AI 工具',
      description: '从想法、代码到研究，快速调用你的 AI 搭档',
      accent: '#9ff7cd',
      sites: [
        { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/', description: '通用 AI 助手', shortcut: '⌘1' },
        { id: 'claude', name: 'Claude', url: 'https://claude.ai/', description: '写作与编程助手' },
        { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/', description: 'Google AI 助手' },
        { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com/', description: '推理与代码模型' },
        { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/', description: 'AI 搜索与研究' },
        { id: 'cursor', name: 'Cursor', url: 'https://www.cursor.com/', description: 'AI 代码编辑器' },
      ],
    },
    {
      id: 'ai-learning',
      title: 'AI 学习',
      description: '课程、模型和动手实践资源',
      accent: '#b9b6ff',
      sites: [
        { id: 'deeplearning', name: 'DeepLearning.AI', url: 'https://www.deeplearning.ai/', description: '系统化 AI 课程' },
        { id: 'huggingface', name: 'Hugging Face', url: 'https://huggingface.co/learn', description: '开源模型与课程' },
        { id: 'fastai', name: 'fast.ai', url: 'https://www.fast.ai/', description: '实践导向深度学习' },
        { id: 'kaggle', name: 'Kaggle Learn', url: 'https://www.kaggle.com/learn', description: '短课与数据竞赛' },
      ],
    },
    {
      id: 'dev-tools',
      title: '开发工具',
      description: '日常开发、部署与问题排查',
      accent: '#ffcb93',
      sites: [
        { id: 'github', name: 'GitHub', url: 'https://github.com/', description: '代码托管与协作', shortcut: '⌘2' },
        { id: 'stackoverflow', name: 'Stack Overflow', url: 'https://stackoverflow.com/', description: '开发问题社区' },
        { id: 'vercel', name: 'Vercel', url: 'https://vercel.com/', description: '前端部署平台' },
        { id: 'docker', name: 'Docker Docs', url: 'https://docs.docker.com/', description: '容器开发文档' },
      ],
    },
    {
      id: 'communities',
      title: '技术社区',
      description: '跟进趋势，交换思路，发现好内容',
      accent: '#88d9ff',
      sites: [
        { id: 'juejin', name: '掘金', url: 'https://juejin.cn/', description: '中文开发者社区' },
        { id: 'v2ex', name: 'V2EX', url: 'https://www.v2ex.com/', description: '创意工作者社区' },
        { id: 'hackernews', name: 'Hacker News', url: 'https://news.ycombinator.com/', description: '全球科技与创业资讯' },
        { id: 'devto', name: 'DEV Community', url: 'https://dev.to/', description: '全球开发者文章' },
      ],
    },
  ],
}

const CUSTOM_CONFIG: NavigationConfig = {
  templateId: 'plain',
  accent: 'orange',
  modules: [
    {
      id: 'custom-module',
      title: '自定义分类',
      description: '用户保存的分类说明',
      accent: '#123456',
      sites: [
        {
          id: 'custom-site',
          name: '自定义站点',
          url: 'https://example.com/custom',
          description: '用户保存的站点说明',
          shortcut: '⌘9',
        },
      ],
    },
  ],
}

const EmptyTemplate = () => null
const catalog = [
  {
    id: 'bubble',
    name: '默认模板',
    description: '默认模板说明',
    editingHint: '默认编辑提示',
    load: async () => ({ default: EmptyTemplate }),
  },
  {
    id: 'plain',
    name: '纯净模板',
    description: '纯净模板说明',
    editingHint: '纯净编辑提示',
    load: async () => ({ default: EmptyTemplate }),
  },
] satisfies readonly TemplateDefinition[]

function cloneConfig(config: NavigationConfig): NavigationConfig {
  return structuredClone(config)
}

function saveRaw(value: unknown) {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new Error('测试数据必须可以序列化')
  localStorage.setItem(STORAGE_KEY, serialized)
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('usePersistentConfig 初始化', () => {
  it('没有存储内容时返回独立的固定默认配置，且初始化不会主动写入 localStorage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    const { result } = renderHook(() => usePersistentConfig(catalog))

    expect(result.current.config).toEqual(EXPECTED_DEFAULT_CONFIG)
    expect(result.current.storageError).toBeNull()
    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('恢复结构合法且模板 ID 在目录中的完整配置', () => {
    saveRaw(CUSTOM_CONFIG)

    const { result } = renderHook(() => usePersistentConfig(catalog))

    expect(result.current.config).toEqual(CUSTOM_CONFIG)
    expect(result.current.storageError).toBeNull()
  })

  it('恢复缺少模板 ID 的旧配置：保留用户内容，仅补默认模板 ID', () => {
    const legacyConfig = {
      accent: CUSTOM_CONFIG.accent,
      modules: CUSTOM_CONFIG.modules,
    }
    saveRaw(legacyConfig)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    const { result } = renderHook(() => usePersistentConfig(catalog))

    expect(result.current.config).toEqual({ ...legacyConfig, templateId: 'bubble' })
    expect(result.current.config.modules).toEqual(CUSTOM_CONFIG.modules)
    expect(result.current.config.accent).toBe(CUSTOM_CONFIG.accent)
    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(legacyConfig))
  })

  it('未知模板 ID 回退为 bubble，但保留用户模块、站点和配色', () => {
    const saved = { ...cloneConfig(CUSTOM_CONFIG), templateId: 'removed-template' }
    saveRaw(saved)

    const { result } = renderHook(() => usePersistentConfig(catalog))

    expect(result.current.config).toEqual({ ...CUSTOM_CONFIG, templateId: 'bubble' })
    expect(result.current.config.modules).toEqual(CUSTOM_CONFIG.modules)
    expect(result.current.config.accent).toBe('orange')
  })

  it('非法 JSON 回退为固定默认配置，不把读取异常显示为保存错误', () => {
    localStorage.setItem(STORAGE_KEY, '{"templateId":')

    const { result } = renderHook(() => usePersistentConfig(catalog))

    expect(result.current.config).toEqual(EXPECTED_DEFAULT_CONFIG)
    expect(result.current.storageError).toBeNull()
  })

  it.each([
    ['顶层不是对象', ['plain', 'mint', []]],
    ['templateId 不是字符串', { ...CUSTOM_CONFIG, templateId: 7 }],
    ['accent 不是允许值', { ...CUSTOM_CONFIG, accent: 'blue' }],
    ['modules 不是数组', { ...CUSTOM_CONFIG, modules: 'not-an-array' }],
    ['模块缺少 description', {
      ...CUSTOM_CONFIG,
      modules: [{ id: 'broken', title: '损坏分类', accent: '#000000', sites: [] }],
    }],
    ['站点 url 不是字符串', {
      ...CUSTOM_CONFIG,
      modules: [{
        id: 'broken',
        title: '损坏分类',
        description: '损坏数据',
        accent: '#000000',
        sites: [{ id: 'site', name: '站点', url: 1, description: '损坏地址' }],
      }],
    }],
  ])('存储内容不是 NavigationConfig 时回退默认配置：%s', (_name, invalidValue) => {
    saveRaw(invalidValue)

    const { result } = renderHook(() => usePersistentConfig(catalog))

    expect(result.current.config).toEqual(EXPECTED_DEFAULT_CONFIG)
    expect(result.current.storageError).toBeNull()
  })

  it('localStorage.getItem 抛错时仍返回固定默认配置', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage denied', 'SecurityError')
    })

    const { result } = renderHook(() => usePersistentConfig(catalog))

    expect(getItem).toHaveBeenCalledWith(STORAGE_KEY)
    expect(result.current.config).toEqual(EXPECTED_DEFAULT_CONFIG)
    expect(result.current.storageError).toBeNull()
  })
})

describe('usePersistentConfig 更新与持久化', () => {
  it('同一批事件中的连续函数式更新依次读取最新内存状态', () => {
    saveRaw(CUSTOM_CONFIG)
    const { result } = renderHook(() => usePersistentConfig(catalog))
    const observedAccents: NavigationConfig['accent'][] = []

    act(() => {
      result.current.setConfig((current) => {
        observedAccents.push(current.accent)
        return { ...current, accent: 'violet' }
      })
      result.current.setConfig((current) => {
        observedAccents.push(current.accent)
        return {
          ...current,
          modules: [...current.modules, {
            id: 'second-module',
            title: '第二分类',
            description: '由第二次更新新增',
            accent: '#654321',
            sites: [],
          }],
        }
      })
    })

    expect(observedAccents).toEqual(['orange', 'violet'])
    expect(result.current.config.accent).toBe('violet')
    expect(result.current.config.modules.map((module) => module.id)).toEqual(['custom-module', 'second-module'])
  })

  it('传入当前同一个配置对象是 no-op：不改状态、不写存储并返回原对象', () => {
    saveRaw(CUSTOM_CONFIG)
    const { result } = renderHook(() => usePersistentConfig(catalog))
    const current = result.current.config
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    let returned: NavigationConfig | undefined

    act(() => {
      returned = result.current.setConfig(current)
    })

    expect(returned).toBe(current)
    expect(result.current.config).toBe(current)
    expect(result.current.storageError).toBeNull()
    expect(setItem).not.toHaveBeenCalled()
  })

  it('对象式更新直接替换公开状态，并返回同一个新对象', () => {
    saveRaw(CUSTOM_CONFIG)
    const { result } = renderHook(() => usePersistentConfig(catalog))
    const next: NavigationConfig = {
      templateId: 'bubble',
      accent: 'violet',
      modules: [],
    }
    let returned: NavigationConfig | undefined

    act(() => {
      returned = result.current.setConfig(next)
    })

    expect(returned).toBe(next)
    expect(result.current.config).toBe(next)
    expect(result.current.storageError).toBeNull()
  })

  it('成功更新把完整 JSON 写到固定 localStorage key', () => {
    saveRaw(CUSTOM_CONFIG)
    const { result } = renderHook(() => usePersistentConfig(catalog))
    const next: NavigationConfig = {
      ...cloneConfig(CUSTOM_CONFIG),
      accent: 'violet',
      modules: [],
    }
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    act(() => {
      result.current.setConfig(next)
    })

    expect(setItem).toHaveBeenCalledTimes(1)
    expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(next))
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual(next)
  })

  it('setItem 失败时仍保留内存修改并公开固定错误提示', () => {
    saveRaw(CUSTOM_CONFIG)
    const originallyPersisted = localStorage.getItem(STORAGE_KEY)
    const { result } = renderHook(() => usePersistentConfig(catalog))
    const next = { ...cloneConfig(CUSTOM_CONFIG), accent: 'violet' as const }
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    act(() => {
      result.current.setConfig(next)
    })

    expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(next))
    expect(result.current.config).toEqual(next)
    expect(result.current.storageError).toBe(STORAGE_ERROR)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(originallyPersisted)
  })

  it('一次写入失败后，后续成功写入使用最新内存状态、清除错误并恢复持久化', () => {
    saveRaw(CUSTOM_CONFIG)
    const { result } = renderHook(() => usePersistentConfig(catalog))
    const nativeSetItem = Storage.prototype.setItem
    let shouldFail = true
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (shouldFail) {
        shouldFail = false
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      }
      nativeSetItem.call(this, key, value)
    })

    act(() => {
      result.current.setConfig((current) => ({ ...current, accent: 'violet' }))
    })
    expect(result.current.config.accent).toBe('violet')
    expect(result.current.storageError).toBe(STORAGE_ERROR)

    act(() => {
      result.current.setConfig((current) => ({
        ...current,
        modules: [],
      }))
    })

    const expected: NavigationConfig = {
      ...CUSTOM_CONFIG,
      accent: 'violet',
      modules: [],
    }
    expect(result.current.config).toEqual(expected)
    expect(result.current.storageError).toBeNull()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual(expected)
  })

  it('resetConfig 恢复固定默认内容和配色，但保留当前模板 ID 并持久化结果', () => {
    saveRaw(CUSTOM_CONFIG)
    const { result } = renderHook(() => usePersistentConfig(catalog))
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    act(() => {
      result.current.resetConfig()
    })

    const expected = { ...EXPECTED_DEFAULT_CONFIG, templateId: 'plain' }
    expect(result.current.config).toEqual(expected)
    expect(result.current.storageError).toBeNull()
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(expected))
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual(expected)
  })
})


describe('图标位置配置兼容', () => {
  it('旧配置保持关闭且加载不改写原始 localStorage', () => {
    saveRaw(CUSTOM_CONFIG)
    const original = localStorage.getItem(STORAGE_KEY)
    const write = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => usePersistentConfig(catalog))
    expect(result.current.config.iconPositionPersistence).toBeUndefined()
    for (const id of ['matter', 'beijing'] as const) {
      expect(getIconPositionPersistence(result.current.config, id)).toEqual({ enabled: false, positions: {} })
    }
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original)
    expect(write).not.toHaveBeenCalled()
  })

  it('只忽略非法位置，不丢弃模块或另一个模板的数据', () => {
    const valid = { x: 0.2, y: 0.5, angle: 0.8 }
    const other = { x: 0.6, y: 0.7, angle: -1.2 }
    saveRaw({ ...CUSTOM_CONFIG, iconPositionPersistence: {
      matter: { enabled: true, positions: { valid, null: null, array: [], text: { ...valid, x: '0.2' }, range: { ...valid, y: 2 }, angle: { ...valid, angle: null } } },
      beijing: { enabled: true, positions: { other } },
    } })
    const { result } = renderHook(() => usePersistentConfig(catalog))
    expect(result.current.config.modules).toEqual(CUSTOM_CONFIG.modules)
    expect(result.current.config.iconPositionPersistence).toEqual({
      matter: { enabled: true, positions: { valid } }, beijing: { enabled: true, positions: { other } },
    })
  })

  it.each([null, [], false, 'invalid', { matter: null, beijing: { enabled: 'true', positions: [] } }])('损坏的可选位置设置不影响加载：%j', value => {
    saveRaw({ ...CUSTOM_CONFIG, iconPositionPersistence: value })
    const { result } = renderHook(() => usePersistentConfig(catalog))
    expect(result.current.config.modules).toEqual(CUSTOM_CONFIG.modules)
    expect(getIconPositionPersistence(result.current.config, 'matter').enabled).toBe(false)
    expect(getIconPositionPersistence(result.current.config, 'beijing').enabled).toBe(false)
  })

  it('恢复默认内容清除两个模板的位置设置且同步写入存储', () => {
    saveRaw({ ...CUSTOM_CONFIG, iconPositionPersistence: {
      matter: { enabled: true, positions: { a: { x: 0.5, y: 0.6, angle: 0 } } },
      beijing: { enabled: false, positions: { a: { x: 0.2, y: 0.3, angle: 0.4 } } },
    } })
    const { result } = renderHook(() => usePersistentConfig(catalog))
    act(() => {
      result.current.resetConfig()
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).iconPositionPersistence).toBeUndefined()
    })
    expect(result.current.config.iconPositionPersistence).toBeUndefined()
    expect(result.current.config.templateId).toBe(CUSTOM_CONFIG.templateId)
  })
})
