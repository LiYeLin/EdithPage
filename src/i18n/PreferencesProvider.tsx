import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getStoredValue, setStoredValue, subscribeStoredValue } from '../platform/storage'
import { PreferencesContext } from './PreferencesContext'
import { browserLocale, parsePreferences, PREFERENCES_KEY, type Preferences } from './preferences'

function loadPreferences(): Preferences {
  try { return parsePreferences(getStoredValue(PREFERENCES_KEY), navigator.language) }
  catch { return parsePreferences(null, navigator.language) }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(loadPreferences)
  const [browserLanguage, setBrowserLanguage] = useState(() => navigator.language)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const changed = () => setBrowserLanguage(navigator.language)
    window.addEventListener('languagechange', changed)
    const unsubscribe = subscribeStoredValue(PREFERENCES_KEY, saved => setPreferences(parsePreferences(saved, navigator.language)))
    return () => { window.removeEventListener('languagechange', changed); unsubscribe() }
  }, [])
  const update = useCallback((patch: Partial<Preferences>) => {
    const next = { ...preferences, ...patch }
    setPreferences(next)
    setError(null)
    try {
      void setStoredValue(PREFERENCES_KEY, JSON.stringify(next)).catch(() => setError('无法保存到浏览器，本次修改仅在当前页面有效。'))
    } catch { setError('无法保存到浏览器，本次修改仅在当前页面有效。') }
  }, [preferences])
  const locale = preferences.language === 'auto' ? browserLocale(browserLanguage) : preferences.language
  useEffect(() => { document.documentElement.lang = locale; document.title = locale === 'en' ? 'Edith — New Tab' : 'Edith 新标签页' }, [locale])
  const value = useMemo(() => ({ preferences, locale, error, update }), [preferences, locale, error, update])
  return <PreferencesContext value={value}>{children}</PreferencesContext>
}
