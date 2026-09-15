// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState, type ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import type { NavigationTemplateProps, TemplateDefinition } from '../src/templates/types'
import type { NavigationConfig, Site } from '../src/types'

const CONFIG_KEY = 'edith-navigation-config-v3'
const USAGE_KEY = 'edith-navigation-usage-v1'
const ENGINE_KEY = 'edith-navigation-search-engine-v1'
const ONBOARDING_KEY = 'edith-navigation-onboarding-completed-v1'

const makeSite = (id: string, name: string): Site => ({
  id,
  name,
  url: `https://example.com/${id}`,
  description: `${name} description`,
})

const fixtureConfig: NavigationConfig = {
  templateId: 'bubble',
  accent: 'violet',
  modules: [
    {
      id: 'one',
      title: '分类一',
      description: '第一个分类',
      accent: '#9ff7cd',
      sites: [makeSite('alpha', 'Alpha'), makeSite('beta', 'Beta'), makeSite('gamma', 'Gamma')],
    },
    {
      id: 'two',
      title: '分类二',
      description: '第二个分类',
      accent: '#b9b6ff',
      sites: [makeSite('delta', 'Delta'), makeSite('echo', 'Echo')],
    },
    {
      id: 'empty',
      title: '空分类',
      description: '空分类',
      accent: '#ffbd7b',
      sites: [],
    },
  ],
}

type ProbeProps = NavigationTemplateProps & { label: string }

function ProbeTemplate({
  label,
  modules,
  frequentSites,
  editing,
  interactionBlocked,
  revealSite,
  actions,
  onInteractionStateChange,
}: ProbeProps) {
  const [localCount, setLocalCount] = useState(0)
  const [moveResult, setMoveResult] = useState('尚未移动')
  const [invalidMoveResult, setInvalidMoveResult] = useState('尚未校验')

  const betaOwner = modules.find((module) => module.sites.some((site) => site.id === 'beta'))
  const one = modules.find((module) => module.id === 'one')

  return (
    <section data-testid={`template-${label}`} aria-label={`测试模板 ${label}`} inert={interactionBlocked}>
      <h1>当前模板：{label}</h1>
      <p data-testid="editing-state">编辑状态：{editing ? '开启' : '关闭'}</p>
      <p data-testid="interaction-state">交互阻断：{interactionBlocked ? '是' : '否'}</p>
      <p role="status" aria-label="定位请求">
        {revealSite ? `定位 ${revealSite.moduleId}/${revealSite.siteId}` : '无定位请求'}
      </p>
      <p data-testid="local-count">模板本地计数：{localCount}</p>
      <button type="button" onClick={() => setLocalCount((count) => count + 1)}>增加模板本地计数</button>
      <button type="button" onClick={actions.enterEditMode}>进入编辑模式</button>
      <button type="button" onClick={actions.openSettings}>模板设置入口</button>
      <button type="button" onClick={() => onInteractionStateChange({ dragging: true, settling: false })}>开始拖拽</button>
      <button type="button" onClick={() => onInteractionStateChange({ dragging: false, settling: true })}>开始收尾</button>
      <button type="button" onPointerUp={() => onInteractionStateChange({ dragging: false, settling: false })} onClick={() => onInteractionStateChange({ dragging: false, settling: false })}>结束交互</button>
      <button type="button" onClick={() => {
        window.setTimeout(() => onInteractionStateChange({ dragging: true, settling: false }), 10)
      }}>切换加载期间变忙</button>
      {editing && <button type="button" onClick={() => { actions.removeSite('missing', 'missing'); actions.removeModule('missing') }}>执行无效删除</button>}

      <div data-testid="blank-area">模板空白区</div>
      <div data-editing-interactive data-testid="declared-interactive"><span>声明的交互区</span></div>
      <button type="button" data-testid="real-button"><span>真实按钮内部</span></button>
      <a href="#probe" onClick={(event) => event.preventDefault()}>真实链接</a>
      <label htmlFor={`probe-input-${label}`}>真实标签</label>
      <input id={`probe-input-${label}`} aria-label="真实输入框" />
      <select aria-label="真实选择框" defaultValue="one"><option value="one">一</option></select>
      <form aria-label="真实表单" onSubmit={(event) => event.preventDefault()}><span>表单内容</span></form>

      <ol aria-label="最常使用顺序">
        {frequentSites.map(({ site, moduleId }, index) => (
          <li key={`${moduleId}-${site.id}-${index}`}>{site.name}</li>
        ))}
      </ol>

      {modules.map((module) => (
        <section data-editing-interactive aria-label={`分类 ${module.title}`} data-module-id={module.id} key={module.id}>
          <h2>{module.title}</h2>
          <ol aria-label={`${module.title}站点顺序`}>
            {module.sites.map((site) => <li key={site.id}>{site.name}</li>)}
          </ol>
          {editing && (
            <>
              <button type="button" onClick={() => actions.edit({ type: 'module', moduleId: module.id })}>编辑分类 {module.title}</button>
              <button type="button" onClick={() => actions.removeModule(module.id)}>删除分类 {module.title}</button>
              <button type="button" onClick={() => actions.addSite(module.id)}>添加到 {module.title}</button>
              {module.sites.map((site) => (
                <span key={site.id}>
                  <button type="button" onClick={() => actions.visitSite(site.id)}>访问 {site.name}</button>
                  <button type="button" onClick={() => actions.edit({ type: 'site', moduleId: module.id, siteId: site.id })}>编辑 {site.name}</button>
                  <button type="button" onClick={() => actions.removeSite(module.id, site.id)}>删除 {site.name}</button>
                </span>
              ))}
            </>
          )}
        </section>
      ))}

      {editing && betaOwner && (
        <button type="button" onClick={() => {
          const move = { siteId: 'beta', fromModuleId: betaOwner.id, toModuleId: 'two', toIndex: 0 }
          const first = actions.moveSite(move)
          const second = actions.moveSite(move)
          setMoveResult(`首次 ${String(first)}，重复 ${String(second)}`)
        }}>移动 Beta 到分类二首位</button>
      )}
      <output aria-label="移动结果">{moveResult}</output>

      {editing && one && (
        <button type="button" onClick={() => {
          const sameModule = actions.moveSite({ siteId: one.sites[0]?.id ?? 'missing', fromModuleId: 'one', toModuleId: 'one' })
          const missingSite = actions.moveSite({ siteId: 'missing', fromModuleId: 'one', toModuleId: 'two' })
          const missingTarget = actions.moveSite({ siteId: one.sites[0]?.id ?? 'missing', fromModuleId: 'one', toModuleId: 'missing' })
          setInvalidMoveResult([sameModule, missingSite, missingTarget].join(','))
        }}>执行无效移动</button>
      )}
      <output aria-label="无效移动结果">{invalidMoveResult}</output>
    </section>
  )
}

function makeTemplate(id: string, label: string, load?: TemplateDefinition['load']): TemplateDefinition {
  const Component = (props: NavigationTemplateProps) => <ProbeTemplate {...props} label={label} />
  return {
    id,
    name: `模板 ${label}`,
    description: `${label} 模板描述`,
    editingHint: `${label} 编辑提示`,
    load: load ?? (async () => ({ default: Component })),
  }
}

function createCatalog(secondLoad?: TemplateDefinition['load']) {
  return [makeTemplate('bubble', 'A'), makeTemplate('second', 'B', secondLoad)] as const
}

function seedConfig(config: NavigationConfig = fixtureConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}

function siteNames(moduleTitle: string) {
  return within(screen.getByRole('list', { name: `${moduleTitle}站点顺序` }))
    .getAllByRole('listitem')
    .map((item) => item.textContent)
}

function frequentNames() {
  return within(screen.getByRole('list', { name: '最常使用顺序' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent)
}

async function renderApp(options: {
  catalog?: readonly TemplateDefinition[]
  config?: NavigationConfig | null
  onboarding?: boolean
} = {}) {
  if (options.config !== null) seedConfig(options.config ?? fixtureConfig)
  if (options.onboarding !== true) localStorage.setItem(ONBOARDING_KEY, '1')
  const catalog = options.catalog ?? createCatalog()
  const view = render(<App templates={catalog} />)
  await screen.findByTestId(options.config?.templateId === 'second' ? 'template-B' : 'template-A')
  return { ...view, catalog }
}

function enterEditing() {
  fireEvent.click(screen.getByRole('button', { name: '进入编辑模式' }))
  expect(screen.getByTestId('editing-state').textContent).toBe('编辑状态：开启')
}

function closeSettings() {
  fireEvent.click(screen.getByRole('button', { name: '关闭' }))
}

function clickUndoTwiceInOneBatch() {
  const undo = screen.getByRole('button', { name: '撤销' })
  act(() => {
    undo.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    undo.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

beforeEach(() => {
  localStorage.clear()
  document.body.className = ''
  vi.restoreAllMocks()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
  document.body.className = ''
})

describe('App 启动与共享数据', () => {
  it('没有已有配置时使用默认内容启动', async () => {
    await renderApp({ config: null })

    expect(screen.getByTestId('template-A')).toBeTruthy()
    expect(document.querySelector('.app')?.getAttribute('data-accent')).toBe('mint')
    expect(screen.getByRole('heading', { name: 'AI 工具' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '开发工具' })).toBeTruthy()
    expect(frequentNames().slice(0, 3)).toEqual(['ChatGPT', 'Claude', 'GitHub'])
  })

  it('从已有配置和已有模板 ID 恢复内容', async () => {
    const stored = { ...fixtureConfig, templateId: 'second' as const, accent: 'orange' as const }
    await renderApp({ config: stored })

    expect(screen.getByTestId('template-B')).toBeTruthy()
    expect(document.querySelector('.app')?.getAttribute('data-accent')).toBe('orange')
    expect(siteNames('分类一')).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(screen.queryByRole('dialog', { name: '首次访问引导' })).toBeNull()
  })

  it('读取 localStorage 异常时仍以默认内容启动', async () => {
    const originalGetItem = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key) {
      if (key === CONFIG_KEY || key === USAGE_KEY || key === ENGINE_KEY || key === ONBOARDING_KEY) {
        throw new DOMException('blocked', 'SecurityError')
      }
      return originalGetItem.call(this, key)
    })

    const catalog = createCatalog()
    render(<App templates={catalog} />)
    await screen.findByTestId('template-A')

    expect(screen.getByRole('heading', { name: 'AI 工具' })).toBeTruthy()
    expect(screen.getByRole('dialog', { name: '首次访问引导' })).toBeTruthy()
  })

  it('访问次数持久化，并立即重排 frequentSites', async () => {
    localStorage.setItem(USAGE_KEY, JSON.stringify({ alpha: 1, delta: 3 }))
    await renderApp()
    enterEditing()

    expect(frequentNames().slice(0, 2)).toEqual(['Delta', 'Alpha'])
    fireEvent.click(screen.getByRole('button', { name: '访问 Alpha' }))
    fireEvent.click(screen.getByRole('button', { name: '访问 Alpha' }))
    fireEvent.click(screen.getByRole('button', { name: '访问 Alpha' }))

    expect(frequentNames()[0]).toBe('Alpha')
    expect(JSON.parse(localStorage.getItem(USAGE_KEY) ?? '{}')).toEqual({ alpha: 4, delta: 3 })
  })

  it('访问次数写入失败不阻断访问计数和排序', async () => {
    localStorage.setItem(USAGE_KEY, JSON.stringify({ delta: 1 }))
    const originalSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === USAGE_KEY) throw new DOMException('quota', 'QuotaExceededError')
      return originalSetItem.call(this, key, value)
    })
    await renderApp()
    enterEditing()

    fireEvent.click(screen.getByRole('button', { name: '访问 Alpha' }))
    fireEvent.click(screen.getByRole('button', { name: '访问 Alpha' }))

    expect(frequentNames()[0]).toBe('Alpha')
    expect(localStorage.getItem(USAGE_KEY)).toBe(JSON.stringify({ delta: 1 }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('App 编辑模式与设置入口', () => {
  it('支持 Escape 和模板空白退出编辑', async () => {
    await renderApp()
    enterEditing()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('editing-state').textContent).toBe('编辑状态：关闭')

    enterEditing()
    fireEvent.click(screen.getByTestId('blank-area'))
    expect(screen.getByTestId('editing-state').textContent).toBe('编辑状态：关闭')
  })

  it('声明交互区和真实交互元素不会误退出编辑', async () => {
    await renderApp()
    enterEditing()

    const protectedTargets = [
      within(screen.getByTestId('declared-interactive')).getByText('声明的交互区'),
      within(screen.getByTestId('real-button')).getByText('真实按钮内部'),
      screen.getByRole('link', { name: '真实链接' }),
      screen.getByText('真实标签'),
      screen.getByRole('textbox', { name: '真实输入框' }),
      screen.getByRole('combobox', { name: '真实选择框' }),
      within(screen.getByRole('form', { name: '真实表单' })).getByText('表单内容'),
    ]

    for (const target of protectedTargets) {
      fireEvent.click(target)
      expect(screen.getByTestId('editing-state').textContent).toBe('编辑状态：开启')
    }
  })

  it('设置打开时保护编辑状态，关闭后 Escape 才退出', async () => {
    await renderApp()
    enterEditing()
    fireEvent.click(screen.getByRole('button', { name: '打开设置' }))

    expect(screen.getByRole('heading', { name: '定制工作台' })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('editing-state').textContent).toBe('编辑状态：开启')

    closeSettings()
    expect(screen.getByTestId('editing-state').textContent).toBe('编辑状态：开启')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('editing-state').textContent).toBe('编辑状态：关闭')
  })

  it('模板选择器拦截 Escape，并在关闭后恢复入口焦点', async () => {
    await renderApp()
    enterEditing()
    const switchButton = screen.getByRole('button', { name: '切换模板' })
    fireEvent.click(switchButton)

    expect(screen.getByRole('dialog', { name: '选择模板' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: '选择模板' })).toBeNull()
    expect(screen.getByTestId('editing-state').textContent).toBe('编辑状态：开启')
    await waitFor(() => expect(document.activeElement).toBe(switchButton))

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('editing-state').textContent).toBe('编辑状态：关闭')
  })

  it('拖拽期间和释放后的防误触窗口内 Escape 不退出编辑', async () => {
    await renderApp()
    enterEditing()
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: '开始拖拽' }))
    expect(document.querySelector('.app')?.classList.contains('is-site-dragging')).toBe(true)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('editing-state').textContent).toBe('编辑状态：开启')

    fireEvent.pointerUp(screen.getByRole('button', { name: '结束交互' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('editing-state').textContent).toBe('编辑状态：开启')

    act(() => vi.advanceTimersByTime(361))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('editing-state').textContent).toBe('编辑状态：关闭')
  })

  it('公共设置入口和模板设置入口都打开通用设置', async () => {
    await renderApp()

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }))
    expect(screen.getByRole('heading', { name: '定制工作台' })).toBeTruthy()
    closeSettings()

    fireEvent.click(screen.getByRole('button', { name: '模板设置入口' }))
    expect(screen.getByRole('heading', { name: '定制工作台' })).toBeTruthy()
    closeSettings()

    enterEditing()
    fireEvent.click(screen.getByRole('button', { name: '添加站点' }))
    expect(screen.getByRole('heading', { name: '定制工作台' })).toBeTruthy()
  })

  it('addSite、编辑站点和编辑分类动作进入正确设置上下文', async () => {
    await renderApp()
    enterEditing()

    fireEvent.click(screen.getByRole('button', { name: '添加到 分类二' }))
    expect((screen.getByRole('combobox', { name: '所属分类' }) as HTMLSelectElement).value).toBe('two')
    closeSettings()

    fireEvent.click(screen.getByRole('button', { name: '编辑 Beta' }))
    expect(screen.getByRole('heading', { name: '编辑站点' })).toBeTruthy()
    expect((screen.getByPlaceholderText('站点名称') as HTMLInputElement).value).toBe('Beta')
    closeSettings()

    fireEvent.click(screen.getByRole('button', { name: '编辑分类 分类一' }))
    expect(screen.getByRole('heading', { name: '编辑分类' })).toBeTruthy()
    expect((screen.getByPlaceholderText('分类名称') as HTMLInputElement).value).toBe('分类一')
  })
})

describe('App 删除与撤销', () => {
  it('删除站点后可按原索引撤销，重复撤销不会复制站点', async () => {
    await renderApp()
    enterEditing()

    fireEvent.click(screen.getByRole('button', { name: '删除 Beta' }))
    expect(siteNames('分类一')).toEqual(['Alpha', 'Gamma'])
    expect(screen.getByText('已删除 Beta')).toBeTruthy()

    clickUndoTwiceInOneBatch()
    expect(siteNames('分类一')).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(screen.queryByRole('button', { name: '撤销' })).toBeNull()
  })

  it('删除分类后可按原索引撤销，重复撤销不会复制分类', async () => {
    await renderApp()
    enterEditing()

    fireEvent.click(screen.getByRole('button', { name: '删除分类 分类二' }))
    expect(screen.queryByRole('heading', { name: '分类二' })).toBeNull()
    expect(screen.getByText('已删除分类「分类二」和其中 2 个站点')).toBeTruthy()

    clickUndoTwiceInOneBatch()
    const moduleHeadings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    expect(moduleHeadings.filter((title) => title === '分类二')).toHaveLength(1)
    expect(moduleHeadings.filter((title) => ['分类一', '分类二', '空分类'].includes(title ?? ''))).toEqual(['分类一', '分类二', '空分类'])
    expect(siteNames('分类二')).toEqual(['Delta', 'Echo'])
  })

  it('无效站点和分类删除保持配置不变且不创建撤销', async () => {
    await renderApp()
    enterEditing()

    fireEvent.click(screen.getByRole('button', { name: '执行无效删除' }))

    expect(siteNames('分类一')).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(screen.getByRole('heading', { name: '分类二' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '撤销' })).toBeNull()
  })

  it('撤销按钮只接受匹配的主指针按下/抬起，并可绕过拖拽后的尾随点击保护', async () => {
    await renderApp()
    enterEditing()
    fireEvent.click(screen.getByRole('button', { name: '删除 Beta' }))
    const undo = screen.getByRole('button', { name: '撤销' })

    fireEvent.pointerUp(undo, { pointerId: 1, button: 0 })
    expect(siteNames('分类一')).toEqual(['Alpha', 'Gamma'])

    fireEvent.pointerDown(undo, { pointerId: 2, button: 1 })
    fireEvent.pointerUp(undo, { pointerId: 2, button: 1 })
    expect(siteNames('分类一')).toEqual(['Alpha', 'Gamma'])

    fireEvent.pointerDown(undo, { pointerId: 3, button: 0 })
    fireEvent.pointerLeave(undo, { pointerId: 3 })
    fireEvent.pointerUp(undo, { pointerId: 3, button: 0 })
    expect(siteNames('分类一')).toEqual(['Alpha', 'Gamma'])

    fireEvent.pointerDown(undo, { pointerId: 4, button: 0 })
    fireEvent.pointerCancel(undo, { pointerId: 4 })
    fireEvent.pointerUp(undo, { pointerId: 4, button: 0 })
    expect(siteNames('分类一')).toEqual(['Alpha', 'Gamma'])

    fireEvent.click(screen.getByRole('button', { name: '开始拖拽' }))
    fireEvent.pointerDown(undo, { pointerId: 5, button: 0 })
    fireEvent.pointerUp(undo, { pointerId: 5, button: 0 })
    expect(siteNames('分类一')).toEqual(['Alpha', 'Gamma'])

    fireEvent.pointerUp(screen.getByRole('button', { name: '结束交互' }))
    fireEvent.pointerDown(undo, { pointerId: 6, button: 0 })
    fireEvent.pointerUp(undo, { pointerId: 6, button: 0 })

    expect(siteNames('分类一')).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(screen.queryByRole('button', { name: '撤销' })).toBeNull()
  })

  it('撤销入口在 5 秒后过期且删除结果保留', async () => {
    await renderApp()
    enterEditing()
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: '删除 Beta' }))
    act(() => vi.advanceTimersByTime(4_999))
    expect(screen.getByRole('button', { name: '撤销' })).toBeTruthy()

    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByRole('button', { name: '撤销' })).toBeNull()
    expect(siteNames('分类一')).toEqual(['Alpha', 'Gamma'])
  })

  it('连续删除只撤销最新动作，并从最新动作重新计算 5 秒', async () => {
    await renderApp()
    enterEditing()
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: '删除 Beta' }))
    act(() => vi.advanceTimersByTime(3_000))
    fireEvent.click(screen.getByRole('button', { name: '删除 Alpha' }))
    act(() => vi.advanceTimersByTime(2_001))

    expect(screen.getByText('已删除 Alpha')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '撤销' }))
    expect(siteNames('分类一')).toEqual(['Alpha', 'Gamma'])
  })
})

describe('App 跨分类移动', () => {
  it('原子移动到指定索引，拒绝重复提交，设置 revealSite 并按原索引撤销', async () => {
    await renderApp()
    enterEditing()

    fireEvent.click(screen.getByRole('button', { name: '移动 Beta 到分类二首位' }))

    expect(screen.getByRole('status', { name: '定位请求' }).textContent).toBe('定位 two/beta')
    expect(screen.getByRole('status', { name: '定位请求' }).textContent).not.toContain('定位 one/beta')
    expect(screen.getByLabelText('移动结果').textContent).toBe('首次 true，重复 false')
    expect(siteNames('分类一')).toEqual(['Alpha', 'Gamma'])
    expect(siteNames('分类二')).toEqual(['Beta', 'Delta', 'Echo'])
    expect(screen.getByText('已将 Beta 移到「分类二」')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '撤销' }))
    expect(siteNames('分类一')).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(siteNames('分类二')).toEqual(['Delta', 'Echo'])
    expect(screen.getByRole('status', { name: '定位请求' }).textContent).toBe('定位 one/beta')
  })

  it('同分类、缺失站点和缺失目标移动都返回 false 且不创建撤销', async () => {
    await renderApp()
    enterEditing()

    fireEvent.click(screen.getByRole('button', { name: '执行无效移动' }))

    expect(screen.getByLabelText('无效移动结果').textContent).toBe('false,false,false')
    expect(siteNames('分类一')).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(siteNames('分类二')).toEqual(['Delta', 'Echo'])
    expect(screen.queryByRole('button', { name: '撤销' })).toBeNull()
    expect(screen.getByRole('status', { name: '定位请求' }).textContent).toBe('无定位请求')
  })

  it('目标分类已有同 ID 站点时拒绝移动', async () => {
    const duplicateConfig: NavigationConfig = {
      ...fixtureConfig,
      modules: fixtureConfig.modules.map((module) => module.id === 'two'
        ? { ...module, sites: [makeSite('beta', 'Beta duplicate'), ...module.sites] }
        : module),
    }
    await renderApp({ config: duplicateConfig })
    enterEditing()

    fireEvent.click(screen.getByRole('button', { name: '移动 Beta 到分类二首位' }))

    expect(screen.getByLabelText('移动结果').textContent).toBe('首次 false，重复 false')
    expect(siteNames('分类一')).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(siteNames('分类二')).toEqual(['Beta duplicate', 'Delta', 'Echo'])
    expect(screen.queryByRole('button', { name: '撤销' })).toBeNull()
  })
})

describe('App 模板切换保护', () => {
  it.each([
    ['拖拽', '开始拖拽'],
    ['收尾', '开始收尾'],
  ])('%s 状态禁用模板入口，空闲后恢复', async (_phase, controlName) => {
    await renderApp()
    const switchButton = screen.getByRole('button', { name: '切换模板' }) as HTMLButtonElement

    fireEvent.click(screen.getByRole('button', { name: controlName }))
    expect(switchButton.disabled).toBe(true)
    fireEvent.click(switchButton)
    expect(screen.queryByRole('dialog', { name: '选择模板' })).toBeNull()

    fireEvent.pointerUp(screen.getByRole('button', { name: '结束交互' }))
    expect(switchButton.disabled).toBe(false)
  })

  it('模板异步加载完成时再次检查交互状态，变忙后不提交切换', async () => {
    type LoadedModule = { default: ComponentType<NavigationTemplateProps> }
    let resolveSecond!: (module: LoadedModule) => void
    const secondLoad = vi.fn(() => new Promise<LoadedModule>((resolve) => {
      resolveSecond = resolve
    }))
    const Second = (props: NavigationTemplateProps) => <ProbeTemplate {...props} label="B" />
    await renderApp({ catalog: createCatalog(secondLoad) })
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: '切换加载期间变忙' }))
    fireEvent.click(screen.getByRole('button', { name: '切换模板' }))
    fireEvent.click(screen.getByRole('button', { name: /^模板 B/ }))
    expect(secondLoad).toHaveBeenCalledTimes(1)

    act(() => vi.advanceTimersByTime(10))
    await act(async () => {
      resolveSecond({ default: Second })
      await Promise.resolve()
    })

    expect(screen.getByTestId('template-A')).toBeTruthy()
    expect(screen.queryByTestId('template-B')).toBeNull()
    expect(screen.getByRole('dialog', { name: '选择模板' })).toBeTruthy()
    expect(JSON.parse(localStorage.getItem(CONFIG_KEY) ?? '{}').templateId).toBe('bubble')
  })



  it('正常模板切换提交新模板，退出编辑并清除旧的定位请求', async () => {
    await renderApp()
    enterEditing()
    fireEvent.click(screen.getByRole('button', { name: '移动 Beta 到分类二首位' }))
    expect(screen.getByRole('status', { name: '定位请求' }).textContent).toBe('定位 two/beta')

    fireEvent.click(screen.getByRole('button', { name: '切换模板' }))
    fireEvent.click(screen.getByRole('button', { name: /^模板 B/ }))
    await screen.findByTestId('template-B')

    expect(screen.queryByTestId('template-A')).toBeNull()
    expect(screen.getByTestId('editing-state').textContent).toBe('编辑状态：关闭')
    expect(screen.getByRole('status', { name: '定位请求' }).textContent).toBe('无定位请求')
    expect(JSON.parse(localStorage.getItem(CONFIG_KEY) ?? '{}').templateId).toBe('second')
  })

  it('选择当前模板只关闭选择器，不重挂载模板或清空模板本地状态', async () => {
    await renderApp()
    enterEditing()
    fireEvent.click(screen.getByRole('button', { name: '增加模板本地计数' }))
    expect(screen.getByTestId('local-count').textContent).toBe('模板本地计数：1')

    fireEvent.click(screen.getByRole('button', { name: '切换模板' }))
    fireEvent.click(screen.getByRole('button', { name: /^模板 A/ }))

    expect(screen.queryByRole('dialog', { name: '选择模板' })).toBeNull()
    expect(screen.getByTestId('local-count').textContent).toBe('模板本地计数：1')
    expect(screen.getByTestId('editing-state').textContent).toBe('编辑状态：开启')
  })
})

describe('App 搜索、引导与存储错误', () => {
  it('搜索引擎持久化失败时仍立即更新搜索界面', async () => {
    const originalSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === ENGINE_KEY) throw new DOMException('quota', 'QuotaExceededError')
      return originalSetItem.call(this, key, value)
    })
    await renderApp()

    fireEvent.click(screen.getByRole('button', { name: /当前引擎：Google/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Perplexity AI' }))

    expect(screen.getByRole('textbox', { name: '使用 Perplexity AI 搜索' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /当前引擎：Perplexity AI/ })).toBeTruthy()
    expect(localStorage.getItem(ENGINE_KEY)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('按真实动作完成四步 onboarding 并写入完成标记', async () => {
    await renderApp({ onboarding: true })

    expect(screen.getByRole('heading', { name: '欢迎使用 Edith' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '开始使用' }))
    expect(screen.getByRole('heading', { name: '切换搜索引擎' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /当前引擎：Google/ }))
    fireEvent.click(screen.getByRole('button', { name: '百度' }))
    expect(screen.getByRole('heading', { name: '选择你的模板' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '切换模板' }))
    expect(screen.queryByRole('dialog', { name: '首次访问引导' })).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('heading', { name: '进入编辑模式' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '进入编辑模式' }))
    expect(screen.queryByRole('dialog', { name: '首次访问引导' })).toBeNull()
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('1')
    expect(screen.getByTestId('editing-state').textContent).toBe('编辑状态：开启')
  })

  it('跳过 onboarding 后立即关闭并写入完成标记', async () => {
    await renderApp({ onboarding: true })

    fireEvent.click(screen.getByRole('button', { name: '跳过引导' }))

    expect(screen.queryByRole('dialog', { name: '首次访问引导' })).toBeNull()
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('1')
    expect(document.body.classList.contains('onboarding-active')).toBe(false)
  })

  it.each(['完成', '跳过'] as const)('onboarding %s标记写入失败时仍可离开引导', async (mode) => {
    await renderApp({ onboarding: true })
    const originalSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === ONBOARDING_KEY) throw new DOMException('quota', 'QuotaExceededError')
      return originalSetItem.call(this, key, value)
    })

    if (mode === '跳过') {
      fireEvent.click(screen.getByRole('button', { name: '跳过引导' }))
    } else {
      fireEvent.click(screen.getByRole('button', { name: '开始使用' }))
      fireEvent.click(screen.getByRole('button', { name: '下一步' }))
      fireEvent.click(screen.getByRole('button', { name: '下一步' }))
      fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    }

    expect(screen.queryByRole('dialog', { name: '首次访问引导' })).toBeNull()
    expect(localStorage.getItem(ONBOARDING_KEY)).toBeNull()
  })

  it('配置写入失败仍保留页面内修改并显示提示，后续成功写入会清除提示', async () => {
    seedConfig()
    localStorage.setItem(ONBOARDING_KEY, '1')
    const originalSetItem = Storage.prototype.setItem
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === CONFIG_KEY) throw new DOMException('quota', 'QuotaExceededError')
      return originalSetItem.call(this, key, value)
    })
    render(<App templates={createCatalog()} />)
    await screen.findByTestId('template-A')

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }))
    fireEvent.click(screen.getByRole('button', { name: '日落橙' }))
    expect(document.querySelector('.app')?.getAttribute('data-accent')).toBe('orange')
    expect(screen.getByRole('alert').textContent).toContain('无法保存到浏览器')

    setItem.mockImplementation(function (this: Storage, key, value) {
      return originalSetItem.call(this, key, value)
    })
    fireEvent.click(screen.getByRole('button', { name: '薄荷绿' }))
    expect(document.querySelector('.app')?.getAttribute('data-accent')).toBe('mint')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(JSON.parse(localStorage.getItem(CONFIG_KEY) ?? '{}').accent).toBe('mint')
  })

  it('卸载时清理活动撤销定时器和模板选择焦点恢复定时器', async () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout')
    const { unmount } = await renderApp()
    enterEditing()
    fireEvent.click(screen.getByRole('button', { name: '删除 Beta' }))

    fireEvent.click(screen.getByRole('button', { name: '切换模板' }))
    fireEvent.click(screen.getByRole('button', { name: /^模板 A/ }))
    unmount()

    expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
