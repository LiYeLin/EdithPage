import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import { getLocalSiteIcon, getSiteIconSources, getSiteIconFallbackText } from '../src/data/siteIcons.ts'

const supportedHosts = [
  'chatgpt.com', 'claude.ai', 'gemini.google.com', 'chat.deepseek.com',
  'perplexity.ai', 'cursor.com', 'huggingface.co', 'kaggle.com',
  'github.com', 'stackoverflow.com', 'vercel.com', 'docs.docker.com',
  'juejin.cn', 'v2ex.com', 'news.ycombinator.com', 'dev.to',
  'google.com', 'baidu.com',
]

test('supported websites resolve to checked-in vector SVGs before the remote favicon', () => {
  for (const domain of supportedHosts) {
    const sources = getSiteIconSources(domain)
    assert.equal(sources.length, 2)
    assert.match(sources[0], /^\/site-icons\/.+\.svg$/)
    assert.match(sources[1], /^https:\/\/www\.google\.com\/s2\/favicons\?/)
    const svg = readFileSync(new URL(`../public${sources[0]}`, import.meta.url), 'utf8')
    assert.match(svg, /<svg\b/)
    assert.match(svg, /viewBox=/)
    assert.match(svg, /<path\b/)
  }
})

test('known aliases resolve without misbranding unknown hosts', () => {
  assert.equal(getLocalSiteIcon('WWW.GITHUB.COM'), '/site-icons/github.svg')
  assert.equal(getLocalSiteIcon('chat.openai.com'), '/site-icons/chatgpt.svg')
  assert.equal(getLocalSiteIcon('cursor.sh'), '/site-icons/cursor.svg')
  assert.equal(getLocalSiteIcon('hub.docker.com'), '/site-icons/docker.svg')
  for (const host of ['github.com.example.org', 'notgithub.com', 'example.org']) {
    assert.equal(getLocalSiteIcon(host), undefined)
    assert.equal(getSiteIconSources(host).length, 1)
  }
})

test('unmapped websites keep the existing encoded 128px favicon fallback', () => {
  for (const host of ['deeplearning.ai', 'example.org']) {
    assert.deepEqual(getSiteIconSources(host), [
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
    ])
  }
})

test('vendored SVGs do not contain embedded bitmaps, executable content or remote dependencies', () => {
  const folder = new URL('../public/site-icons/', import.meta.url)
  for (const file of readdirSync(folder).filter((name) => name.endsWith('.svg'))) {
    const svg = readFileSync(new URL(file, folder), 'utf8')
    assert.doesNotMatch(svg, /<(?:image|script|foreignObject|text)\b|data:image|\bon\w+\s*=|currentColor/i, file)
    assert.doesNotMatch(svg, /(?:href\s*=\s*["'](?!#)|url\(\s*["']?(?!#)[a-z])/i, file)
  }
})

test('fast.ai uses a readable local wordmark without requesting the known blurry placeholder', () => {
  for (const host of ['fast.ai', 'www.fast.ai', 'WWW.FAST.AI']) {
    assert.deepEqual(getSiteIconSources(host), [])
    assert.equal(getSiteIconFallbackText(host, 'Fast AI'), 'fast.ai')
  }
  assert.equal(getSiteIconFallbackText('example.org', 'Example'), 'E')
  assert.equal(getSiteIconSources('fast.ai.example.org').length, 1)
})

test('fallback initials preserve complete Unicode code points', () => {
  for (const [name, expected] of [
    ['🔧工具', '🔧'],
    ['𠮷工具', '𠮷'],
    ['工具', '工'],
    ['example', 'E'],
    ['', ''],
  ]) {
    assert.equal(getSiteIconFallbackText('example.org', name), expected)
  }
})


test('domestic service uses only the encoded hostname and works in extension builds', () => {
  assert.deepEqual(getSiteIconSources('example.org', 'domestic'), [
    'https://cn.cravatar.com/favicon/api/index.php?url=example.org',
  ])
  assert.equal(getSiteIconSources('github.com', 'domestic')[0], '/site-icons/github.svg')
  assert.equal(getSiteIconSources('fast.ai', 'domestic').length, 1)
})

test('invalid or private hosts never leave the browser', () => {
  for (const host of ['constructor', '__proto__', 'invalid value&sz=16', 'localhost', '127.0.0.1', 'office.local', 'https://example.org/private?token=secret']) {
    assert.deepEqual(getSiteIconSources(host, 'domestic'), [])
    assert.deepEqual(getSiteIconSources(host, 'google'), [])
  }
})
