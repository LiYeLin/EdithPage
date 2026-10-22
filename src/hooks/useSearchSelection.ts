import { useEffect, useState } from 'react'
import { searchEngines } from '../data/defaultConfig'
import { browserDefaultSearch, isExtensionSearch } from '../platform/search'
import { getStoredValue, setStoredValue, subscribeStoredValue } from '../platform/storage'
import type { SearchSelection } from '../types'

const ENGINE_STORAGE_KEY = 'edith-navigation-search-engine-v1'

export function useSearchSelection() {
  const extensionSearch = isExtensionSearch()
  const [engine, setEngine] = useState<SearchSelection>(() => {
    if (extensionSearch) return browserDefaultSearch
    try {
      return searchEngines.find((item) => item.id === getStoredValue(ENGINE_STORAGE_KEY)) ?? searchEngines[0]
    } catch {
      return searchEngines[0]
    }
  })

  useEffect(() => {
    if (extensionSearch) return
    return subscribeStoredValue(ENGINE_STORAGE_KEY, (saved) => {
      setEngine(searchEngines.find((item) => item.id === saved) ?? searchEngines[0])
    })
  }, [extensionSearch])

  const changeEngine = (next: SearchSelection) => {
    setEngine(next)
    if (!extensionSearch && next.id !== 'browser-default') {
      try {
        void setStoredValue(ENGINE_STORAGE_KEY, next.id).catch(() => {
          // Keep the current page usable when storage is unavailable.
        })
      } catch {
        // Keep the current page usable when storage is unavailable.
      }
    }
  }

  return { engine, changeEngine }
}
