// @vitest-environment jsdom

import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react'
import type { ComponentType } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NavigationTemplateProps, TemplateDefinition } from '../src/templates/types'
import { useTemplateSelection, type LoadedTemplate } from '../src/templates/useTemplateSelection'

type TemplateModule = Awaited<ReturnType<TemplateDefinition['load']>>

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function createDefinition(
  id: string,
  load: TemplateDefinition['load'],
): TemplateDefinition {
  return {
    id,
    name: `${id} name`,
    description: `${id} description`,
    editingHint: `${id} editing hint`,
    load,
  }
}

function moduleWith(Component: ComponentType<NavigationTemplateProps>): TemplateModule {
  return { default: Component }
}

const AlphaTemplate: ComponentType<NavigationTemplateProps> = () => (
  <div data-testid="alpha-template">alpha</div>
)
const BetaTemplate: ComponentType<NavigationTemplateProps> = () => (
  <div data-testid="beta-template">beta</div>
)
const ReplacementAlphaTemplate: ComponentType<NavigationTemplateProps> = () => (
  <div data-testid="replacement-alpha-template">replacement alpha</div>
)

const templateProps: NavigationTemplateProps = {
  modules: [],
  frequentSites: [],
  editing: false,
  interactionBlocked: false,
  revealSite: null,
  actions: {
    enterEditMode: vi.fn(),
    openSettings: vi.fn(),
    addSite: vi.fn(),
    edit: vi.fn(),
    removeSite: vi.fn(),
    removeModule: vi.fn(),
    moveSite: vi.fn(() => true),
    visitSite: vi.fn(),
  },
  onInteractionStateChange: vi.fn(),
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useTemplateSelection', () => {
  it('初始异步加载期间公开 loading，成功后提交默认导出组件', async () => {
    const pending = createDeferred<TemplateModule>()
    const loader = vi.fn(() => pending.promise)
    const definition = createDefinition('alpha', loader)
    const catalog = [definition]
    const { result } = renderHook(() => useTemplateSelection(catalog, 'alpha'))

    expect(loader).toHaveBeenCalledTimes(1)
    expect(result.current.active).toBeNull()
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()

    await act(async () => {
      pending.resolve(moduleWith(AlphaTemplate))
      await pending.promise
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeNull()
    expect(result.current.active).toEqual({ definition, Component: AlphaTemplate })

    const ActiveComponent = result.current.active?.Component
    expect(ActiveComponent).toBe(AlphaTemplate)
    if (!ActiveComponent) throw new Error('initial template did not load')
    const rendered = render(<ActiveComponent {...templateProps} />)
    expect(rendered.getByTestId('alpha-template').textContent).toBe('alpha')
  })

  it('初始加载失败时保留空 active，并允许 retryInitial 清错后成功', async () => {
    const firstAttempt = createDeferred<TemplateModule>()
    const retryAttempt = createDeferred<TemplateModule>()
    const loader = vi.fn<TemplateDefinition['load']>()
      .mockImplementationOnce(() => firstAttempt.promise)
      .mockImplementationOnce(() => retryAttempt.promise)
    const definition = createDefinition('alpha', loader)
    const catalog = [definition]
    const { result } = renderHook(() => useTemplateSelection(catalog, 'alpha'))

    await act(async () => {
      firstAttempt.reject(new Error('first attempt failed'))
      await firstAttempt.promise.catch(() => undefined)
    })

    await waitFor(() => expect(result.current.error).toBe('模板加载失败，请重试。'))
    expect(result.current.active).toBeNull()
    expect(result.current.loading).toBe(false)

    act(() => result.current.retryInitial())
    expect(loader).toHaveBeenCalledTimes(2)
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()

    await act(async () => {
      retryAttempt.resolve(moduleWith(AlphaTemplate))
      await retryAttempt.promise
    })

    await waitFor(() => expect(result.current.active?.Component).toBe(AlphaTemplate))
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('未知 ID 不调用 loader、commit，也不改变已有错误状态', async () => {
    const loader = vi.fn<TemplateDefinition['load']>()
      .mockRejectedValue(new Error('known template failed'))
    const definition = createDefinition('alpha', loader)
    const catalog = [definition]
    const commit = vi.fn<(loaded: LoadedTemplate) => void>()
    const { result } = renderHook(() => useTemplateSelection(catalog, 'alpha'))

    await waitFor(() => expect(result.current.error).toBe('模板加载失败，请重试。'))
    const loaderCallsBeforeUnknownLoad = loader.mock.calls.length

    await act(async () => {
      await result.current.load('missing', commit)
    })

    // 只证明未知 ID 没有新增加载；不把挂载阶段 effect 的具体执行次数当成契约。
    expect(loader.mock.calls).toHaveLength(loaderCallsBeforeUnknownLoad)
    expect(commit).not.toHaveBeenCalled()
    expect(result.current.active).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe('模板加载失败，请重试。')
  })

  it('同一时间只允许一个 load，后续重复或不同 ID 请求都被保护', async () => {
    const alphaPending = createDeferred<TemplateModule>()
    const alphaLoader = vi.fn(() => alphaPending.promise)
    const betaLoader = vi.fn(async () => moduleWith(BetaTemplate))
    const catalog = [
      createDefinition('alpha', alphaLoader),
      createDefinition('beta', betaLoader),
    ]
    const firstCommit = vi.fn<(loaded: LoadedTemplate) => void>()
    const duplicateCommit = vi.fn<(loaded: LoadedTemplate) => void>()
    const competingCommit = vi.fn<(loaded: LoadedTemplate) => void>()
    const { result } = renderHook(() => useTemplateSelection(catalog, 'missing'))
    let firstLoad!: Promise<void>
    let duplicateLoad!: Promise<void>
    let competingLoad!: Promise<void>

    act(() => {
      firstLoad = result.current.load('alpha', firstCommit)
      duplicateLoad = result.current.load('alpha', duplicateCommit)
      competingLoad = result.current.load('beta', competingCommit)
    })

    expect(result.current.loading).toBe(true)
    expect(alphaLoader).toHaveBeenCalledTimes(1)
    expect(betaLoader).not.toHaveBeenCalled()
    await expect(duplicateLoad).resolves.toBeUndefined()
    await expect(competingLoad).resolves.toBeUndefined()

    await act(async () => {
      alphaPending.resolve(moduleWith(AlphaTemplate))
      await firstLoad
    })

    expect(firstCommit).toHaveBeenCalledTimes(1)
    expect(duplicateCommit).not.toHaveBeenCalled()
    expect(competingCommit).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
  })

  it('成功结果按 ID 缓存，二次选择不再调用 loader 并复用同一 LoadedTemplate', async () => {
    const loader = vi.fn(async () => moduleWith(AlphaTemplate))
    const definition = createDefinition('alpha', loader)
    const catalog = [definition]
    const firstCommit = vi.fn<(loaded: LoadedTemplate) => void>()
    const secondCommit = vi.fn<(loaded: LoadedTemplate) => void>()
    const { result } = renderHook(() => useTemplateSelection(catalog, 'missing'))

    await act(async () => {
      await result.current.load('alpha', firstCommit)
    })
    await act(async () => {
      await result.current.load('alpha', secondCommit)
    })

    expect(loader).toHaveBeenCalledTimes(1)
    expect(firstCommit).toHaveBeenCalledTimes(1)
    expect(secondCommit).toHaveBeenCalledTimes(1)
    expect(secondCommit.mock.calls[0][0]).toBe(firstCommit.mock.calls[0][0])
    expect(secondCommit.mock.calls[0][0]).toEqual({ definition, Component: AlphaTemplate })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('cancel 清理错误和 loading，并阻止被取消 Promise 的晚到提交', async () => {
    const failedLoader = vi.fn<TemplateDefinition['load']>()
      .mockRejectedValue(new Error('failed'))
    const pending = createDeferred<TemplateModule>()
    const pendingLoader = vi.fn(() => pending.promise)
    const catalog = [
      createDefinition('failed', failedLoader),
      createDefinition('pending', pendingLoader),
    ]
    const commit = vi.fn<(loaded: LoadedTemplate) => void>()
    const { result } = renderHook(() => useTemplateSelection(catalog, 'missing'))

    await act(async () => {
      await result.current.load('failed', vi.fn())
    })
    expect(result.current.error).toBe('模板加载失败，请重试。')

    act(() => result.current.cancel())
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)

    let pendingLoad!: Promise<void>
    act(() => {
      pendingLoad = result.current.load('pending', commit)
    })
    expect(result.current.loading).toBe(true)

    act(() => result.current.cancel())
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()

    await act(async () => {
      pending.resolve(moduleWith(BetaTemplate))
      await pendingLoad
    })

    expect(commit).not.toHaveBeenCalled()
    expect(result.current.active).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('旧请求成功晚到时不提交、不结束新请求，且不会污染新结果缓存', async () => {
    const stalePending = createDeferred<TemplateModule>()
    const currentPending = createDeferred<TemplateModule>()
    const loader = vi.fn<TemplateDefinition['load']>()
      .mockImplementationOnce(() => stalePending.promise)
      .mockImplementationOnce(() => currentPending.promise)
    const definition = createDefinition('alpha', loader)
    const catalog = [definition]
    const staleCommit = vi.fn<(loaded: LoadedTemplate) => void>()
    const currentCommit = vi.fn<(loaded: LoadedTemplate) => void>()
    const cachedCommit = vi.fn<(loaded: LoadedTemplate) => void>()
    const { result } = renderHook(() => useTemplateSelection(catalog, 'missing'))
    let staleLoad!: Promise<void>
    let currentLoad!: Promise<void>

    act(() => {
      staleLoad = result.current.load('alpha', staleCommit)
    })
    act(() => result.current.cancel())
    act(() => {
      currentLoad = result.current.load('alpha', currentCommit)
    })

    await act(async () => {
      stalePending.resolve(moduleWith(AlphaTemplate))
      await staleLoad
    })

    expect(staleCommit).not.toHaveBeenCalled()
    expect(currentCommit).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()

    await act(async () => {
      currentPending.resolve(moduleWith(BetaTemplate))
      await currentLoad
    })

    expect(currentCommit).toHaveBeenCalledTimes(1)
    expect(currentCommit.mock.calls[0][0].Component).toBe(BetaTemplate)

    await act(async () => {
      await result.current.load('alpha', cachedCommit)
    })
    expect(loader).toHaveBeenCalledTimes(2)
    expect(cachedCommit.mock.calls[0][0]).toBe(currentCommit.mock.calls[0][0])
  })

  it('旧 token 的失败不影响当前请求，只有当前 token 失败才公开错误并结束 loading', async () => {
    const stalePending = createDeferred<TemplateModule>()
    const currentPending = createDeferred<TemplateModule>()
    const alphaLoader = vi.fn(() => stalePending.promise)
    const betaLoader = vi.fn(() => currentPending.promise)
    const catalog = [
      createDefinition('alpha', alphaLoader),
      createDefinition('beta', betaLoader),
    ]
    const { result } = renderHook(() => useTemplateSelection(catalog, 'missing'))
    let staleLoad!: Promise<void>
    let currentLoad!: Promise<void>

    act(() => {
      staleLoad = result.current.load('alpha', vi.fn())
    })
    act(() => result.current.cancel())
    act(() => {
      currentLoad = result.current.load('beta', vi.fn())
    })

    await act(async () => {
      stalePending.reject(new Error('stale failure'))
      await staleLoad
    })

    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()

    await act(async () => {
      currentPending.reject(new Error('current failure'))
      await currentLoad
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe('模板加载失败，请重试。')
  })

  it('卸载会使请求失效，Promise 晚到时不再执行外部 commit', async () => {
    const pending = createDeferred<TemplateModule>()
    const loader = vi.fn(() => pending.promise)
    const definition = createDefinition('alpha', loader)
    const catalog = [definition]
    const commit = vi.fn<(loaded: LoadedTemplate) => void>()
    const { result, unmount } = renderHook(() => useTemplateSelection(catalog, 'missing'))
    let loadPromise!: Promise<void>

    act(() => {
      loadPromise = result.current.load('alpha', commit)
    })
    expect(result.current.loading).toBe(true)

    unmount()
    pending.resolve(moduleWith(AlphaTemplate))
    await loadPromise

    expect(commit).not.toHaveBeenCalled()
  })

  it('显式 load 只调用传入 commit；是否替换 active 由调用方决定', async () => {
    const loader = vi.fn(async () => moduleWith(BetaTemplate))
    const definition = createDefinition('beta', loader)
    const catalog = [definition]
    const commit = vi.fn<(loaded: LoadedTemplate) => void>()
    const { result } = renderHook(() => useTemplateSelection(catalog, 'missing'))

    await act(async () => {
      await result.current.load('beta', commit)
    })

    expect(commit).toHaveBeenCalledOnce()
    expect(commit).toHaveBeenCalledWith({ definition, Component: BetaTemplate })
    expect(result.current.active).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('调用方可把 setActive 作为显式 load 的 commit 来完成切换', async () => {
    const loader = vi.fn(async () => moduleWith(BetaTemplate))
    const definition = createDefinition('beta', loader)
    const catalog = [definition]
    const { result } = renderHook(() => useTemplateSelection(catalog, 'missing'))

    await act(async () => {
      await result.current.load('beta', result.current.setActive)
    })

    expect(result.current.active).toEqual({ definition, Component: BetaTemplate })
  })

  it('仅 initialId 属性变化不会自动重载；retryInitial 始终指向首次挂载 ID', async () => {
    const alphaLoader = vi.fn(async () => moduleWith(AlphaTemplate))
    const betaLoader = vi.fn(async () => moduleWith(BetaTemplate))
    const alphaDefinition = createDefinition('alpha', alphaLoader)
    const betaDefinition = createDefinition('beta', betaLoader)
    const catalog = [alphaDefinition, betaDefinition]
    const { result, rerender } = renderHook(
      ({ initialId }: { initialId: string }) => useTemplateSelection(catalog, initialId),
      { initialProps: { initialId: 'alpha' } },
    )

    await waitFor(() => expect(result.current.active?.Component).toBe(AlphaTemplate))

    rerender({ initialId: 'beta' })
    await act(async () => undefined)

    expect(result.current.active?.definition.id).toBe('alpha')
    expect(alphaLoader).toHaveBeenCalledTimes(1)
    expect(betaLoader).not.toHaveBeenCalled()

    await act(async () => result.current.retryInitial())
    expect(alphaLoader).toHaveBeenCalledTimes(1)
    expect(betaLoader).not.toHaveBeenCalled()
    expect(result.current.active?.definition.id).toBe('alpha')
  })

  it('catalog 在初始请求期间变化会让旧请求过期，并使用新 catalog 重试首次 ID', async () => {
    const oldPending = createDeferred<TemplateModule>()
    const newPending = createDeferred<TemplateModule>()
    const oldLoader = vi.fn(() => oldPending.promise)
    const newLoader = vi.fn(() => newPending.promise)
    const oldDefinition = createDefinition('alpha', oldLoader)
    const newDefinition = createDefinition('alpha', newLoader)
    const { result, rerender } = renderHook(
      ({ catalog }: { catalog: readonly TemplateDefinition[] }) => useTemplateSelection(catalog, 'alpha'),
      { initialProps: { catalog: [oldDefinition] } },
    )

    expect(result.current.loading).toBe(true)
    rerender({ catalog: [newDefinition] })
    expect(oldLoader).toHaveBeenCalledTimes(1)
    expect(newLoader).toHaveBeenCalledTimes(1)
    expect(result.current.loading).toBe(true)

    await act(async () => {
      oldPending.resolve(moduleWith(AlphaTemplate))
      await oldPending.promise
    })

    expect(result.current.active).toBeNull()
    expect(result.current.loading).toBe(true)

    await act(async () => {
      newPending.resolve(moduleWith(ReplacementAlphaTemplate))
      await newPending.promise
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.active).toEqual({
      definition: newDefinition,
      Component: ReplacementAlphaTemplate,
    })
  })

  it('catalog 移除首次 ID 后，已有 active 保持不变且不会产生错误', async () => {
    const alphaLoader = vi.fn(async () => moduleWith(AlphaTemplate))
    const alphaDefinition = createDefinition('alpha', alphaLoader)
    const betaLoader = vi.fn(async () => moduleWith(BetaTemplate))
    const betaDefinition = createDefinition('beta', betaLoader)
    const { result, rerender } = renderHook(
      ({ catalog }: { catalog: readonly TemplateDefinition[] }) => useTemplateSelection(catalog, 'alpha'),
      { initialProps: { catalog: [alphaDefinition] } },
    )

    await waitFor(() => expect(result.current.active?.Component).toBe(AlphaTemplate))
    rerender({ catalog: [betaDefinition] })
    await act(async () => undefined)

    expect(alphaLoader).toHaveBeenCalledTimes(1)
    expect(betaLoader).not.toHaveBeenCalled()
    expect(result.current.active).toEqual({ definition: alphaDefinition, Component: AlphaTemplate })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

})
