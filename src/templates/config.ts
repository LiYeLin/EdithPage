import { defaultConfig } from '../data/defaultConfig.ts'
import type { NavigationConfig } from '../types'
import type { TemplateAppearance, TemplateDefinition, TemplateInteractionState } from './types'

export const DEFAULT_TEMPLATE_APPEARANCE: TemplateAppearance = {
  backgroundImage: '/edith-landscape.jpg',
  backgroundPosition: 'center 46%',
}

export function getTemplateAppearance(template: Pick<TemplateDefinition, 'appearance'> | null | undefined): TemplateAppearance {
  return { ...DEFAULT_TEMPLATE_APPEARANCE, ...(template?.appearance ?? {}) }
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
  return { ...safeConfig, templateId }
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
