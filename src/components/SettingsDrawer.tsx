import { Check, Plus, RotateCcw, Settings2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { EditorTarget, NavigationConfig } from '../types'

type SettingsDrawerProps = {
  open: boolean
  activeModuleId: string | null
  editingTarget: EditorTarget
  config: NavigationConfig
  onClose: () => void
  onChange: (config: NavigationConfig) => void
  onReset: () => void
}

const accentOptions: Array<{ id: NavigationConfig['accent']; label: string; color: string }> = [
  { id: 'mint', label: '薄荷绿', color: '#9ff7cd' },
  { id: 'violet', label: '星云紫', color: '#b9b6ff' },
  { id: 'orange', label: '日落橙', color: '#ffbd7b' },
]

const moduleAccentOptions = ['#9ff7cd', '#b9b6ff', '#ffcb93', '#88d9ff', '#ff9fb7', '#ffe38c']

function normalizeUrl(url: string) {
  const trimmed = url.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function SettingsDrawer({
  open,
  activeModuleId,
  editingTarget,
  config,
  onClose,
  onChange,
  onReset,
}: SettingsDrawerProps) {
  const editingSiteContext = editingTarget?.type === 'site'
    ? (() => {
        const module = config.modules.find((item) => item.id === editingTarget.moduleId)
        const site = module?.sites.find((item) => item.id === editingTarget.siteId)
        return module && site ? { module, site } : null
      })()
    : null
  const editingModule = editingTarget?.type === 'module'
    ? config.modules.find((module) => module.id === editingTarget.moduleId) ?? null
    : null

  const [siteName, setSiteName] = useState(editingSiteContext?.site.name ?? '')
  const [siteUrl, setSiteUrl] = useState(editingSiteContext?.site.url ?? '')
  const [siteDescription, setSiteDescription] = useState(editingSiteContext?.site.description ?? '')
  const [selectedModuleId, setSelectedModuleId] = useState(
    editingSiteContext?.module.id ?? activeModuleId ?? config.modules[0]?.id ?? '',
  )
  const [newModuleName, setNewModuleName] = useState('')
  const [moduleName, setModuleName] = useState(editingModule?.title ?? '')
  const [moduleDescription, setModuleDescription] = useState(editingModule?.description ?? '')
  const [moduleAccent, setModuleAccent] = useState(editingModule?.accent ?? moduleAccentOptions[0])

  const selectedModule = useMemo(
    () => config.modules.find((module) => module.id === selectedModuleId),
    [config.modules, selectedModuleId],
  )

  const saveSite = (event: FormEvent) => {
    event.preventDefault()
    if (!siteName.trim() || !siteUrl.trim() || !selectedModuleId) return

    if (editingSiteContext && editingTarget?.type === 'site') {
      const updatedSite = {
        ...editingSiteContext.site,
        name: siteName.trim(),
        url: normalizeUrl(siteUrl),
        description: siteDescription.trim() || '自定义站点',
      }
      const originalModuleId = editingTarget.moduleId

      onChange({
        ...config,
        modules: config.modules.map((module) => {
          if (originalModuleId === selectedModuleId && module.id === originalModuleId) {
            return {
              ...module,
              sites: module.sites.map((site) => site.id === updatedSite.id ? updatedSite : site),
            }
          }
          if (module.id === originalModuleId) {
            return { ...module, sites: module.sites.filter((site) => site.id !== updatedSite.id) }
          }
          if (module.id === selectedModuleId) {
            return { ...module, sites: [...module.sites, updatedSite] }
          }
          return module
        }),
      })
      onClose()
      return
    }

    onChange({
      ...config,
      modules: config.modules.map((module) =>
        module.id === selectedModuleId
          ? {
              ...module,
              sites: [
                ...module.sites,
                {
                  id: `${Date.now()}`,
                  name: siteName.trim(),
                  url: normalizeUrl(siteUrl),
                  description: siteDescription.trim() || '自定义站点',
                },
              ],
            }
          : module,
      ),
    })
    setSiteName('')
    setSiteUrl('')
    setSiteDescription('')
  }

  const saveModule = (event: FormEvent) => {
    event.preventDefault()
    if (!editingModule || !moduleName.trim()) return

    onChange({
      ...config,
      modules: config.modules.map((module) =>
        module.id === editingModule.id
          ? {
              ...module,
              title: moduleName.trim(),
              description: moduleDescription.trim() || '你的自定义资源分组',
              accent: moduleAccent,
            }
          : module,
      ),
    })
    onClose()
  }

  const addModule = () => {
    const title = newModuleName.trim()
    if (!title) return
    const id = `module-${Date.now()}`
    onChange({
      ...config,
      modules: [
        ...config.modules,
        {
          id,
          title,
          description: '你的自定义资源分组',
          accent: accentOptions.find((option) => option.id === config.accent)?.color ?? '#9ff7cd',
          sites: [],
        },
      ],
    })
    setSelectedModuleId(id)
    setNewModuleName('')
  }

  const isEditingSite = Boolean(editingSiteContext)
  const isEditingModule = Boolean(editingModule)
  const drawerTitle = isEditingSite ? '编辑站点' : isEditingModule ? '编辑分类' : '定制工作台'
  const drawerDescription = isEditingSite
    ? '修改名称、网址或所属分类'
    : isEditingModule
      ? '调整分类信息，站点不会受到影响'
      : '修改后会自动保存在本机'

  return (
    <>
      <button className={`drawer-backdrop ${open ? 'is-open' : ''}`} onClick={onClose} aria-label="关闭设置" />
      <aside className={`settings-drawer ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <div className="drawer-title-mark"><Settings2 size={18} /></div>
          <div>
            <h2>{drawerTitle}</h2>
            <p>{drawerDescription}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭">
            <X size={19} />
          </button>
        </div>

        <div className="drawer-scroll">
          {isEditingModule ? (
            <form className="edit-form" onSubmit={saveModule}>
              <section className="settings-section">
                <span className="settings-label">分类信息</span>
                <input value={moduleName} onChange={(event) => setModuleName(event.target.value)} placeholder="分类名称" />
                <input value={moduleDescription} onChange={(event) => setModuleDescription(event.target.value)} placeholder="一句话描述" />
              </section>
              <section className="settings-section">
                <span className="settings-label">分类强调色</span>
                <div className="module-accent-picker">
                  {moduleAccentOptions.map((color) => (
                    <button
                      key={color}
                      className={moduleAccent === color ? 'is-selected' : ''}
                      type="button"
                      style={{ '--option-color': color } as React.CSSProperties}
                      onClick={() => setModuleAccent(color)}
                      aria-label={`使用颜色 ${color}`}
                    >
                      <i />
                      {moduleAccent === color && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </section>
              <button className="primary-button drawer-save-button" type="submit" disabled={!moduleName.trim()}>
                <Check size={16} /> 保存分类
              </button>
            </form>
          ) : (
            <>
              {!isEditingSite && (
                <section className="settings-section">
                  <span className="settings-label">主题色</span>
                  <div className="accent-picker">
                    {accentOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={config.accent === option.id ? 'is-selected' : ''}
                        onClick={() => onChange({ ...config, accent: option.id })}
                      >
                        <i style={{ background: option.color }} />
                        {option.label}
                        {config.accent === option.id && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="settings-section">
                <span className="settings-label">{isEditingSite ? '站点信息' : '添加站点'}</span>
                <form className="add-site-form" onSubmit={saveSite}>
                  <select
                    value={selectedModuleId}
                    onChange={(event) => setSelectedModuleId(event.target.value)}
                    disabled={config.modules.length === 0}
                    aria-label="所属分类"
                  >
                    {config.modules.map((module) => <option value={module.id} key={module.id}>{module.title}</option>)}
                  </select>
                  <input value={siteName} onChange={(event) => setSiteName(event.target.value)} placeholder="站点名称" />
                  <input value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} placeholder="https://example.com" inputMode="url" />
                  <input value={siteDescription} onChange={(event) => setSiteDescription(event.target.value)} placeholder="一句话描述（可选）" />
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={!siteName.trim() || !siteUrl.trim() || !selectedModuleId}
                  >
                    {isEditingSite ? <Check size={16} /> : <Plus size={16} />}
                    {isEditingSite ? '保存站点' : `添加到「${selectedModule?.title ?? '模块'}」`}
                  </button>
                </form>
              </section>

              {!isEditingSite && (
                <>
                  <section className="settings-section">
                    <span className="settings-label">新建分类</span>
                    <div className="inline-form">
                      <input value={newModuleName} onChange={(event) => setNewModuleName(event.target.value)} placeholder="例如：设计灵感" />
                      <button className="square-button" type="button" onClick={addModule} disabled={!newModuleName.trim()} aria-label="新建分类">
                        <Plus size={18} />
                      </button>
                    </div>
                  </section>

                  <button className="reset-button" type="button" onClick={onReset}>
                    <RotateCcw size={16} /> 恢复程序员模板默认配置
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  )
}
