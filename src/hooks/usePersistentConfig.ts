import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getDefaultConfig } from '../data/defaultConfig'
import { PreferencesContext } from '../i18n/PreferencesContext'
import type { Locale } from '../i18n/preferences'
import { normalizeTemplateConfig, resetContent } from '../templates/config'
import type { TemplateDefinition } from '../templates/types'
import type { NavigationConfig } from '../types'
import { getStoredValue, setStoredValue, subscribeStoredValue } from '../platform/storage'

const STORAGE_KEY = 'edith-navigation-config-v3'

function loadConfig(catalog: readonly TemplateDefinition[], locale: Locale): NavigationConfig {
  try {
    const saved = getStoredValue(STORAGE_KEY)
    const parsed: unknown = saved ? JSON.parse(saved) : getDefaultConfig(locale)
    return normalizeTemplateConfig(parsed, catalog)
  } catch {
    return getDefaultConfig(locale)
  }
}

export function usePersistentConfig(catalog: readonly TemplateDefinition[]) {
  const { locale } = useContext(PreferencesContext)
  const [config, setConfigState] = useState(() => loadConfig(catalog, locale))
  const currentConfig = useRef(config)
  const [storageError, setStorageError] = useState<string | null>(null)

  useEffect(() => subscribeStoredValue(STORAGE_KEY, (saved) => {
    try {
      const parsed: unknown = saved ? JSON.parse(saved) : getDefaultConfig(locale)
      const value = normalizeTemplateConfig(parsed, catalog)
      currentConfig.current = value
      setConfigState(value)
      setStorageError(null)
    } catch {
      setStorageError('其他标签页保存的数据无效，已保留当前配置。')
    }
  }), [catalog, locale])

  const setConfig = useCallback((next: NavigationConfig | ((current: NavigationConfig) => NavigationConfig)) => {
    // Resolve once, synchronously: multiple operations in one event see the newest data.
    // Persistence is deliberately outside React's replayable state updater.
    const value = typeof next === 'function' ? next(currentConfig.current) : next
    if (value === currentConfig.current) return value
    currentConfig.current = value
    setConfigState(value)
    try {
      const pendingWrite = setStoredValue(STORAGE_KEY, JSON.stringify(value))
      setStorageError(null)
      void pendingWrite.catch(() => setStorageError('无法保存到浏览器，本次修改仅在当前页面有效。'))
    } catch {
      setStorageError('无法保存到浏览器，本次修改仅在当前页面有效。')
    }
    return value
  }, [])

  const resetConfig = useCallback(() => { setConfig(current => resetContent(current, locale)) }, [setConfig, locale])
  return { config, setConfig, resetConfig, storageError }
}
