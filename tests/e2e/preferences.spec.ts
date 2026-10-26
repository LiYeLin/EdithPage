import { test, expect } from '@playwright/test'

const preferencesKey = 'edith-navigation-preferences-v1'
const configKey = 'edith-navigation-config-v3'
const config = { templateId: 'plain', accent: 'mint', modules: [
  { id: 'custom', title: '我的分类', description: '', accent: '#9ff7cd', sites: [] },
] }
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="lime"/></svg>'

test.beforeEach(async ({ page }) => {
  await page.route('https://cn.cravatar.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: svg }))
  await page.route('https://www.google.com/s2/**', route => route.fulfill({ contentType: 'image/svg+xml', body: svg }))
  await page.route('**/_vercel/**', route => route.fulfill({ contentType: 'application/javascript', body: '' }))
  await page.addInitScript(({ configKey, config }) => {
    if (!localStorage.getItem(configKey)) localStorage.setItem(configKey, JSON.stringify(config))
    localStorage.setItem('edith-navigation-onboarding-completed-v1', '1')
  }, { configKey, config })
})

test('new site fetches a domestic icon; language and service switch independently and survive refresh', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: '打开设置', exact: true }).click()
  await page.getByPlaceholder('站点名称').fill('我的网站')
  await page.getByPlaceholder('https://example.com').fill('https://example.org/private?secret=hidden')
  await page.getByRole('button', { name: '添加到「我的分类」' }).click()
  // Use the site link to scope the image independently of template CSS names.
  const siteIcon = page.getByRole('link', { name: '我的网站，打开站点' }).locator('img')
  await expect(siteIcon).toHaveAttribute('src', 'https://cn.cravatar.com/favicon/api/index.php?url=example.org')
  await expect.poll(() => siteIcon.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(32)
  expect(await siteIcon.getAttribute('referrerpolicy')).toBe('no-referrer')
  await page.getByLabel('界面语言', { exact: true }).selectOption('en')
  await expect(page.getByRole('heading', { name: 'Customize workspace' })).toBeVisible()
  await expect(page.getByLabel('Icon service')).toHaveValue('domestic')
  await page.getByLabel('Icon service').selectOption('google')
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  const englishIcon = page.getByRole('link', { name: '我的网站, open site' }).locator('img')
  await expect(englishIcon).toHaveAttribute('src', /google\.com\/s2\/favicons\?domain=example.org/)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(englishIcon).toHaveAttribute('src', /google\.com/)
  await expect(page.getByRole('heading', { name: '我的分类' })).toBeVisible()
  expect(JSON.parse(await page.evaluate(key => localStorage.getItem(key)!, preferencesKey))).toEqual({ language: 'en', iconService: 'google' })
  expect(errors).toEqual([])
})

test('offline or failed icon request falls back without a broken image', async ({ page }) => {
  await page.route('https://cn.cravatar.com/**', route => route.abort())
  await page.addInitScript(({ configKey, config }) => {
    localStorage.setItem(configKey, JSON.stringify({ ...config, modules: [{ ...config.modules[0], sites: [
      { id: 'one', name: 'Example', url: 'https://example.org', description: '' },
    ] }] }))
  }, { configKey, config })
  await page.goto('/')
  const link = page.getByRole('link', { name: 'Example，打开站点' })
  await expect(link.locator('.site-icon-fallback')).toHaveText('E')
  await expect(link.locator('img')).toHaveCount(0)
})

test.describe('overseas defaults', () => {
  test.use({ locale: 'en-US', viewport: { width: 390, height: 844 } })
  test('uses English and Google by default, with usable settings on mobile', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.getByRole('button', { name: 'Open settings', exact: true }).click()
    await expect(page.getByLabel('Language')).toHaveValue('auto')
    await expect(page.getByLabel('Icon service')).toHaveValue('google')
    await expect(page.getByRole('heading', { name: 'Customize workspace' })).toBeVisible()
    await page.getByLabel('Icon service').selectOption('domestic')
    await expect(page.getByLabel('Icon service')).toHaveValue('domestic')
    const drawer = page.locator('.settings-drawer.is-open')
    await expect.poll(async () => {
      const bounds = await drawer.boundingBox()
      return bounds!.x + bounds!.width
    }).toBeLessThanOrEqual(390)
    const box = await drawer.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  })
})
