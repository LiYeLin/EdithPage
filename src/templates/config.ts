import { defaultConfig } from '../data/defaultConfig.ts'
import type { IconPosition, IconPositionPersistence, NavigationConfig } from '../types'
import type { TemplateAppearance, TemplateDefinition, TemplateInteractionState } from './types'

export const DEFAULT_TEMPLATE_APPEARANCE: TemplateAppearance = {
  backgroundImage: '/edith-landscape.jpg',
  backgroundPosition: 'center 46%',
}

export function getTemplateAppearance(template: Pick<TemplateDefinition, 'appearance'> | null | undefined): TemplateAppearance {
  return { ...DEFAULT_TEMPLATE_APPEARANCE, ...(template?.appearance ?? {}) }
}

export const DEFAULT_ICON_POSITION_PERSISTENCE: IconPositionPersistence = {
  enabled: false,
  positions: {},
}

export function isValidIconPosition(value: unknown): value is IconPosition {
  if (!isRecord(value)) return false
  return typeof value.x === 'number' && Number.isFinite(value.x) && value.x >= 0 && value.x <= 1
    && typeof value.y === 'number' && Number.isFinite(value.y) && value.y >= 0 && value.y <= 1
    && typeof value.angle === 'number' && Number.isFinite(value.angle)
}

export function normalizeIconPositions(value: unknown): Record<string, IconPosition> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter(([, position]) => isValidIconPosition(position)),
  ) as Record<string, IconPosition>
}

function normalizeIconPositionPersistenceSlot(value: unknown): IconPositionPersistence {
  if (!isRecord(value)) return { ...DEFAULT_ICON_POSITION_PERSISTENCE, positions: {} }
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : false,
    positions: normalizeIconPositions(value.positions),
  }
}

/** Normalize only when the optional field existed, so legacy configs are not rewritten in memory. */
export function normalizeIconPositionPersistence(value: unknown): NavigationConfig['iconPositionPersistence'] {
  if (!isRecord(value)) return {}
  const result: NonNullable<NavigationConfig['iconPositionPersistence']> = {}
  if ('matter' in value) result.matter = normalizeIconPositionPersistenceSlot(value.matter)
  if ('beijing' in value) result.beijing = normalizeIconPositionPersistenceSlot(value.beijing)
  return result
}

export function getIconPositionPersistence(config: Pick<NavigationConfig, 'iconPositionPersistence'>, templateId: 'matter' | 'beijing'): IconPositionPersistence {
  const configured = config.iconPositionPersistence?.[templateId]
  if (!configured) return { enabled: false, positions: {} }
  return {
    enabled: configured.enabled === true,
    positions: normalizeIconPositions(configured.positions),
  }
}

/** Only normalize template identity. Existing user content is not a template preset. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasNavigationShape(value: unknown): value is Omit<NavigationConfig, 'templateId'> & { templateId?: string } {
  if (!isRecord(value) || (value.templateId !== undefined && typeof value.templateId !== 'string') || !Array.isArray(value.modules)) return false
  if (value.accent !== 'mint' && value.accent !== 'violet' && value.accent !== 'orange') return false
  return value.modules.every((module) => {
    if (!isRecord(module) || typeof module.id !== 'string' || typeof module.title !== 'string'
      || typeof module.description !== 'string' || typeof module.accent !== 'string' || !Array.isArray(module.sites)) return false
    return module.sites.every((site) => isRecord(site)
      && typeof site.id === 'string' && typeof site.name === 'string'
      && typeof site.url === 'string' && typeof site.description === 'string'
      && (site.shortcut === undefined || typeof site.shortcut === 'string'))
  })
}

export function isNavigationConfig(value: unknown): value is NavigationConfig {
  return hasNavigationShape(value) && typeof value.templateId === 'string'
}

export function normalizeTemplateConfig(config: unknown, catalog: readonly TemplateDefinition[]): NavigationConfig {
  const safeConfig = hasNavigationShape(config) ? config : structuredClone(defaultConfig)
  const templateId = typeof safeConfig.templateId === 'string' && catalog.some(template => template.id === safeConfig.templateId)
    ? safeConfig.templateId
    : defaultConfig.templateId
  if (!Object.prototype.hasOwnProperty.call(safeConfig, 'iconPositionPersistence')) {
    return { ...safeConfig, templateId }
  }
  return {
    ...safeConfig,
    templateId,
    iconPositionPersistence: normalizeIconPositionPersistence(safeConfig.iconPositionPersistence),
  }
}

export function selectTemplate(config: NavigationConfig, templateId: string): NavigationConfig {
  return config.templateId === templateId ? config : { ...config, templateId }
}

export function resetContent(config: NavigationConfig): NavigationConfig {
  return { ...structuredClone(defaultConfig), templateId: config.templateId }
}

export function canSwitchTemplate(state: TemplateInteractionState): boolean {
  return !state.dragging && !state.settling
}
