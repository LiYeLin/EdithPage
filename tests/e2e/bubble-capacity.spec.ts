import { expect, test, type Page } from '@playwright/test'

const configKey = 'edith-navigation-config-v3'
const group = (id: string, count: number) => ({ id, title: `分类 ${id}`, description: '', accent: '#9ff7cd', sites: Array.from({ length: count }, (_, index) => ({
  id: `${id}-${index}`, name: `${id} 站点 ${index}`, url: `https://example.org/${id}/${index}`, description: '',
})) })

async function seed(page: Page, counts: number[]) {
  await page.addInitScript(({ configKey, modules }) => {
    if (!localStorage.getItem(configKey)) localStorage.setItem(configKey, JSON.stringify({ templateId: 'bubble', accent: 'mint', modules }))
    localStorage.setItem('edith-navigation-onboarding-completed-v1', '1')
  }, { configKey, modules: counts.map((count, i) => group(String(i), count)) })
}

async function assertOneScreen(page: Page) {
  await expect(page.locator('.bubble-workspace')).toHaveAttribute('data-capacity', 'fits')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect.poll(() => page.locator('.module-panel').evaluateAll(panels => panels.every(panel => {
    const bounds = panel.getBoundingClientRect()
    return bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight - 44
  }))).toBe(true)
  expect(await page.locator('.bubble-pagination').count()).toBe(0)
  expect(await page.locator('.bubble-page[inert]').count()).toBe(0)
}

test.beforeEach(async ({ context }) => {
  await context.route('https://**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>' }))
})

test('four-site group uses centered 2 + 3 slots and retains positions when editing', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seed(page, [6, 4, 4, 4])
  await page.goto('/')
  await assertOneScreen(page)
  const panel = page.locator('.module-panel[data-module-id="1"]')
  const positions = () => panel.locator('.bubble-site-motion:not(.bubble-add-position)').evaluateAll(elements =>
    elements.map(element => ({ left: parseFloat((element as HTMLElement).style.left), top: parseFloat((element as HTMLElement).style.top) })))
  const before = await positions()
  expect(before).toHaveLength(4)
  const title = panel.getByRole('button', { name: '分类 1，长按进入编辑模式' })
  const box = (await title.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(550)
  await page.mouse.up()
  await expect(page.locator('.app')).toHaveClass(/is-editing/)
  expect(await positions()).toEqual(before)
  const add = await panel.locator('.bubble-add-position').evaluate(element => ({
    left: parseFloat((element as HTMLElement).style.left), top: parseFloat((element as HTMLElement).style.top),
  }))
  expect(before[0].top).toBe(before[1].top)
  expect(before[2].top).toBe(before[3].top)
  expect(add.top).toBe(before[2].top)
  expect(before[2].left).toBeLessThan(before[3].left)
  expect(before[3].left).toBeLessThan(add.left)
  const center = await panel.locator('.bubble-shell').evaluate(element => element.getBoundingClientRect().width / 2)
  expect((before[0].left + before[1].left) / 2).toBeCloseTo(center, 1)
  expect((before[2].left + before[3].left + add.left) / 3).toBeCloseTo(center, 1)
})

for (const [width, height] of [[1366, 768], [1920, 1080], [2560, 1440], [3840, 2160]]) {
  test(`${width}×${height}: all groups and sites fit without scrolling or pagination`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height })
    await seed(page, [6, 4, 4, 4])
    await page.goto('/')
    await expect(page).toHaveTitle('Edith 新标签页')
    await expect(page.getByRole('heading', { name: '分类 0' })).toBeVisible()
    await assertOneScreen(page)
    expect(await page.locator('.bubble-workspace [data-site-id]').count()).toBe(18)
    expect(await page.locator('vite-error-overlay').count()).toBe(0)
    expect(errors).toEqual([])
  })
}

test('new group reflows on one screen; reducing a desktop window preserves content and rejects additions', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await seed(page, [6, 4, 4, 4])
  await page.goto('/')
  await assertOneScreen(page)
  await page.getByRole('button', { name: '打开设置', exact: true }).click()
  await page.getByPlaceholder('例如：设计灵感').fill('新增分组')
  await page.getByRole('button', { name: '新建分类', exact: true }).click()
  await expect(page.locator('.module-panel')).toHaveCount(5)
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await assertOneScreen(page)
  const saved = await page.evaluate(key => localStorage.getItem(key), configKey)
  await page.setViewportSize({ width: 1000, height: 650 })
  await expect(page.locator('.bubble-workspace')).toHaveAttribute('data-capacity', 'overflow')
  await expect(page.getByText('当前窗口空间不足，已临时启用纵向滚动。请减少内容或扩大窗口。')).toBeVisible()
  expect(await page.evaluate(key => localStorage.getItem(key), configKey)).toBe(saved)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1000)
  await page.locator('.module-panel').last().scrollIntoViewIfNeeded()
  await expect(page.locator('.module-panel').last()).toBeInViewport()
  await page.getByRole('button', { name: '打开设置', exact: true }).click()
  await page.getByPlaceholder('例如：设计灵感').fill('不能添加')
  await page.getByRole('button', { name: '新建分类', exact: true }).click()
  await expect(page.locator('.capacity-form-error')).toHaveText('当前窗口空间不足，请减少内容或扩大窗口。')
  await expect(page.getByPlaceholder('例如：设计灵感')).toHaveValue('不能添加')
  await page.getByRole('combobox', { name: '所属分类', exact: true }).selectOption('0')
  await page.getByPlaceholder('站点名称').fill('不能添加的网址')
  await page.getByPlaceholder('https://example.com').fill('https://example.net')
  await page.getByRole('button', { name: '添加到「分类 0」' }).click()
  await expect(page.getByPlaceholder('站点名称')).toHaveValue('不能添加的网址')
  expect(await page.evaluate(key => localStorage.getItem(key), configKey)).toBe(saved)
  await page.setViewportSize({ width: 2560, height: 1440 })
  await page.getByRole('button', { name: '添加到「分类 0」' }).click()
  await expect(page.getByPlaceholder('站点名称')).toHaveValue('')
  await expect(page.locator('.capacity-form-error')).toHaveCount(0)
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await assertOneScreen(page)
  await expect(page.locator('.bubble-workspace [data-site-id]')).toHaveCount(19)
})

test('a legacy group wider than the window wraps all sites and restores a circle when enlarged', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 650 })
  await seed(page, [150, 2])
  await page.goto('/')
  await expect(page.locator('.bubble-workspace')).toHaveAttribute('data-capacity', 'overflow')
  await expect(page.locator('.is-rectangular')).toHaveCount(1)
  await expect(page.locator('.bubble-workspace [data-site-id]')).toHaveCount(152)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1000)
  await page.locator('.bubble-workspace [data-site-id="0-149"] a').focus()
  await expect(page.locator('.bubble-workspace [data-site-id="0-149"] a')).toBeInViewport()
  await page.setViewportSize({ width: 3840, height: 2160 })
  await assertOneScreen(page)
  await expect(page.locator('.is-rectangular')).toHaveCount(0)
})

test('CSS viewport shrink simulates browser zoom and restores without changing saved data', async ({ page }) => {
  await seed(page, [6, 4, 4, 4])
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await assertOneScreen(page)
  const saved = await page.evaluate(key => localStorage.getItem(key), configKey)
  await page.setViewportSize({ width: 1280, height: 720 })
  await expect(page.locator('.bubble-workspace')).toHaveAttribute('data-capacity', 'overflow')
  await page.setViewportSize({ width: 1920, height: 1080 })
  await assertOneScreen(page)
  expect(await page.evaluate(key => localStorage.getItem(key), configKey)).toBe(saved)
})
