import { useCallback, useContext } from 'react'
import { PreferencesContext } from './PreferencesContext'
import { english } from './en'
import type { Locale } from './preferences'

export function translate(locale: Locale, source: string, ...values: unknown[]): string {
  const text = locale === 'en' ? english[source] ?? source : source
  return text.replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)] ?? ''))
}

export function useTranslation() {
  const { locale } = useContext(PreferencesContext)
  return useCallback((source: string, ...values: unknown[]) => translate(locale, source, ...values), [locale])
}
