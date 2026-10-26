import { describe, expect, it } from 'vitest'
import { browserLocale, parsePreferences } from '../src/i18n/preferences'

describe('language and icon service defaults', () => {
  it.each(['zh', 'zh-CN', 'zh-SG', 'zh-Hans', 'zh-Hans-CN'])('%s defaults to the domestic service', language => {
    expect(browserLocale(language)).toBe('zh-CN')
    expect(parsePreferences(null, language)).toEqual({ language: 'auto', iconService: 'domestic' })
  })
  it.each(['en-US', 'fr', 'zh-TW', 'zh-HK', 'zh-Hant'])('%s defaults to Google', language => {
    expect(parsePreferences(null, language)).toEqual({ language: 'auto', iconService: 'google' })
  })
  it('validates saved values independently and tolerates damaged storage', () => {
    expect(parsePreferences('{bad', 'en')).toEqual({ language: 'auto', iconService: 'google' })
    expect(parsePreferences('null', 'zh-CN').iconService).toBe('domestic')
    expect(parsePreferences('{"language":"fr","iconService":"invalid"}', 'en')).toEqual({ language: 'auto', iconService: 'google' })
    expect(parsePreferences('{"language":"en","iconService":"domestic"}', 'en')).toEqual({ language: 'en', iconService: 'domestic' })
  })
})

// Translated strings must retain every interpolation token used by the source.
describe('translation messages', () => {
  it('keeps dynamic names and counts in every English translation', async () => {
    const { english } = await import('../src/i18n/en')
    for (const [source, translation] of Object.entries(english)) {
      expect(translation.match(/\{\d+\}/g) ?? [], source).toEqual(source.match(/\{\d+\}/g) ?? [])
    }
  })
})
