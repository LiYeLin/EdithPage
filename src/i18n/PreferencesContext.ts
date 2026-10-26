import { createContext } from 'react'
import type { Locale, Preferences } from './preferences'

export const PreferencesContext = createContext<{
  preferences: Preferences
  locale: Locale
  error: string | null
  update: (patch: Partial<Preferences>) => void
}>({ preferences: { language: 'auto', iconService: 'google' }, locale: 'zh-CN', error: null, update: () => {} })
