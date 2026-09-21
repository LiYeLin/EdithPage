// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { NavigationTemplateProps } from '../../src/templates/types'
import type { createBeijingScene } from '../../src/templates/beijing/scene'
import type { TerrainLayout } from '../../src/templates/beijing/terrain'
import { installDomStubs } from './testEnvironment'

const runtime = vi.hoisted(() => ({ reconcile: vi.fn(), setPaused: vi.fn(), dispose: vi.fn() }))
const createScene = vi.hoisted(() => vi.fn<typeof createBeijingScene>())
vi.mock('../../src/templates/beijing/scene', () => ({ createBeijingScene: createScene }))
import BeijingTemplate from '../../src/templates/beijing/BeijingTemplate'

const visual = readFileSync('public/terrain/beijing-landmarks.svg', 'utf8')
const terrain = readFileSync('public/terrain/beijing-terrain.svg', 'utf8')
const modules = [{ id: 'a', title: '分类', description: '', accent: '#9ff7cd', sites: [{ id: 'alpha', name: 'Alpha', url: 'https://example.com/alpha', description: '' }] }]
function props(overrides: Partial<NavigationTemplateProps> = {}): NavigationTemplateProps {
  return {
    modules, frequentSites: [], editing: false, interactionBlocked: false, revealSite: null,
    actions: { visitSite: vi.fn(), edit: vi.fn(), removeSite: vi.fn(), removeModule: vi.fn(), moveSite: vi.fn(() => true),
      addSite: vi.fn(), openSettings: vi.fn(), enterEditMode: vi.fn() },
    onInteractionStateChange: vi.fn(), ...overrides,
  }
}
let media: ReturnType<typeof installDomStubs>
beforeEach(() => {
  media = installDomStubs()
  vi.clearAllMocks()
  createScene.mockReset().mockReturnValue(runtime)
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, text: async () => url.includes('landmarks') ? visual : terrain })))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

test('load both assets before starting, preserve the runtime on site edits and dispose on unmount', async () => {
  const input = props()
  const view = render(<BeijingTemplate {...input} />)
  expect(screen.getByRole('status')).toHaveTextContent('正在加载')
  await waitFor(() => expect(createScene).toHaveBeenCalledTimes(1))
  expect(runtime.reconcile).toHaveBeenLastCalledWith([{ site: modules[0].sites[0], module: modules[0] }])
  const next = structuredClone(modules)
  next[0].sites[0].name = 'Changed'
  view.rerender(<BeijingTemplate {...input} modules={next} interactionBlocked />)
  expect(createScene).toHaveBeenCalledTimes(1)
  expect(runtime.reconcile.mock.lastCall?.[0][0].site.name).toBe('Changed')
  expect(runtime.setPaused).toHaveBeenLastCalledWith(true)
  view.unmount()
  expect(runtime.dispose).toHaveBeenCalledTimes(1)
  expect(input.onInteractionStateChange).toHaveBeenLastCalledWith({ dragging: false, settling: false })
})

test.each(['loading', 'physical'] as const)('%s links/edit controls continue to call public actions', async state => {
  const input = props({ editing: true })
  render(<BeijingTemplate {...input} />)
  if (state === 'physical') await screen.findByLabelText('北京地标物理舞台')
  else expect(screen.getByLabelText('网站列表')).toBeInTheDocument()
  const link = screen.getByRole('link', { name: 'Alpha，打开站点' })
  expect(link).toHaveAttribute('href', modules[0].sites[0].url)
  expect(link).toHaveAttribute('target', '_blank')
  expect(link).toHaveAttribute('rel', 'noreferrer')
  expect(fireEvent.dragStart(link)).toBe(false)
  fireEvent.click(link)
  fireEvent.click(screen.getByRole('button', { name: '编辑 Alpha' }))
  fireEvent.click(screen.getByRole('button', { name: '删除 Alpha' }))
  expect(input.actions.visitSite).toHaveBeenCalledExactlyOnceWith('alpha')
  expect(input.actions.edit).toHaveBeenCalledWith({ type: 'site', moduleId: 'a', siteId: 'alpha' })
  expect(input.actions.removeSite).toHaveBeenCalledWith('a', 'alpha')
  await waitFor(() => expect(createScene).toHaveBeenCalledTimes(1))
})

test('aborts in-flight asset requests and ignores their late completion after unmount', async () => {
  let resolve!: (value: { ok: boolean; text: () => Promise<string> }) => void
  const delayed = new Promise<{ ok: boolean; text: () => Promise<string> }>(done => { resolve = done })
  const fetchMock = vi.fn(() => delayed)
  vi.stubGlobal('fetch', fetchMock)
  const view = render(<BeijingTemplate {...props()} />)
  const signal = (fetchMock.mock.calls[0] as unknown as [string, { signal: AbortSignal }])[1].signal
  view.unmount()
  expect(signal.aborted).toBe(true)
  await act(async () => { resolve({ ok: true, text: async () => terrain }); await delayed })
  expect(createScene).not.toHaveBeenCalled()
})

test('missing assets fall back with retry; no half-ready terrain is started', async () => {
  vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response)
  render(<BeijingTemplate {...props()} />)
  await screen.findByRole('alert')
  expect(createScene).not.toHaveBeenCalled()
  expect(screen.getByRole('link', { name: 'Alpha，打开站点' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '重试加载地形' }))
  await waitFor(() => expect(createScene).toHaveBeenCalledTimes(1))
})

test('motion preference changes dispose physical state and keep a usable static list', async () => {
  render(<BeijingTemplate {...props()} />)
  await waitFor(() => expect(createScene).toHaveBeenCalledTimes(1))
  act(() => media.setMatches(true))
  expect(runtime.dispose).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('status')).toHaveTextContent('已减少动态效果')
  expect(screen.getByRole('link', { name: 'Alpha，打开站点' })).toBeVisible()
  act(() => media.setMatches(false))
  await waitFor(() => expect(createScene).toHaveBeenCalledTimes(2))
  expect(fetch).toHaveBeenCalledTimes(2)
})

test('empty content exposes shared settings rather than a dead scene', () => {
  act(() => media.setMatches(true))
  const input = props({ modules: [] })
  render(<BeijingTemplate {...input} />)
  fireEvent.click(screen.getByRole('button', { name: '添加网站' }))
  expect(input.actions.openSettings).toHaveBeenCalledTimes(1)
  expect(createScene).not.toHaveBeenCalled()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

test.each(['visual', 'collision'] as const)('a %s asset arriving first cannot start a half-ready scene', async first => {
  const display = deferred<string>()
  const solid = deferred<string>()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, text: () => url.includes('landmarks') ? display.promise : solid.promise })))
  render(<BeijingTemplate {...props()} />)
  await act(async () => {
    if (first === 'visual') display.resolve(visual)
    else solid.resolve(terrain)
  })
  expect(createScene).not.toHaveBeenCalled()
  expect(screen.getByRole('status')).toHaveTextContent('正在加载')
  expect(screen.getByRole('link', { name: 'Alpha，打开站点' })).toBeVisible()
  await act(async () => {
    display.resolve(visual)
    solid.resolve(terrain)
  })
  expect(createScene).toHaveBeenCalledOnce()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('malformed geometry leaves a usable fallback even when both HTTP requests succeed', async () => {
  vi.mocked(fetch).mockResolvedValueOnce({ ok: true, text: async () => '<svg/>' } as Response)
  const input = props()
  render(<BeijingTemplate {...input} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('加载失败')
  expect(createScene).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('link', { name: 'Alpha，打开站点' }))
  expect(input.actions.visitSite).toHaveBeenCalledExactlyOnceWith('alpha')
  expect(screen.getByRole('button', { name: '重试加载地形' })).toBeEnabled()
})

test('a Canvas startup failure falls back and a successful retry creates just one live runtime', async () => {
  createScene.mockImplementationOnce(() => { throw new Error('Canvas unavailable') })
  const input = props()
  const view = render(<BeijingTemplate {...input} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('加载失败')
  expect(screen.getByLabelText('网站列表')).toBeVisible()
  expect(runtime.reconcile).not.toHaveBeenCalled()
  expect(runtime.dispose).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '重试加载地形' }))
  await screen.findByLabelText('北京地标物理舞台')
  expect(createScene).toHaveBeenCalledTimes(2)
  expect(runtime.reconcile).toHaveBeenCalledOnce()
  expect(runtime.setPaused).toHaveBeenLastCalledWith(false)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  view.unmount()
  expect(runtime.dispose).toHaveBeenCalledOnce()
})

test('initial reduced-motion mode skips fetch and Canvas, while navigation and editing remain available', () => {
  media.setMatches(true)
  const input = props({ editing: true })
  const view = render(<BeijingTemplate {...input} />)
  expect(screen.getByRole('status')).toHaveTextContent('已减少动态效果')
  expect(fetch).not.toHaveBeenCalled()
  expect(createScene).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('link', { name: 'Alpha，打开站点' }))
  fireEvent.click(screen.getByRole('button', { name: '编辑 Alpha' }))
  expect(input.actions.visitSite).toHaveBeenCalledExactlyOnceWith('alpha')
  expect(input.actions.edit).toHaveBeenCalledExactlyOnceWith({ type: 'site', moduleId: 'a', siteId: 'alpha' })
  expect(media.listeners.size).toBe(1)
  view.unmount()
  expect(media.listeners.size).toBe(0)
  expect(runtime.dispose).not.toHaveBeenCalled()
})

test.each(['valid', 'invalid'] as const)('a stale %s request cannot overwrite a newer scene after a motion toggle', async stale => {
  const display = deferred<string>()
  const solid = deferred<string>()
  vi.mocked(fetch)
    .mockResolvedValueOnce({ ok: true, text: () => display.promise } as Response)
    .mockResolvedValueOnce({ ok: true, text: () => solid.promise } as Response)
  render(<BeijingTemplate {...props()} />)
  const oldSignal = vi.mocked(fetch).mock.calls[0][1]!.signal!
  act(() => media.setMatches(true))
  expect(oldSignal.aborted).toBe(true)
  act(() => media.setMatches(false))
  await screen.findByLabelText('北京地标物理舞台')
  expect(fetch).toHaveBeenCalledTimes(4)
  expect(createScene).toHaveBeenCalledOnce()
  await act(async () => {
    display.resolve(stale === 'valid' ? visual : '<svg>')
    solid.resolve(terrain)
  })
  expect(createScene).toHaveBeenCalledOnce()
  expect(runtime.dispose).not.toHaveBeenCalled()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByLabelText('北京地标物理舞台')).toBeVisible()
})

test('the line-art uses the runtime’s layout on desktop and mobile without injecting raw SVG', async () => {
  const { container } = render(<BeijingTemplate {...props()} />)
  await waitFor(() => expect(createScene).toHaveBeenCalledOnce())
  const options = createScene.mock.calls[0][2]
  const desktop: TerrainLayout = {
    width: 1440, height: 1000, scale: 0.5, groundY: 983.25,
    buildings: [
      { id: 'temple-of-heaven', x: 270, y: 703.25 },
      { id: 'forbidden-city', x: 270, y: 703.25 },
      { id: 'china-zun', x: 270, y: 703.25 },
    ],
  }
  act(() => options.onLayout(desktop))
  const svg = container.querySelector('svg.beijing-landmarks')!
  expect(svg).toHaveAttribute('viewBox', '0 0 1440 1000')
  expect(svg).toHaveAttribute('aria-hidden', 'true')
  expect(svg.querySelectorAll('[data-landmark]')).toHaveLength(3)
  for (const group of svg.querySelectorAll('[data-landmark]')) {
    expect(group).toHaveAttribute('transform', 'translate(270 703.25) scale(0.5)')
    expect(group.querySelectorAll('path').length).toBeGreaterThan(1)
    for (const path of group.querySelectorAll('path')) expect(path).toHaveAttribute('vector-effect', 'non-scaling-stroke')
  }
  expect(svg.querySelector('script, style')).toBeNull()
  expect(svg.querySelector('.beijing-line-ground')).toHaveAttribute('d', 'M 0 983.25 H 1440')
  act(() => options.onLayout({
    width: 390, height: 844, scale: 0.25, groundY: 827.25,
    buildings: [
      { id: 'temple-of-heaven', x: 21.25, y: 687.25 },
      { id: 'forbidden-city', x: -14.5, y: 687.25 },
      { id: 'china-zun', x: -65.75, y: 687.25 },
    ],
  }))
  expect(svg).toHaveAttribute('viewBox', '0 0 390 844')
  expect(svg.querySelector('[data-landmark="temple-of-heaven"]')).toHaveAttribute('transform', 'translate(21.25 687.25) scale(0.25)')
  expect(svg.querySelector('[data-landmark="forbidden-city"]')).toHaveAttribute('transform', 'translate(-14.5 687.25) scale(0.25)')
  expect(svg.querySelector('[data-landmark="china-zun"]')).toHaveAttribute('transform', 'translate(-65.75 687.25) scale(0.25)')
  expect(svg.querySelector('.beijing-line-ground')).toHaveAttribute('d', 'M 0 827.25 H 390')
  expect(options.iconFor('alpha')).toBe(container.querySelector('[data-site-id="alpha"]'))
  expect(options.iconFor('removed')).toBeUndefined()
  expect(createScene).toHaveBeenCalledOnce()
})

test('public panel blocking makes the template inert and pauses only until the panel closes', async () => {
  const input = props({ interactionBlocked: true })
  const view = render(<BeijingTemplate {...input} />)
  await screen.findByLabelText('北京地标物理舞台')
  expect(screen.getByRole('region', { name: '北京地标导航模板' })).toHaveAttribute('inert')
  expect(screen.getByRole('button', { name: '进入编辑模式' })).toBeDisabled()
  expect(runtime.setPaused).toHaveBeenLastCalledWith(true)
  view.rerender(<BeijingTemplate {...input} interactionBlocked={false} />)
  expect(screen.getByRole('region', { name: '北京地标导航模板' })).not.toHaveAttribute('inert')
  expect(runtime.setPaused).toHaveBeenLastCalledWith(false)
  fireEvent.click(screen.getByRole('button', { name: '进入编辑模式' }))
  expect(input.actions.enterEditMode).toHaveBeenCalledOnce()
  expect(createScene).toHaveBeenCalledOnce()
})

test('frequent-site navigation and edit/delete actions are forwarded to the shared layer', async () => {
  const input = props({ frequentSites: [{ moduleId: 'a', site: modules[0].sites[0] }] })
  const view = render(<BeijingTemplate {...input} />)
  await screen.findByLabelText('北京地标物理舞台')
  const frequent = within(screen.getByRole('region', { name: '最常使用' }))
  fireEvent.click(frequent.getByRole('link'))
  fireEvent.click(frequent.getByRole('button', { name: '编辑最常使用的 Alpha' }))
  expect(input.actions.visitSite).toHaveBeenCalledExactlyOnceWith('alpha')
  expect(input.actions.enterEditMode).toHaveBeenCalledOnce()
  view.rerender(<BeijingTemplate {...input} editing />)
  fireEvent.click(frequent.getByRole('link', { name: '编辑 Alpha' }))
  fireEvent.click(frequent.getByRole('button', { name: '编辑 Alpha' }))
  fireEvent.click(frequent.getByRole('button', { name: '删除 Alpha' }))
  expect(input.actions.edit).toHaveBeenCalledTimes(2)
  expect(input.actions.edit).toHaveBeenLastCalledWith({ type: 'site', moduleId: 'a', siteId: 'alpha' })
  expect(input.actions.removeSite).toHaveBeenCalledExactlyOnceWith('a', 'alpha')
  expect(input.actions.visitSite).toHaveBeenCalledOnce()
  expect(createScene).toHaveBeenCalledOnce()
})


test('toggle rebuilds resume with the current blocked state; snapshot updates do not rebuild', async () => {
  const input = props()
  const saveIconPositions = vi.fn()
  input.actions.saveIconPositions = saveIconPositions
  const { rerender } = render(<BeijingTemplate {...input} />)
  await waitFor(() => expect(createScene).toHaveBeenCalledOnce())
  runtime.setPaused.mockClear()
  const persistence = { enabled: true, positions: { alpha: { x: 0.3, y: 0.4, angle: 0.5 } } }
  rerender(<BeijingTemplate {...input} iconPositionPersistence={persistence} />)
  expect(createScene).toHaveBeenCalledTimes(2)
  expect(runtime.setPaused).toHaveBeenLastCalledWith(false)
  const options = createScene.mock.lastCall![2]
  expect(options.getIconPositionPersistence?.()).toEqual(persistence)
  options.saveIconPositions?.(persistence.positions)
  expect(saveIconPositions).toHaveBeenLastCalledWith('beijing', persistence.positions)
  rerender(<BeijingTemplate {...input} iconPositionPersistence={{ ...persistence, positions: {} }} />)
  expect(createScene).toHaveBeenCalledTimes(2)
  expect(options.getIconPositionPersistence?.()?.positions).toEqual({})
})
