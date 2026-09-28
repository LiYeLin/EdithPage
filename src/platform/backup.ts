import { isNavigationConfig } from '../templates/config'
import { getStoredValue, replaceStoredValues, STORAGE_KEYS, type StorageKey } from './storage'

export type EdithBackupV1 = {
  format: 'edith-backup'
  version: 1
  exportedAt: string
  data: Partial<Record<StorageKey, unknown>>
}

const CONFIG_KEY: StorageKey = 'edith-navigation-config-v3'
const ENGINE_KEY: StorageKey = 'edith-navigation-search-engine-v1'
const USAGE_KEY: StorageKey = 'edith-navigation-usage-v1'
const ONBOARDING_KEY: StorageKey = 'edith-navigation-onboarding-completed-v1'
const searchEngineIds = new Set(['google', 'perplexity', 'baidu'])

function parseJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value) as unknown
  } catch {
    throw new Error(`${label}数据已损坏，无法导出。`)
  }
}

function isUsageCounts(value: unknown): value is Record<string, number> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.values(value).every((count) => typeof count === 'number' && Number.isFinite(count) && count >= 0)
}

export function createBackup(): EdithBackupV1 {
  const data: Partial<Record<StorageKey, unknown>> = {}
  const config = getStoredValue(CONFIG_KEY)
  const engine = getStoredValue(ENGINE_KEY)
  const usage = getStoredValue(USAGE_KEY)
  const onboarding = getStoredValue(ONBOARDING_KEY)

  if (config !== null) data[CONFIG_KEY] = parseJson(config, '导航配置')
  if (engine !== null) data[ENGINE_KEY] = engine
  if (usage !== null) data[USAGE_KEY] = parseJson(usage, '访问记录')
  if (onboarding !== null) data[ONBOARDING_KEY] = onboarding === '1'

  return {
    format: 'edith-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  }
}

export function parseBackup(text: string): EdithBackupV1 {
  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch {
    throw new Error('备份文件不是有效的 JSON。')
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('备份文件格式不正确。')
  const backup = value as Partial<EdithBackupV1>
  if (backup.format !== 'edith-backup' || backup.version !== 1
    || typeof backup.data !== 'object' || backup.data === null || Array.isArray(backup.data)) {
    throw new Error('不支持这个备份文件版本。')
  }

  const data = backup.data
  if (CONFIG_KEY in data && !isNavigationConfig(data[CONFIG_KEY])) throw new Error('备份中的导航配置无效。')
  if (ENGINE_KEY in data && (typeof data[ENGINE_KEY] !== 'string' || !searchEngineIds.has(data[ENGINE_KEY]))) {
    throw new Error('备份中的搜索引擎无效。')
  }
  if (USAGE_KEY in data && !isUsageCounts(data[USAGE_KEY])) throw new Error('备份中的访问记录无效。')
  if (ONBOARDING_KEY in data && typeof data[ONBOARDING_KEY] !== 'boolean') throw new Error('备份中的引导状态无效。')

  return backup as EdithBackupV1
}

function serializeBackupValue(key: StorageKey, value: unknown): string {
  if (key === ENGINE_KEY) return value as string
  if (key === ONBOARDING_KEY) return value ? '1' : '0'
  return JSON.stringify(value)
}

export async function importBackup(text: string): Promise<void> {
  const backup = parseBackup(text)
  const values: Partial<Record<StorageKey, string>> = {}
  for (const key of STORAGE_KEYS) {
    if (!(key in backup.data)) continue
    const value = backup.data[key]
    if (key !== ONBOARDING_KEY || value !== false) values[key] = serializeBackupValue(key, value)
  }
  await replaceStoredValues(values)
}
