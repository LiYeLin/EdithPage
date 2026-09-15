import { useCallback, useRef, useState } from 'react'
import { defaultConfig } from '../data/defaultConfig'
import { isNavigationConfig, normalizeTemplateConfig, resetContent } from '../templates/config'
import type { TemplateDefinition } from '../templates/types'
import type { NavigationConfig } from '../types'

const STORAGE_KEY = 'edith-navigation-config-v3'

function loadConfig(catalog: readonly TemplateDefinition[]): NavigationConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = saved ? JSON.parse(saved) : structuredClone(defaultConfig)
    return normalizeTemplateConfig(isNavigationConfig(parsed) ? parsed : structuredClone(defaultConfig), catalog)
  } catch {
    return structuredClone(defaultConfig)
  }
}

export function usePersistentConfig(catalog: readonly TemplateDefinition[]) {
  const [config, setConfigState] = useState(() => loadConfig(catalog))
  const currentConfig = useRef(config)
  const [storageError, setStorageError] = useState<string | null>(null)

  const setConfig = useCallback((next: NavigationConfig | ((current: NavigationConfig) => NavigationConfig)) => {
    // Resolve once, synchronously: multiple operations in one event see the newest data.
    // Persistence is deliberately outside React's replayable state updater.
    const value = typeof next === 'function' ? next(currentConfig.current) : next
    if (value === currentConfig.current) return value
    currentConfig.current = value
    setConfigState(value)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      setStorageError(null)
    } catch {
      setStorageError('无法保存到浏览器，本次修改仅在当前页面有效。')
    }
    return value
  }, [])

  const resetConfig = useCallback(() => { setConfig(resetContent) }, [setConfig])
  return { config, setConfig, resetConfig, storageError }
}
