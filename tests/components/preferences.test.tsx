// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useContext } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PreferencesProvider } from '../../src/i18n/PreferencesProvider'
import { PreferencesContext } from '../../src/i18n/PreferencesContext'
import { PREFERENCES_KEY } from '../../src/i18n/preferences'
import { useTranslation } from '../../src/i18n/useTranslation'
import { SiteIcon } from '../../src/components/SiteIcon'
import { SettingsDrawer } from '../../src/components/SettingsDrawer'
import { defaultConfig } from '../../src/data/defaultConfig'
import { createBackup, importBackup } from '../../src/platform/backup'
import { usePersistentConfig } from '../../src/hooks/usePersistentConfig'
import { templates } from '../../src/templates/registry'

function Settings() {
  return <SettingsDrawer open activeModuleId={null} editingTarget={null} config={defaultConfig}
    onChange={() => {}} onClose={() => {}} onReset={() => {}} onExport={() => {}} onImport={async () => {}} />
}
function Probe() {
  const { update } = useContext(PreferencesContext)
  const t = useTranslation()
  return <><button onClick={() => update({ language: 'en' })}>English</button><p>{t('已删除 {0}', '中文网站')}</p></>
}

beforeEach(() => { localStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('preferences and icons', () => {
  it('loads English defaults but never translates saved user content; reset uses the current language', () => {
    localStorage.setItem(PREFERENCES_KEY, '{"language":"en","iconService":"google"}')
    const first = renderHook(() => usePersistentConfig(templates), { wrapper: PreferencesProvider })
    expect(first.result.current.config.modules[0].title).toBe('AI Tools')
    first.unmount()
    const saved = structuredClone(defaultConfig)
    saved.modules[0].title = '我的 AI 工具'
    localStorage.setItem('edith-navigation-config-v3', JSON.stringify(saved))
    const second = renderHook(() => usePersistentConfig(templates), { wrapper: PreferencesProvider })
    expect(second.result.current.config.modules[0].title).toBe('我的 AI 工具')
    act(() => second.result.current.resetConfig())
    expect(second.result.current.config.modules[0].title).toBe('AI Tools')
  })

  it('shows a translated export error and clears it after a successful retry', () => {
    localStorage.setItem(PREFERENCES_KEY, '{"language":"en","iconService":"google"}')
    localStorage.setItem('edith-navigation-usage-v1', 'invalid')
    render(<PreferencesProvider><SettingsDrawer open activeModuleId={null} editingTarget={null} config={defaultConfig}
      onChange={() => {}} onClose={() => {}} onReset={() => {}} onExport={() => { createBackup() }} onImport={async () => {}} /></PreferencesProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Export', exact: true }))
    expect(screen.getByRole('status')).toHaveTextContent('Your usage history is corrupted and cannot be exported.')
    localStorage.removeItem('edith-navigation-usage-v1')
    fireEvent.click(screen.getByRole('button', { name: 'Export', exact: true }))
    expect(screen.queryByRole('status')).toBeNull()
  })
  it('switches UI language without changing user content or icon service; refresh retains both', () => {
    const view = render(<PreferencesProvider><Settings /><SiteIcon url="https://example.org/private?token=secret" name="中文网站" /></PreferencesProvider>)
    const image = () => view.container.querySelector('.site-icon img')!
    expect(image().getAttribute('src')).toBe('https://cn.cravatar.com/favicon/api/index.php?url=example.org')
    expect(image().getAttribute('referrerpolicy')).toBe('no-referrer')
    fireEvent.change(screen.getByLabelText('界面语言'), { target: { value: 'en' } })
    expect(screen.getByRole('heading', { name: 'Customize workspace' })).toBeVisible()
    expect(screen.getByRole('option', { name: 'AI 工具' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
    expect(screen.getByLabelText('Icon service')).toHaveValue('domestic')
    fireEvent.change(screen.getByLabelText('Icon service'), { target: { value: 'google' } })
    expect(image().getAttribute('src')).toContain('www.google.com/s2/favicons?domain=example.org')
    view.unmount()
    render(<PreferencesProvider><Settings /></PreferencesProvider>)
    expect(screen.getByLabelText('Language')).toHaveValue('en')
    expect(screen.getByLabelText('Icon service')).toHaveValue('google')
  })

  it('resets an exhausted image on service and host changes', () => {
    const view = render(<PreferencesProvider><Settings /><SiteIcon url="https://example.org" name="Example" /></PreferencesProvider>)
    fireEvent.error(view.container.querySelector('.site-icon img')!)
    expect(view.container.querySelector('.site-icon-fallback')).toHaveTextContent('E')
    fireEvent.change(screen.getByLabelText('图标服务'), { target: { value: 'google' } })
    expect(view.container.querySelector('.site-icon img')?.getAttribute('src')).toContain('google.com')
    fireEvent.error(view.container.querySelector('.site-icon img')!)
    view.rerender(<PreferencesProvider><SiteIcon url="https://github.com" name="GitHub" /></PreferencesProvider>)
    expect(view.container.querySelector('img')?.getAttribute('src')).toBe('/site-icons/github.svg')
  })

  it('times out after 8 seconds, but successful images do not expire', () => {
    vi.useFakeTimers()
    const view = render(<PreferencesProvider><SiteIcon url="https://example.org" name="Example" /></PreferencesProvider>)
    act(() => { vi.advanceTimersByTime(7999) })
    expect(view.container.querySelector('img')).not.toBeNull()
    act(() => { vi.advanceTimersByTime(1) })
    expect(view.container.querySelector('.site-icon-fallback')).toHaveTextContent('E')
    view.rerender(<PreferencesProvider><SiteIcon url="https://other.org" name="Other" /></PreferencesProvider>)
    fireEvent.load(view.container.querySelector('img')!)
    act(() => { vi.advanceTimersByTime(16000) })
    expect(view.container.querySelector('img')).not.toBeNull()
  })

  it('uses the same remote service in extension runtime', () => {
    vi.stubEnv('VITE_EXTENSION_BUILD', 'true')
    const view = render(<PreferencesProvider><SiteIcon url="https://example.org" name="Example" /></PreferencesProvider>)
    expect(view.container.querySelector('img')?.getAttribute('src')).toContain('cn.cravatar.com')
    vi.unstubAllEnvs()
  })

  it('keeps preferences when importing a legacy backup, without changing the backup format', async () => {
    localStorage.setItem(PREFERENCES_KEY, '{"language":"en","iconService":"domestic"}')
    const backup = createBackup()
    expect(backup.data).not.toHaveProperty(PREFERENCES_KEY)
    await importBackup(JSON.stringify(backup))
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!)).toEqual({ language: 'en', iconService: 'domestic' })
  })

  it('reports a storage failure while keeping the current session usable', async () => {
    render(<PreferencesProvider><Settings /><Probe /></PreferencesProvider>)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(screen.getByText('Deleted 中文网站')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save to your browser')
  })

  it('follows browser language changes without changing the chosen service', () => {
    render(<PreferencesProvider><Settings /></PreferencesProvider>)
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US')
    act(() => window.dispatchEvent(new Event('languagechange')))
    expect(screen.getByLabelText('Language')).toHaveValue('auto')
    expect(screen.getByLabelText('Icon service')).toHaveValue('domestic')
  })
})
