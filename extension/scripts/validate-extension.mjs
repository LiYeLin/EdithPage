import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extensionTargets } from './targets.mjs'

const projectRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)))

function walk(folder) {
  return readdirSync(folder).flatMap((name) => {
    const path = resolve(folder, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export function validateExtension(folder, browser) {
  const manifestPath = resolve(folder, 'manifest.json')
  assert(existsSync(manifestPath), `${browser}: 缺少 manifest.json`)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

  assert(manifest.manifest_version === 3, `${browser}: 必须使用 Manifest V3`)
  assert(/^\d+(?:\.\d+){0,3}$/.test(manifest.version), `${browser}: 版本号无效`)
  assert(JSON.stringify(manifest.permissions) === JSON.stringify(['storage', 'search']), `${browser}: 权限必须仅包含 storage 和 search`)
  assert(!manifest.host_permissions, `${browser}: 不允许 host_permissions`)
  assert(!manifest.background && !manifest.content_scripts && !manifest.action, `${browser}: 首版不允许后台、内容脚本或工具栏入口`)
  assert(manifest.chrome_url_overrides?.newtab === 'index.html', `${browser}: 新标签页入口无效`)
  assert(manifest.content_security_policy?.extension_pages === "script-src 'self'; object-src 'none'", `${browser}: CSP 无效`)
  assert(existsSync(resolve(folder, 'index.html')), `${browser}: 缺少 index.html`)

  for (const icon of Object.values(manifest.icons ?? {})) {
    assert(existsSync(resolve(folder, icon)), `${browser}: 缺少图标 ${icon}`)
  }

  assert(manifest.default_locale === 'en', `${browser}: 缺少默认语言`)
  assert(manifest.name === '__MSG_extensionName__' && manifest.description === '__MSG_extensionDescription__', `${browser}: 未启用本地化名称`)
  for (const locale of ['en', 'zh_CN']) {
    const messages = JSON.parse(readFileSync(resolve(folder, '_locales', locale, 'messages.json'), 'utf8'))
    assert(messages.extensionName?.message && messages.extensionDescription?.message, `${browser}: 缺少 ${locale} 翻译`)
  }
  const files = walk(folder)
  assert(!files.some((file) => file.endsWith('.map')), `${browser}: 商店包不能包含 source map`)
  const executableText = files
    .filter((file) => /\.(?:html|js|css|json)$/.test(file))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n')

  for (const forbidden of ['@vercel/analytics', '/_vercel/insights']) {
    assert(!executableText.includes(forbidden), `${browser}: 构建产物包含禁用资源 ${forbidden}`)
  }
  const html = readFileSync(resolve(folder, 'index.html'), 'utf8')
  assert(!/(?:src|href)=["']https?:\/\//i.test(html), `${browser}: HTML 包含远程资源`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const browser of extensionTargets) {
    validateExtension(resolve(projectRoot, 'dist/extensions', browser.id), browser.label)
  }
  console.log('Chrome、Edge、360 和 QQ 扩展产物校验通过。')
}
