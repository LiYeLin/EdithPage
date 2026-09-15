import { test, expect } from '@playwright/test'

const config = {
  templateId: 'matter',
  accent: 'mint',
  modules: [{
    id: 'matter-test',
    title: '物理测试',
    description: '',
    accent: '#9ff7cd',
    sites: [{ id: 'github', name: 'GitHub', url: 'https://github.com/', description: '' }],
  }],
}

test('非编辑态提供可访问的编辑模式入口', async ({ page }) => {
  await page.addInitScript((value) => {
    localStorage.setItem('edith-navigation-config-v3', JSON.stringify(value))
    localStorage.setItem('edith-navigation-onboarding-completed-v1', '1')
  }, config)
  await page.goto('/')

  const entry = page.getByRole('button', { name: '进入编辑模式' })
  await expect(entry).toBeVisible()
  await expect(entry).toHaveAttribute('data-onboarding-edit', 'true')
  await entry.click()

  await expect(page.locator('.app')).toHaveClass(/is-editing/)
  await expect(entry).toBeHidden()
  await expect(page.locator('[data-template="matter"] .matter-icon-actions').first()).toBeVisible()
})

test('物理图标从图片中心拖拽时不触发浏览器原生图片拖拽', async ({ page }) => {
  await page.addInitScript((value) => {
    localStorage.setItem('edith-navigation-config-v3', JSON.stringify(value))
    localStorage.setItem('edith-navigation-onboarding-completed-v1', '1')
  }, config)
  await page.goto('/')
  await page.locator('[data-template="matter"] .matter-icon-link').first().waitFor({ state: 'attached' })
  const image = page.locator('.matter-icon-link img').first()
  await expect(image).toHaveAttribute('draggable', 'false')
  await expect(image).toHaveCSS('pointer-events', 'none')
})

test('点击图标中心仍然可以打开网站并记录访问', async ({ page }) => {
  await page.addInitScript((value) => {
    localStorage.setItem('edith-navigation-config-v3', JSON.stringify(value))
    localStorage.setItem('edith-navigation-onboarding-completed-v1', '1')
  }, config)
  await page.goto('/')
  await page.locator('[data-template="matter"] .matter-icon-link').first().waitFor({ state: 'attached' })
  await page.waitForTimeout(1200)
  const icon = page.locator('[data-template="matter"] .matter-icon-link').first()
  const box = await icon.boundingBox()
  if (!box) throw new Error('物理图标未进入可点击区域')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(180)
  await page.mouse.up()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('edith-navigation-usage-v1') ?? '{}'))).toEqual({ github: 1 })
})

test('pointer capture keeps the icon following after the cursor leaves it', async ({ page }) => {
  await page.addInitScript((value) => {
    localStorage.setItem('edith-navigation-config-v3', JSON.stringify(value))
    localStorage.setItem('edith-navigation-onboarding-completed-v1', '1')
  }, config)
  await page.goto('/')
  const icon = page.locator('[data-template="matter"] .matter-icon-link').first()
  await icon.waitFor({ state: 'attached' })
  await expect.poll(async () => (await icon.boundingBox())?.y ?? -1).toBeGreaterThan(120)

  const box = await icon.boundingBox()
  if (!box) throw new Error('Missing matter icon')
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const firstTarget = { x: start.x + 180, y: start.y + 140 }
  const secondTarget = { x: start.x + 300, y: start.y + 220 }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(firstTarget.x, firstTarget.y, { steps: 12 })
  await expect(page.locator('.app')).toHaveClass(/is-site-dragging/)
  await expect.poll(async () => {
    const current = await icon.boundingBox()
    if (!current) return Number.POSITIVE_INFINITY
    return Math.hypot(current.x + current.width / 2 - firstTarget.x, current.y + current.height / 2 - firstTarget.y)
  }).toBeLessThan(20)

  await page.mouse.move(secondTarget.x, secondTarget.y, { steps: 12 })
  await expect.poll(async () => {
    const current = await icon.boundingBox()
    if (!current) return Number.POSITIVE_INFINITY
    return Math.hypot(current.x + current.width / 2 - secondTarget.x, current.y + current.height / 2 - secondTarget.y)
  }).toBeLessThan(20)

  await page.mouse.up()
  await expect(page.locator('.app')).not.toHaveClass(/is-site-dragging/)
})

test('pointer leaving the browser window releases the active drag', async ({ page }) => {
  await page.addInitScript((value) => {
    localStorage.setItem('edith-navigation-config-v3', JSON.stringify(value))
    localStorage.setItem('edith-navigation-onboarding-completed-v1', '1')
  }, config)
  await page.goto('/')
  const icon = page.locator('[data-template="matter"] .matter-icon-link').first()
  await icon.waitFor({ state: 'attached' })
  await expect.poll(async () => (await icon.boundingBox())?.y ?? -1).toBeGreaterThan(120)
  const box = await icon.boundingBox()
  if (!box) throw new Error('Missing matter icon')
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.move(point.x + 120, point.y + 80, { steps: 8 })
  await expect(page.locator('.app')).toHaveClass(/is-site-dragging/)
  await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerout', {
    bubbles: true,
    pointerId: 1,
    relatedTarget: null,
  })))
  await expect(page.locator('.app')).not.toHaveClass(/is-site-dragging/)
})

test('pointercancel 取消点击时不会打开网站或记录访问', async ({ page }) => {
  await page.addInitScript((value) => {
    localStorage.setItem('edith-navigation-config-v3', JSON.stringify(value))
    localStorage.setItem('edith-navigation-onboarding-completed-v1', '1')
  }, config)
  await page.goto('/')
  const icon = page.locator('[data-template="matter"] .matter-icon-link').first()
  await icon.waitFor({ state: 'attached' })
  await expect.poll(async () => (await icon.boundingBox())?.y ?? -1).toBeGreaterThan(120)
  const box = await icon.boundingBox()
  if (!box) throw new Error('Missing matter icon')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', {
    bubbles: true,
    pointerId: 1,
  })))

  await expect(page.locator('.app')).not.toHaveClass(/is-site-dragging/)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('edith-navigation-usage-v1') ?? '{}'))).toEqual({})
})

test('窗口失焦取消点击时不会打开网站或记录访问', async ({ page }) => {
  await page.addInitScript((value) => {
    localStorage.setItem('edith-navigation-config-v3', JSON.stringify(value))
    localStorage.setItem('edith-navigation-onboarding-completed-v1', '1')
  }, config)
  await page.goto('/')
  const icon = page.locator('[data-template="matter"] .matter-icon-link').first()
  await icon.waitFor({ state: 'attached' })
  await expect.poll(async () => (await icon.boundingBox())?.y ?? -1).toBeGreaterThan(120)
  const box = await icon.boundingBox()
  if (!box) throw new Error('Missing matter icon')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))

  await expect(page.locator('.app')).not.toHaveClass(/is-site-dragging/)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('edith-navigation-usage-v1') ?? '{}'))).toEqual({})
})

test('页面隐藏取消点击时不会打开网站或记录访问', async ({ page }) => {
  await page.addInitScript((value) => {
    localStorage.setItem('edith-navigation-config-v3', JSON.stringify(value))
    localStorage.setItem('edith-navigation-onboarding-completed-v1', '1')
  }, config)
  await page.goto('/')
  const icon = page.locator('[data-template="matter"] .matter-icon-link').first()
  await icon.waitFor({ state: 'attached' })
  await expect.poll(async () => (await icon.boundingBox())?.y ?? -1).toBeGreaterThan(120)
  const box = await icon.boundingBox()
  if (!box) throw new Error('Missing matter icon')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })

  await expect(page.locator('.app')).not.toHaveClass(/is-site-dragging/)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('edith-navigation-usage-v1') ?? '{}'))).toEqual({})
})

test('仅 hover 图标时显示网站名称', async ({ page }) => {
  await page.addInitScript((value) => {
    localStorage.setItem('edith-navigation-config-v3', JSON.stringify(value))
    localStorage.setItem('edith-navigation-onboarding-completed-v1', '1')
  }, config)
  await page.goto('/')
  const icon = page.locator('[data-template="matter"] .matter-icon-link').first()
  const name = icon.locator('.matter-icon-name')
  await icon.waitFor({ state: 'attached' })

  await expect(name).toHaveText('GitHub')
  await expect(name).toHaveCSS('visibility', 'hidden')
  await expect(name).toHaveCSS('opacity', '0')

  await icon.hover()
  await expect(name).toHaveCSS('visibility', 'visible')
  await expect(name).toHaveCSS('opacity', '1')
})

test('真实点击物理图标会打开新页面，不只是记录访问', async ({ page, context }) => {
  const targetUrl = 'https://matter-navigation-target.test/'
  const targetConfig = structuredClone(config)
  targetConfig.modules[0].sites[0].url = targetUrl
  await context.route(`${targetUrl}**`, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>target</title>' }))
  await page.addInitScript((value) => {
    localStorage.setItem('edith-navigation-config-v3', JSON.stringify(value))
    localStorage.setItem('edith-navigation-onboarding-completed-v1', '1')
  }, targetConfig)
  await page.goto('/')
  const icon = page.locator('[data-template="matter"] .matter-icon-link').first()
  await icon.waitFor({ state: 'attached' })
  await expect.poll(async () => (await icon.boundingBox())?.y ?? -1).toBeGreaterThan(120)
  const box = await icon.boundingBox()
  if (!box) throw new Error('Missing matter icon')

  const popupPromise = context.waitForEvent('page', { timeout: 3_000 })
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  const popup = await popupPromise
  await popup.waitForLoadState()
  expect(new URL(popup.url()).origin).toBe(new URL(targetUrl).origin)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('edith-navigation-usage-v1') ?? '{}'))).toEqual({ github: 1 })
  await popup.close()
})

for (const interruption of ['pointercancel', 'blur', 'visibilitychange'] as const) test(`取消后的 trailing click 不会导航：${interruption}`, async ({ page, context }) => {
  const targetUrl = 'https://matter-cancel-target.test/'
  const targetConfig = structuredClone(config)
  targetConfig.modules[0].sites[0].url = targetUrl
  await context.route(`${targetUrl}**`, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>target</title>' }))
  await page.addInitScript((value) => {
    localStorage.setItem('edith-navigation-config-v3', JSON.stringify(value))
    localStorage.setItem('edith-navigation-onboarding-completed-v1', '1')
  }, targetConfig)
  await page.goto('/')
  const icon = page.locator('[data-template="matter"] .matter-icon-link').first()
  await icon.waitFor({ state: 'attached' })
  await expect.poll(async () => (await icon.boundingBox())?.y ?? -1).toBeGreaterThan(120)
  const box = await icon.boundingBox()
  if (!box) throw new Error('Missing matter icon')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.evaluate((kind) => {
    if (kind === 'pointercancel') window.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }))
    else if (kind === 'blur') window.dispatchEvent(new Event('blur'))
    else {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
    }
  }, interruption)

  const popupPromise = context.waitForEvent('page', { timeout: 500 }).catch(() => null)
  await icon.locator('a').evaluate((anchor) => (anchor as HTMLAnchorElement).click())
  expect(await popupPromise).toBeNull()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('edith-navigation-usage-v1') ?? '{}'))).toEqual({})
})
