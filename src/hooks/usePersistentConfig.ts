import { useCallback, useState } from 'react'
import { defaultConfig } from '../data/defaultConfig'
import type { NavigationConfig } from '../types'

const STORAGE_KEY = 'edith-navigation-config-v3'

function loadConfig(): NavigationConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? (JSON.parse(saved) as NavigationConfig) : defaultConfig
  } catch {
    return defaultConfig
  }
}

export function usePersistentConfig() {
  const [config, setConfigState] = useState<NavigationConfig>(loadConfig)

  const setConfig = useCallback((next: NavigationConfig | ((current: NavigationConfig) => NavigationConfig)) => {
    setConfigState((current) => {
      const value = typeof next === 'function' ? next(current) : next
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      return value
    })
  }, [])

  const resetConfig = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setConfigState(defaultConfig)
  }, [])

  return { config, setConfig, resetConfig }
}
