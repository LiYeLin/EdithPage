export const STORAGE_KEYS = [
  'edith-navigation-config-v3',
  'edith-navigation-search-engine-v1',
  'edith-navigation-usage-v1',
  'edith-navigation-onboarding-completed-v1',
] as const

const ALL_STORAGE_KEYS = [...STORAGE_KEYS, 'edith-navigation-preferences-v1'] as const
export type StorageKey = typeof ALL_STORAGE_KEYS[number]

type ExtensionStorageArea = {
  get(keys: readonly string[]): Promise<Record<string, unknown>>
  set(items: Record<string, string>): Promise<void>
  remove(keys: readonly string[]): Promise<void>
}

type ExtensionStorageChange = { oldValue?: unknown; newValue?: unknown }
type ExtensionStorageChanges = Record<string, ExtensionStorageChange>
type ExtensionStorageChangeListener = (changes: ExtensionStorageChanges, areaName: string) => void

type ExtensionRuntime = {
  runtime?: { id?: string }
  storage?: {
    local?: ExtensionStorageArea
    onChanged?: {
      addListener(listener: ExtensionStorageChangeListener): void
      removeListener(listener: ExtensionStorageChangeListener): void
    }
  }
}

const extensionCache = new Map<StorageKey, string>()

function extensionStorage(): ExtensionStorageArea | null {
  const api = (globalThis as typeof globalThis & { chrome?: ExtensionRuntime }).chrome
  return api?.runtime?.id && api.storage?.local ? api.storage.local : null
}

function extensionStorageEvents() {
  return (globalThis as typeof globalThis & { chrome?: ExtensionRuntime }).chrome?.storage?.onChanged ?? null
}

export function isExtensionRuntime(): boolean {
  return extensionStorage() !== null
}

export async function initializeStorage(): Promise<void> {
  const storage = extensionStorage()
  if (!storage) return

  const values = await storage.get(ALL_STORAGE_KEYS)
  extensionCache.clear()
  for (const key of ALL_STORAGE_KEYS) {
    if (typeof values[key] === 'string') extensionCache.set(key, values[key])
  }
}

export function getStoredValue(key: StorageKey): string | null {
  if (extensionStorage()) return extensionCache.get(key) ?? null
  return localStorage.getItem(key)
}

export function setStoredValue(key: StorageKey, value: string): Promise<void> {
  const storage = extensionStorage()
  if (!storage) {
    localStorage.setItem(key, value)
    return Promise.resolve()
  }

  extensionCache.set(key, value)
  return storage.set({ [key]: value })
}

export function removeStoredValue(key: StorageKey): Promise<void> {
  const storage = extensionStorage()
  if (!storage) {
    localStorage.removeItem(key)
    return Promise.resolve()
  }

  extensionCache.delete(key)
  return storage.remove([key])
}

export function subscribeStoredValue(key: StorageKey, listener: (value: string | null) => void): () => void {
  const events = extensionStorageEvents()
  if (extensionStorage() && events) {
    const handleChange: ExtensionStorageChangeListener = (changes, areaName) => {
      if (areaName !== 'local' || !(key in changes)) return
      const next = changes[key].newValue
      const value = typeof next === 'string' ? next : null
      if (value === null) extensionCache.delete(key)
      else extensionCache.set(key, value)
      listener(value)
    }
    events.addListener(handleChange)
    return () => events.removeListener(handleChange)
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.storageArea === localStorage && event.key === key) listener(event.newValue)
  }
  window.addEventListener('storage', handleStorage)
  return () => window.removeEventListener('storage', handleStorage)
}

export async function replaceStoredValues(values: Partial<Record<StorageKey, string>>): Promise<void> {
  const previous = Object.fromEntries(STORAGE_KEYS.map((key) => [key, getStoredValue(key)])) as Record<StorageKey, string | null>
  const storage = extensionStorage()

  const applyToWebStorage = (snapshot: Partial<Record<StorageKey, string>>) => {
    for (const key of STORAGE_KEYS) {
      const value = snapshot[key]
      if (value === undefined) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    }
  }

  const restoreExtension = async () => {
    if (!storage) return
    const toSet = Object.fromEntries(Object.entries(previous).filter((entry): entry is [StorageKey, string] => entry[1] !== null))
    const toRemove = STORAGE_KEYS.filter((key) => previous[key] === null)
    if (Object.keys(toSet).length > 0) await storage.set(toSet)
    if (toRemove.length > 0) await storage.remove(toRemove)
  }

  try {
    if (!storage) {
      applyToWebStorage(values)
      return
    }

    const toSet = Object.fromEntries(Object.entries(values)) as Record<string, string>
    const toRemove = STORAGE_KEYS.filter((key) => values[key] === undefined)
    if (Object.keys(toSet).length > 0) await storage.set(toSet)
    if (toRemove.length > 0) await storage.remove(toRemove)
    for (const key of STORAGE_KEYS) extensionCache.delete(key)
    for (const [key, value] of Object.entries(values) as [StorageKey, string][]) extensionCache.set(key, value)
  } catch (error) {
    try {
      if (storage) await restoreExtension()
      else applyToWebStorage(Object.fromEntries(Object.entries(previous).filter((entry): entry is [StorageKey, string] => entry[1] !== null)))
    } catch {
      // Preserve the original import failure; the caller can report it and avoid reloading.
    }
    for (const key of STORAGE_KEYS) extensionCache.delete(key)
    for (const [key, value] of Object.entries(previous) as [StorageKey, string | null][]) {
      if (value !== null) extensionCache.set(key, value)
    }
    throw error
  }
}
