import { test, expect, type Page, type Locator } from '@playwright/test'

const key = 'edith-navigation-config-v3'
const usageKey = 'edith-navigation-usage-v1'
const site = (id: string) => ({ id, name: id, url: `https://example.com/${id}`, description: `Description ${id}` })
const content = {
  accent: 'violet',
  modules: [
    { id: 'a', title: '分类 A', description: 'A', accent: '#9ff7cd', sites: [site('alpha'), site('beta')] },
    { id: 'b', title: '分类 B', description: 'B', accent: '#b9b6ff', sites: [site('gamma')] },
    { id: 'empty', title: '空分类', description: 'Empty', accent: '#ffbd7b', sites: [] },
  ],
}
const template = (page: Page, id = 'bubble') => page.locator(`.template-host [data-template="${id}"]`)
const config = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)
const owner = async (page: Page, id = 'alpha') => (await config(page)).modules.find((m: typeof content.modules[number]) => m.sites.some(s => s.id === id))?.id
const background = (page: Page) => page.locator('.app').evaluate(el => getComputedStyle(el, '::before').backgroundImage)

async function choose(page: Page, id: 'list' | 'bubble' | 'plain') {
  await page.getByRole('button', { name: '切换模板', exact: true }).click()
  await page.locator('.template-option').filter({ hasText: id === 'list' ? '普通列表测试' : id === 'plain' ? '纯净应用网格' : '液态气泡' }).click()
  await expect(template(page, id)).toBeVisible()
  await expect(page.getByRole('dialog', { name: '选择模板' })).toHaveCount(0)
}
async function editBubble(page: Page) {
  const title = template(page).getByRole('button', { name: '分类 A，长按进入编辑模式' })
  const rect = await title.boundingBox(); if (!rect) throw new Error('Missing category title')
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2)
  await page.mouse.down(); await page.waitForTimeout(550); await page.mouse.up()
  await expect(page.locator('.app')).toHaveClass(/is-editing/)
}
async function center(node: Locator) {
  const r = await node.boundingBox(); if (!r) throw new Error('Missing drag target')
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
}
async function drag(page: Page, variant: 'module' | 'frequent' = 'module', targetId = 'b', release = true) {
  const source = await center(template(page).locator(`[data-site-id="alpha"][data-variant="${variant}"] a`))
  const target = await center(template(page).locator(`.module-panel[data-module-id="${targetId}"] .bubble-shell`))
  await page.mouse.move(source.x, source.y); await page.mouse.down()
  await page.mouse.move(source.x + 12, source.y, { steps: 3 })
  await expect(page.locator('.app')).toHaveClass(/is-site-dragging/)
  await expect(page.getByRole('button', { name: '切换模板', exact: true })).toBeDisabled()
  await page.mouse.move(target.x, target.y, { steps: 12 })
  if (release) await page.mouse.up()
}

test.beforeEach(async ({ page, context }) => {
  // External favicons and link destinations are not the subject of this regression suite.
  await context.route('**/*', route => {
    if (route.request().resourceType() === 'script' && !route.request().url().startsWith('http://127.0.0.1:4179/')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
    if (route.request().url().startsWith('http://127.0.0.1:4179/')) return route.continue()
    return route.fulfill({ status: 200, contentType: route.request().resourceType() === 'image' ? 'image/svg+xml' : 'text/html',
      body: route.request().resourceType() === 'image' ? '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="white"/></svg>' : '<title>External fixture</title>' })
  })
  await page.addInitScript(({ key, content }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(content))
    localStorage.setItem('edith-navigation-onboarding-completed-v1', '1')
  }, { key, content })
})

test('real replacement preserves search DOM, query, engine and shared data; refresh restores template', async ({ page }) => {
  await page.goto('/tests/fixtures/')
  await expect(template(page)).toBeVisible()
  await expect.poll(() => background(page)).toContain('/edith-landscape.jpg')
  const search = page.locator('.search-form input')
  const handle = await search.elementHandle()
  await search.fill('尚未提交的搜索')
  await page.locator('.engine-trigger').hover()
  await page.getByRole('button', { name: '百度', exact: true }).click()
  await choose(page, 'list')
  await expect.poll(() => background(page)).toContain('/fixture-list-background.jpg')
  expect(await handle?.evaluate(el => el === document.querySelector('.search-form input'))).toBe(true)
  await expect(search).toHaveValue('尚未提交的搜索')
  await expect(page.locator('.engine-trigger')).toHaveAttribute('aria-label', /百度/)
  await expect(page.locator('.bubble-shell, .site-tile-wrap, .bubble-portals')).toHaveCount(0)
  expect(await config(page)).toEqual({ ...content, templateId: 'list' })
  await choose(page, 'bubble')
  await expect(search).toHaveValue('尚未提交的搜索')
  await choose(page, 'list'); await page.reload()
  await expect(template(page, 'list')).toBeVisible()
})

test('clicking blank template space exits edit mode', async ({ page }) => {
  await page.goto('/tests/fixtures/')
  await editBubble(page)

  const modulePanel = template(page).locator('.module-panel[data-module-id="a"]')
  const moduleBox = await modulePanel.boundingBox()
  if (!moduleBox) throw new Error('Missing module panel')
  await page.mouse.click(moduleBox.x + moduleBox.width - 4, moduleBox.y + moduleBox.height - 4)
  await expect(page.locator('.app')).not.toHaveClass(/is-editing/)

  await editBubble(page)
  const frequentPanel = template(page).locator('.frequent-panel')
  const frequentBox = await frequentPanel.boundingBox()
  if (!frequentBox) throw new Error('Missing frequent panel')
  await page.mouse.click(frequentBox.x + frequentBox.width - 4, frequentBox.y + frequentBox.height - 4)
  await expect(page.locator('.app')).not.toHaveClass(/is-editing/)
})

test('same template closes picker without remounting or exiting edit mode; keyboard focus trap', async ({ page }) => {
  await page.goto('/tests/fixtures/'); await editBubble(page)
  const handle = await template(page).elementHandle()
  await page.getByRole('button', { name: '切换模板', exact: true }).click()
  await expect(page.getByRole('button', { name: '关闭模板选择' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.locator('.template-option').last()).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '关闭模板选择' })).toBeFocused()
  await page.locator('.template-option').first().click()
  await expect(page.locator('.app')).toHaveClass(/is-editing/)
  expect(await handle?.evaluate(el => el.isConnected)).toBe(true)
  await expect(page.getByRole('button', { name: '切换模板', exact: true })).toBeFocused()
})

test('load failure retains old tree and ID; retry succeeds; cancellation ignores late result', async ({ page }) => {
  await page.goto('/tests/fixtures/?fail=1&delay=200')
  await expect(template(page)).toBeVisible()
  const originalBackground = await background(page)
  await page.getByRole('button', { name: '切换模板', exact: true }).click()
  await page.locator('.template-option').last().click()
  await expect(page.locator('.template-option').last()).toBeDisabled()
  await expect(template(page)).toBeAttached()
  await expect(page.getByRole('alert')).toContainText('模板加载失败')
  expect(await background(page)).toBe(originalBackground)
  expect((await config(page)).templateId).toBeUndefined() // failed load doesn't even normalize storage
  await page.locator('.template-option').last().click()
  await expect(template(page, 'list')).toBeVisible()
  await choose(page, 'bubble')
  await page.goto('/tests/fixtures/?delay=700')
  await expect(template(page)).toBeVisible()
  await page.getByRole('button', { name: '切换模板', exact: true }).click()
  await page.locator('.template-option').last().click()
  await expect(page.locator('.template-option').last()).toBeDisabled()
  const beforeCancelBackground = await background(page)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(850)
  await expect(template(page)).toBeVisible()
  expect(await background(page)).toBe(beforeCancelBackground)
  expect((await config(page)).templateId).toBe('bubble')
  await expect(page.getByRole('button', { name: '切换模板', exact: true })).toBeFocused()
})

test('initial failure can retry while search remains usable', async ({ page }) => {
  await page.addInitScript(key => { localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)!), templateId: 'list' })); sessionStorage.removeItem('template-fixture-ready') }, key)
  await page.goto('/tests/fixtures/?fail-always=1&delay=100')
  await page.locator('.search-form input').fill('loading test')
  await expect(page.getByRole('alert')).toContainText('模板加载失败')
  await expect(page.locator('.search-form input')).toHaveValue('loading test')
  await page.evaluate(() => sessionStorage.setItem('template-fixture-ready', '1'))
  await page.getByRole('button', { name: '重试加载' }).click()
  await expect(template(page, 'list')).toBeVisible()
})

test('list uses shared editing, visit stats, atomic movement and cross-template undo', async ({ page }) => {
  await page.goto('/tests/fixtures/'); await choose(page, 'list')
  const popup = page.waitForEvent('popup')
  await page.locator('[data-list-site="beta"] a').click()
  await (await popup).close()
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), usageKey)).toEqual({ beta: 1 })
  await expect(page.getByRole('region', { name: '列表最常使用' }).locator('li').first()).toHaveText('beta')
  await page.getByRole('button', { name: '进入列表编辑' }).click()
  await page.getByRole('button', { name: '编辑 alpha', exact: true }).click()
  await page.getByPlaceholder('站点名称').fill('自定义 alpha')
  await page.getByRole('button', { name: '保存站点' }).click()
  await page.getByLabel('移动 自定义 alpha').selectOption('empty')
  expect(await owner(page)).toBe('empty')
  await expect(page.getByText('移动成功次数：1')).toBeVisible()
  await choose(page, 'bubble')
  await expect(page.locator('.app')).not.toHaveClass(/is-editing/)
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  const result = await config(page)
  expect(result.modules[0].sites.map((s: { id: string }) => s.id)).toEqual(['alpha', 'beta'])
  expect(result.modules[0].sites[0].name).toBe('自定义 alpha')
  await choose(page, 'list')
  await expect(page.getByText('无定位请求')).toBeVisible()
  await expect(page.getByRole('region', { name: '列表最常使用' }).locator('li').first()).toHaveText('beta')
})

test('undo deadline is not extended by template switching', async ({ page }) => {
  await page.goto('/tests/fixtures/'); await choose(page, 'list')
  await page.getByRole('button', { name: '进入列表编辑' }).click()
  await page.getByRole('button', { name: '删除 alpha', exact: true }).click()
  await page.waitForTimeout(3200)
  await choose(page, 'bubble')
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeVisible()
  await page.waitForTimeout(1800)
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toHaveCount(0)
})

test('settings content/accent reset preserves template; unknown saved ID preserves content', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)!), templateId: 'removed' })), key)
  await page.goto('/tests/fixtures/'); await expect(template(page)).toBeVisible()
  await choose(page, 'list')
  expect(await config(page)).toEqual({ ...content, templateId: 'list' })
  await page.getByRole('button', { name: '列表设置' }).click()
  await page.getByRole('button', { name: '恢复默认内容与配色' }).click()
  expect((await config(page)).templateId).toBe('list')
  expect((await config(page)).accent).toBe('mint')
  expect((await config(page)).modules[0].id).toBe('ai-tools')
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await page.getByRole('button', { name: '切换模板', exact: true }).click()
  await expect(page.locator('.settings-drawer:not(.template-picker)')).toHaveAttribute('aria-hidden', 'true')
})

test('failed config persistence retains in-memory edits and shows warning', async ({ page }) => {
  await page.goto('/tests/fixtures/'); await choose(page, 'list')
  await page.evaluate(key => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function(k, value) { if (k === key) throw new DOMException('Quota', 'QuotaExceededError'); original.call(this, k, value) }
  }, key)
  await page.getByRole('button', { name: '进入列表编辑' }).click()
  await page.getByRole('button', { name: '删除 alpha', exact: true }).click()
  await expect(page.locator('[data-list-site="alpha"]')).toHaveCount(0)
  await expect(page.getByRole('alert')).toContainText('无法保存到浏览器')
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  await expect(page.locator('[data-list-site="alpha"]')).toBeVisible()
})

for (const phase of ['dragging', 'settling']) test(`${phase} disables switch until template reports released`, async ({ page }) => {
  await page.goto('/tests/fixtures/'); await choose(page, 'list')
  await page.getByRole('button', { name: `模拟${phase}`, exact: true }).click()
  await expect(page.getByRole('button', { name: '切换模板', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '切换模板', exact: true })).toBeEnabled()
  await choose(page, 'bubble')
})

test('mouse liquid drag, settling guard, accent portal, cross-category move and immediate undo', async ({ page }) => {
  await page.goto('/tests/fixtures/'); await editBubble(page)
  await drag(page, 'module', 'b', false)
  await expect(page.locator('.liquid-drag-layer')).toBeVisible()
  expect(await page.locator('.liquid-drag-layer').evaluate(el => getComputedStyle(el).getPropertyValue('--accent').trim())).toBe('#c6c1ff')
  await page.mouse.up()
  await expect(page.locator('.app')).not.toHaveClass(/is-site-dragging/)
  await expect(page.getByRole('button', { name: '切换模板', exact: true })).toBeDisabled()
  expect(await owner(page)).toBe('b')
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  expect(await owner(page)).toBe('a')
  await expect(page.locator('[data-pending-arrival], .liquid-drag-layer')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '切换模板', exact: true })).toBeEnabled()
})

test('frequent drag to empty category and repeated replacement leaves no drag residue', async ({ page }) => {
  await page.goto('/tests/fixtures/'); await editBubble(page)
  await drag(page, 'frequent', 'empty')
  await expect.poll(() => owner(page)).toBe('empty')
  for (let i = 0; i < 3; i++) { await choose(page, 'list'); await expect(page.locator('.bubble-portals, .liquid-drag-layer, [data-pending-arrival]')).toHaveCount(0); await choose(page, 'bubble') }
  await editBubble(page)
  await page.getByRole('button', { name: '删除 beta', exact: true }).last().click({ force: true })
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  expect((await config(page)).modules.flatMap((m: typeof content.modules[number]) => m.sites).filter((s: { id: string }) => s.id === 'beta')).toHaveLength(1)
})

for (const cancel of [true, false]) test(`keyboard drag ${cancel ? 'cancel' : 'move'} without liquid layer`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/tests/fixtures/'); await editBubble(page)
  await template(page).locator('[data-site-id="alpha"][data-variant="module"] a').focus()
  await page.keyboard.press('Space'); await expect(page.locator('.app')).toHaveClass(/is-site-dragging/)
  if (cancel) { await page.keyboard.press('Escape') } else { await page.waitForTimeout(50); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter') }
  await expect(page.locator('.app')).not.toHaveClass(/is-site-dragging/)
  await expect(page.locator('.liquid-drag-layer')).toHaveCount(0)
  await expect.poll(() => owner(page)).toBe(cancel ? 'a' : 'b')
  await expect(page.locator('.app')).toHaveClass(/is-editing/)
  await expect(page.getByRole('button', { name: '切换模板', exact: true })).toBeEnabled()
})

test('mouse cancellation returns placeholder without moving content', async ({ page }) => {
  await page.goto('/tests/fixtures/'); await editBubble(page)
  await drag(page, 'module', 'b', false)
  await page.keyboard.press('Escape'); await page.mouse.up()
  await expect(page.locator('.liquid-drag-layer, [data-pending-arrival]')).toHaveCount(0)
  expect(await owner(page)).toBe('a')
  await expect(page.locator('.app')).toHaveClass(/is-editing/)
})

test('touch drag uses real touch input and moves into empty category', async ({ page, context }) => {
  await page.goto('/tests/fixtures/'); await editBubble(page)
  const client = await context.newCDPSession(page)
  const source = await center(template(page).locator('[data-site-id="alpha"][data-variant="module"] a'))
  const target = await center(template(page).locator('.module-panel[data-module-id="empty"] .bubble-shell'))
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...source, id: 0 }] })
  await page.waitForTimeout(270)
  await expect(page.locator('.app')).toHaveClass(/is-site-dragging/)
  for (let i = 1; i <= 10; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: source.x + (target.x - source.x) * i / 10, y: source.y + (target.y - source.y) * i / 10, id: 0 }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect.poll(() => owner(page)).toBe('empty')
  await expect(page.locator('.liquid-drag-layer, [data-pending-arrival]')).toHaveCount(0)
})

test('new-page arrival and undo reveal the correct site', async ({ page }) => {
  await page.addInitScript(({ key, sites }) => {
    const saved = JSON.parse(localStorage.getItem(key)!); saved.modules[1].sites = sites
    localStorage.setItem(key, JSON.stringify(saved))
  }, { key, sites: Array.from({ length: 17 }, (_, i) => site(`extra-${i}`)) })
  await page.goto('/tests/fixtures/'); await editBubble(page)
  await drag(page)
  await expect.poll(() => owner(page)).toBe('b')
  const received = template(page).locator('[data-module-id="b"][data-site-id="alpha"][data-variant="module"]')
  await expect(received).toBeInViewport()
  await expect(received).not.toHaveAttribute('data-pending-arrival', 'true')
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  await expect(template(page).locator('[data-module-id="a"][data-site-id="alpha"][data-variant="module"]')).toBeInViewport()
})

test('blank template space exits editing, actual category area does not', async ({ page }) => {
  await page.goto('/tests/fixtures/'); await editBubble(page)
  await template(page).locator('.module-header').first().dispatchEvent('click')
  await expect(page.locator('.app')).toHaveClass(/is-editing/)
  await template(page).locator('.module-grid').dispatchEvent('click')
  await expect(page.locator('.app')).not.toHaveClass(/is-editing/)
})

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) test(`production visual smoke ${viewport.width}px, reduced motion and picker catalog`, async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()) })
  await page.setViewportSize(viewport)
  await page.addInitScript(key => localStorage.removeItem(key), key)
  await page.goto('/')
  await expect(page).toHaveTitle('Edith导航')
  await expect(template(page)).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '添加站点', exact: true })).toHaveCount(0)
  await page.waitForTimeout(1400)
  await page.screenshot({ path: `/private/tmp/edith-template-phase1-${viewport.width}.png`, fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: '切换模板', exact: true }).click()
  const templateOptions = page.locator('.template-option')
  await expect(templateOptions).toHaveCount(4)
  await expect(templateOptions).toHaveText([/^液态气泡/, /^物理图标/, /^北京地标/, /^纯净应用网格/])
  await page.keyboard.press('Escape')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(template(page)).toBeVisible()
  expect(errors).toEqual([])
})


test('plain template renders categories and shares visits/editing with the public layer', async ({ page }) => {
  await page.goto('/')
  await expect(template(page)).toBeVisible()
  await choose(page, 'plain')

  const plain = template(page, 'plain')
  await expect(plain).toBeVisible()
  await expect(plain.locator('.plain-module')).toHaveCount(3)
  await expect(plain.getByRole('heading', { name: '分类 A', exact: true })).toBeVisible()
  await expect(plain.getByRole('heading', { name: '分类 B', exact: true })).toBeVisible()
  await expect(plain.getByRole('heading', { name: '空分类', exact: true })).toBeVisible()
  await expect(plain.locator('.plain-site-grid').first()).toBeVisible()
  await expect(plain.locator('[data-plain-site="alpha"]')).toBeVisible()
  await expect(plain.locator('[data-plain-site="gamma"]')).toBeVisible()
  await expect(plain.locator('.plain-empty-state')).toContainText('这个分类还没有应用')
  await expect(plain.locator('.bubble-shell, .liquid-drag-layer, .bubble-portals')).toHaveCount(0)
  await expect(plain.getByRole('button', { name: '进入编辑模式：分类 A' })).toBeVisible()

  const popup = page.waitForEvent('popup')
  await plain.locator('[data-plain-site="alpha"] .plain-site-link').click()
  await (await popup).close()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('edith-navigation-usage-v1')!))).toEqual({ alpha: 1 })

  await plain.getByRole('button', { name: '进入编辑模式：分类 A' }).click()
  await expect(page.locator('.app')).toHaveClass(/is-editing/)
  await expect(plain.getByRole('button', { name: /编辑分类/ }).first()).toBeVisible()
  await expect(plain.getByRole('button', { name: /编辑 / }).first()).toBeVisible()
  await expect(plain.locator('select[aria-label^="移动 "]').first()).toBeVisible()
})
