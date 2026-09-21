import { expect, test, type Page, type Locator } from '@playwright/test'

const configKey = 'edith-navigation-config-v3'
const config = {
  templateId: 'beijing', accent: 'mint',
  modules: [{ id: 'a', title: '地标测试', description: '', accent: '#9ff7cd', sites: [
    { id: 'alpha', name: 'Alpha', url: 'https://beijing-target.test/alpha', description: '' },
  ] }],
}
const stage = (page: Page) => page.locator('.beijing-stage')
const icon = (page: Page) => page.locator('.beijing-stage [data-site-id="alpha"]')
async function center(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Missing visible body')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
async function ready(page: Page) {
  await page.goto('/')
  await expect(page.locator('.beijing-landmarks [data-landmark]')).toHaveCount(3)
  await expect(stage(page)).toHaveAttribute('data-paused', 'false')
  await expect.poll(async () => (await center(icon(page))).y).toBeGreaterThan(400)
}
async function drop(page: Page, x: number, y: number, release = true) {
  const point = await center(icon(page))
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.move(x, y, { steps: 8 })
  await expect(page.locator('.app')).toHaveClass(/is-site-dragging/)
  if (release) {
    await page.mouse.up()
    await expect(page.locator('.app')).not.toHaveClass(/is-site-dragging/)
  }
}

test.beforeEach(async ({ page, context }) => {
  await context.route('**/*', route => {
    if (route.request().url().startsWith('http://127.0.0.1:4179/')) return route.continue()
    if (route.request().resourceType() === 'image') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="8" fill="#88bfa5"/></svg>' })
    return route.fulfill({ contentType: route.request().resourceType() === 'script' ? 'application/javascript' : 'text/html', body: route.request().resourceType() === 'script' ? '' : '<title>Navigation target</title>' })
  })
  await page.addInitScript(({ key, initial }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial))
    localStorage.setItem('edith-navigation-onboarding-completed-v1', '1')
  }, { key: configKey, initial: config })
})

for (const [width, height] of [[1440, 1000], [390, 844], [320, 640]]) test(`line terrain fits ${width}x${height}, with no runtime errors`, async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.setViewportSize({ width, height })
  await ready(page)
  const groups = page.locator('.beijing-landmarks [data-landmark]')
  let right = 0
  for (const group of await groups.all()) {
    // CDP's boundingBox includes Bézier control points/strokes; getBBox uses actual SVG geometry.
    const box = await group.evaluate(element => {
      const g = element as SVGGraphicsElement
      const bounds = g.getBBox()
      const matrix = g.getScreenCTM()!
      const min = new DOMPoint(bounds.x, bounds.y).matrixTransform(matrix)
      const max = new DOMPoint(bounds.x + bounds.width, bounds.y + bounds.height).matrixTransform(matrix)
      const stroke = Number.parseFloat(getComputedStyle(g.querySelector('path')!).strokeWidth)
      return { left: min.x - stroke / 2, right: max.x + stroke / 2, bottom: max.y + stroke / 2, height: max.y - min.y + stroke }
    })
    // A 0.01px tolerance is only for browser floating-point transforms, not layout drift.
    expect(box.left).toBeGreaterThanOrEqual(right + 16 - 0.01)
    expect(box.right).toBeLessThanOrEqual(width - 16 + 0.01)
    expect(Math.abs(box.bottom - (height - 16))).toBeLessThan(0.01)
    expect(box.height).toBeLessThanOrEqual(height / 3 + 0.01)
    right = box.right
  }
  const edit = (await page.getByRole('button', { name: '进入编辑模式', exact: true }).boundingBox())!
  const logo = (await page.locator('.hero-logo').boundingBox())!
  expect(edit.y + edit.height).toBeLessThanOrEqual(logo.y)
  await expect(groups.first().locator('path').first()).toHaveCSS('fill', 'none')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
  expect(await page.locator('.app').evaluate(el => getComputedStyle(el, '::before').backgroundImage)).toContain('temple-of-heaven.jpg')
  const photo = await page.evaluate(async () => {
    const background = getComputedStyle(document.querySelector('.app')!, '::before')
    const image = new Image()
    image.src = background.backgroundImage.slice(5, -2)
    await image.decode()
    return { width: image.naturalWidth, height: image.naturalHeight, size: background.backgroundSize, position: background.backgroundPosition }
  })
  expect(photo).toEqual({ width: 2400, height: 1600, size: 'cover', position: '50% 50%' })
  expect(errors).toEqual([])
})

test('physical roof release, pointer cancellation, resize and orientation keep the icon available', async ({ page }) => {
  await ready(page)
  const building = (await page.locator('[data-landmark="china-zun"]').boundingBox())!
  const x = building.x + building.width / 2
  await drop(page, x, building.y + building.height / 2)
  await expect.poll(async () => (await center(icon(page))).y).toBeLessThan(building.y)
  await page.waitForTimeout(1200)
  expect((await center(icon(page))).y).toBeLessThan(building.y + 20)
  await drop(page, 300, 300, false)
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true })))
  await expect(page.locator('.app')).not.toHaveClass(/is-site-dragging/)
  await page.mouse.up()
  expect(await page.evaluate(() => localStorage.getItem('edith-navigation-usage-v1'))).toBeNull()
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size)
    await expect(page.locator('.beijing-landmarks')).toHaveAttribute('viewBox', `0 0 ${size.width} ${size.height}`)
    await expect.poll(async () => (await center(icon(page))).x).toBeLessThan(size.width)
    await expect.poll(async () => (await center(icon(page))).y).toBeLessThan(size.height)
  }
})

test('a true tap opens the real URL once; keyboard navigation works after a cancelled gesture', async ({ page, context }) => {
  await ready(page)
  const point = await center(icon(page))
  const opened = context.waitForEvent('page')
  await page.mouse.click(point.x, point.y)
  const popup = await opened
  await popup.waitForLoadState()
  expect(popup.url()).toBe(config.modules[0].sites[0].url)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('edith-navigation-usage-v1') ?? '{}'))).toEqual({ alpha: 1 })
  await popup.close()
  await expect(page.locator('.frequent-site-strip strong')).toHaveText('Alpha')
  await drop(page, 250, 450, false)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.mouse.up()
  // The shared App intentionally guards trailing clicks for 360ms after a completed drag.
  await page.waitForTimeout(400)
  await icon(page).locator('a').focus()
  const keyboardOpen = context.waitForEvent('page')
  await page.keyboard.press('Enter')
  const second = await keyboardOpen
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('edith-navigation-usage-v1') ?? '{}'))).toEqual({ alpha: 2 })
  await second.close()
})

test('edit and undo preserve other bodies; switching preserves content and removes the old canvas', async ({ page }) => {
  await ready(page)
  await page.locator('.search-form input').fill('北京测试')
  const canvas = await page.locator('.beijing-canvas').elementHandle()
  await page.getByRole('button', { name: '进入编辑模式', exact: true }).click()
  await icon(page).getByRole('button', { name: '编辑 Alpha', exact: true }).click()
  await expect(stage(page)).toHaveAttribute('data-paused', 'true')
  const position = await icon(page).getAttribute('style')
  await page.waitForTimeout(200)
  expect(await icon(page).getAttribute('style')).toBe(position)
  await page.getByPlaceholder('站点名称').fill('北京 Alpha')
  await page.getByRole('button', { name: '保存站点', exact: true }).click()
  await expect(stage(page)).toHaveAttribute('data-paused', 'false')
  expect(await canvas?.evaluate(el => el === document.querySelector('.beijing-canvas'))).toBe(true)
  await icon(page).getByRole('button', { name: '删除 北京 Alpha', exact: true }).click()
  await expect(page.locator('.beijing-stage [data-site-id]')).toHaveCount(0)
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  await expect(icon(page)).toHaveCount(1)
  await page.getByRole('button', { name: '切换模板', exact: true }).click()
  await expect(stage(page)).toHaveAttribute('data-paused', 'true')
  await page.locator('.template-option').filter({ hasText: '纯净应用网格' }).click()
  await expect(page.locator('[data-template="plain"]')).toBeVisible()
  await expect(page.locator('.beijing-canvas')).toHaveCount(0)
  await expect(page.locator('.search-form input')).toHaveValue('北京测试')
  await page.getByRole('button', { name: '切换模板', exact: true }).click()
  await page.locator('.template-option').filter({ hasText: '北京地标' }).click()
  await expect(page.locator('.beijing-canvas')).toHaveCount(1)
  await expect(icon(page).locator('.beijing-icon-name')).toHaveText('北京 Alpha')
  await page.reload()
  await expect(page.locator('.beijing-canvas')).toHaveCount(1)
})

test('asset failure has usable fallback navigation and a working retry', async ({ page }) => {
  await page.route('**/terrain/beijing-terrain.svg', route => route.fulfill({ status: 503, body: '' }))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('地形加载失败')
  await expect(page.locator('.beijing-fallback a')).toHaveAttribute('href', config.modules[0].sites[0].url)
  await expect(page.locator('.beijing-canvas, .beijing-landmarks')).toHaveCount(0)
  await page.unroute('**/terrain/beijing-terrain.svg')
  await page.getByRole('button', { name: '重试加载地形' }).click()
  await expect(page.locator('.beijing-canvas')).toHaveCount(1)
})

test('reduced-motion avoids physics and responds to changes without duplicate scenes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.beijing-fallback')).toBeVisible()
  await expect(page.locator('.beijing-canvas')).toHaveCount(0)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(page.locator('.beijing-canvas')).toHaveCount(1)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.beijing-canvas')).toHaveCount(0)
})

test('hidden pages pause and resume without stranding a pointer session', async ({ page }) => {
  await ready(page)
  await drop(page, 300, 500, false)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(stage(page)).toHaveAttribute('data-paused', 'true')
  await expect(page.locator('.app')).not.toHaveClass(/is-site-dragging/)
  const style = await icon(page).getAttribute('style')
  await page.waitForTimeout(200)
  expect(await icon(page).getAttribute('style')).toBe(style)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(stage(page)).toHaveAttribute('data-paused', 'false')
  await page.mouse.up()
})


test('two rapid pointer taps each open the correct site exactly once', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(({ key, initial }) => {
    const next = structuredClone(initial)
    next.modules[0].sites.push({ id: 'beta', name: 'Beta', url: 'https://beijing-target.test/beta', description: '' })
    localStorage.setItem(key, JSON.stringify(next))
  }, { key: configKey, initial: config })
  await ready(page)
  const beta = page.locator('.beijing-stage [data-site-id="beta"]')
  await expect.poll(async () => (await center(beta)).y).toBeGreaterThan(400)
  const positions = [await center(icon(page)), await center(beta)]
  const firstOpen = context.waitForEvent('page')
  await page.mouse.click(positions[0].x, positions[0].y)
  const first = await firstOpen
  const secondOpen = context.waitForEvent('page')
  const next = await center(beta)
  await page.mouse.click(next.x, next.y)
  const second = await secondOpen
  await Promise.all([first.waitForLoadState(), second.waitForLoadState()])
  expect(first.url()).toBe('https://beijing-target.test/alpha')
  expect(second.url()).toBe('https://beijing-target.test/beta')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('edith-navigation-usage-v1') ?? '{}'))).toEqual({ alpha: 1, beta: 1 })
})

test('mobile touch can drag, cancel without visiting, and resume a real tap', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await ready(page)
  const cdp = await context.newCDPSession(page)
  const start = await center(icon(page))
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x, y: start.y }] })
  // The icon can fall between the sample and touchStart. Dragging preserves that real grab offset.
  const held = await center(icon(page))
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 190, y: 440 }] })
  await expect(page.locator('.app')).toHaveClass(/is-site-dragging/)
  const dragged = await center(icon(page))
  expect(Math.abs(dragged.x - (190 + held.x - start.x))).toBeLessThan(2)
  expect(Math.abs(dragged.y - (440 + held.y - start.y))).toBeLessThan(2)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
  await expect(page.locator('.app')).not.toHaveClass(/is-site-dragging/)
  await page.waitForTimeout(450)
  expect(context.pages()).toHaveLength(1)
  expect(await page.evaluate(() => localStorage.getItem('edith-navigation-usage-v1'))).toBeNull()
  const point = await center(icon(page))
  const opened = context.waitForEvent('page')
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  const popup = await opened
  await popup.waitForLoadState()
  expect(popup.url()).toBe(config.modules[0].sites[0].url)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('edith-navigation-usage-v1') ?? '{}'))).toEqual({ alpha: 1 })
  await cdp.detach()
})
