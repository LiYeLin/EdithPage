import type { ComponentType } from 'react'
import type { EditorTarget, FrequentSiteItem, Module } from '../types'
import type { SiteMove } from '../utils/moveSite'

export type TemplateInteractionState = { dragging: boolean; settling: boolean }

export type TemplateAppearance = {
  backgroundImage: string
  backgroundPosition?: string
}

export type NavigationActions = {
  enterEditMode: () => void
  openSettings: () => void
  addSite: (moduleId: string) => void
  edit: (target: NonNullable<EditorTarget>) => void
  removeSite: (moduleId: string, siteId: string) => void
  removeModule: (moduleId: string) => void
  moveSite: (move: SiteMove) => boolean
  visitSite: (siteId: string) => void
}

export type NavigationTemplateProps = {
  modules: readonly Module[]
  frequentSites: readonly FrequentSiteItem[]
  editing: boolean
  interactionBlocked: boolean
  revealSite: { moduleId: string; siteId: string } | null
  actions: NavigationActions
  onInteractionStateChange: (state: TemplateInteractionState) => void
}

export type TemplateDefinition = {
  id: string
  name: string
  description: string
  editingHint: string
  appearance?: TemplateAppearance
  load: () => Promise<{ default: ComponentType<NavigationTemplateProps> }>
}
