import { useContext } from 'react'
import { PreferencesContext } from '../i18n/PreferencesContext'
import type { Language, IconService } from '../i18n/preferences'
import { useTranslation } from '../i18n/useTranslation'
import { Check, Download, Plus, RotateCcw, Settings2, Upload, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { EditorTarget, NavigationConfig } from '../types'
import { getIconPositionPersistence } from '../templates/config'

type SettingsDrawerProps = {
  open: boolean
  activeModuleId: string | null
  editingTarget: EditorTarget
  config: NavigationConfig
  onClose: () => void
  onChange: (config: NavigationConfig) => string | void
  onReset: () => void
  onExport: () => void
  onImport: (file: File) => Promise<void>
}

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
  onExport,
  onImport,
}: SettingsDrawerProps) {
  const t = useTranslation()
  const { preferences, update, error: preferenceError } = useContext(PreferencesContext)
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
  const [selectedModuleId, setSelectedModuleId] = useState(
    editingSiteContext?.module.id ?? activeModuleId ?? config.modules[0]?.id ?? '',
  )
  const [newModuleName, setNewModuleName] = useState('')
  const [moduleName, setModuleName] = useState(editingModule?.title ?? '')
  const [moduleAccent, setModuleAccent] = useState(editingModule?.accent ?? moduleAccentOptions[0])
  const [capacityError, setCapacityError] = useState<string | null>(null)
  const acceptChange = (next: NavigationConfig) => {
    const error = onChange(next)
    setCapacityError(error || null)
    return !error
  }
  const [transferStatus, setTransferStatus] = useState<string | null>(null)
  const importInput = useRef<HTMLInputElement>(null)

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
      }
      const originalModuleId = editingTarget.moduleId

      if (!acceptChange({
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
      })) return
      onClose()
      return
    }

    if (!acceptChange({
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
                  description: '',
                },
              ],
            }
          : module,
      ),
    })) return
    setSiteName('')
    setSiteUrl('')
  }

  const saveModule = (event: FormEvent) => {
    event.preventDefault()
    if (!editingModule || !moduleName.trim()) return

    if (!acceptChange({
      ...config,
      modules: config.modules.map((module) =>
        module.id === editingModule.id
          ? {
              ...module,
              title: moduleName.trim(),
              accent: moduleAccent,
            }
          : module,
      ),
    })) return
    onClose()
  }

  const addModule = () => {
    const title = newModuleName.trim()
    if (!title) return
    const id = `module-${Date.now()}`
    if (!acceptChange({
      ...config,
      modules: [
        ...config.modules,
        {
          id,
          title,
          description: '',
          accent: moduleAccentOptions[0],
          sites: [],
        },
      ],
    })) return
    setSelectedModuleId(id)
    setNewModuleName('')
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !window.confirm(t("导入将覆盖当前配置，是否继续？"))) return

    setTransferStatus('正在导入…')
    try {
      await onImport(file)
      setTransferStatus('导入成功，正在重新载入。')
    } catch (error) {
      setTransferStatus(error instanceof Error ? error.message : '导入失败，请检查备份文件。')
    }
  }

  const handleExport = () => {
    try {
      onExport()
      setTransferStatus(null)
    } catch (error) {
      setTransferStatus(error instanceof Error ? error.message : '导出失败，请重试。')
    }
  }

  const isEditingSite = Boolean(editingSiteContext)
  const isEditingModule = Boolean(editingModule)
  const positionTemplate = config.templateId === 'matter' || config.templateId === 'beijing' ? config.templateId : null
  const iconPositionPersistence = positionTemplate ? getIconPositionPersistence(config, positionTemplate) : null
  const drawerTitle = isEditingSite ? t("编辑站点") : isEditingModule ? t("编辑分类") : t("定制工作台")
  const drawerDescription = isEditingSite
    ? t("修改名称、网址或所属分类")
    : isEditingModule
      ? t("调整分类信息，站点不会受到影响")
      : t("修改后会自动保存在本机")

  return (
    <>
      <button className={`drawer-backdrop ${open ? 'is-open' : ''}`} onClick={onClose} aria-label={t("关闭设置")} />
      <aside data-editing-interactive className={`settings-drawer ${open ? 'is-open' : ''}`} aria-hidden={!open} inert={!open}>
        <div className="drawer-head">
          <div className="drawer-title-mark"><Settings2 size={18} /></div>
          <div>
            <h2>{drawerTitle}</h2>
            <p>{drawerDescription}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={t("关闭")}>
            <X size={19} />
          </button>
        </div>

        <div className="drawer-scroll">
          {capacityError && <p className="capacity-form-error" role="alert">{t(capacityError)}</p>}
          {isEditingModule ? (
            <form className="edit-form" onSubmit={saveModule}>
              <section className="settings-section">
                <span className="settings-label">{t("分类信息")}</span>
                <input value={moduleName} onChange={(event) => setModuleName(event.target.value)} placeholder={t("分类名称")} />
              </section>
              <section className="settings-section">
                <span className="settings-label">{t("分类强调色")}</span>
                <div className="module-accent-picker">
                  {moduleAccentOptions.map((color) => (
                    <button
                      key={color}
                      className={moduleAccent === color ? 'is-selected' : ''}
                      type="button"
                      style={{ '--option-color': color } as React.CSSProperties}
                      onClick={() => setModuleAccent(color)}
                      aria-label={t("使用颜色 {0}", color)}
                    >
                      <i />
                      {moduleAccent === color && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </section>
              <button className="primary-button drawer-save-button" type="submit" disabled={!moduleName.trim()}>
                <Check size={16} />  {t("保存分类")} </button>
            </form>
          ) : (
            <>
              <section className="settings-section">
                <span className="settings-label">{isEditingSite ? t("站点信息") : t("添加站点")}</span>
                <form className="add-site-form" onSubmit={saveSite}>
                  <select
                    value={selectedModuleId}
                    onChange={(event) => setSelectedModuleId(event.target.value)}
                    disabled={config.modules.length === 0}
                    aria-label={t("所属分类")}
                  >
                    {config.modules.map((module) => <option value={module.id} key={module.id}>{module.title}</option>)}
                  </select>
                  <input value={siteName} onChange={(event) => setSiteName(event.target.value)} placeholder={t("站点名称")} />
                  <input value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} placeholder="https://example.com" inputMode="url" />
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={!siteName.trim() || !siteUrl.trim() || !selectedModuleId}
                  >
                    {isEditingSite ? <Check size={16} /> : <Plus size={16} />}
                    {isEditingSite ? t("保存站点") : t("添加到「{0}」", selectedModule?.title ?? t('模块'))}
                  </button>
                </form>
              </section>

              {!isEditingSite && (
                <>
                  <section className="settings-section preference-settings">
                    <label className="settings-label" htmlFor="interface-language">{t('界面语言')}</label>
                    <select id="interface-language" value={preferences.language} onChange={event => update({ language: event.target.value as Language })}>
                      <option value="auto">{t('跟随浏览器')}</option>
                      <option value="zh-CN">简体中文</option>
                      <option value="en">English</option>
                    </select>
                    <label className="settings-label" htmlFor="icon-service">{t('图标服务')}</label>
                    <select id="icon-service" value={preferences.iconService} onChange={event => update({ iconService: event.target.value as IconService })}>
                      <option value="domestic">{t('国内服务（Cravatar）')}</option>
                      <option value="google">{t('Google 服务')}</option>
                    </select>
                    <p className="settings-help">{t('用于获取网站图标，仅发送网站域名，不发送具体页面地址。')}</p>
                    {preferenceError && <p role="alert">{t(preferenceError)}</p>}
                  </section>
                  {positionTemplate && iconPositionPersistence && (
                    <section className="settings-section icon-position-settings">
                      <span className="settings-label">{t("图标布局")}</span>
                      <div className="icon-position-setting-row">
                        <div>
                          <strong>{t("保存图标位置")}</strong>
                          <p id="icon-position-description">{iconPositionPersistence.enabled ? t("开启：刷新后恢复上次保存的位置。") : t("关闭：刷新后图标重新掉落。")}</p>
                        </div>
                        <button
                          className={`settings-switch${iconPositionPersistence.enabled ? ' is-on' : ''}`}
                          type="button"
                          role="switch"
                          aria-checked={iconPositionPersistence.enabled}
                          aria-label={t("保存图标位置")}
                          aria-describedby="icon-position-description"
                          onClick={() => onChange({
                            ...config,
                            iconPositionPersistence: {
                              ...config.iconPositionPersistence,
                              [positionTemplate]: {
                                enabled: !iconPositionPersistence.enabled,
                                positions: iconPositionPersistence.positions,
                              },
                            },
                          })}
                        >
                          <span aria-hidden="true" />
                        </button>
                      </div>
                    </section>
                  )}
                  <section className="settings-section">
                    <span className="settings-label">{t("新建分类")}</span>
                    <div className="inline-form">
                      <input value={newModuleName} onChange={(event) => setNewModuleName(event.target.value)} placeholder={t("例如：设计灵感")} />
                      <button className="square-button" type="button" onClick={addModule} disabled={!newModuleName.trim()} aria-label={t("新建分类")}>
                        <Plus size={18} />
                      </button>
                    </div>
                  </section>

                  <section className="settings-section">
                    <span className="settings-label">{t("数据迁移")}</span>
                    <p className="settings-help">{t("通过 JSON 文件在网页版、Chrome 和 Edge 之间迁移配置。")}</p>
                    <div className="data-transfer-actions">
                      <button type="button" onClick={handleExport}><Download size={15} />{t("导出")}</button>
                      <button type="button" onClick={() => importInput.current?.click()}><Upload size={15} />{t("导入")}</button>
                    </div>
                    <input
                      ref={importInput}
                      className="visually-hidden"
                      type="file"
                      accept="application/json,.json"
                      aria-label={t("选择 Edith 备份文件")}
                      onChange={handleImport}
                    />
                    {transferStatus && <p className="transfer-status" role="status">{t(transferStatus)}</p>}
                  </section>

                  <button className="reset-button" type="button" onClick={onReset}>
                    <RotateCcw size={16} />  {t("恢复默认内容与配色")} </button>
                </>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  )
}
