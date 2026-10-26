export type Language = 'auto' | 'zh-CN' | 'en'
export type Locale = Exclude<Language, 'auto'>
export type IconService = 'domestic' | 'google'
export type Preferences = { language: Language; iconService: IconService }
export const PREFERENCES_KEY = 'edith-navigation-preferences-v1'

export function browserLocale(language: string): Locale {
  return /^zh(?:-(?:cn|sg|hans)(?:-|$)|$)/i.test(language) ? 'zh-CN' : 'en'
}

export function parsePreferences(saved: string | null, browserLanguage: string): Preferences {
  const defaults: Preferences = {
    language: 'auto',
    iconService: browserLocale(browserLanguage) === 'zh-CN' ? 'domestic' : 'google',
  }
  try {
    const value: unknown = saved ? JSON.parse(saved) : null
    if (typeof value !== 'object' || value === null) return defaults
    const data = value as Partial<Preferences>
    return {
      language: data.language === 'zh-CN' || data.language === 'en' ? data.language : 'auto',
      iconService: data.iconService === 'domestic' || data.iconService === 'google' ? data.iconService : defaults.iconService,
    }
  } catch { return defaults }
}
